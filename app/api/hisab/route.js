import { NextResponse } from "next/server";
import { calculatePrayerTimesSpa, solarPositionSpa } from "../../../lib/falak/prayer-times-spa";
import { findRashdulQibla } from "../../../lib/falak/qibla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validNumber(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const latitude = validNumber(body.latitude, -90, 90);
    const longitude = validNumber(body.longitude, -180, 180);
    const timezone = validNumber(body.timezone, -14, 14);
    const elevation = validNumber(body.elevation ?? 0, -500, 9000);

    if (latitude == null || longitude == null || timezone == null || elevation == null) {
      return NextResponse.json({ error: "Input lokasi tidak valid." }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.day || "")) {
      return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });
    }

    const prayer = calculatePrayerTimesSpa({
      day: body.day,
      latitude,
      longitude,
      elevation,
      timezone,
      parameters: body.parameters || {},
      formulas: Array.isArray(body.formulas) ? body.formulas : [],
    });

    const instant = body.instant ? new Date(body.instant) : new Date();
    const solar = solarPositionSpa({
      instant,
      latitude,
      longitude,
      elevation,
      timezone,
      parameters: body.parameters || {},
    });

    const [y, m, d] = body.day.split("-").map(Number);
    const localDate = new Date(y, m - 1, d, 12, 0, 0, 0);
    const rashdul = findRashdulQibla({
      date: localDate,
      latitude,
      longitude,
      timezone,
      elevation,
    }).map((item) => ({
      localHour: item.localHour,
      altitude: item.altitude,
      azimuth: item.azimuth,
    }));

    return NextResponse.json({
      source: "nrel-spa",
      prayer,
      solar,
      rashdul,
    });
  } catch (error) {
    console.error("hisab-api", error);
    return NextResponse.json(
      { error: "Perhitungan NREL SPA gagal diproses." },
      { status: 500 }
    );
  }
}
