import { NextResponse } from "next/server";

const FALLBACK_METHOD = {
  id: null,
  slug: "kemenag-ri-spa-reference",
  name: "Kemenag RI — Referensi Falak",
  description:
    "Profil referensi Indonesia berbasis koordinat dengan engine astronomi NREL SPA.",
  engine_type: "nrel_spa",
  version: "2026.1",
  is_verified: false,
  source_note:
    "Fallback lokal. Parameter dapat disesuaikan dan harus diverifikasi bersama ahli falak.",
  parameters: {
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
    minute_rounding: "kemenag_up_except_sunrise",
  },
  formulas: [],
};

export async function GET() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://souakvmuoygvsugxmpwd.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_--u2P-Gm5qaogeuV1KD05g_X3q1-eMA";

  const headers = { apikey: key };

  try {
    const [methodsResponse, formulasResponse] = await Promise.all([
      fetch(
        `${url}/rest/v1/df_falak_methods?select=id,slug,name,description,engine_type,version,is_verified,source_note,parameters,formula_notes,reference_urls&is_active=eq.true&status=eq.published&order=published_at.desc.nullslast,name.asc`,
        { headers, cache: "no-store" }
      ),
      fetch(
        `${url}/rest/v1/df_formula_definitions?select=id,method_id,slot,label,expression,variables,output_unit,description,is_enabled,sort_order&is_enabled=eq.true&order=sort_order.asc`,
        { headers, cache: "no-store" }
      ),
    ]);

    if (!methodsResponse.ok) {
      throw new Error(`Methods ${methodsResponse.status}`);
    }

    const methods = await methodsResponse.json();
    const formulas = formulasResponse.ok ? await formulasResponse.json() : [];

    const merged = methods.map((method) => ({
      ...method,
      formulas: formulas.filter((formula) => formula.method_id === method.id),
    }));

    return NextResponse.json({
      methods: merged.length ? merged : [FALLBACK_METHOD],
      source: merged.length ? "supabase" : "fallback",
    });
  } catch {
    return NextResponse.json({
      methods: [FALLBACK_METHOD],
      source: "fallback",
    });
  }
}
