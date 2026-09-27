import { getSpa } from "nrel-spa";
import { evaluateFormula } from "./formula-engine.js";

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fractionalHourToDate(date, hour) {
  if (!Number.isFinite(hour)) return null;
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setMilliseconds(hour * 3600000);
  return result;
}

function localHourToInstant(date, hour, timezone) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) + (hour - timezone) * 3600000);
}

function addMinutes(hour, minutes = 0) {
  return Number.isFinite(hour) ? hour + Number(minutes || 0) / 60 : NaN;
}

function param(parameters, key, fallback) {
  const value = Number(parameters?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function formulaBySlot(formulas, slot) {
  return (formulas || []).find((item) => item.slot === slot && item.is_enabled !== false);
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

  const key = dayKey(date);
  const customZeniths = [
    90 + fajrAngle,
    90 + ishaAngle,
    90 - dhuhaAltitude,
  ];

  const base = getSpa(
    key,
    latitude,
    longitude,
    timezone,
    options,
    customZeniths
  );

  const noonInstant = localHourToInstant(date, base.solarNoon, timezone);
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

  const asrCrossing = getSpa(
    key,
    latitude,
    longitude,
    timezone,
    options,
    [90 - asrTargetAltitude]
  );

  const fajrHour = addMinutes(
    base.angles?.[0]?.sunrise,
    param(parameters, "fajr_ihtiyat_minutes", 2)
  );
  const sunriseHour = addMinutes(
    base.sunrise,
    param(parameters, "sunrise_adjustment_minutes", -2)
  );
  const dhuhaHour = addMinutes(
    base.angles?.[2]?.sunrise,
    param(parameters, "dhuha_ihtiyat_minutes", 2)
  );
  const dhuhrHour = addMinutes(
    base.solarNoon,
    param(parameters, "dhuhr_ihtiyat_minutes", 3)
  );
  const asrHour = addMinutes(
    asrCrossing.angles?.[0]?.sunset,
    param(parameters, "asr_ihtiyat_minutes", 2)
  );
  const maghribHour = addMinutes(
    base.sunset,
    param(parameters, "maghrib_ihtiyat_minutes", 2)
  );
  const ishaHour = addMinutes(
    base.angles?.[1]?.sunset,
    param(parameters, "isha_ihtiyat_minutes", 2)
  );

  return {
    fajr: fractionalHourToDate(date, fajrHour),
    sunrise: fractionalHourToDate(date, sunriseHour),
    dhuha: fractionalHourToDate(date, dhuhaHour),
    dhuhr: fractionalHourToDate(date, dhuhrHour),
    asr: fractionalHourToDate(date, asrHour),
    maghrib: fractionalHourToDate(date, maghribHour),
    isha: fractionalHourToDate(date, ishaHour),
    raw: {
      fajrHour,
      sunriseHour,
      dhuhaHour,
      dhuhrHour,
      asrHour,
      maghribHour,
      ishaHour,
      solarNoon: base.solarNoon,
    },
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
