/**
 * Radar data pipeline for the /radar page:
 *
 *   ObserverState
 *       -> AircraftDataProvider.getSnapshot()   (raw geographic telemetry)
 *       -> projectFleet()                       (observer-relative distance/bearing/x,y)
 *       -> RadarTarget[]                         ("Radar State", ready to render)
 *       -> Renderer (RadarSimulation.astro)
 *
 * SimulationAircraftProvider is the only provider wired up today. A future
 * RealAdsbProvider only has to implement AircraftDataProvider — nothing else
 * in this pipeline, or the UI, needs to change. There is intentionally no
 * data-source selector anywhere: the active provider is a fixed code-level
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

/** Full-scale radar range mapped to the outer ring. */
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
  registration: string;
  airline: string;
  /** degrees */
  latitude: number;
  /** degrees */
  longitude: number;
  /** feet */
  altitude: number;
  /** knots */
  groundSpeed: number;
  /** compass degrees, 0-359 */
  heading: number;
  /** feet per minute, positive = climbing */
  verticalRate: number;
  /** epoch ms of the last telemetry report */
  lastUpdated: number;
}

// ---------------------------------------------------------------------------
// Radar target — an aircraft snapshot plus everything derived from it once
// an observer location is known. This is the "Radar State" the renderer
// consumes; nothing upstream of this knows about the observer.
// ---------------------------------------------------------------------------

export interface RadarTarget extends AircraftSnapshot {
  /** nautical miles from the observer */
  distance: number;
  /** compass degrees from the observer, 0 = north */
  bearing: number;
  /** nautical miles, +east of the observer */
  x: number;
  /** nautical miles, +north of the observer */
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

/**
 * Projects a fleet snapshot into observer-relative distance/bearing/x/y.
 * Pure function — returns a fresh, small array every call. The fleet here
 * is at most a handful of aircraft, so this is not the "large numbers of
 * objects per frame" case; the render loop is where persistent state
 * (screen position, sweep brightness) actually needs to be reused, and it
 * owns that separately.
 */
export function projectFleet(observer: ObserverState, snapshots: AircraftSnapshot[]): RadarTarget[] {
  return snapshots.map((snapshot) => {
    const distance = haversineDistanceNm(observer, snapshot);
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
