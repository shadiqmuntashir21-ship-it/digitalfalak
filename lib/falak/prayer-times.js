import {
  dateAtLocalMinutes,
  localSolarNoonMinutes,
  solarCoordinates,
  timeForSolarAltitude,
} from "./solar.js";
import { toDeg, toRad } from "./math.js";

function asrAltitude(latitude, declination, factor) {
  const angle = Math.abs(latitude - declination);
  return toDeg(Math.atan(1 / (factor + Math.tan(toRad(angle)))));
}

export function calculatePrayerTimes({ date, latitude, longitude, elevation = 0, timezone, parameters }) {
  const noonProbe = new Date(date);
  noonProbe.setHours(12, 0, 0, 0);
  const solar = solarCoordinates(noonProbe);
  const solarNoon = localSolarNoonMinutes(longitude, timezone, solar.equationOfTime);
  const dip = 0.0347 * Math.sqrt(Math.max(0, elevation));
  const horizonAltitude = -0.833 - dip;
  const ihtiyat = Number(parameters.ihtiyat_minutes ?? 0);

  const fajrRaw = timeForSolarAltitude({ solarNoonMinutes: solarNoon, latitude, declination: solar.declination, altitude: -Number(parameters.fajr_angle), direction: "morning" });
  const sunriseRaw = timeForSolarAltitude({ solarNoonMinutes: solarNoon, latitude, declination: solar.declination, altitude: horizonAltitude, direction: "morning" });
  const dhuhaRaw = timeForSolarAltitude({ solarNoonMinutes: solarNoon, latitude, declination: solar.declination, altitude: Number(parameters.dhuha_altitude), direction: "morning" });
  const asrAlt = asrAltitude(latitude, solar.declination, Number(parameters.asr_shadow_factor));
  const asrRaw = timeForSolarAltitude({ solarNoonMinutes: solarNoon, latitude, declination: solar.declination, altitude: asrAlt, direction: "evening" });
  const sunsetRaw = timeForSolarAltitude({ solarNoonMinutes: solarNoon, latitude, declination: solar.declination, altitude: horizonAltitude, direction: "evening" });
  const ishaRaw = timeForSolarAltitude({ solarNoonMinutes: solarNoon, latitude, declination: solar.declination, altitude: -Number(parameters.isha_angle), direction: "evening" });

  const withIhtiyat = (value) => (value == null ? null : value + ihtiyat);
  const toDate = (value) => (value == null ? null : dateAtLocalMinutes(date, value));

  return {
    fajr: toDate(withIhtiyat(fajrRaw)),
    sunrise: toDate(sunriseRaw),
    dhuha: toDate(withIhtiyat(dhuhaRaw)),
    dhuhr: toDate(solarNoon + ihtiyat),
    asr: toDate(withIhtiyat(asrRaw)),
    maghrib: toDate(withIhtiyat(sunsetRaw)),
    isha: toDate(withIhtiyat(ishaRaw)),
    raw: { fajrRaw, sunriseRaw, dhuhaRaw, solarNoon, asrRaw, sunsetRaw, ishaRaw },
    meta: {
      declination: solar.declination,
      equationOfTime: solar.equationOfTime,
      horizonAltitude,
      asrAltitude: asrAlt,
      ihtiyat,
    },
  };
}
