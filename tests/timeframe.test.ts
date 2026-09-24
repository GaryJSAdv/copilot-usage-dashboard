import { describe, expect, it } from 'vitest'
import type { DailyPoint } from '../src/domain/metrics'
import { calendarMonth, eachUtcDay, filterPoints, missingDays, resolveTimeframe } from '../src/domain/timeframe'

const now = new Date('2026-09-24T15:00:00Z')

function point(day: string, loc = 1): DailyPoint {
  return {
    day,
    activity: { loc_added_sum: loc, code_acceptance_activity_count: loc },
    activeUsers: { daily_active_users: 2 },
    tokens: {},
  }
}

describe('timeframe', () => {
  it('uses UTC calendar months', () => {
    expect(calendarMonth(now, 0)).toMatchObject({ from: '2026-09-01', to: '2026-09-30', label: 'September 2026' })
    expect(calendarMonth(new Date('2026-01-02T00:00:00Z'), -1)).toMatchObject({
      from: '2025-12-01',
      to: '2025-12-31',
      label: 'December 2025',
    })
  })

  it('filters an inclusive UTC range and leaves all loaded untouched', () => {
    const points = [point('2026-08-31'), point('2026-09-01'), point('2026-09-24'), point('2026-10-01')]
    expect(filterPoints(points, null).map((item) => item.day)).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-24',
      '2026-10-01',
    ])
    expect(filterPoints(points, resolveTimeframe('this-month', '', '', now) as { from: string; to: string }).map((item) => item.day)).toEqual([
      '2026-09-01',
      '2026-09-24',
    ])
    expect(filterPoints(points, { from: '2026-08-31', to: '2026-09-01' }).map((item) => item.day)).toEqual([
      '2026-08-31',
      '2026-09-01',
    ])
  })

  it('lists missing days inside a custom range', () => {
    expect(eachUtcDay('2026-03-01', '2026-03-03')).toEqual(['2026-03-01', '2026-03-02', '2026-03-03'])
    expect(missingDays([point('2026-03-02')], { from: '2026-03-01', to: '2026-03-03' })).toEqual([
      '2026-03-01',
      '2026-03-03',
    ])
    expect(resolveTimeframe('custom', '2026-03-05', '2026-03-01', now)).toEqual({
      error: 'The from date must be on or before the to date.',
    })
    expect(resolveTimeframe('custom', '', '', now)).toBeNull()
  })
})
