const SYNODIC_MONTH = 29.53058867;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

export function moonPhaseEstimate(date) {
  const days = (date.getTime() - KNOWN_NEW_MOON) / 86400000;
  const age = ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const fraction = age / SYNODIC_MONTH;
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;

  let phase = "Bulan Baru";
  if (fraction >= 0.03 && fraction < 0.22) phase = "Sabit Muda";
  else if (fraction < 0.28) phase = "Perbani Awal";
  else if (fraction < 0.47) phase = "Cembung Awal";
  else if (fraction < 0.53) phase = "Purnama";
  else if (fraction < 0.72) phase = "Cembung Akhir";
  else if (fraction < 0.78) phase = "Perbani Akhir";
  else if (fraction < 0.97) phase = "Sabit Tua";

  return { age, fraction, illumination, phase };
}
