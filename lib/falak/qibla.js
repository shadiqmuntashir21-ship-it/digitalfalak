import { normalize180, normalize360, toDeg, toRad } from "./math.js";
import { solarPositionAt } from "./solar.js";

export const KAABA = { latitude: 21.4225, longitude: 39.8262 };

export function qiblaBearing(latitude, longitude) {
  const phi1 = toRad(latitude);
  const phi2 = toRad(KAABA.latitude);
  const deltaLambda = toRad(KAABA.longitude - longitude);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return normalize360(toDeg(Math.atan2(y, x)));
}

export function greatCircleDistanceKm(latitude, longitude) {
  const r = 6371.0088;
  const p1 = toRad(latitude);
  const p2 = toRad(KAABA.latitude);
  const dp = toRad(KAABA.latitude - latitude);
  const dl = toRad(KAABA.longitude - longitude);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findRashdulQibla({ date, latitude, longitude, timezone }) {
  const target = qiblaBearing(latitude, longitude);
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);

  const samples = [];
  for (let minute = 0; minute <= 1440; minute += 4) {
    const d = new Date(base.getTime() + minute * 60000);
    const sun = solarPositionAt({ date: d, latitude, longitude, timezone });
    if (sun.altitude > 1) {
      const delta = normalize180(sun.azimuth - target);
      samples.push({ minute, delta, altitude: sun.altitude });
    }
  }

  const roots = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (Math.abs(a.delta) > 90 || Math.abs(b.delta) > 90) continue;
    if (a.delta === 0 || a.delta * b.delta < 0) {
      let lo = a.minute;
      let hi = b.minute;
      for (let j = 0; j < 18; j++) {
        const mid = (lo + hi) / 2;
        const dm = new Date(base.getTime() + mid * 60000);
        const delta = normalize180(solarPositionAt({ date: dm, latitude, longitude, timezone }).azimuth - target);
        const dlo = normalize180(solarPositionAt({ date: new Date(base.getTime() + lo * 60000), latitude, longitude, timezone }).azimuth - target);
        if (dlo * delta <= 0) hi = mid;
        else lo = mid;
      }
      const minute = (lo + hi) / 2;
      const d = new Date(base.getTime() + minute * 60000);
      const sun = solarPositionAt({ date: d, latitude, longitude, timezone });
      if (sun.altitude > 1) roots.push({ date: d, altitude: sun.altitude, azimuth: sun.azimuth });
    }
  }
  return roots.slice(0, 2);
}
