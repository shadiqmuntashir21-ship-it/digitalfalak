import {
  dateAtLocalMinutes,
  localSolarNoonMinutes,
  solarCoordinates,
  timeForSolarAltitude,
} from "./solar.js";
import { evaluateFormula } from "./formula-engine.js";

function param(parameters, key, fallback) {
  const value = Number(parameters?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function formulaBySlot(formulas, slot) {
  return (formulas || []).find((item) => item.slot === slot && item.is_enabled !== false);
}

function applyMinuteRounding(minutes, eventName, mode) {
  if (!Number.isFinite(minutes)) return minutes;
  if (mode === "kemenag_up_except_sunrise") {
    return eventName === "sunrise" ? Math.floor(minutes) : Math.ceil(minutes);
  }
  if (mode === "ceil") return Math.ceil(minutes);
  if (mode === "floor") return Math.floor(minutes);
  if (mode === "nearest") return Math.round(minutes);
  return minutes;
}

export function calculatePrayerTimes({
  date,
  latitude,
  longitude,
  elevation = 0,
  timezone,
  parameters = {},
  formulas = [],
}) {
  const noonProbe = new Date(date);
  noonProbe.setHours(12, 0, 0, 0);
  const solar = solarCoordinates(noonProbe);
  const solarNoon = localSolarNoonMinutes(longitude, timezone, solar.equationOfTime);

  const fajrAngle = param(parameters, "fajr_angle", 20);
  const ishaAngle = param(parameters, "isha_angle", 18);
  const dhuhaAltitude = param(parameters, "dhuha_altitude", 4.5);
  const asrFactor = param(parameters, "asr_shadow_factor", 1);

  const horizonDip = 0.0347 * Math.sqrt(Math.max(0, Number(elevation) || 0));
  const horizonAltitude = -0.833 - horizonDip;

  const event = (altitude, direction) =>
    timeForSolarAltitude({
      solarNoonMinutes: solarNoon,
      latitude,
      declination: solar.declination,
      altitude,
      direction,
    });

  const staticScope = {
    lat: Number(latitude),
    lon: Number(longitude),
    elevation: Number(elevation) || 0,
    timezone: Number(timezone),
    fajr_angle: fajrAngle,
    isha_angle: ishaAngle,
    dhuha_altitude: dhuhaAltitude,
  };

  const resolveAltitude = (slot, fallback) => {
    const formula = formulaBySlot(formulas, slot);
    if (!formula?.expression) return fallback;
    try {
      return evaluateFormula(formula.expression, staticScope);
    } catch {
      return fallback;
    }
  };

  const fajrTargetAltitude = resolveAltitude(
    "fajr_target_altitude",
    -fajrAngle
  );
  const ishaTargetAltitude = resolveAltitude(
    "isha_target_altitude",
    -ishaAngle
  );
  const dhuhaTargetAltitude = resolveAltitude(
    "dhuha_target_altitude",
    dhuhaAltitude
  );

  const noonAltitude = 90 - Math.abs(latitude - solar.declination);
  let asrTargetAltitude;
  const customAsr = formulaBySlot(formulas, "asr_target_altitude");
  if (customAsr?.expression) {
    try {
      asrTargetAltitude = evaluateFormula(customAsr.expression, {
        factor: asrFactor,
        noon_altitude: noonAltitude,
      });
    } catch {}
  }
  if (!Number.isFinite(asrTargetAltitude)) {
    const noonShadow = 1 / Math.tan((noonAltitude * Math.PI) / 180);
    asrTargetAltitude = Math.atan(1 / (asrFactor + noonShadow)) * 180 / Math.PI;
  }

  const minutes = {
    fajr: event(fajrTargetAltitude, "morning"),
    sunrise: event(horizonAltitude, "morning"),
    dhuha: event(dhuhaTargetAltitude, "morning"),
    dhuhr: solarNoon,
    asr: event(asrTargetAltitude, "evening"),
    maghrib: event(horizonAltitude, "evening"),
    isha: event(ishaTargetAltitude, "evening"),
  };

  const adjustments = {
    fajr: param(parameters, "fajr_ihtiyat_minutes", 2),
    sunrise: param(parameters, "sunrise_adjustment_minutes", -2),
    dhuha: param(parameters, "dhuha_ihtiyat_minutes", 2),
    dhuhr: param(parameters, "dhuhr_ihtiyat_minutes", 3),
    asr: param(parameters, "asr_ihtiyat_minutes", 2),
    maghrib: param(parameters, "maghrib_ihtiyat_minutes", 2),
    isha: param(parameters, "isha_ihtiyat_minutes", 2),
  };

  const roundingMode = parameters?.minute_rounding || "none";
  const finalMinutes = {};
  const result = {};
  for (const key of Object.keys(minutes)) {
    const value = minutes[key];
    if (value == null) {
      finalMinutes[key] = null;
      result[key] = null;
      continue;
    }
    const rounded = applyMinuteRounding(value, key, roundingMode);
    finalMinutes[key] = rounded + adjustments[key];
    result[key] = dateAtLocalMinutes(date, finalMinutes[key]);
  }

  return {
    ...result,
    raw: finalMinutes,
    meta: {
      engine: "Local solar fallback",
      fajrAngle,
      ishaAngle,
      dhuhaAltitude,
      fajrTargetAltitude,
      ishaTargetAltitude,
      dhuhaTargetAltitude,
      asrFactor,
      noonAltitude,
      asrTargetAltitude,
      elevation: Number(elevation) || 0,
      roundingMode,
    },
  };
}
