/**
 * Cloudflare Pages Function: GET /api/aircraft?lat=..&lon=..
 *
 * Same-origin server-side proxy to opendata.adsb.fi's public "near a point"
 * endpoint. Exists purely to work around adsb.fi not sending CORS headers
 * (confirmed via a live request — see radar.ts's ADS-B normalization doc
 * comment) — there is no API key/token/secret involved on either side of
 * this proxy, adsb.fi's endpoint is public and unauthenticated.
 *
 * This does NOT normalize the response into this app's AircraftSnapshot
 * shape — it hands back upstream's JSON as-is. Normalization lives once,
 * client-side, in src/lib/radar.ts (normalizeAircraftResponse), so there is
 * exactly one place that knows the upstream field mapping, not one on the
 * server and a second, potentially-diverging one on the client.
 *
 * Abuse protection is split across two layers, deliberately:
 *  - Caching + a fixed, client-uncontrollable upstream query (this file) —
 *    cuts down *repeat* requests from hitting adsb.fi at all.
 *  - A Cloudflare Rate Limiting Rule on /api/aircraft, configured in the
 *    dashboard (Security -> WAF -> Rate limiting rules), not in code — see
 *    the report for the exact rule. CORS is same-origin here but is NOT a
 *    security boundary (curl/Node/Python ignore it entirely); the rate
 *    limit + cache + fixed upstream + input validation are what actually
 *    bound abuse.
 */

// Minimal local ambient type for the Cache API (`caches.default`), just the
// two methods this file uses — avoids pulling in @cloudflare/workers-types
// as a new dependency for one global.
interface CFCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}
declare const caches: { default: CFCache };

const UPSTREAM_BASE = 'https://opendata.adsb.fi/api/v2/lat';
// Fixed at 55 NM (~101.9 km) — covers the radar's max 100km display range
// regardless of what the user has the range slider set to. The slider only
// filters what's already been fetched (see RadarSimulation.astro); it never
// changes this upstream query radius, so dragging it never triggers a
// re-fetch or a different-radius request. The client cannot override this —
// there is no radius/dist request parameter read anywhere below.
const UPSTREAM_RADIUS_NM = 55;
const UPSTREAM_TIMEOUT_MS = 10_000;

// Edge cache lifetime for a successful response. ADS-B positions move
// quickly enough that this is intentionally short — long enough to let
// several browsers near the same spot within a few seconds share one
// upstream fetch, short enough that nobody is ever looking at meaningfully
// stale traffic. RadarSimulation.astro's own data clock is 15s; this must
// stay below that or a client's *own* refreshes would sometimes replay a
// cached response instead of getting a new one.
const CACHE_TTL_SECONDS = 10;

// Cache-key quantization: requests are rounded to this many degrees before
// being used as the cache key (NOT for the actual upstream query center or
// for anything the radar renders — see quantizeForCacheKey below). 0.01° is
// ~1.11km of latitude everywhere, and ~1.01km of longitude at this app's
// default ~25°N latitude (less further from the equator, e.g. ~0.79km at
// 45°N) — i.e. the upstream query center this causes to be reused across
// nearby requests can be off from the true observer by at most ~0.5-0.7km
// in the worst case (half a grid cell). Against a 55NM (~102km) query
// radius that's under 1% — far too small to change which aircraft show up
// except for one that was already sitting almost exactly on the query
// boundary. A coarser grid (e.g. 0.02-0.05°) would improve cache hit rates
// further, at correspondingly larger (still small) worst-case offsets;
// 0.01° is the conservative starting point.
const CACHE_COORD_STEP = 0.01;
const CACHE_COORD_DECIMALS = 2; // must match CACHE_COORD_STEP's precision

function quantizeForCacheKey(value: number): string {
  return (Math.round(value / CACHE_COORD_STEP) * CACHE_COORD_STEP).toFixed(CACHE_COORD_DECIMALS);
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const onRequestGet = async ({
  request,
  waitUntil,
}: {
  request: Request;
  waitUntil: (promise: Promise<unknown>) => void;
}): Promise<Response> => {
  try {
    const url = new URL(request.url);
    const latRaw = url.searchParams.get('lat');
    const lonRaw = url.searchParams.get('lon');

    const lat = latRaw !== null ? Number(latRaw) : NaN;
    const lon = lonRaw !== null ? Number(lonRaw) : NaN;

    const latValid = Number.isFinite(lat) && lat >= -90 && lat <= 90;
    const lonValid = Number.isFinite(lon) && lon >= -180 && lon <= 180;

    // Client only ever supplies lat/lon — never the upstream URL, hostname,
    // provider, or radius; those are fixed here, server-side. Validation
    // failures are never cached (there's no cache key to build for them
    // anyway, since a stable key needs a valid coordinate).
    if (!latValid || !lonValid) {
      return jsonError('invalid_location', 400);
    }

    // Cache key: the request's own pathname with lat/lon replaced by their
    // quantized form, so nearby-but-not-identical observers (and repeat
    // requests from the same one) share an entry. This key is ONLY used for
    // the edge cache lookup and the upstream query center below — the radar
    // itself always projects/renders using the browser's exact, unquantized
    // observer coordinates (see RadarSimulation.astro / projectFleet); this
    // function never sees or affects that precision.
    const cacheUrl = new URL(request.url);
    cacheUrl.search = '';
    cacheUrl.searchParams.set('lat', quantizeForCacheKey(lat));
    cacheUrl.searchParams.set('lon', quantizeForCacheKey(lon));
    const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }

    const upstreamUrl = `${UPSTREAM_BASE}/${lat}/lon/${lon}/dist/${UPSTREAM_RADIUS_NM}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, { signal: controller.signal });
    } catch {
      // Network error, timeout (AbortController), DNS failure, etc. Never cached.
      return jsonError('upstream_unreachable', 502);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!upstreamResponse.ok) {
      // Upstream 4xx/5xx — never cached, so the next request tries again
      // rather than being stuck replaying a failure for CACHE_TTL_SECONDS.
      return jsonError('upstream_error', 502);
    }

    let data: unknown;
    try {
      data = await upstreamResponse.json();
    } catch {
      return jsonError('invalid_upstream_response', 502);
    }

    // Only a fully successful, valid-JSON response ever reaches here — this
    // is the one path that writes to the cache.
    const response = new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        // Informational for any downstream/browser cache; the Cache API
        // call below is what actually makes Cloudflare's edge cache this —
        // Cache-Control headers alone are not reliably honored for a
        // Function's dynamic response without it (see report).
        'cache-control': `public, max-age=${CACHE_TTL_SECONDS}`,
      },
    });

    // Don't block the response on the cache write.
    waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  } catch {
    // Defensive catch-all: never let an unexpected error leak a stack trace
    // or raw HTML error page to the client.
    return jsonError('internal_error', 502);
  }
};
