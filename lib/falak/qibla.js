import GeographicLib from "geographiclib-geodesic";
import { getSpa } from "nrel-spa";
import { normalize180, normalize360 } from "./math.js";

export const KAABA = { latitude: 21.422487, longitude: 39.826206 };
const WGS84 = GeographicLib.Geodesic.WGS84;

export function qiblaGeodesic(latitude, longitude) {
  const result = WGS84.Inverse(
    latitude,
    longitude,
    KAABA.latitude,
    KAABA.longitude
  );
  return {
    bearing: normalize360(result.azi1),
    finalBearing: normalize360(result.azi2),
    distanceKm: result.s12 / 1000,
    model: "WGS84",
  };
}

export function qiblaBearing(latitude, longitude) {
  return qiblaGeodesic(latitude, longitude).bearing;
}

export function greatCircleDistanceKm(latitude, longitude) {
  return qiblaGeodesic(latitude, longitude).distanceKm;
}

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localHourToInstant(date, hour, timezone) {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) +
      (hour - timezone) * 3600000
  );
}

export function findRashdulQibla({
  date,
  latitude,
  longitude,
  timezone,
  elevation = 0,
}) {
  const target = qiblaBearing(latitude, longitude);
  const day = dayKey(date);
  const base = getSpa(day, latitude, longitude, timezone, { elevation });
  const roots = [];

  const start = Math.max(0, base.sunrise - 0.25);
  const end = Math.min(24, base.sunset + 0.25);

  const differenceAt = (hour) => {
    const instant = localHourToInstant(date, hour, timezone);
    const sun = getSpa(instant, latitude, longitude, timezone, {
      elevation,
      function: 0,
    });
    return {
      diff: normalize180(sun.azimuth - target),
      altitude: 90 - sun.zenith,
      azimuth: sun.azimuth,
    };
  };

  let previousHour = start;
  let previous = differenceAt(previousHour);

  for (let hour = start + 1 / 12; hour <= end; hour += 1 / 12) {
    const current = differenceAt(hour);
    if (
      previous.altitude > 1 &&
      current.altitude > 1 &&
      Math.abs(previous.diff) < 100 &&
      Math.abs(current.diff) < 100 &&
      previous.diff * current.diff <= 0
    ) {
      let lo = previousHour;
      let hi = hour;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        const a = differenceAt(lo);
        const b = differenceAt(mid);
        if (a.diff * b.diff <= 0) hi = mid;
        else lo = mid;
      }
      const rootHour = (lo + hi) / 2;
      const root = differenceAt(rootHour);
      roots.push({
        date: localHourToInstant(date, rootHour, timezone),
        localHour: rootHour,
        altitude: root.altitude,
        azimuth: root.azimuth,
      });
    }
    previousHour = hour;
    previous = current;
  }

  return roots.slice(0, 2);
}
