"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "./icons";
import { getSupabaseBrowser } from "../lib/supabase/client";
import { evaluateFormula } from "../lib/falak/formula-engine";

const EMPTY_METHOD = {
  id: null,
  slug: "",
  name: "",
  description: "",
  engine_type: "nrel_spa",
  version: "1.0",
  status: "draft",
  is_active: true,
  is_verified: false,
  source_note: "",
  reference_urls: [],
  formula_notes: {},
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
  },
};

const PARAM_FIELDS = [
  ["fajr_angle", "Sudut Subuh", "°"],
  ["isha_angle", "Sudut Isya", "°"],
  ["dhuha_altitude", "Altitude Dhuha", "°"],
  ["asr_shadow_factor", "Faktor Bayangan Asar", "x"],
  ["fajr_ihtiyat_minutes", "Ihtiyat Subuh", "menit"],
  ["dhuhr_ihtiyat_minutes", "Ihtiyat Zuhur", "menit"],
  ["asr_ihtiyat_minutes", "Ihtiyat Asar", "menit"],
  ["maghrib_ihtiyat_minutes", "Ihtiyat Magrib", "menit"],
  ["isha_ihtiyat_minutes", "Ihtiyat Isya", "menit"],
  ["sunrise_adjustment_minutes", "Koreksi Terbit", "menit"],
  ["temperature_c", "Suhu Referensi", "°C"],
  ["pressure_mbar", "Tekanan Udara", "mbar"],
  ["atmos_refract_deg", "Refraksi Horizon", "°"],
];

export default function AdminConsole() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [session, setSession] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [auth, setAuth] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState([]);
  const [draft, setDraft] = useState(EMPTY_METHOD);
  const [formulas, setFormulas] = useState([]);
  const [formulaDraft, setFormulaDraft] = useState({
    id: null,
    slot: "asr_target_altitude",
    label: "Target altitude Asar",
    expression: "atand(1/(factor+cotd(noon_altitude)))",
    variables: "factor,noon_altitude",
    output_unit: "degree",
    description: "",
    test_scope: '{"factor":1,"noon_altitude":88}',
  });
  const [formulaResult, setFormulaResult] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session?.user) {
      setAdmin(null);
      setLoading(false);
      return;
    }
    checkAdmin(session.user.id);
  }, [session]);

  async function checkAdmin(userId) {
    setLoading(true);
    const { data, error } = await supabase
      .from("df_admin_users")
      .select("user_id,display_name,role,is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) setMessage(error.message);
    setAdmin(data || null);
    setLoading(false);
    if (data) loadMethods();
  }

  async function submitAuth(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    const email = auth.email.trim();
    const password = auth.password;

    const result =
      authMode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) setMessage(result.error.message);
    else if (authMode === "signup")
      setMessage("Akun dibuat. Jika konfirmasi email aktif, konfirmasi dulu lalu masuk.");
    setLoading(false);
  }

  async function requestAccess() {
    if (!session?.user) return;
    const { error } = await supabase.from("df_admin_requests").upsert({
      user_id: session.user.id,
      note: "Permintaan akses panel metode Digital Falak",
      requested_at: new Date().toISOString(),
    });
    setMessage(
      error
        ? error.message
        : "Permintaan akses tercatat. Akun perlu dimasukkan ke df_admin_users oleh owner."
    );
  }

  async function loadMethods(preferredId) {
    const { data, error } = await supabase
      .from("df_falak_methods")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }
    setMethods(data || []);
    const chosen =
      (data || []).find((m) => m.id === preferredId) ||
      (data || [])[0] ||
      EMPTY_METHOD;
    setDraft(JSON.parse(JSON.stringify(chosen)));
    if (chosen.id) loadFormulas(chosen.id);
  }

  async function loadFormulas(methodId) {
    const { data, error } = await supabase
      .from("df_formula_definitions")
      .select("*")
      .eq("method_id", methodId)
      .order("sort_order");

    if (error) setMessage(error.message);
    setFormulas(data || []);
  }

  function chooseMethod(method) {
    setDraft(JSON.parse(JSON.stringify(method)));
    loadFormulas(method.id);
    setFormulaResult("");
  }

  function updateParam(key, value) {
    setDraft((current) => ({
      ...current,
      parameters: {
        ...(current.parameters || {}),
        [key]: Number(value),
      },
    }));
  }

  async function saveMethod() {
    if (!admin || !session?.user) return;
    setMessage("");
    const payload = {
      slug: draft.slug.trim(),
      name: draft.name.trim(),
      description: draft.description || null,
      engine_type: draft.engine_type,
      version: draft.version || "1.0",
      status: draft.status,
      is_active: Boolean(draft.is_active),
      is_verified: Boolean(draft.is_verified),
      source_note: draft.source_note || null,
      parameters: draft.parameters || {},
      formula_notes: draft.formula_notes || {},
      reference_urls: (draft.reference_urls || []).filter(Boolean),
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
      published_at:
        draft.status === "published"
          ? draft.published_at || new Date().toISOString()
          : draft.published_at || null,
    };

    let result;
    if (draft.id) {
      result = await supabase
        .from("df_falak_methods")
        .update(payload)
        .eq("id", draft.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("df_falak_methods")
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setMessage("Metode tersimpan.");
    await loadMethods(result.data.id);
  }

  function newMethod() {
    setDraft(JSON.parse(JSON.stringify(EMPTY_METHOD)));
    setFormulas([]);
    setMessage("");
  }

  function editFormula(formula) {
    setFormulaDraft({
      id: formula.id,
      slot: formula.slot,
      label: formula.label,
      expression: formula.expression,
      variables: (formula.variables || []).join(","),
      output_unit: formula.output_unit || "",
      description: formula.description || "",
      test_scope: JSON.stringify(
        Object.fromEntries((formula.variables || []).map((v) => [v, 1]))
      ),
    });
    setFormulaResult("");
  }

  function newFormula() {
    setFormulaDraft({
      id: null,
      slot: "custom_formula",
      label: "Formula Baru",
      expression: "",
      variables: "",
      output_unit: "",
      description: "",
      test_scope: "{}",
    });
    setFormulaResult("");
  }

  function testFormula() {
    try {
      const scope = JSON.parse(formulaDraft.test_scope || "{}");
      const result = evaluateFormula(formulaDraft.expression, scope);
      setFormulaResult(`Hasil uji: ${result}`);
    } catch (error) {
      setFormulaResult(`Error: ${error.message}`);
    }
  }

  async function saveFormula() {
    if (!draft.id || !admin || !session?.user) {
      setMessage("Simpan metode terlebih dahulu.");
      return;
    }
    const variables = formulaDraft.variables
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const payload = {
      method_id: draft.id,
      slot: formulaDraft.slot.trim(),
      label: formulaDraft.label.trim(),
      expression: formulaDraft.expression.trim(),
      variables,
      output_unit: formulaDraft.output_unit || null,
      description: formulaDraft.description || null,
      is_enabled: true,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (formulaDraft.id) {
      result = await supabase
        .from("df_formula_definitions")
        .update(payload)
        .eq("id", formulaDraft.id);
    } else {
      result = await supabase.from("df_formula_definitions").upsert(payload, {
        onConflict: "method_id,slot",
      });
    }

    if (result.error) setMessage(result.error.message);
    else {
      setMessage("Formula tersimpan.");
      loadFormulas(draft.id);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setAdmin(null);
    setMethods([]);
  }

  if (loading) {
    return <div className="admin-loading">Menyiapkan panel falak…</div>;
  }

  if (!session) {
    return (
      <main className="admin-auth-shell">
        <Link href="/" className="admin-back">← Kembali ke Digital Falak</Link>
        <section className="admin-auth-card">
          <div className="admin-emblem"><Icon name="flask" size={28} /></div>
          <span className="eyebrow">ADMIN METODE HISAB</span>
          <h1>Ruang kerja ahli falak.</h1>
          <p>Masuk untuk mengelola metode, parameter astronomi, rujukan, dan formula yang dipakai aplikasi.</p>
          <form onSubmit={submitAuth}>
            <label>Email<input type="email" required value={auth.email} onChange={(e)=>setAuth({...auth,email:e.target.value})}/></label>
            <label>Password<input type="password" minLength="8" required value={auth.password} onChange={(e)=>setAuth({...auth,password:e.target.value})}/></label>
            <button className="admin-primary" type="submit">{authMode === "login" ? "Masuk Admin" : "Buat Akun Ahli"}</button>
          </form>
          <button className="admin-switch" onClick={()=>setAuthMode(authMode==="login"?"signup":"login")}>
            {authMode === "login" ? "Belum punya akun? Buat akun" : "Sudah punya akun? Masuk"}
          </button>
          {message ? <div className="admin-message">{message}</div> : null}
        </section>
      </main>
    );
  }

  if (!admin) {
    return (
      <main className="admin-auth-shell">
        <Link href="/" className="admin-back">← Kembali ke Digital Falak</Link>
        <section className="admin-auth-card">
          <div className="admin-emblem muted"><Icon name="admin" size={28} /></div>
          <span className="eyebrow">AKSES MENUNGGU OTORISASI</span>
          <h1>Akun sudah masuk, tetapi belum menjadi admin.</h1>
          <p>{session.user.email}</p>
          <p>Owner perlu menambahkan user ini ke tabel <b>df_admin_users</b>. Ini sengaja dibuat begitu agar formula tidak bisa diubah sembarang orang.</p>
          <button className="admin-primary" onClick={requestAccess}>Kirim Permintaan Akses</button>
          <button className="admin-switch" onClick={logout}>Keluar</button>
          {message ? <div className="admin-message">{message}</div> : null}
        </section>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-logo"><span>F</span><div><b>Digital Falak</b><small>Method Studio</small></div></Link>
        <div className="admin-user"><small>Masuk sebagai</small><b>{admin.display_name || session.user.email}</b><span>{admin.role}</span></div>
        <button className="admin-nav active"><Icon name="book" /> Metode Hisab</button>
        <button className="admin-nav"><Icon name="flask" /> Formula Lab</button>
        <button className="admin-nav" onClick={logout}><Icon name="logout" /> Keluar</button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div><span className="eyebrow">METHOD STUDIO</span><h1>Metode & Formula</h1></div>
          <button className="admin-outline" onClick={newMethod}><Icon name="plus" size={16}/> Metode Baru</button>
        </header>

        {message ? <div className="admin-message top">{message}</div> : null}

        <div className="admin-workspace">
          <section className="method-list-panel">
            <div className="admin-section-head"><b>Daftar metode</b><span>{methods.length}</span></div>
            <div className="method-list">
              {methods.map((method)=>(
                <button key={method.id} onClick={()=>chooseMethod(method)} className={draft.id===method.id?"selected":""}>
                  <div><b>{method.name}</b><small>{method.engine_type} · v{method.version}</small></div>
                  <span className={`status-dot ${method.status}`}>{method.status}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="method-editor">
            <div className="editor-card">
              <div className="admin-section-head"><div><span className="eyebrow">IDENTITAS METODE</span><b>{draft.id ? "Edit metode" : "Metode baru"}</b></div><button className="admin-primary compact" onClick={saveMethod}><Icon name="save" size={15}/> Simpan</button></div>
              <div className="admin-form-grid">
                <label>Nama metode<input value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})}/></label>
                <label>Slug<input value={draft.slug} onChange={(e)=>setDraft({...draft,slug:e.target.value})}/></label>
                <label>Engine<select value={draft.engine_type} onChange={(e)=>setDraft({...draft,engine_type:e.target.value})}><option value="nrel_spa">NREL SPA</option><option value="legacy_noaa">Legacy NOAA/Meeus</option><option value="custom">Custom</option></select></label>
                <label>Versi<input value={draft.version} onChange={(e)=>setDraft({...draft,version:e.target.value})}/></label>
                <label>Status<select value={draft.status} onChange={(e)=>setDraft({...draft,status:e.target.value})}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
                <label className="check-label"><input type="checkbox" checked={Boolean(draft.is_verified)} onChange={(e)=>setDraft({...draft,is_verified:e.target.checked})}/> Ditandai terverifikasi ahli</label>
                <label className="full">Deskripsi<textarea rows="3" value={draft.description||""} onChange={(e)=>setDraft({...draft,description:e.target.value})}/></label>
                <label className="full">Sumber / catatan metodologi<textarea rows="4" value={draft.source_note||""} onChange={(e)=>setDraft({...draft,source_note:e.target.value})}/></label>
                <label className="full">URL referensi (satu per baris)<textarea rows="3" value={(draft.reference_urls||[]).join("\n")} onChange={(e)=>setDraft({...draft,reference_urls:e.target.value.split("\n")})}/></label>
              </div>
            </div>

            <div className="editor-card">
              <div className="admin-section-head"><div><span className="eyebrow">PARAMETER FALAK</span><b>Parameter metode</b></div><small>Semua perubahan baru dipakai publik saat status Published.</small></div>
              <div className="parameter-admin-grid">
                {PARAM_FIELDS.map(([key,label,unit])=>(
                  <label key={key}><span>{label}<small>{unit}</small></span><input type="number" step="0.0001" value={draft.parameters?.[key] ?? ""} onChange={(e)=>updateParam(key,e.target.value)}/></label>
                ))}
              </div>
            </div>

            <div className="editor-card">
              <div className="admin-section-head"><div><span className="eyebrow">FORMULA SLOTS</span><b>Rumus yang tersimpan</b></div><button className="admin-outline compact" onClick={newFormula}><Icon name="plus" size={14}/> Tambah</button></div>
              <div className="formula-list">
                {formulas.length ? formulas.map((formula)=>(
                  <button key={formula.id} onClick={()=>editFormula(formula)}>
                    <div><b>{formula.label}</b><code>{formula.expression}</code></div><span>{formula.slot}</span>
                  </button>
                )):<p className="empty-copy">Belum ada formula untuk metode ini.</p>}
              </div>

              <div className="formula-editor">
                <label>Slot
                  <input list="formula-slot-options" value={formulaDraft.slot} onChange={(e)=>setFormulaDraft({...formulaDraft,slot:e.target.value})}/>
                  <datalist id="formula-slot-options">
                    <option value="fajr_target_altitude">Subuh · target altitude</option>
                    <option value="isha_target_altitude">Isya · target altitude</option>
                    <option value="dhuha_target_altitude">Dhuha · target altitude</option>
                    <option value="asr_target_altitude">Asar · target altitude</option>
                    <option value="hour_angle">Referensi sudut waktu</option>
                    <option value="custom_formula">Formula laboratorium</option>
                  </datalist>
                </label>
                <label>Nama formula<input value={formulaDraft.label} onChange={(e)=>setFormulaDraft({...formulaDraft,label:e.target.value})}/></label>
                <label className="full">Ekspresi<input className="formula-input" value={formulaDraft.expression} onChange={(e)=>setFormulaDraft({...formulaDraft,expression:e.target.value})} placeholder="atand(1/(factor+cotd(noon_altitude)))"/></label>
                <label>Variabel<input value={formulaDraft.variables} onChange={(e)=>setFormulaDraft({...formulaDraft,variables:e.target.value})} placeholder="factor,noon_altitude"/></label>
                <label>Satuan output<input value={formulaDraft.output_unit} onChange={(e)=>setFormulaDraft({...formulaDraft,output_unit:e.target.value})}/></label>
                <label className="full">Keterangan<textarea rows="2" value={formulaDraft.description} onChange={(e)=>setFormulaDraft({...formulaDraft,description:e.target.value})}/></label>
                <label className="full">Data uji (JSON)<textarea rows="2" value={formulaDraft.test_scope} onChange={(e)=>setFormulaDraft({...formulaDraft,test_scope:e.target.value})}/></label>
                <div className="formula-actions"><button className="admin-outline" onClick={testFormula}>Uji Formula</button><button className="admin-primary" onClick={saveFormula}>Simpan Formula</button></div>
                {formulaResult ? <div className="formula-result">{formulaResult}</div> : null}
                <small className="formula-help"><b>Slot produksi:</b> fajr_target_altitude, isha_target_altitude, dhuha_target_altitude, asr_target_altitude. Slot lain dapat disimpan/diuji tetapi tidak mengubah hasil sampai dihubungkan ke engine. Fungsi aman: sind, cosd, tand, cotd, asind, acosd, atand, atan2d, sqrt, abs, min, max, round, floor, ceil. Operator: + − × ÷ ^.</small>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
