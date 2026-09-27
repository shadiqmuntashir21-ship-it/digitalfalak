import { clamp, normalize360, toDeg, toRad } from "./math.js";

export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

export function solarCoordinates(date) {
  const jd = julianDay(date);
  const t = (jd - 2451545.0) / 36525;

  const l0 = normalize360(280.46646 + t * (36000.76983 + 0.0003032 * t));
  const m = normalize360(357.52911 + t * (35999.05029 - 0.0001537 * t));
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  const c =
    Math.sin(toRad(m)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(toRad(2 * m)) * (0.019993 - 0.000101 * t) +
    Math.sin(toRad(3 * m)) * 0.000289;

  const trueLongitude = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude = trueLongitude - 0.00569 - 0.00478 * Math.sin(toRad(omega));

  const meanObliquity =
    23 +
    (26 +
      (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) /
      60;
  const obliquity = meanObliquity + 0.00256 * Math.cos(toRad(omega));

  const declination = toDeg(
    Math.asin(Math.sin(toRad(obliquity)) * Math.sin(toRad(apparentLongitude)))
  );

  const y = Math.tan(toRad(obliquity / 2)) ** 2;
  const equationOfTime =
    4 *
    toDeg(
      y * Math.sin(2 * toRad(l0)) -
        2 * e * Math.sin(toRad(m)) +
        4 * e * y * Math.sin(toRad(m)) * Math.cos(2 * toRad(l0)) -
        0.5 * y * y * Math.sin(4 * toRad(l0)) -
        1.25 * e * e * Math.sin(2 * toRad(m))
    );

  return { jd, declination, equationOfTime, apparentLongitude };
}

export function localSolarNoonMinutes(longitude, timezone, equationOfTime) {
  return 720 - 4 * longitude - equationOfTime + timezone * 60;
}

export function hourAngleForAltitude(latitude, declination, altitude) {
  const lat = toRad(latitude);
  const dec = toRad(declination);
  const alt = toRad(altitude);
  const cosH =
    (Math.sin(alt) - Math.sin(lat) * Math.sin(dec)) /
    (Math.cos(lat) * Math.cos(dec));

  if (cosH < -1 || cosH > 1) return null;
  return toDeg(Math.acos(clamp(cosH, -1, 1)));
}

export function timeForSolarAltitude({
  solarNoonMinutes,
  latitude,
  declination,
  altitude,
  direction,
}) {
  const h = hourAngleForAltitude(latitude, declination, altitude);
  if (h == null) return null;
  const delta = h * 4;
  return direction === "morning" ? solarNoonMinutes - delta : solarNoonMinutes + delta;
}

export function solarPositionAt({ date, latitude, longitude, timezone }) {
  const coords = solarCoordinates(date);
  const localMinutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  const trueSolarTime = ((localMinutes + coords.equationOfTime + 4 * longitude - 60 * timezone) % 1440 + 1440) % 1440;
  let hourAngle = trueSolarTime / 4 - 180;
  if (hourAngle < -180) hourAngle += 360;

  const lat = toRad(latitude);
  const dec = toRad(coords.declination);
  const ha = toRad(hourAngle);

  const cosZenith = clamp(
    Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha),
    -1,
    1
  );
  const zenith = Math.acos(cosZenith);
  const altitude = 90 - toDeg(zenith);

  const azimuth = normalize360(
    toDeg(
      Math.atan2(
        Math.sin(ha),
        Math.cos(ha) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)
      )
    ) + 180
  );

  return { ...coords, hourAngle, altitude, azimuth };
}

export function dateAtLocalMinutes(baseDate, minutes) {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}
