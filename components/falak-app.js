"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./icons";
import { calculatePrayerTimes } from "../lib/falak/prayer-times";
import { formatClock, formatNumber } from "../lib/falak/format";
import { findRashdulQibla, qiblaGeodesic } from "../lib/falak/qibla";
import { formatHijriCivil, gregorianToHijriCivil } from "../lib/falak/hijri";
import { moonPhaseEstimate } from "../lib/falak/moon";
import { normalize180, normalize360 } from "../lib/falak/math";
import { solarPositionAt } from "../lib/falak/solar";

const DEFAULT_METHOD = {
  id: null,
  slug: "kemenag-ri-spa-reference",
  name: "Kemenag RI — Referensi Falak",
  description: "Profil referensi Indonesia berbasis koordinat dengan engine NREL SPA.",
  engine_type: "nrel_spa",
  version: "2026.1",
  is_verified: false,
  source_note: "Fallback lokal; verifikasi bersama ahli falak sebelum menjadi metode final.",
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
  formulas: [],
};

const NAV = [
  ["home", "Ringkasan", "home"],
  ["prayer", "Waktu Salat", "clock"],
  ["qibla", "Kiblat", "qibla"],
  ["solar", "Matahari", "sun"],
  ["hilal", "Hilal", "moon"],
  ["calendar", "Kalender", "calendar"],
  ["settings", "Pengaturan", "settings"],
];

const PRAYERS = [
  ["fajr", "Subuh"],
  ["sunrise", "Terbit"],
  ["dhuha", "Dhuha"],
  ["dhuhr", "Zuhur"],
  ["asr", "Asar"],
  ["maghrib", "Magrib"],
  ["isha", "Isya"],
];

const MAIN_PRAYERS = PRAYERS.filter(([key]) => !["sunrise", "dhuha"].includes(key));

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function circularSmooth(previous, next, factor = 0.2) {
  if (previous == null) return normalize360(next);
  const delta = normalize180(next - previous);
  return normalize360(previous + delta * factor);
}

function tiltCompensatedHeading(alpha, beta, gamma) {
  if (![alpha, beta, gamma].every(Number.isFinite)) return null;

  // W3C: when the screen is essentially horizontal, compass heading is
  // 360 - alpha. The tilt matrix becomes undefined/unstable near beta=gamma=0.
  if (Math.abs(beta) < 5 && Math.abs(gamma) < 5) {
    return normalize360(360 - alpha);
  }

  const degToRad = Math.PI / 180;
  const x = beta * degToRad;
  const y = gamma * degToRad;
  const z = alpha * degToRad;
  const cX = Math.cos(x);
  const cY = Math.cos(y);
  const cZ = Math.cos(z);
  const sX = Math.sin(x);
  const sY = Math.sin(y);
  const sZ = Math.sin(z);
  const vX = -cZ * sY - sZ * sX * cY;
  const vY = -sZ * sY + cZ * sX * cY;
  let heading = Math.atan2(vX, vY);
  if (heading < 0) heading += Math.PI * 2;
  return heading * (180 / Math.PI);
}

function SectionTitle({ eyebrow, title, text, action }) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {text ? <p>{text}</p> : null}
      </div>
      {action}
    </div>
  );
}

function MethodBadge({ method }) {
  return (
    <span className={`method-badge ${method.is_verified ? "verified" : ""}`}>
      <span />
      {method.is_verified ? "Terverifikasi ahli" : "Referensi · belum final"}
    </span>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function hydratePrayer(serverPrayer, fallback, selectedDate) {
  if (!serverPrayer) return fallback;
  const keys = ["fajr","sunrise","dhuha","dhuhr","asr","maghrib","isha"];
  const result = { ...fallback, raw: serverPrayer.raw, meta: serverPrayer.meta };
  for (const key of keys) {
    const hour = Number(serverPrayer.raw?.[key]);
    if (!Number.isFinite(hour)) {
      result[key] = null;
      continue;
    }
    const localWallClock = new Date(selectedDate);
    localWallClock.setHours(0, 0, 0, 0);
    localWallClock.setMilliseconds(hour * 3600000);
    result[key] = localWallClock;
  }
  return result;
}

export default function FalakApp() {
  const [active, setActive] = useState("home");
  const [date, setDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [location, setLocation] = useState({
    label: "Palu, Sulawesi Tengah",
    latitude: -0.8917,
    longitude: 119.8707,
    elevation: 15,
    timezone: 8,
    accuracy: null,
  });
  const [method, setMethod] = useState(DEFAULT_METHOD);
  const [methods, setMethods] = useState([DEFAULT_METHOD]);
  const [methodSource, setMethodSource] = useState("fallback");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [geoState, setGeoState] = useState("");
  const [showCalc, setShowCalc] = useState(false);
  const [serverHisab, setServerHisab] = useState(null);
  const [hisabState, setHisabState] = useState("local");

  const [heading, setHeading] = useState(null);
  const [compassPermission, setCompassPermission] = useState("idle");
  const [compassSource, setCompassSource] = useState("");
  const [compassAccuracy, setCompassAccuracy] = useState(null);
  const [deviceTilt, setDeviceTilt] = useState(null);
  const [compassOffset, setCompassOffset] = useState(0);
  const headingRef = useRef(null);
  const hasAbsolute = useRef(false);
  const magneticDeclination = Number(serverHisab?.magneticDeclination ?? 0);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("df-location-v2");
      if (saved) setLocation(JSON.parse(saved));
      const savedOffset = Number(localStorage.getItem("df-compass-offset") || 0);
      if (Number.isFinite(savedOffset)) setCompassOffset(savedOffset);
    } catch {}

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

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const installHandler = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", installHandler);
    return () => window.removeEventListener("beforeinstallprompt", installHandler);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("df-location-v2", JSON.stringify(location));
    } catch {}
  }, [location]);

  useEffect(() => {
    if (active !== "qibla" || compassPermission !== "idle") return;
    if (typeof window.DeviceOrientationEvent === "undefined") {
      setCompassPermission("unsupported");
    } else if (typeof window.DeviceOrientationEvent.requestPermission !== "function") {
      setCompassPermission("granted");
    }
  }, [active, compassPermission]);

  useEffect(() => {
    if (active !== "qibla" || compassPermission !== "granted") return;

    const onOrientation = (event) => {
      const beta = Number(event.beta);
      const gamma = Number(event.gamma);
      if (Number.isFinite(beta) && Number.isFinite(gamma)) {
        setDeviceTilt(Math.sqrt(beta * beta + gamma * gamma));
      }

      let nextHeading = null;
      let source = "";

      if (
        typeof event.webkitCompassHeading === "number" &&
        Number.isFinite(event.webkitCompassHeading) &&
        event.webkitCompassHeading >= 0
      ) {
        // WebKit explicitly reports magnetic north. Convert to true north
        // with WMM2025 declination from the server calculation route.
        nextHeading = normalize360(
          event.webkitCompassHeading + magneticDeclination + compassOffset
        );
        source = "True North · WMM2025";
        hasAbsolute.current = true;
        if (
          typeof event.webkitCompassAccuracy === "number" &&
          Number.isFinite(event.webkitCompassAccuracy)
        ) {
          setCompassAccuracy(
            event.webkitCompassAccuracy < 0 ? -1 : event.webkitCompassAccuracy
          );
        }
      } else if (
        Number.isFinite(event.alpha) &&
        (event.absolute === true || event.type === "deviceorientationabsolute")
      ) {
        const raw = tiltCompensatedHeading(
          Number(event.alpha),
          beta || 0,
          gamma || 0
        );
        if (raw != null) {
          const screenAngle =
            Number(window.screen?.orientation?.angle || window.orientation || 0) || 0;
          nextHeading = normalize360(raw + screenAngle + compassOffset);
          source = "Sensor absolut";
          hasAbsolute.current = true;
        }
      } else if (Number.isFinite(event.alpha) && !hasAbsolute.current) {
        const raw = tiltCompensatedHeading(
          Number(event.alpha),
          beta || 0,
          gamma || 0
        );
        if (raw != null) {
          nextHeading = normalize360(raw + compassOffset);
          source = "Sensor relatif";
        }
      }

      if (nextHeading != null) {
        const smooth = circularSmooth(headingRef.current, nextHeading, 0.18);
        headingRef.current = smooth;
        setHeading(smooth);
        setCompassSource(source);
      }
    };

    window.addEventListener("deviceorientationabsolute", onOrientation, true);
    window.addEventListener("deviceorientation", onOrientation, true);
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrientation, true);
      window.removeEventListener("deviceorientation", onOrientation, true);
    };
  }, [active, compassPermission, magneticDeclination, compassOffset]);

  const localPrayers = useMemo(
    () =>
      calculatePrayerTimes({
        date,
        ...location,
        parameters: method.parameters,
        formulas: method.formulas,
      }),
    [date, location, method]
  );

  const minuteTick = Math.floor(now.getTime() / 60000);

  useEffect(() => {
    const controller = new AbortController();
    setHisabState((current) => (current === "nrel" ? "refreshing" : "loading"));

    fetch("/api/hisab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        day: dateKey(date),
        instant: sameDay(date, now) ? now.toISOString() : new Date(
          Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 4, 0, 0)
        ).toISOString(),
        latitude: location.latitude,
        longitude: location.longitude,
        elevation: location.elevation,
        timezone: location.timezone,
        parameters: method.parameters || {},
        formulas: method.formulas || [],
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("hisab api");
        return response.json();
      })
      .then((payload) => {
        setServerHisab(payload);
        setHisabState(payload.source === "nrel-spa" ? "nrel" : "local");
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setHisabState("local");
        }
      });

    return () => controller.abort();
  }, [
    date,
    minuteTick,
    location.latitude,
    location.longitude,
    location.elevation,
    location.timezone,
    method.slug,
    method.parameters,
    method.formulas,
  ]);

  const prayers = useMemo(
    () => hydratePrayer(serverHisab?.prayer, localPrayers, date),
    [serverHisab, localPrayers, date]
  );

  const qibla = useMemo(
    () => qiblaGeodesic(location.latitude, location.longitude),
    [location.latitude, location.longitude]
  );

  const qiblaRelative = useMemo(
    () => (heading == null ? qibla.bearing : normalize360(qibla.bearing - heading)),
    [qibla.bearing, heading]
  );

  const qiblaError = useMemo(
    () => (heading == null ? null : Math.abs(normalize180(qibla.bearing - heading))),
    [qibla.bearing, heading]
  );

  const localRashdul = useMemo(
    () =>
      findRashdulQibla({
        date,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone,
      }),
    [date, location]
  );

  const rashdul = serverHisab?.rashdul?.length
    ? serverHisab.rashdul
    : localRashdul;

  const hijri = useMemo(() => gregorianToHijriCivil(date), [date]);
  const moon = useMemo(() => moonPhaseEstimate(date), [date]);

  const solarMoment = useMemo(() => {
    if (sameDay(date, now)) return now;
    const selected = new Date(date);
    selected.setHours(12, 0, 0, 0);
    return selected;
  }, [date, now]);

  const localSolarNow = useMemo(
    () =>
      solarPositionAt({
        date: solarMoment,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone,
      }),
    [solarMoment, location.latitude, location.longitude, location.timezone]
  );

  const solarNow = serverHisab?.solar || {
    azimuth: localSolarNow.azimuth,
    altitude: localSolarNow.altitude,
    zenith: 90 - localSolarNow.altitude,
  };

  const nextPrayer = useMemo(() => {
    const deviceTimezone = -now.getTimezoneOffset() / 60;
    if (!sameDay(date, now) || Math.abs(deviceTimezone - location.timezone) > 0.01) {
      return null;
    }
    for (const [key, label] of MAIN_PRAYERS) {
      const value = prayers[key];
      if (value && value.getTime() > now.getTime()) {
        return {
          key,
          label,
          date: value,
          minutes: Math.max(0, Math.ceil((value - now) / 60000)),
        };
      }
    }
    return null;
  }, [date, now, prayers, location.timezone]);

  async function enableCompass() {
    if (typeof window.DeviceOrientationEvent === "undefined") {
      setCompassPermission("unsupported");
      return;
    }
    try {
      if (typeof window.DeviceOrientationEvent.requestPermission === "function") {
        const result = await window.DeviceOrientationEvent.requestPermission();
        setCompassPermission(result === "granted" ? "granted" : "denied");
      } else {
        setCompassPermission("granted");
      }
    } catch {
      setCompassPermission("denied");
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoState("Geolokasi tidak tersedia di perangkat ini.");
      return;
    }
    setGeoState("Membaca GPS…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation((current) => ({
          ...current,
          label: "Lokasi perangkat",
          latitude: Number(position.coords.latitude.toFixed(7)),
          longitude: Number(position.coords.longitude.toFixed(7)),
          elevation: Number.isFinite(position.coords.altitude)
            ? Math.round(position.coords.altitude)
            : current.elevation,
          timezone: -new Date().getTimezoneOffset() / 60,
          accuracy: Math.round(position.coords.accuracy),
        }));
        setGeoState(
          `GPS aktif · akurasi ±${Math.round(position.coords.accuracy)} m`
        );
      },
      (error) => {
        setGeoState(
          error.code === 1
            ? "Izin lokasi ditolak."
            : "GPS belum mendapatkan posisi. Coba lagi di area terbuka."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  function chooseMethod(slug) {
    const selected = methods.find((item) => item.slug === slug);
    if (selected) setMethod(selected);
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  const home = (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="live-chip"><span /> {hisabState === "nrel" || hisabState === "refreshing" ? "NREL SPA AKTIF" : "FALLBACK LOKAL AKTIF"}</div>
          <h1>Falak dari <em>koordinat nyata</em>, bukan tabel jadwal.</h1>
          <p>Digital Falak menghitung posisi Matahari dan arah kiblat dari titik pengguna, tanggal, elevasi, zona waktu, serta metode falak yang aktif.</p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={()=>setActive("prayer")}><Icon name="clock" size={16}/> Waktu salat</button>
            <button className="secondary-btn" onClick={()=>setActive("qibla")}><Icon name="compass" size={16}/> Arah kiblat</button>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring one"/><div className="orbit-ring two"/>
          <div className="orbit-core"><Icon name="sun" size={38}/></div>
          <span className="coord north">{formatNumber(location.latitude,4)}°</span>
          <span className="coord east">{formatNumber(location.longitude,4)}°</span>
        </div>
      </section>

      <section className="quick-status">
        <div><span>Lokasi</span><b>{location.label}</b><small>{formatNumber(location.latitude,5)}°, {formatNumber(location.longitude,5)}°</small></div>
        <div><span>Engine</span><b>{hisabState === "nrel" || hisabState === "refreshing" ? "NREL SPA" : "Local fallback"}</b><small>{hisabState === "refreshing" ? "memperbarui…" : "posisi Matahari"}</small></div>
        <div><span>Kiblat</span><b>WGS84</b><small>{formatNumber(qibla.bearing,2)}° True North</small></div>
        <div><span>Metode</span><b>{method.name}</b><MethodBadge method={method}/></div>
      </section>

      <section className="page-section">
        <SectionTitle eyebrow="HARI INI" title="Waktu yang dihitung untuk titik ini" text="Beda koordinat dapat menghasilkan beda menit. Ubah lokasi, semua hasil dihitung ulang." action={<button className="mini-action" onClick={useMyLocation}><Icon name="location" size={14}/> Gunakan GPS</button>}/>
        {nextPrayer ? (
          <div className="next-prayer">
            <div><span>BERIKUTNYA</span><h3>{nextPrayer.label}</h3><p>{nextPrayer.minutes} menit lagi</p></div>
            <strong>{formatClock(nextPrayer.date)}</strong>
          </div>
        ) : null}
        <div className="prayer-cards">
          {MAIN_PRAYERS.map(([key,label])=>(
            <button key={key} className={`prayer-card ${nextPrayer?.key===key?"next":""}`} onClick={()=>setActive("prayer")}>
              <span>{label}</span><strong>{formatClock(prayers[key])}</strong><small>{nextPrayer?.key===key?"waktu berikutnya":"hasil hisab"}</small>
            </button>
          ))}
        </div>

        <div className="module-grid">
          <button onClick={()=>setActive("qibla")}><span className="module-icon"><Icon name="qibla"/></span><div><b>Kompas Kiblat</b><small>Azimut WGS84 + sensor perangkat</small></div><Icon name="chevron" size={15}/></button>
          <button onClick={()=>setActive("solar")}><span className="module-icon"><Icon name="sun"/></span><div><b>Posisi Matahari</b><small>Azimut & elevasi real-time</small></div><Icon name="chevron" size={15}/></button>
          <button onClick={()=>setActive("hilal")}><span className="module-icon"><Icon name="moon"/></span><div><b>Lab Hilal</b><small>Kerangka rumus lunar</small></div><Icon name="chevron" size={15}/></button>
          <Link href="/admin"><span className="module-icon"><Icon name="admin"/></span><div><b>Method Studio</b><small>Admin metode & formula</small></div><Icon name="chevron" size={15}/></Link>
        </div>
      </section>
    </>
  );

  const prayerPage = (
    <section className="page-section full">
      <SectionTitle eyebrow="WAKTU SALAT" title="Hisab berdasarkan posisi Matahari" text="Engine astronomi dan parameter fikih dipisahkan. NREL SPA menghitung posisi Matahari; metode aktif menentukan sudut, bayangan Asar, dan ihtiyat."/>
      <div className="two-col">
        <div className="surface-card">
          <div className="card-head"><div><span className="eyebrow">HASIL HISAB</span><h3>{date.toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</h3></div><MethodBadge method={method}/></div>
          <div className="prayer-table">
            {PRAYERS.map(([key,label])=><div key={key} className={nextPrayer?.key===key?"active":""}><span>{label}</span><strong>{formatClock(prayers[key])}</strong></div>)}
          </div>
          <button className="calculation-toggle" onClick={()=>setShowCalc(!showCalc)}>{showCalc?"Tutup rincian":"Lihat rincian perhitungan"} <Icon name="chevron" size={14}/></button>
          {showCalc ? <div className="calc-details">
            <div><span>Engine astronomi</span><b>{prayers.meta.engine}</b></div>
            <div><span>Target Subuh</span><b>{formatNumber(prayers.meta.fajrTargetAltitude ?? -prayers.meta.fajrAngle,4)}°</b></div>
            <div><span>Target Isya</span><b>{formatNumber(prayers.meta.ishaTargetAltitude ?? -prayers.meta.ishaAngle,4)}°</b></div>
            <div><span>Target Dhuha</span><b>{formatNumber(prayers.meta.dhuhaTargetAltitude ?? prayers.meta.dhuhaAltitude,4)}°</b></div>
            <div><span>Asar</span><b>faktor bayangan {prayers.meta.asrFactor}×</b></div>
            <div><span>Altitude target Asar</span><b>{formatNumber(prayers.meta.asrTargetAltitude,4)}°</b></div>
            <div><span>Elevasi titik</span><b>{formatNumber(location.elevation,0)} m</b></div>
            <div><span>Atmosfer</span><b>{prayers.meta.temperature}°C · {prayers.meta.pressure} mbar</b></div>
          </div>:null}
        </div>
        <div className="surface-card method-card">
          <span className="eyebrow">METODE AKTIF</span><h3>{method.name}</h3><p>{method.description}</p>
          <div className="method-meta"><span>Engine<b>{method.engine_type}</b></span><span>Versi<b>{method.version}</b></span><span>Sumber<b>{methodSource==="supabase"?"Database metode":"Fallback lokal"}</b></span></div>
          <div className="parameter-list">
            <div><span>Sudut Subuh</span><b>{method.parameters.fajr_angle}°</b></div>
            <div><span>Sudut Isya</span><b>{method.parameters.isha_angle}°</b></div>
            <div><span>Faktor Asar</span><b>{method.parameters.asr_shadow_factor}×</b></div>
            <div><span>Ihtiyat Zuhur</span><b>{method.parameters.dhuhr_ihtiyat_minutes} menit</b></div>
          </div>
          <label className="select-label">Ganti metode<select value={method.slug} onChange={(e)=>chooseMethod(e.target.value)}>{methods.map((m)=><option key={m.slug} value={m.slug}>{m.name}</option>)}</select></label>
          <Link className="admin-inline" href="/admin"><Icon name="admin" size={15}/> Kelola metode di Admin</Link>
        </div>
      </div>
    </section>
  );

  const qiblaPage = (
    <section className="page-section full">
      <SectionTitle eyebrow="ARAH KIBLAT" title="Kompas yang mengikuti arah HP" text="Azimut target dihitung di ellipsoid WGS84. Sensor HP hanya digunakan untuk mengetahui arah hadap perangkat—bukan untuk menentukan azimut Ka'bah." action={<button className="mini-action" onClick={useMyLocation}><Icon name="location" size={14}/> Perbarui GPS</button>}/>
      <div className="qibla-grid">
        <div className="surface-card compass-card">
          <div className={`precision-compass ${qiblaError!=null&&qiblaError<=2?"aligned":""}`}>
            <div className="phone-index">▲</div>
            <div className="compass-dial" style={{transform:`rotate(${heading==null?0:-heading}deg)`}}>
              <span className="n">U</span><span className="e">T</span><span className="s">S</span><span className="w">B</span>
              <div className="dial-line vertical"/><div className="dial-line horizontal"/>
              {Array.from({length:24}).map((_,i)=><i key={i} style={{transform:`rotate(${i*15}deg)`}} />)}
            </div>
            <div className="qibla-needle" style={{transform:`rotate(${qiblaRelative}deg)`}}><span><Icon name="qibla" size={18}/></span></div>
            <div className="compass-hub"/>
          </div>
          <div className="compass-readout">
            <strong>{heading==null?"—":`${formatNumber(heading,1)}°`}</strong>
            <span>arah hadap HP</span>
          </div>
          {qiblaError!=null&&qiblaError<=2?<div className="aligned-pill"><Icon name="check" size={14}/> Tepat ke arah kiblat</div>:null}
          {compassPermission!=="granted"||heading==null?<button className="primary-btn compass-activate" onClick={enableCompass}><Icon name="compass" size={16}/> Aktifkan kompas HP</button>:null}
          <div className={`sensor-status ${compassSource==="Sensor relatif"||compassAccuracy===-1?"warning":""}`}>
            <Icon name={compassSource==="Sensor relatif"||compassAccuracy===-1?"warning":"compass"} size={15}/>
            <div>
              <b>{heading==null?"Sensor belum aktif":compassSource}</b>
              <small>
                {heading==null
                  ?"Gunakan HP yang memiliki magnetometer / sensor orientasi."
                  : compassAccuracy===-1
                    ?"Kompas belum terkalibrasi. Lakukan gerakan angka 8 sebelum digunakan."
                    : compassSource==="Sensor relatif"
                      ?"Arah bergerak, tetapi tidak boleh dianggap presisi. Kalibrasi atau gunakan perangkat dengan heading absolut."
                      : compassSource==="True North · WMM2025"
                        ?`Heading magnetik dikoreksi ke True North dengan WMM2025 (${magneticDeclination>=0?"+":""}${formatNumber(magneticDeclination,2)}°).`
                        :"Heading absolut aktif dan sudah dihaluskan."}
              </small>
            </div>
          </div>
          {deviceTilt!=null&&deviceTilt>45?<div className="tilt-warning">Pegang HP lebih mendatar agar heading lebih stabil.</div>:null}
          <div className="compass-offset">
            <div><span>Koreksi perangkat</span><b>{compassOffset>=0?"+":""}{formatNumber(compassOffset,1)}°</b></div>
            <input
              type="range"
              min="-15"
              max="15"
              step="0.5"
              value={compassOffset}
              onChange={(event)=>{
                const value=Number(event.target.value);
                setCompassOffset(value);
                localStorage.setItem("df-compass-offset",String(value));
              }}
            />
            <small>Biarkan 0° kecuali sensor HP sudah dibandingkan dengan arah acuan yang diketahui.</small>
          </div>
          <small className="calibration-note">Kalibrasi: gerakkan HP membentuk angka 8, jauhkan dari logam/magnet, lalu pegang relatif datar. Kompas HP tetap memiliki keterbatasan sensor.</small>
        </div>

        <div className="qibla-side">
          <div className="metric-grid">
            <Metric label="Azimut Kiblat" value={`${formatNumber(qibla.bearing,4)}°`} sub="True North · WGS84"/>
            <Metric label="Jarak geodesik" value={`${formatNumber(qibla.distanceKm,0)} km`} sub="lintasan ellipsoid"/>
            <Metric label="Selisih arah HP" value={qiblaError==null?"—":`${formatNumber(qiblaError,1)}°`} sub="semakin kecil semakin tepat"/>
            <Metric label="Deklinasi magnetik" value={`${magneticDeclination>=0?"+":""}${formatNumber(magneticDeclination,2)}°`} sub="WMM2025 · untuk koreksi kompas"/>
            <Metric label="Akurasi GPS" value={location.accuracy?`±${location.accuracy} m`:"—"} sub={location.label}/>
          </div>
          <div className="surface-card rashdul-card">
            <span className="eyebrow">RASHDUL KIBLAT LOKAL</span><h3>Verifikasi dengan Matahari</h3>
            <p>Ketika azimut Matahari berimpit dengan azimut kiblat, bayangan benda tegak dapat dipakai sebagai verifikasi lapangan.</p>
            {rashdul.length?rashdul.map((item,i)=><div className="rashdul-row" key={i}><strong>{String(Math.floor(item.localHour)).padStart(2,"0")}:{String(Math.round((item.localHour%1)*60)).padStart(2,"0")}</strong><div><b>Azimut {formatNumber(item.azimuth,2)}°</b><small>Altitude {formatNumber(item.altitude,2)}°</small></div></div>):<div className="empty-state">Tidak ada perpotongan azimut yang layak pada tanggal ini.</div>}
          </div>
        </div>
      </div>
    </section>
  );

  const solarPage = (
    <section className="page-section full">
      <SectionTitle eyebrow="MATAHARI" title="Posisi Matahari dari NREL SPA" text="Halaman ini menunjukkan posisi Matahari untuk waktu sekarang pada tanggal aktif, dihitung dari titik lokasi dan kondisi observasi."/>
      <div className="metric-grid four">
        <Metric label="Azimut" value={solarNow?`${formatNumber(solarNow.azimuth,4)}°`:"—"} sub="0° Utara · 90° Timur"/>
        <Metric label="Elevasi" value={solarNow?`${formatNumber(solarNow.altitude,4)}°`:"—"} sub="di atas/bawah ufuk"/>
        <Metric label="Solar noon" value={formatClock(prayers.dhuhr)} sub="Zuhur termasuk ihtiyat"/>
        <Metric label="Engine" value="NREL SPA" sub="topocentric solar position"/>
      </div>
      <div className="surface-card science-card"><div className="science-orb"><Icon name="sun" size={42}/></div><div><span className="eyebrow">ASTRONOMI → FIKIH</span><h3>Dua lapisan yang sengaja dipisahkan.</h3><p>Engine astronomi menghitung kapan Matahari mencapai posisi tertentu. Metode falak menentukan posisi mana yang dianggap awal Subuh, Isya, Dhuha, Asar, serta berapa ihtiyat yang dipakai.</p></div></div>
    </section>
  );

  const hilalPage = (
    <section className="page-section full">
      <SectionTitle eyebrow="LAB HILAL" title="Lunar engine belum dijadikan keputusan awal bulan" text="Bagian ini masih laboratorium. Kami tidak menampilkan presisi palsu sebelum rumus hilal yang disepakati ahli dimasukkan."/>
      <div className="surface-card hilal-panel"><div className="moon-art"><Icon name="moon" size={60}/></div><div><span className="eyebrow">INDIKATOR FASE SAJA</span><h3>{moon.phase}</h3><p>Umur siklus estimasi {formatNumber(moon.age,2)} hari · iluminasi {formatNumber(moon.illumination*100,1)}%.</p><div className="warning-box"><Icon name="warning" size={16}/> Bukan nilai resmi tinggi hilal, elongasi, ijtimak, atau imkan rukyat.</div></div></div>
      <div className="lab-grid">{["Ijtimak","Tinggi Hilal Toposentris","Elongasi","Azimut Bulan","Moonset","Imkan Rukyat"].map((x)=><div key={x}><span>FORMULA SLOT</span><b>{x}</b><small>menunggu metode ahli</small></div>)}</div>
    </section>
  );

  const calendarPage = (
    <section className="page-section full">
      <SectionTitle eyebrow="KALENDER" title="Konversi kalender sebagai alat bantu" text="Konversi Hijriah di sini masih tabular/sipil. Penetapan awal bulan nantinya dapat dipisahkan dari kalender aritmetika."/>
      <div className="calendar-convert surface-card"><div><span>MASEHI</span><strong>{date.getDate()}</strong><b>{date.toLocaleDateString("id-ID",{month:"long",year:"numeric"})}</b></div><Icon name="chevron" size={24}/><div className="hijri"><span>HIJRIAH SIPIL</span><strong>{hijri.day}</strong><b>{formatHijriCivil(hijri).replace(`${hijri.day} `,"")}</b></div></div>
    </section>
  );

  const settingsPage = (
    <section className="page-section full">
      <SectionTitle eyebrow="PENGATURAN" title="Titik observasi & metode" text="Koordinat adalah input utama. Anda dapat memakai GPS atau memasukkan titik manual untuk simulasi lokasi lain."/>
      <div className="two-col">
        <div className="surface-card settings-card">
          <div className="card-head"><div><span className="eyebrow">LOKASI</span><h3>{location.label}</h3></div><button className="icon-btn" onClick={useMyLocation}><Icon name="refresh"/></button></div>
          <button className="primary-btn full-btn" onClick={useMyLocation}><Icon name="location" size={16}/> Gunakan GPS perangkat</button>
          {geoState?<div className="geo-state">{geoState}</div>:null}
          <label>Nama titik<input value={location.label} onChange={(e)=>setLocation({...location,label:e.target.value})}/></label>
          <div className="input-pair"><label>Latitude<input type="number" step="0.000001" value={location.latitude} onChange={(e)=>setLocation({...location,latitude:Number(e.target.value)})}/></label><label>Longitude<input type="number" step="0.000001" value={location.longitude} onChange={(e)=>setLocation({...location,longitude:Number(e.target.value)})}/></label></div>
          <div className="input-pair"><label>Elevasi (m)<input type="number" value={location.elevation} onChange={(e)=>setLocation({...location,elevation:Number(e.target.value)})}/></label><label>UTC offset<input type="number" step="0.5" value={location.timezone} onChange={(e)=>setLocation({...location,timezone:Number(e.target.value)})}/></label></div>
        </div>
        <div className="surface-card settings-card">
          <span className="eyebrow">METODE HISAB</span><h3>{method.name}</h3><p>{method.source_note}</p>
          <label>Metode aktif<select value={method.slug} onChange={(e)=>chooseMethod(e.target.value)}>{methods.map((m)=><option key={m.slug} value={m.slug}>{m.name}</option>)}</select></label>
          <div className="settings-facts"><div><span>Astronomi</span><b>NREL SPA</b></div><div><span>Kiblat</span><b>WGS84 inverse geodesic</b></div><div><span>Formula custom</span><b>{method.formulas?.length||0} slot aktif</b></div></div>
          <Link href="/admin" className="admin-cta"><Icon name="admin"/> Buka Method Studio <Icon name="chevron" size={15}/></Link>
        </div>
      </div>
    </section>
  );

  const body = active==="home"?home:active==="prayer"?prayerPage:active==="qibla"?qiblaPage:active==="solar"?solarPage:active==="hilal"?hilalPage:active==="calendar"?calendarPage:settingsPage;

  return (
    <div className="falak-shell">
      <aside className="falak-sidebar">
        <button className="falak-brand" onClick={()=>setActive("home")}><span>F</span><div><b>Digital Falak</b><small>Coordinate Astronomy</small></div></button>
        <nav>{NAV.map(([id,label,icon])=><button key={id} className={active===id?"active":""} onClick={()=>setActive(id)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
        <div className="sidebar-method"><small>METODE AKTIF</small><b>{method.name}</b><span>{method.engine_type} · v{method.version}</span></div>
        <Link href="/admin" className="sidebar-admin"><Icon name="admin" size={16}/> Method Studio</Link>
      </aside>

      <main className="falak-main">
        <header className="falak-topbar">
          <div className="mobile-logo"><span>F</span><b>Digital Falak</b></div>
          <div className="date-picker"><Icon name="calendar" size={15}/><input type="date" value={dateKey(date)} onChange={(e)=>setDate(parseDate(e.target.value))}/></div>
          <div className="topbar-right">
            <button className="top-location" onClick={()=>setActive("settings")}><Icon name="location" size={15}/><div><span>{location.label}</span><small>{formatNumber(location.latitude,4)}°, {formatNumber(location.longitude,4)}°</small></div></button>
            {installPrompt?<button className="install-btn" onClick={installApp}>Install</button>:null}
          </div>
        </header>
        {body}
        <footer className="falak-footer"><span>Digital Falak · engine hisab berbasis koordinat</span><span>Hasil metode perlu diverifikasi ahli sebelum dijadikan acuan final ibadah.</span></footer>
      </main>

      <nav className="mobile-nav">{NAV.slice(0,5).map(([id,label,icon])=><button key={id} className={active===id?"active":""} onClick={()=>setActive(id)}><Icon name={icon} size={18}/><span>{label}</span></button>)}</nav>
    </div>
  );
}
