/**
 * The only module that reads the clock or formats dates. Records store UTC ISO-8601 strings;
 * display uses the device's locale and time zone through Intl.
 */

export type Clock = () => Date

export const systemClock: Clock = () => new Date()

export function nowIso(clock: Clock = systemClock): string {
  return clock().toISOString()
}

export function toEpochMs(iso: string): number {
  return Date.parse(iso)
}

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const shortFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** Medium date and short time; takes a stored ISO string or epoch milliseconds. */
export function formatDateTime(at: string | number): string {
  return dateTimeFormat.format(new Date(at))
}

export function formatDate(at: string | number): string {
  return dateFormat.format(new Date(at))
}

export function formatShort(epochMs: number): string {
  return shortFormat.format(new Date(epochMs))
}

/** Value for an <input type="datetime-local"> in the device's local time. */
export function toLocalInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parse a datetime-local value (device local time) back to UTC ISO. */
export function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString()
}

/** Whole days elapsed between two instants (ISO strings or epoch ms), for "day 12". */
export function daysBetween(from: string | number, to: Date | number): number {
  const toMs = typeof to === 'number' ? to : to.getTime()
  const fromMs = typeof from === 'number' ? from : Date.parse(from)
  return Math.floor((toMs - fromMs) / 86_400_000)
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export function formatRelativeDays(days: number): string {
  return relative.format(-days, 'day')
}

/** Human duration for PK figures: "11 min", "5.0 h", "7.0 days". */
export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 48) return `${Number(hours.toFixed(1))} h`
  return `${Number((hours / 24).toFixed(1))} days`
}

/** "Sep 29 – Oct 29, 2026" in the device's locale. */
export function formatDateRange(startMs: number, endMs: number): string {
  return dateFormat.formatRange(new Date(startMs), new Date(endMs))
}

/** The local calendar year and month (1 to 12) of an instant, for ages from a birth month. */
export function calendarMonth(epochMs: number): { year: number; month: number } {
  const d = new Date(epochMs)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

const monthYearFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })

/** "March 1984" for a stored "1984-03"; the day is fixed mid-month so no time zone moves it. */
export function formatBirthMonth(birthMonth: string): string {
  const [y, m] = birthMonth.split('-').map(Number)
  return monthYearFormat.format(new Date(y!, m! - 1, 15))
}

/** Month names in the device's language, January first, for a month picker. */
export function monthNames(): string[] {
  const f = new Intl.DateTimeFormat(undefined, { month: 'long' })
  return Array.from({ length: 12 }, (_, i) => f.format(new Date(2000, i, 15)))
}

/** "Thursday" for a due date, in the device's language. */
export function formatWeekday(epochMs: number): string {
  return weekdayFormat.format(new Date(epochMs))
}

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long' })

/** Local calendar date as YYYY-MM-DD, for file names. */
export function fileDate(epochMs: number): string {
  const d = new Date(epochMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
