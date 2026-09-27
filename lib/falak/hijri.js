import { julianDay } from "./solar.js";

function islamicToJD(year, month, day) {
  return (
    day +
    Math.ceil(29.5 * (month - 1)) +
    (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) +
    1948439.5 -
    1
  );
}

export function gregorianToHijriCivil(date) {
  const jd = Math.floor(julianDay(date)) + 0.5;
  const year = Math.floor((30 * (jd - 1948439.5) + 10646) / 10631);
  const first = islamicToJD(year, 1, 1);
  const month = Math.min(12, Math.ceil((jd - 29 - first) / 29.5) + 1);
  const day = Math.floor(jd - islamicToJD(year, month, 1) + 1);
  return { year, month, day };
}

export const HIJRI_MONTHS = [
  "Muharram", "Safar", "Rabiulawal", "Rabiulakhir", "Jumadilawal", "Jumadilakhir",
  "Rajab", "Syakban", "Ramadan", "Syawal", "Zulkaidah", "Zulhijah"
];

export function formatHijriCivil(value) {
  return `${value.day} ${HIJRI_MONTHS[value.month - 1]} ${value.year} H`;
}
