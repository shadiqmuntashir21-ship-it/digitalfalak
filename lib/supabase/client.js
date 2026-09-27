"use client";

import { createClient } from "@supabase/supabase-js";

let browserClient;

export function getSupabaseBrowser() {
  if (browserClient) return browserClient;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://souakvmuoygvsugxmpwd.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_--u2P-Gm5qaogeuV1KD05g_X3q1-eMA";

  browserClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}
