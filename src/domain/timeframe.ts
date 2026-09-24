import type { DailyPoint } from './metrics'

const DAY = /^\d{4}-\d{2}-\d{2}$/

export type TimeframePreset = 'all' | 'this-month' | 'last-month' | 'custom'

export type DateRange = {
  from: string
  to: string
}

export const MAX_DAY_REQUESTS = 31

export function isUtcDay(value: string): boolean {
  if (!DAY.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function calendarMonth(now: Date, offset: 0 | -1): DateRange & { label: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
  const from = isoDay(start)
  const to = isoDay(end)
  const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(start)
  return { from, to, label }
}

export function resolveTimeframe(
  preset: TimeframePreset,
  customFrom: string,
  customTo: string,
  now: Date,
): DateRange | { error: string } | null {
  if (preset === 'all') return null
  if (preset === 'this-month') return calendarMonth(now, 0)
  if (preset === 'last-month') return calendarMonth(now, -1)
  if (!customFrom && !customTo) return null
  if (!isUtcDay(customFrom) || !isUtcDay(customTo)) {
    return { error: 'Enter a UTC from date and to date as YYYY-MM-DD.' }
  }
  if (customFrom > customTo) return { error: 'The from date must be on or before the to date.' }
  return { from: customFrom, to: customTo }
}

export function filterPoints(points: DailyPoint[], range: DateRange | null): DailyPoint[] {
  if (!range) return points
  return points.filter((point) => point.day >= range.from && point.day <= range.to)
}

export function eachUtcDay(from: string, to: string): string[] {
  if (!isUtcDay(from) || !isUtcDay(to) || from > to) return []
  const days: string[] = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor.getTime() <= end.getTime() && days.length <= 400) {
    days.push(isoDay(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

export function missingDays(points: { day: string }[], range: DateRange): string[] {
  const present = new Set(points.map((point) => point.day))
  return eachUtcDay(range.from, range.to).filter((day) => !present.has(day))
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}
