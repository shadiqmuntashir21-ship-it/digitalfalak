import { NextResponse } from "next/server";

const FALLBACK_METHOD = {
  slug: "digital-falak-default-test",
  name: "Default Indonesia — Uji",
  description: "Parameter awal untuk pengujian engine. Bukan rumus final pengguna.",
  is_verified: false,
  source_note: "Metode uji internal; parameter dapat diganti setelah rumus rujukan dimasukkan.",
  parameters: {
    fajr_angle: 20,
    isha_angle: 18,
    dhuha_altitude: 4.5,
    asr_shadow_factor: 1,
    ihtiyat_minutes: 2,
  },
};

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://souakvmuoygvsugxmpwd.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_--u2P-Gm5qaogeuV1KD05g_X3q1-eMA";

  try {
    const response = await fetch(`${url}/rest/v1/df_falak_methods?select=slug,name,description,is_verified,source_note,parameters&is_active=eq.true&order=name.asc`, {
      headers: { apikey: key },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Supabase ${response.status}`);
    const data = await response.json();
    return NextResponse.json({ methods: data.length ? data : [FALLBACK_METHOD], source: data.length ? "supabase" : "fallback" });
  } catch {
    return NextResponse.json({ methods: [FALLBACK_METHOD], source: "fallback" });
  }
}
