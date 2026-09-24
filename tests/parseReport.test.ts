import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mergePoints, parseReport } from '../src/domain/parseReport'

const sample = readFileSync(resolve('public/fixtures/sample-usage.ndjson'), 'utf8')

describe('parseReport', () => {
  it('reads the sample NDJSON into a rising acceptance series', () => {
    const result = parseReport(sample)
    expect(result.errors).toEqual([])
    expect(result.points).toHaveLength(14)
    expect(result.points[0]).toMatchObject({
      day: '2026-03-01',
      activity: { code_acceptance_activity_count: 120, loc_added_sum: 800 },
      activeUsers: { daily_active_users: 40 },
    })
    expect(result.points[13]?.activity.code_acceptance_activity_count).toBe(310)
    expect(result.points[2]?.tokens['totals_by_cli.token_usage.prompt_tokens_sum']).toBe(12000)
    expect(result.points[0]?.tokens).toEqual({})
    expect(result.points[13]?.tokens['totals_by_copilot_app.token_usage.output_tokens_sum']).toBe(3600)
    expect(result.unknownKeys).toEqual([])
  })

  it('unwraps a 28-day report and ignores an unknown field', () => {
    const result = parseReport(
      JSON.stringify({
        report_start_day: '2026-03-01',
        report_end_day: '2026-03-02',
        day_totals: [
          {
            day: '2026-03-01',
            code_acceptance_activity_count: 10,
            daily_active_users: 3,
            invented_spend: 99,
          },
          { day: '2026-03-02', code_acceptance_activity_count: 12, daily_active_users: 4 },
        ],
      }),
    )
    expect(result.reportStartDay).toBe('2026-03-01')
    expect(result.reportEndDay).toBe('2026-03-02')
    expect(result.points.map((point) => point.activity.code_acceptance_activity_count)).toEqual([10, 12])
    expect(result.unknownKeys).toEqual(['invented_spend'])
    expect(JSON.stringify(result.points)).not.toContain('invented_spend')
    expect(JSON.stringify(result.points)).not.toContain('99')
  })

  it('sums per-user rows and does not invent active users', () => {
    const ndjson = [
      JSON.stringify({
        day: '2026-03-01',
        user_id: 1,
        user_login: 'a',
        code_acceptance_activity_count: 4,
        loc_added_sum: 10,
        ai_credits_used: 50,
        totals_by_cli: { token_usage: { prompt_tokens_sum: 100, output_tokens_sum: 20 } },
      }),
      JSON.stringify({
        day: '2026-03-01',
        user_id: 2,
        user_login: 'b',
        code_acceptance_activity_count: 6,
        loc_added_sum: 15,
        totals_by_cli: { token_usage: { prompt_tokens_sum: 40, output_tokens_sum: 5 } },
      }),
    ].join('\n')
    const result = parseReport(ndjson)
    expect(result.points).toEqual([
      {
        day: '2026-03-01',
        activity: { code_acceptance_activity_count: 10, loc_added_sum: 25 },
        activeUsers: {},
        tokens: {
          'totals_by_cli.token_usage.prompt_tokens_sum': 140,
          'totals_by_cli.token_usage.output_tokens_sum': 25,
        },
      },
    ])
    expect(JSON.stringify(result.points)).not.toContain('ai_credits_used')
  })

  it('keeps an aggregated day when a user row for the same day is also present', () => {
    const result = parseReport(
      [
        JSON.stringify({ day: '2026-03-04', user_id: 9, code_acceptance_activity_count: 1 }),
        JSON.stringify({ day: '2026-03-04', daily_active_users: 8, code_acceptance_activity_count: 30 }),
      ].join('\n'),
    )
    expect(result.points[0]?.activeUsers.daily_active_users).toBe(8)
    expect(result.points[0]?.activity.code_acceptance_activity_count).toBe(30)
  })

  it('skips a bad line and still reads the next day', () => {
    const result = parseReport('not-json\n{"day":"2026-03-08","code_acceptance_activity_count":2}\n')
    expect(result.errors).toEqual([{ line: 1, message: 'Line is not JSON' }])
    expect(result.points[0]?.activity.code_acceptance_activity_count).toBe(2)
  })

  it('skips repository and user-teams rows', () => {
    const result = parseReport(
      [
        JSON.stringify({ day: '2026-03-01', repo_id: 5, repo_name: 'demo' }),
        JSON.stringify({ day: '2026-03-01', team_id: 3, user_id: 1, slug: 'core' }),
        JSON.stringify({ day: '2026-03-01', code_acceptance_activity_count: 7, daily_active_users: 2 }),
      ].join('\n'),
    )
    expect(result.skipped.map((issue) => issue.message)).toEqual([
      'Skipped repository report',
      'Skipped user-teams report',
    ])
    expect(result.points).toHaveLength(1)
    expect(result.points[0]?.activity.code_acceptance_activity_count).toBe(7)
  })

  it('replaces a day when merging a newer snapshot and keeps older days', () => {
    const merged = mergePoints(
      [
        { day: '2026-03-01', activity: { code_acceptance_activity_count: 1 }, activeUsers: {}, tokens: {} },
        { day: '2026-03-02', activity: { code_acceptance_activity_count: 2 }, activeUsers: {}, tokens: {} },
      ],
      [{ day: '2026-03-02', activity: { code_acceptance_activity_count: 9 }, activeUsers: { daily_active_users: 4 }, tokens: {} }],
    )
    expect(merged.map((point) => point.activity.code_acceptance_activity_count)).toEqual([1, 9])
    expect(merged[1]?.activeUsers.daily_active_users).toBe(4)
  })
})
