import "server-only";
import { getSpa } from "nrel-spa";
import { evaluateFormula } from "./formula-engine.js";

function fractionalHourToIso(day, hour, timezone) {
  if (!Number.isFinite(hour)) return null;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + (hour - timezone) * 3600000).toISOString();
}

function param(parameters, key, fallback) {
  const value = Number(parameters?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function formulaBySlot(formulas, slot) {
  return (formulas || []).find((item) => item.slot === slot && item.is_enabled !== false);
}

function addMinutes(hour, minutes = 0) {
  return Number.isFinite(hour) ? hour + Number(minutes || 0) / 60 : NaN;
}

export function calculatePrayerTimesSpa({
  day,
  latitude,
  longitude,
  elevation = 0,
  timezone,
  parameters = {},
  formulas = [],
}) {
  const fajrAngle = param(parameters, "fajr_angle", 20);
  const ishaAngle = param(parameters, "isha_angle", 18);
  const dhuhaAltitude = param(parameters, "dhuha_altitude", 4.5);
  const asrFactor = param(parameters, "asr_shadow_factor", 1);

  const options = {
    elevation: Number(elevation) || 0,
    temperature: param(parameters, "temperature_c", 28),
    pressure: param(parameters, "pressure_mbar", 1010),
    atmos_refract: param(parameters, "atmos_refract_deg", 0.5667),
  };

  const base = getSpa(day, latitude, longitude, timezone, options, [
    90 + fajrAngle,
    90 + ishaAngle,
    90 - dhuhaAltitude,
  ]);

  const [y, m, d] = day.split("-").map(Number);
  const noonInstant = new Date(
    Date.UTC(y, m - 1, d) + (base.solarNoon - timezone) * 3600000
  );
  const noonPosition = getSpa(noonInstant, latitude, longitude, timezone, {
    ...options,
    function: 0,
  });
  const noonAltitude = 90 - noonPosition.zenith;

  let asrTargetAltitude;
  const customAsrFormula = formulaBySlot(formulas, "asr_target_altitude");
  if (customAsrFormula?.expression) {
    try {
      asrTargetAltitude = evaluateFormula(customAsrFormula.expression, {
        factor: asrFactor,
        noon_altitude: noonAltitude,
      });
    } catch {
      asrTargetAltitude = undefined;
    }
  }

  if (!Number.isFinite(asrTargetAltitude)) {
    const noonShadow = 1 / Math.tan((noonAltitude * Math.PI) / 180);
    asrTargetAltitude =
      Math.atan(1 / (asrFactor + noonShadow)) * (180 / Math.PI);
  }

  const asrCrossing = getSpa(day, latitude, longitude, timezone, options, [
    90 - asrTargetAltitude,
  ]);

  const raw = {
    fajr: addMinutes(base.angles?.[0]?.sunrise, param(parameters, "fajr_ihtiyat_minutes", 2)),
    sunrise: addMinutes(base.sunrise, param(parameters, "sunrise_adjustment_minutes", -2)),
    dhuha: addMinutes(base.angles?.[2]?.sunrise, param(parameters, "dhuha_ihtiyat_minutes", 2)),
    dhuhr: addMinutes(base.solarNoon, param(parameters, "dhuhr_ihtiyat_minutes", 3)),
    asr: addMinutes(asrCrossing.angles?.[0]?.sunset, param(parameters, "asr_ihtiyat_minutes", 2)),
    maghrib: addMinutes(base.sunset, param(parameters, "maghrib_ihtiyat_minutes", 2)),
    isha: addMinutes(base.angles?.[1]?.sunset, param(parameters, "isha_ihtiyat_minutes", 2)),
  };

  return {
    fajr: fractionalHourToIso(day, raw.fajr, timezone),
    sunrise: fractionalHourToIso(day, raw.sunrise, timezone),
    dhuha: fractionalHourToIso(day, raw.dhuha, timezone),
    dhuhr: fractionalHourToIso(day, raw.dhuhr, timezone),
    asr: fractionalHourToIso(day, raw.asr, timezone),
    maghrib: fractionalHourToIso(day, raw.maghrib, timezone),
    isha: fractionalHourToIso(day, raw.isha, timezone),
    raw,
    meta: {
      engine: "NREL SPA",
      fajrAngle,
      ishaAngle,
      dhuhaAltitude,
      asrFactor,
      noonAltitude,
      asrTargetAltitude,
      pressure: options.pressure,
      temperature: options.temperature,
      elevation: options.elevation,
      atmosRefract: options.atmos_refract,
    },
  };
}

export function solarPositionSpa({
  instant,
  latitude,
  longitude,
  elevation = 0,
  timezone,
  parameters = {},
}) {
  const result = getSpa(new Date(instant), latitude, longitude, timezone, {
    elevation: Number(elevation) || 0,
    temperature: param(parameters, "temperature_c", 28),
    pressure: param(parameters, "pressure_mbar", 1010),
    atmos_refract: param(parameters, "atmos_refract_deg", 0.5667),
    function: 0,
  });
  return {
    azimuth: result.azimuth,
    altitude: 90 - result.zenith,
    zenith: result.zenith,
  };
}
