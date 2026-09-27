import { NextResponse } from "next/server";
import { calculatePrayerTimesSpa, findRashdulSpa, solarPositionSpa } from "../../../lib/falak/prayer-times-spa";
import { qiblaGeodesic } from "../../../lib/falak/qibla";

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

    const qibla = qiblaGeodesic(latitude, longitude);
    const rashdul = findRashdulSpa({
      day: body.day,
      latitude,
      longitude,
      timezone,
      elevation,
      parameters: body.parameters || {},
      targetBearing: qibla.bearing,
    });

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
