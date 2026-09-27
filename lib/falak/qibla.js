import GeographicLib from "geographiclib-geodesic";
import { evaluateFormula } from "./formula-engine.js";
import { normalize180, normalize360 } from "./math.js";
import { solarPositionAt } from "./solar.js";

export const KAABA = { latitude: 21.422487, longitude: 39.826206 };
const WGS84 = GeographicLib.Geodesic.WGS84;

export function qiblaGeodesic(latitude, longitude, formulas = []) {
  const result = WGS84.Inverse(
    latitude,
    longitude,
    KAABA.latitude,
    KAABA.longitude
  );

  const custom = (formulas || []).find(
    (item) => item.slot === "qibla_bearing" && item.is_enabled !== false
  );

  if (custom?.expression) {
    try {
      const bearing = evaluateFormula(custom.expression, {
        lat: Number(latitude),
        lon: Number(longitude),
        kaaba_lat: KAABA.latitude,
        kaaba_lon: KAABA.longitude,
      });
      return {
        bearing: normalize360(bearing),
        finalBearing: normalize360(result.azi2),
        distanceKm: result.s12 / 1000,
        model: "Custom formula",
      };
    } catch {
      // Fall through to the robust geodesic baseline.
    }
  }

  return {
    bearing: normalize360(result.azi1),
    finalBearing: normalize360(result.azi2),
    distanceKm: result.s12 / 1000,
    model: "WGS84",
  };
}

export function qiblaBearing(latitude, longitude, formulas = []) {
  return qiblaGeodesic(latitude, longitude, formulas).bearing;
}

export function findRashdulQibla({
  date,
  latitude,
  longitude,
  timezone,
}) {
  const target = qiblaBearing(latitude, longitude);
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);
  const samples = [];

  for (let minute = 0; minute <= 1440; minute += 4) {
    const d = new Date(base.getTime() + minute * 60000);
    const sun = solarPositionAt({ date: d, latitude, longitude, timezone });
    if (sun.altitude > 1) {
      samples.push({
        minute,
        diff: normalize180(sun.azimuth - target),
        altitude: sun.altitude,
      });
    }
  }

  const roots = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (Math.abs(a.diff) > 90 || Math.abs(b.diff) > 90) continue;
    if (a.diff * b.diff <= 0) {
      let lo = a.minute;
      let hi = b.minute;
      for (let j = 0; j < 20; j++) {
        const mid = (lo + hi) / 2;
        const dm = new Date(base.getTime() + mid * 60000);
        const diffMid = normalize180(
          solarPositionAt({ date: dm, latitude, longitude, timezone }).azimuth - target
        );
        const dlo = new Date(base.getTime() + lo * 60000);
        const diffLo = normalize180(
          solarPositionAt({ date: dlo, latitude, longitude, timezone }).azimuth - target
        );
        if (diffLo * diffMid <= 0) hi = mid;
        else lo = mid;
      }
      const localMinute = (lo + hi) / 2;
      const rootDate = new Date(base.getTime() + localMinute * 60000);
      const sun = solarPositionAt({ date: rootDate, latitude, longitude, timezone });
      roots.push({
        date: rootDate,
        localHour: localMinute / 60,
        altitude: sun.altitude,
        azimuth: sun.azimuth,
      });
    }
  }
  return roots.slice(0, 2);
}
