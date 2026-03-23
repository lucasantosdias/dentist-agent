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

export function roundUpToStep(date: Date, stepMinutes: number): Date {
  const ms = stepMinutes * 60_000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}
