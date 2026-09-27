"use client";

import { useEffect, useMemo, useState } from "react";
import { calculatePrayerTimes } from "../lib/falak/prayer-times";
import { formatClock, formatNumber } from "../lib/falak/format";
import { findRashdulQibla, greatCircleDistanceKm, qiblaBearing } from "../lib/falak/qibla";
import { localSolarNoonMinutes, solarCoordinates, solarPositionAt } from "../lib/falak/solar";
import { formatHijriCivil, gregorianToHijriCivil } from "../lib/falak/hijri";
import { moonPhaseEstimate } from "../lib/falak/moon";

const DEFAULT_METHOD = {
  slug: "digital-falak-default-test",
  name: "Default Indonesia — Uji",
  description: "Parameter awal untuk pengujian engine. Bukan rumus final pengguna.",
  is_verified: false,
  source_note: "Metode uji internal. Ganti dengan rumus rujukan Anda untuk versi final.",
  parameters: {
    fajr_angle: 20,
    isha_angle: 18,
    dhuha_altitude: 4.5,
    asr_shadow_factor: 1,
    ihtiyat_minutes: 2,
  },
};

const NAV = [
  ["home", "Ringkasan", "⌂"],
  ["prayer", "Waktu Salat", "◴"],
  ["qibla", "Arah Kiblat", "◇"],
  ["solar", "Matahari", "☼"],
  ["hilal", "Hilal", "◐"],
  ["calendar", "Kalender", "▦"],
  ["settings", "Pengaturan", "⚙"],
];

const PRAYER_LABELS = [
  ["fajr", "Subuh"],
  ["sunrise", "Terbit"],
  ["dhuha", "Dhuha"],
  ["dhuhr", "Zuhur"],
  ["asr", "Asar"],
  ["maghrib", "Magrib"],
  ["isha", "Isya"],
];

function localDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function SectionTitle({ eyebrow, title, text }) {
  return (
    <div className="section-title">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
    </div>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

function StatusBadge({ verified }) {
  return verified ? <span className="badge success">Terverifikasi</span> : <span className="badge warn">Metode Uji</span>;
}

export default function FalakApp() {
  const [active, setActive] = useState("home");
  const [date, setDate] = useState(() => new Date());
  const [location, setLocation] = useState({
    label: "Palu, Sulawesi Tengah",
    latitude: -0.8917,
    longitude: 119.8707,
    elevation: 15,
    timezone: 8,
  });
  const [method, setMethod] = useState(DEFAULT_METHOD);
  const [methods, setMethods] = useState([DEFAULT_METHOD]);
  const [methodSource, setMethodSource] = useState("fallback");
  const [showFormula, setShowFormula] = useState(false);
  const [geoState, setGeoState] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("df-location");
    if (saved) {
      try { setLocation(JSON.parse(saved)); } catch {}
    }
    const settings = window.localStorage.getItem("df-method-parameters");
    if (settings) {
      try {
        const parsed = JSON.parse(settings);
        setMethod((m) => ({ ...m, parameters: { ...m.parameters, ...parsed } }));
      } catch {}
    }
    fetch("/api/methods")
      .then((r) => r.json())
      .then((payload) => {
        if (payload.methods?.length) {
          setMethods(payload.methods);
          setMethod(payload.methods[0]);
          setMethodSource(payload.source || "supabase");
        }
      })
      .catch(() => {});

    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const handler = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("df-location", JSON.stringify(location));
  }, [location]);

  const prayers = useMemo(
    () => calculatePrayerTimes({ date, ...location, parameters: method.parameters }),
    [date, location, method]
  );

  const noonProbe = useMemo(() => {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    return d;
  }, [date]);
  const solar = useMemo(() => solarCoordinates(noonProbe), [noonProbe]);
  const solarNoon = useMemo(() => localSolarNoonMinutes(location.longitude, location.timezone, solar.equationOfTime), [location, solar]);
  useMemo(() => solarPositionAt({ date: new Date(date), latitude: location.latitude, longitude: location.longitude, timezone: location.timezone }), [date, location]);
  const qibla = useMemo(() => qiblaBearing(location.latitude, location.longitude), [location]);
  const kaabaDistance = useMemo(() => greatCircleDistanceKm(location.latitude, location.longitude), [location]);
  const rashdul = useMemo(() => findRashdulQibla({ date, latitude: location.latitude, longitude: location.longitude, timezone: location.timezone }), [date, location]);
  const hijri = useMemo(() => gregorianToHijriCivil(date), [date]);
  const moon = useMemo(() => moonPhaseEstimate(date), [date]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoState("Perangkat tidak mendukung geolokasi.");
      return;
    }
    setGeoState("Mencari koordinat…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const timezone = -new Date().getTimezoneOffset() / 60;
        setLocation((old) => ({
          ...old,
          label: "Lokasi perangkat",
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          elevation: pos.coords.altitude ? Math.round(pos.coords.altitude) : old.elevation,
          timezone,
        }));
        setGeoState("Koordinat perangkat aktif.");
      },
      () => setGeoState("Izin lokasi tidak tersedia. Masukkan koordinat manual."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
    );
  };

  const updateParameter = (key, value) => {
    const parameters = { ...method.parameters, [key]: Number(value) };
    setMethod((m) => ({ ...m, parameters }));
    window.localStorage.setItem("df-method-parameters", JSON.stringify(parameters));
  };

  const changeMethod = (slug) => {
    const next = methods.find((item) => item.slug === slug);
    if (next) setMethod(next);
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  const renderHome = () => (
    <>
      <section className="hero-panel">
        <div>
          <span className="eyebrow light">LABORATORIUM HISAB DIGITAL</span>
          <h1>Falak yang dihitung dari <em>titik Anda.</em></h1>
          <p>Koordinat, tanggal, zona waktu, elevasi, dan metode masuk ke engine. Hasilnya dihitung langsung—bukan mengambil jadwal jadi.</p>
          <div className="hero-actions">
            <button className="button gold" onClick={() => setActive("prayer")}>Lihat waktu salat</button>
            <button className="button ghost" onClick={() => setActive("qibla")}>Cek arah kiblat</button>
          </div>
        </div>
        <div className="orbit-card" aria-hidden="true">
          <div className="orbit orbit-a"><i /></div>
          <div className="orbit orbit-b"><i /></div>
          <div className="center-star">✦</div>
          <div className="orbit-copy"><span>{location.latitude.toFixed(4)}°</span><span>{location.longitude.toFixed(4)}°</span></div>
        </div>
      </section>

      <div className="status-strip">
        <div><span>Lokasi aktif</span><strong>{location.label}</strong></div>
        <div><span>Zona waktu</span><strong>UTC{location.timezone >= 0 ? "+" : ""}{location.timezone}</strong></div>
        <div><span>Metode</span><strong>{method.name}</strong></div>
        <StatusBadge verified={method.is_verified} />
      </div>

      <section className="content-section">
        <SectionTitle eyebrow="HARI INI" title="Ringkasan hisab" text="Semua angka berubah mengikuti titik koordinat dan parameter yang aktif." />
        <div className="prayer-grid compact">
          {PRAYER_LABELS.filter(([key]) => key !== "sunrise" && key !== "dhuha").map(([key, label]) => (
            <div className="prayer-tile" key={key}>
              <span>{label}</span>
              <strong>{formatClock(prayers[key])}</strong>
            </div>
          ))}
        </div>
        <div className="feature-grid">
          <button className="feature-card" onClick={() => setActive("qibla")}>
            <span className="feature-icon">◇</span><span><b>Arah Kiblat</b><small>{formatNumber(qibla, 2)}° dari Utara Sejati</small></span><i>↗</i>
          </button>
          <button className="feature-card" onClick={() => setActive("solar")}>
            <span className="feature-icon">☼</span><span><b>Data Matahari</b><small>Deklinasi {formatNumber(solar.declination, 3)}°</small></span><i>↗</i>
          </button>
          <button className="feature-card" onClick={() => setActive("hilal")}>
            <span className="feature-icon">◐</span><span><b>Lab Hilal</b><small>Fase estimasi: {moon.phase}</small></span><i>↗</i>
          </button>
          <button className="feature-card" onClick={() => setActive("calendar")}>
            <span className="feature-icon">▦</span><span><b>Kalender Hijriah</b><small>{formatHijriCivil(hijri)}</small></span><i>↗</i>
          </button>
        </div>
      </section>
    </>
  );

  const renderPrayer = () => (
    <section className="content-section page-section">
      <SectionTitle eyebrow="HISAB WAKTU SALAT" title="Dihitung dari koordinat, bukan tabel jadwal" text="Parameter metode dapat Anda ganti. Engine akan menghitung ulang seluruh waktu secara langsung." />
      <div className="two-column">
        <div className="panel">
          <div className="panel-head"><div><span className="mini-label">JADWAL HASIL HISAB</span><h3>{date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3></div><StatusBadge verified={method.is_verified} /></div>
          <div className="prayer-list">
            {PRAYER_LABELS.map(([key, label]) => (
              <div className={`prayer-row ${key === "maghrib" ? "highlight" : ""}`} key={key}>
                <span>{label}</span><strong>{formatClock(prayers[key])}</strong>
              </div>
            ))}
          </div>
          <button className="text-button" onClick={() => setShowFormula((v) => !v)}>{showFormula ? "Tutup proses hisab ↑" : "Lihat proses hisab ↓"}</button>
          {showFormula ? (
            <div className="formula-box">
              <b>Jejak perhitungan</b>
              <code>Deklinasi Matahari = {prayers.meta.declination.toFixed(6)}°</code>
              <code>Equation of Time = {prayers.meta.equationOfTime.toFixed(6)} menit</code>
              <code>Koreksi ufuk = {prayers.meta.horizonAltitude.toFixed(6)}°</code>
              <code>Altitude Asar = {prayers.meta.asrAltitude.toFixed(6)}°</code>
              <code>Solar noon = {prayers.raw.solarNoon.toFixed(4)} menit lokal</code>
              <small>Urutan engine: tanggal → Julian Day → koordinat Matahari → deklinasi/EoT → sudut waktu → koreksi zona waktu, elevasi, dan ihtiyat.</small>
            </div>
          ) : null}
        </div>
        <div className="panel parameter-panel">
          <span className="mini-label">PARAMETER AKTIF</span>
          <h3>{method.name}</h3>
          <p>{method.description}</p>
          <label>Sudut Subuh <b>{method.parameters.fajr_angle}°</b><input type="range" min="14" max="22" step="0.1" value={method.parameters.fajr_angle} onChange={(e) => updateParameter("fajr_angle", e.target.value)} /></label>
          <label>Sudut Isya <b>{method.parameters.isha_angle}°</b><input type="range" min="14" max="22" step="0.1" value={method.parameters.isha_angle} onChange={(e) => updateParameter("isha_angle", e.target.value)} /></label>
          <label>Altitude Dhuha <b>{method.parameters.dhuha_altitude}°</b><input type="range" min="2" max="8" step="0.1" value={method.parameters.dhuha_altitude} onChange={(e) => updateParameter("dhuha_altitude", e.target.value)} /></label>
          <label>Ihtiyat <b>{method.parameters.ihtiyat_minutes} menit</b><input type="range" min="0" max="5" step="1" value={method.parameters.ihtiyat_minutes} onChange={(e) => updateParameter("ihtiyat_minutes", e.target.value)} /></label>
          <div className="notice">Parameter ini masih untuk pengujian. Rumus Anda nanti ditempatkan sebagai metode tersendiri dan dapat dibandingkan.</div>
        </div>
      </div>
    </section>
  );

  const renderQibla = () => (
    <section className="content-section page-section">
      <SectionTitle eyebrow="ARAH KIBLAT" title="Azimut dari titik Anda menuju Ka'bah" text="Bearing dihitung sebagai lintasan lingkaran besar dan ditampilkan terhadap Utara Sejati." />
      <div className="qibla-layout">
        <div className="compass-panel panel">
          <div className="compass">
            <span className="north">U</span><span className="east">T</span><span className="south">S</span><span className="west">B</span>
            <div className="qibla-arrow" style={{ transform: `rotate(${qibla}deg)` }}><i>◆</i></div>
            <div className="compass-center" />
          </div>
          <strong className="bearing">{formatNumber(qibla, 2)}°</strong>
          <span className="bearing-caption">dari Utara Sejati</span>
        </div>
        <div className="qibla-info">
          <div className="metric-grid">
            <Metric label="Azimut kiblat" value={`${formatNumber(qibla, 4)}°`} sub="True North" />
            <Metric label="Jarak lingkaran besar" value={`${formatNumber(kaabaDistance, 0)} km`} sub="estimasi geodesik" />
            <Metric label="Lintang" value={`${formatNumber(location.latitude, 6)}°`} sub={location.latitude < 0 ? "LS" : "LU"} />
            <Metric label="Bujur" value={`${formatNumber(location.longitude, 6)}°`} sub={location.longitude < 0 ? "BB" : "BT"} />
          </div>
          <div className="panel rashdul-card">
            <span className="mini-label">RASHDUL KIBLAT LOKAL</span>
            <h3>Bayangan Matahari searah garis kiblat</h3>
            {rashdul.length ? rashdul.map((item, idx) => <div className="rashdul-time" key={idx}><strong>{formatClock(item.date)}</strong><span>Azimut Matahari {formatNumber(item.azimuth, 2)}° · altitude {formatNumber(item.altitude, 2)}°</span></div>) : <p>Tidak ditemukan perpotongan azimut saat Matahari berada di atas ufuk pada tanggal ini.</p>}
            <small>Hasil rashdul lokal dihitung numerik dari kesamaan azimut Matahari dan azimut kiblat.</small>
          </div>
        </div>
      </div>
    </section>
  );

  const renderSolar = () => (
    <section className="content-section page-section">
      <SectionTitle eyebrow="ASTRONOMI MATAHARI" title="Data Matahari untuk engine hisab" text="Nilai dasar yang digunakan untuk menghitung waktu salat dan analisis bayangan." />
      <div className="metric-grid wide">
        <Metric label="Deklinasi" value={`${formatNumber(solar.declination, 5)}°`} sub="solar declination" />
        <Metric label="Equation of Time" value={`${formatNumber(solar.equationOfTime, 3)} m`} sub="koreksi waktu semu" />
        <Metric label="Solar noon" value={formatClock(new Date(new Date(date).setHours(0, solarNoon, 0, 0)))} sub="tengah hari Matahari" />
        <Metric label="Julian Day" value={formatNumber(solar.jd, 5)} sub="JD" />
      </div>
      <div className="panel solar-explain">
        <div className="sun-disc">☼</div>
        <div><span className="mini-label">ALUR ENGINE</span><h3>Tanggal → Julian Day → koordinat ekliptika → deklinasi & EoT</h3><p>Engine kemudian membentuk sudut jam untuk setiap altitude target. Inilah fondasi yang dipakai modul waktu salat.</p></div>
      </div>
    </section>
  );

  const renderHilal = () => (
    <section className="content-section page-section">
      <SectionTitle eyebrow="LAB HILAL" title="Modul lunar siap menerima rumus Anda" text="Versi awal hanya menampilkan estimasi fase. Tinggi hilal, elongasi, ijtimak, moonset, dan kriteria visibilitas belum kami klaim final sebelum rumus rujukan Anda dimasukkan." />
      <div className="hilal-hero panel">
        <div className="moon-visual">◐</div>
        <div><span className="mini-label">ESTIMASI FASE ASTRONOMIS SEDERHANA</span><h3>{moon.phase}</h3><p>Umur siklus sinodik sekitar <b>{formatNumber(moon.age, 2)} hari</b> · iluminasi estimasi <b>{formatNumber(moon.illumination * 100, 1)}%</b>.</p><div className="notice">Nilai ini hanya indikator fase untuk prototipe UI, bukan keputusan awal bulan atau hasil rukyat/hisab resmi.</div></div>
      </div>
      <div className="coming-grid">
        {["Waktu ijtimak", "Tinggi hilal", "Elongasi", "Azimut Bulan", "Moonset", "Umur hilal"].map((x) => <div className="coming-card" key={x}><span>MODUL RUMUS</span><b>{x}</b><small>Siap dihubungkan ke formula Anda</small></div>)}
      </div>
    </section>
  );

  const renderCalendar = () => (
    <section className="content-section page-section">
      <SectionTitle eyebrow="KALENDER" title="Konversi Masehi ↔ Hijriah aritmetika" text="Konversi awal memakai kalender Hijriah sipil/tabular, sehingga dapat berbeda dari penetapan awal bulan berbasis rukyat atau metode hisab tertentu." />
      <div className="calendar-card panel">
        <div className="gregorian"><span>{date.toLocaleDateString("id-ID", { weekday: "long" })}</span><strong>{date.getDate()}</strong><b>{date.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</b></div>
        <div className="calendar-arrow">→</div>
        <div className="hijri-date"><span>HIJRIAH SIPIL</span><strong>{hijri.day}</strong><b>{formatHijriCivil(hijri).replace(`${hijri.day} `, "")}</b></div>
      </div>
      <div className="notice standalone">Untuk modul awal bulan final, kalender akan dihubungkan ke engine hilal/metode hisab Anda, bukan hanya konversi aritmetika.</div>
    </section>
  );

  const renderSettings = () => (
    <section className="content-section page-section">
      <SectionTitle eyebrow="KONTROL HISAB" title="Lokasi dan metode perhitungan" text="Ubah titik sekecil apa pun dan seluruh hasil akan dihitung ulang." />
      <div className="two-column">
        <div className="panel form-panel">
          <span className="mini-label">LOKASI PERHITUNGAN</span><h3>{location.label}</h3>
          <button className="button primary full" onClick={useMyLocation}>Gunakan lokasi perangkat</button>
          {geoState ? <small className="geo-state">{geoState}</small> : null}
          <label>Nama lokasi<input type="text" value={location.label} onChange={(e) => setLocation({ ...location, label: e.target.value })} /></label>
          <div className="field-pair">
            <label>Latitude<input type="number" step="0.000001" value={location.latitude} onChange={(e) => setLocation({ ...location, latitude: Number(e.target.value) })} /></label>
            <label>Longitude<input type="number" step="0.000001" value={location.longitude} onChange={(e) => setLocation({ ...location, longitude: Number(e.target.value) })} /></label>
          </div>
          <div className="field-pair">
            <label>Elevasi (m)<input type="number" value={location.elevation} onChange={(e) => setLocation({ ...location, elevation: Number(e.target.value) })} /></label>
            <label>Zona waktu UTC<input type="number" step="0.5" value={location.timezone} onChange={(e) => setLocation({ ...location, timezone: Number(e.target.value) })} /></label>
          </div>
        </div>
        <div className="panel form-panel">
          <span className="mini-label">METODE HISAB</span><h3>Pilih metode aktif</h3>
          <label>Metode<select value={method.slug} onChange={(e) => changeMethod(e.target.value)}>{methods.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}</select></label>
          <div className="method-detail"><StatusBadge verified={method.is_verified} /><p>{method.source_note}</p></div>
          <div className="source-row"><span>Sumber konfigurasi</span><b>{methodSource === "supabase" ? "Supabase · df_falak_methods" : "Fallback lokal"}</b></div>
          <div className="source-row"><span>Database sementara</span><b>Terisolasi prefix df_</b></div>
          <div className="source-row"><span>Engine hisab</span><b>Berjalan independen</b></div>
        </div>
      </div>
    </section>
  );

  const body = active === "home" ? renderHome() : active === "prayer" ? renderPrayer() : active === "qibla" ? renderQibla() : active === "solar" ? renderSolar() : active === "hilal" ? renderHilal() : active === "calendar" ? renderCalendar() : renderSettings();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setActive("home")}><span className="brand-mark">✦</span><span><b>Digital Falak</b><small>Hisab berbasis koordinat</small></span></button>
        <nav>{NAV.map(([id, label, icon]) => <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}><i>{icon}</i><span>{label}</span></button>)}</nav>
        <div className="sidebar-foot"><span>ENGINE STATUS</span><b><i /> Aktif · Lokal</b><small>Supabase hanya menyimpan konfigurasi & data.</small></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">✦</span><b>Digital Falak</b></div>
          <div className="date-control"><span>Tanggal hisab</span><input type="date" value={localDateInput(date)} onChange={(e) => setDate(parseLocalDate(e.target.value))} /></div>
          <div className="top-actions">
            <button className="location-pill" onClick={() => setActive("settings")}><span>◎</span><div><small>Lokasi aktif</small><b>{location.label}</b></div></button>
            {installPrompt ? <button className="install-button" onClick={install}>Install</button> : null}
          </div>
        </header>
        {body}
        <footer><b>Digital Falak</b><span>Prototipe hisab · verifikasi metode sebelum digunakan sebagai rujukan ibadah.</span></footer>
      </main>

      <nav className="bottom-nav">{NAV.slice(0, 5).map(([id, label, icon]) => <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}><i>{icon}</i><span>{label}</span></button>)}</nav>
    </div>
  );
}
