import { NextResponse } from "next/server";
import {
  calculatePrayerTimesSpa,
  findRashdulSpa,
  solarPositionSpa,
} from "../../../lib/falak/prayer-times-spa";
import { qiblaGeodesic } from "../../../lib/falak/qibla";
import { magvar } from "magvar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REFERENCE_PARAMETERS = {
  fajr_angle: 20,
  isha_angle: 18,
  dhuha_altitude: 4.5,
  asr_shadow_factor: 1,
  fajr_ihtiyat_minutes: 2,
  dhuhr_ihtiyat_minutes: 3,
  asr_ihtiyat_minutes: 2,
  maghrib_ihtiyat_minutes: 2,
  isha_ihtiyat_minutes: 2,
  dhuha_ihtiyat_minutes: 2,
  sunrise_adjustment_minutes: -2,
  temperature_c: 28,
  pressure_mbar: 1010,
  atmos_refract_deg: 0.5667,
};

function validNumber(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function dateKeyIndonesia(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function calculate(body) {
  const latitude = validNumber(body.latitude, -90, 90);
  const longitude = validNumber(body.longitude, -180, 180);
  const timezone = validNumber(body.timezone, -14, 14);
  const elevation = validNumber(body.elevation ?? 0, -500, 9000);

  if (latitude == null || longitude == null || timezone == null || elevation == null) {
    return { error: "Input lokasi tidak valid.", status: 400 };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.day || "")) {
    return { error: "Tanggal tidak valid.", status: 400 };
  }

  const parameters = { ...REFERENCE_PARAMETERS, ...(body.parameters || {}) };
  const formulas = Array.isArray(body.formulas) ? body.formulas : [];

  const prayer = calculatePrayerTimesSpa({
    day: body.day,
    latitude,
    longitude,
    elevation,
    timezone,
    parameters,
    formulas,
  });

  const instant = body.instant ? new Date(body.instant) : new Date();
  const solar = solarPositionSpa({
    instant,
    latitude,
    longitude,
    elevation,
    timezone,
    parameters,
  });

  const qibla = qiblaGeodesic(latitude, longitude, formulas);
  const magneticDeclination = magvar(
    latitude,
    longitude,
    Math.max(-0.5, elevation / 1000),
    instant
  );
  const rashdul = findRashdulSpa({
    day: body.day,
    latitude,
    longitude,
    timezone,
    elevation,
    parameters,
    targetBearing: qibla.bearing,
  });

  return {
    status: 200,
    payload: {
      source: "nrel-spa",
      day: body.day,
      location: { latitude, longitude, elevation, timezone },
      prayer,
      solar,
      qibla,
      magneticDeclination,
      magneticModel: "WMM2025",
      rashdul,
    },
  };
}

export async function POST(request) {
  try {
    const result = await calculate(await request.json());
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.payload);
  } catch (error) {
    console.error("hisab-api", error);
    return NextResponse.json(
      { error: "Perhitungan NREL SPA gagal diproses." },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const body = {
      day: url.searchParams.get("day") || dateKeyIndonesia(),
      instant: url.searchParams.get("instant") || new Date().toISOString(),
      latitude: url.searchParams.get("lat") ?? -0.8917,
      longitude: url.searchParams.get("lon") ?? 119.8707,
      elevation: url.searchParams.get("elevation") ?? 15,
      timezone: url.searchParams.get("tz") ?? 8,
      parameters: REFERENCE_PARAMETERS,
      formulas: [],
    };
    const result = await calculate(body);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ...result.payload, smoke_test: true });
  } catch (error) {
    console.error("hisab-smoke", error);
    return NextResponse.json(
      { error: "Smoke test hisab gagal." },
      { status: 500 }
    );
  }
}
