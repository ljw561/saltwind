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
 */

const UPSTREAM_BASE = 'https://opendata.adsb.fi/api/v2/lat';
// Fixed at 55 NM (~101.9 km) — covers the radar's max 100km display range
// regardless of what the user has the range slider set to. The slider only
// filters what's already been fetched (see RadarSimulation.astro); it never
// changes this upstream query radius, so dragging it never triggers a
// re-fetch or a different-radius request.
const UPSTREAM_RADIUS_NM = 55;
const UPSTREAM_TIMEOUT_MS = 10_000;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const onRequestGet = async ({ request }: { request: Request }): Promise<Response> => {
  try {
    const url = new URL(request.url);
    const latRaw = url.searchParams.get('lat');
    const lonRaw = url.searchParams.get('lon');

    const lat = latRaw !== null ? Number(latRaw) : NaN;
    const lon = lonRaw !== null ? Number(lonRaw) : NaN;

    const latValid = Number.isFinite(lat) && lat >= -90 && lat <= 90;
    const lonValid = Number.isFinite(lon) && lon >= -180 && lon <= 180;

    // Client only ever supplies lat/lon — never the upstream URL, hostname,
    // provider, or radius; those are fixed here, server-side.
    if (!latValid || !lonValid) {
      return jsonError('invalid_location', 400);
    }

    const upstreamUrl = `${UPSTREAM_BASE}/${lat}/lon/${lon}/dist/${UPSTREAM_RADIUS_NM}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, { signal: controller.signal });
    } catch {
      // Network error, timeout (AbortController), DNS failure, etc.
      return jsonError('upstream_unreachable', 502);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!upstreamResponse.ok) {
      return jsonError('upstream_error', 502);
    }

    let data: unknown;
    try {
      data = await upstreamResponse.json();
    } catch {
      return jsonError('invalid_upstream_response', 502);
    }

    // First version: pass upstream's JSON through as-is (see doc comment).
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    // Defensive catch-all: never let an unexpected error leak a stack trace
    // or raw HTML error page to the client.
    return jsonError('internal_error', 502);
  }
};
