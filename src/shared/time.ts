const SAO_PAULO_OFFSET = "-03:00";

export const now = (): Date => new Date();

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function toIsoWithTimezone(date: Date, offset: string = SAO_PAULO_OFFSET): string {
  const sign = offset.startsWith("-") ? -1 : 1;
  const [hours, mins] = offset.slice(1).split(":").map(Number);
  const totalOffsetMinutes = sign * (hours * 60 + mins);
  const shifted = new Date(date.getTime() + totalOffsetMinutes * 60_000);

  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");

  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${offset}`;
}

/**
 * Format a date for display in pt-BR conversation.
 * Output: "terça, 25/03 às 08:00" or "amanhã às 14:00"
 */
export function formatDateTimePtBr(date: Date, offsetMinutes = -180): string {
  const local = new Date(date.getTime() + offsetMinutes * 60_000);

  const nowLocal = new Date(Date.now() + offsetMinutes * 60_000);
  const tomorrowDay = nowLocal.getUTCDate() + 1;
  const tomorrowMonth = nowLocal.getUTCMonth();

  const day = local.getUTCDate();
  const month = local.getUTCMonth();
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  const time = `${hh}:${mm}`;

  if (day === tomorrowDay && month === tomorrowMonth) {
    return `amanhã às ${time}`;
  }

  const weekdays = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const dayStr = String(day).padStart(2, "0");
  const monthStr = String(month + 1).padStart(2, "0");

  return `${weekdays[local.getUTCDay()]}, ${dayStr}/${monthStr} às ${time}`;
}

export function roundUpToStep(date: Date, stepMinutes: number): Date {
  const ms = stepMinutes * 60_000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}
