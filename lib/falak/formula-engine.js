const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

const FUNCTIONS = {
  sind: (x) => Math.sin(x * DEG),
  cosd: (x) => Math.cos(x * DEG),
  tand: (x) => Math.tan(x * DEG),
  cotd: (x) => 1 / Math.tan(x * DEG),
  asind: (x) => Math.asin(x) * RAD,
  acosd: (x) => Math.acos(x) * RAD,
  atand: (x) => Math.atan(x) * RAD,
  atan2d: (y, x) => Math.atan2(y, x) * RAD,
  sqrt: Math.sqrt,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};

const SAFE_CHARS = /^[0-9A-Za-z_+\-*/^().,\s]+$/;

export function evaluateFormula(expression, scope = {}) {
  if (typeof expression !== "string" || !expression.trim()) {
    throw new Error("Formula kosong.");
  }
  if (!SAFE_CHARS.test(expression)) {
    throw new Error("Formula mengandung karakter yang tidak diizinkan.");
  }

  const identifiers = expression.match(/[A-Za-z_]\w*/g) || [];
  const allowed = new Set([
    ...Object.keys(FUNCTIONS),
    ...Object.keys(scope),
    "PI",
  ]);

  for (const identifier of identifiers) {
    if (!allowed.has(identifier)) {
      throw new Error(`Variabel/fungsi tidak dikenal: ${identifier}`);
    }
  }

  let compiled = expression.replace(/\^/g, "**");
  for (const name of Object.keys(FUNCTIONS)) {
    compiled = compiled.replace(
      new RegExp(`\\b${name}\\s*\\(`, "g"),
      `fn.${name}(`
    );
  }
  compiled = compiled.replace(/\bPI\b/g, "Math.PI");

  const names = Object.keys(scope);
  const values = names.map((name) => Number(scope[name]));
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Semua nilai variabel harus berupa angka yang valid.");
  }

  const runner = new Function(
    ...names,
    "fn",
    "Math",
    `"use strict"; return (${compiled});`
  );

  const result = runner(...values, FUNCTIONS, Math);
  if (!Number.isFinite(result)) {
    throw new Error("Hasil formula tidak finite/valid.");
  }
  return result;
}
