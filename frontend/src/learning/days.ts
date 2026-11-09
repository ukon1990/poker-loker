/** A calendar day in the player's own timezone, formatted `YYYY-MM-DD`. */
export type LocalDay = string;

export function localDay(date: Date): LocalDay {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const MS_PER_DAY = 86_400_000;

/** Whole days from `from` to `to`. Parsed as UTC, so daylight saving changes cannot skew it. */
export function daysBetween(from: LocalDay, to: LocalDay): number {
  return (Date.parse(to) - Date.parse(from)) / MS_PER_DAY;
}

/** The day `count` days after `day`. */
export function addDays(day: LocalDay, count: number): LocalDay {
  return new Date(Date.parse(day) + count * MS_PER_DAY).toISOString().slice(0, 10);
}
