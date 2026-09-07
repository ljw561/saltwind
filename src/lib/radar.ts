/**
 * Radar data pipeline for the /radar page:
 *
 *   ObserverState
 *       -> AircraftDataProvider.getSnapshot()   (raw geographic telemetry)
 *       -> projectFleet()                       (observer-relative distance/bearing/x,y)
 *       -> RadarTarget[]                         ("Radar State", ready to render)
 *       -> Renderer (RadarSimulation.astro)
 *
 * SimulationAircraftProvider is the only AircraftDataProvider wired up today.
 * RadarSimulation.astro currently gets its live data a different way — it
 * fetches /api/aircraft (a same-origin Cloudflare Pages Function proxying
 * opendata.adsb.fi, see functions/api/aircraft.ts) directly on its own data
 * clock and calls normalizeAdsbAircraft/normalizeAircraftResponse below to
 * turn the response into AircraftSnapshot[] — there is no RealAdsbProvider
 * class; this is deliberately just a fetch + a plain mapping function, not a
 * second AircraftDataProvider implementation. A future RealAdsbProvider
 * could still wrap the same normalization functions and implement
 * AircraftDataProvider if that abstraction is ever needed here — nothing
 * below is structured in a way that would block it. There is intentionally
 * no data-source selector anywhere: the active source is a fixed code-level
 * choice, not a user-facing option.
 */

// ---------------------------------------------------------------------------
// Observer
// ---------------------------------------------------------------------------

export interface ObserverState {
  /** degrees, -90..90 */
  latitude: number;
  /** degrees, -180..180 */
  longitude: number;
}

/** Default demo location (Taipei). Purely a starting point — the user can edit it. */
export const DEFAULT_OBSERVER: ObserverState = { latitude: 25.033, longitude: 121.5654 };

/**
 * Default wander radius (nautical miles) for SimulationAircraftProvider's own
 * internal fleet — how far the simulated aircraft roam from their origin.
 * This is a simulator seeding detail, not the radar display's range: the
 * user-facing "how far out does the screen show" control is separate,
 * runtime UI state owned by the renderer, purely a display/projection
 * concern layered on top of this data.
 */
export const DEFAULT_RANGE_NM = 40;

export function clampObserver(observer: ObserverState): ObserverState {
  return {
    latitude: clamp(observer.latitude, -90, 90),
    longitude: clamp(observer.longitude, -180, 180),
  };
}

// ---------------------------------------------------------------------------
// Aircraft snapshot — provider-agnostic, purely geographic. This is the
// shape any AircraftDataProvider (simulated or real) must produce; it has no
// idea where the observer is.
// ---------------------------------------------------------------------------

export interface AircraftSnapshot {
  id: string;
  callsign: string;
  /** undefined when the source doesn't have it — never fabricated; render "—" */
  registration?: string;
  /** undefined when the source doesn't have it — never fabricated; render "—" */
  airline?: string;
  /** degrees */
  latitude: number;
  /** degrees */
  longitude: number;
  /** feet; undefined if the source didn't report it */
  altitude?: number;
  /** knots; undefined if the source didn't report it */
  groundSpeed?: number;
  /** compass degrees, 0-359; undefined if the source didn't report it */
  heading?: number;
  /** feet per minute, positive = climbing; undefined if the source didn't report it */
  verticalRate?: number;
  /** epoch ms of the last telemetry report */
  lastUpdated: number;
}

// ---------------------------------------------------------------------------
// ADS-B normalization — turns one raw adsb.fi ("readsb"-schema) aircraft
// object, or a whole /api/aircraft response, into AircraftSnapshot(s). Just
// plain functions, not a provider/class: RadarSimulation.astro owns the
// fetch and its own refresh timing; this only knows the upstream field
// mapping, so there's exactly one place that mapping lives.
// ---------------------------------------------------------------------------

/** Raw shape of one entry in adsb.fi's "aircraft" array — only the fields we read. */
export interface RawAdsbAircraft {
  hex?: string;
  flight?: string;
  r?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
  alt_geom?: number;
  gs?: number;
  track?: number;
  baro_rate?: number;
  geom_rate?: number;
  seen_pos?: number;
  seen?: number;
}

/** Reject a position report older than this — matches the verified M5Dial threshold. */
const POSITION_MAX_AGE_SEC = 60;

/**
 * Normalizes one raw adsb.fi aircraft object into an AircraftSnapshot, or
 * null if it's missing a required field (icao24 hex, lat/lon) or its
 * position report is too stale to trust (> POSITION_MAX_AGE_SEC). Never
 * guesses: a field the upstream didn't send (airline always, registration
 * sometimes, occasionally altitude/speed/heading/vertical rate) comes back
 * `undefined`, not 0/NaN/a fabricated value — callers render that as "—".
 */
export function normalizeAdsbAircraft(raw: RawAdsbAircraft, now: number): AircraftSnapshot | null {
  if (typeof raw.hex !== 'string' || raw.hex.length === 0) return null;
  if (typeof raw.lat !== 'number' || typeof raw.lon !== 'number') return null;
  if (!Number.isFinite(raw.lat) || !Number.isFinite(raw.lon)) return null;

  // seen_pos (age of the position report itself) is preferred; seen (age of
  // any message) is the fallback — same priority M5Dial uses.
  const positionAgeSec = typeof raw.seen_pos === 'number' ? raw.seen_pos
    : typeof raw.seen === 'number' ? raw.seen
    : null;
  if (positionAgeSec === null || positionAgeSec < 0 || positionAgeSec > POSITION_MAX_AGE_SEC) {
    return null;
  }

  const rawCallsign = typeof raw.flight === 'string' ? raw.flight.trim() : '';
  const callsign = rawCallsign.length > 0 ? rawCallsign : raw.hex;

  const registration = typeof raw.r === 'string' && raw.r.trim().length > 0 ? raw.r.trim() : undefined;

  // alt_baro can also legitimately be the string "ground" (on the ramp) —
  // typeof-number-guarded here so that falls through to alt_geom / undefined
  // rather than being coerced into a bogus number.
  const altitude = typeof raw.alt_baro === 'number' ? raw.alt_baro
    : typeof raw.alt_geom === 'number' ? raw.alt_geom
    : undefined;

  const verticalRate = typeof raw.baro_rate === 'number' ? raw.baro_rate
    : typeof raw.geom_rate === 'number' ? raw.geom_rate
    : undefined;

  return {
    id: raw.hex,
    callsign,
    registration,
    airline: undefined, // no reliable upstream field for this — never guessed
    latitude: raw.lat,
    longitude: raw.lon,
    altitude,
    groundSpeed: typeof raw.gs === 'number' ? raw.gs : undefined,
    heading: typeof raw.track === 'number' ? raw.track : undefined,
    verticalRate,
    lastUpdated: now - positionAgeSec * 1000,
  };
}

/**
 * Normalizes a whole /api/aircraft response body into AircraftSnapshot[].
 * Accepts either adsb.fi's documented `{"aircraft": [...]}` key or the
 * older/alternate `{"ac": [...]}` some readsb-based deployments use;
 * anything else (or a malformed entry) is skipped rather than thrown on —
 * one bad entry never fails the whole fetch. No observer, no range, no
 * distance filtering happens here — see RadarSimulation.astro for the
 * MAX_AIRCRAFT safety cap and the render-time radarRangeKm filtering.
 */
export function normalizeAircraftResponse(data: unknown, now: number): AircraftSnapshot[] {
  const body = data as { aircraft?: unknown; ac?: unknown } | null | undefined;
  const list = Array.isArray(body?.aircraft) ? body!.aircraft : Array.isArray(body?.ac) ? body!.ac : [];

  const normalized: AircraftSnapshot[] = [];
  for (const raw of list) {
    if (raw && typeof raw === 'object') {
      const entry = normalizeAdsbAircraft(raw as RawAdsbAircraft, now);
      if (entry) normalized.push(entry);
    }
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Radar target — an aircraft snapshot plus everything derived from it once
// an observer location is known. This is the "Radar State" the renderer
// consumes; nothing upstream of this knows about the observer.
// ---------------------------------------------------------------------------

export interface RadarTarget extends AircraftSnapshot {
  /** kilometres from the observer */
  distance: number;
  /** compass degrees from the observer, 0 = north */
  bearing: number;
  /** kilometres, +east of the observer */
  x: number;
  /** kilometres, +north of the observer */
  y: number;
}

const NM_PER_DEGREE_LAT = 60;
const EARTH_RADIUS_NM = 3440.065;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Great-circle distance in nautical miles (haversine). */
export function haversineDistanceNm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial great-circle bearing in compass degrees (0-360, 0 = north) from a to b. */
export function initialBearing(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Nautical miles to kilometres — the one place that unit conversion happens. */
export const NM_TO_KM = 1.852;

/**
 * Projects a fleet snapshot into observer-relative distance/bearing/x/y.
 * Pure function — returns a fresh, small array every call. The fleet here
 * is at most a handful of aircraft, so this is not the "large numbers of
 * objects per frame" case; the render loop is where persistent state
 * (screen position, sweep brightness) actually needs to be reused, and it
 * owns that separately.
 *
 * The underlying great-circle math is nautical-mile-based (haversineDistanceNm),
 * but everything this function outputs — distance, x, y — is kilometres: the
 * one unit the radar display (range slider, distance rings, Aircraft Info)
 * uses for position, so there's never a mix of NM/km on screen.
 */
export function projectFleet(observer: ObserverState, snapshots: AircraftSnapshot[]): RadarTarget[] {
  return snapshots.map((snapshot) => {
    const distance = haversineDistanceNm(observer, snapshot) * NM_TO_KM;
    const bearing = initialBearing(observer, snapshot);
    const bearingRad = toRad(bearing);
    return {
      ...snapshot,
      distance,
      bearing,
      x: distance * Math.sin(bearingRad),
      y: distance * Math.cos(bearingRad),
    };
  });
}

// ---------------------------------------------------------------------------
// AircraftDataProvider — the abstraction a real ADS-B source would implement.
// ---------------------------------------------------------------------------

export interface AircraftDataProvider {
  /** Render clock: advance any internal motion model by dtMs. A no-op is valid (e.g. a provider that only polls). */
  tick(dtMs: number): void;
  /** Data clock: (re)generate or (re)fetch telemetry. May be async for network-backed providers. */
  refresh(now: number): void | Promise<void>;
  /** Current snapshot, independent of any observer. */
  getSnapshot(): AircraftSnapshot[];
}

// ---------------------------------------------------------------------------
// SimulationAircraftProvider — today's only provider. Simulates a small
// fleet by dead-reckoning in its own local coordinates (unrelated to any
// observer), then reports each aircraft's position back out as lat/lon,
// exactly like a real provider would.
// ---------------------------------------------------------------------------

interface SimulatedAircraft extends AircraftSnapshot {
  // AircraftSnapshot widened these to optional for real (possibly-partial)
  // ADS-B data — narrowed back to required here since the simulation always
  // generates every one of them.
  registration: string;
  airline: string;
  altitude: number;
  groundSpeed: number;
  heading: number;
  verticalRate: number;

  /** nm, +east of this provider's internal reference point */
  simX: number;
  /** nm, +north of this provider's internal reference point */
  simY: number;
  /** nm/ms, +east */
  vx: number;
  /** nm/ms, +north */
  vy: number;
}

const AIRLINES = [
  { name: 'Windward Air', code: 'WWD' },
  { name: 'Bluecoast Airways', code: 'BCA' },
  { name: 'Northline Cargo', code: 'NLC' },
  { name: 'Skyline Regional', code: 'SKR' },
  { name: 'Coral Air Freight', code: 'CRA' },
  { name: 'Highland Jet', code: 'HGJ' },
  { name: 'Tidewater Express', code: 'TWX' },
];

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomRegistration(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const pick = (n: number) =>
    Array.from({ length: n }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  return `N${Math.floor(randomBetween(100, 999))}${pick(2)}`;
}

/** Knots (nautical miles/hour) to nautical miles/millisecond. */
function knotsToNmPerMs(knots: number): number {
  return knots / 3_600_000;
}

function velocityFromHeading(groundSpeed: number, heading: number): { vx: number; vy: number } {
  const speed = knotsToNmPerMs(groundSpeed);
  const rad = toRad(heading);
  return { vx: speed * Math.sin(rad), vy: speed * Math.cos(rad) };
}

export class SimulationAircraftProvider implements AircraftDataProvider {
  private fleet: SimulatedAircraft[];
  private readonly originLat: number;
  private readonly originLon: number;
  private readonly rangeNm: number;

  constructor(count: number, origin: ObserverState, rangeNm: number) {
    this.originLat = origin.latitude;
    this.originLon = origin.longitude;
    this.rangeNm = rangeNm;
    this.fleet = Array.from({ length: count }, (_, i) => this.createAircraft(`sim-${i}`));
  }

  private localToLatLon(x: number, y: number): { latitude: number; longitude: number } {
    const latitude = this.originLat + y / NM_PER_DEGREE_LAT;
    const longitude = this.originLon + x / (NM_PER_DEGREE_LAT * Math.cos(toRad(this.originLat)));
    return { latitude, longitude };
  }

  private createAircraft(id: string): SimulatedAircraft {
    const airline = AIRLINES[Math.floor(Math.random() * AIRLINES.length)];
    const angle = Math.random() * Math.PI * 2;
    const radius = randomBetween(this.rangeNm * 0.15, this.rangeNm * 0.95);
    const simX = radius * Math.sin(angle);
    const simY = radius * Math.cos(angle);
    const heading = Math.floor(randomBetween(0, 360));
    const groundSpeed = Math.floor(randomBetween(180, 480));
    const { vx, vy } = velocityFromHeading(groundSpeed, heading);
    const { latitude, longitude } = this.localToLatLon(simX, simY);

    return {
      id,
      callsign: `${airline.code}${Math.floor(randomBetween(100, 999))}`,
      registration: randomRegistration(),
      airline: airline.name,
      latitude,
      longitude,
      altitude: Math.round(randomBetween(8000, 39000) / 100) * 100,
      groundSpeed,
      heading,
      verticalRate: Math.floor(randomBetween(-1500, 1500)),
      lastUpdated: Date.now(),
      simX,
      simY,
      vx,
      vy,
    };
  }

  /** Render clock: dead-reckon local position, bounce off the range edge, re-derive lat/lon. */
  tick(dtMs: number): void {
    for (const ac of this.fleet) {
      ac.simX += ac.vx * dtMs;
      ac.simY += ac.vy * dtMs;

      const r = Math.hypot(ac.simX, ac.simY);
      if (r > this.rangeNm) {
        const nx = ac.simX / r;
        const ny = ac.simY / r;
        const outward = ac.vx * nx + ac.vy * ny;
        if (outward > 0) {
          ac.vx -= 2 * outward * nx;
          ac.vy -= 2 * outward * ny;
        }
        ac.simX = nx * this.rangeNm;
        ac.simY = ny * this.rangeNm;
      }

      const { latitude, longitude } = this.localToLatLon(ac.simX, ac.simY);
      ac.latitude = latitude;
      ac.longitude = longitude;
    }
  }

  /** Data clock: simulate a fresh telemetry report — the seam a real provider would replace. */
  refresh(now: number): void {
    for (const ac of this.fleet) {
      ac.altitude = Math.max(1000, ac.altitude + Math.round(randomBetween(-200, 200)));
      ac.verticalRate = Math.round(clamp(ac.verticalRate + randomBetween(-150, 150), -2000, 2000));
      ac.groundSpeed = Math.max(120, Math.round(ac.groundSpeed + randomBetween(-8, 8)));
      ac.heading = (ac.heading + randomBetween(-4, 4) + 360) % 360;

      const { vx, vy } = velocityFromHeading(ac.groundSpeed, ac.heading);
      ac.vx = vx;
      ac.vy = vy;
      ac.lastUpdated = now;
    }
  }

  getSnapshot(): AircraftSnapshot[] {
    // Same persistent objects every call — no per-frame allocation.
    return this.fleet;
  }
}
