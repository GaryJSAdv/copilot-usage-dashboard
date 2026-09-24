import { describe, expect, it } from 'vitest'
import { dayReportUrl, githubHeaders, latestReportUrl, parseLinkResponse } from '../src/domain/github'
import { parseSlug } from '../src/domain/slug'

describe('parseSlug', () => {
  it('reads an enterprise URL and a raw slug', () => {
    expect(parseSlug('https://github.com/enterprises/acme-corp/settings', 'enterprise')).toEqual({ slug: 'acme-corp' })
    expect(parseSlug('acme-corp', 'enterprise')).toEqual({ slug: 'acme-corp' })
  })

  it('reads an organization URL only in org mode', () => {
    expect(parseSlug('https://github.com/orgs/widgets', 'org')).toEqual({ slug: 'widgets' })
    expect(parseSlug('https://github.com/widgets', 'org')).toEqual({ slug: 'widgets' })
    expect(parseSlug('https://github.com/enterprises/acme', 'org')).toEqual({
      error: 'That URL is an enterprise. Switch scope to Enterprise, or paste an organization slug.',
    })
  })
})

describe('report URLs', () => {
  it('builds the documented enterprise and organization paths', () => {
    expect(latestReportUrl('enterprise', 'acme')).toBe(
      'https://api.github.com/enterprises/acme/copilot/metrics/reports/enterprise-28-day/latest',
    )
    expect(latestReportUrl('org', 'widgets')).toBe(
      'https://api.github.com/orgs/widgets/copilot/metrics/reports/organization-28-day/latest',
    )
    expect(dayReportUrl('enterprise', 'acme', '2026-03-01')).toBe(
      'https://api.github.com/enterprises/acme/copilot/metrics/reports/enterprise-1-day?day=2026-03-01',
    )
    expect(dayReportUrl('org', 'widgets', '2026-03-01')).toBe(
      'https://api.github.com/orgs/widgets/copilot/metrics/reports/organization-1-day?day=2026-03-01',
    )
  })

  it('sends the token only to api.github.com', () => {
    const api = githubHeaders('https://api.github.com/enterprises/acme/copilot/metrics/reports/enterprise-28-day/latest', 'secret')
    expect(api.Authorization).toBe('Bearer secret')
    expect(api['X-GitHub-Api-Version']).toBe('2026-03-10')
    expect(api.Accept).toBe('application/vnd.github+json')
    const signed = githubHeaders('https://objects.githubusercontent.com/report.ndjson?token=signed', 'secret')
    expect(signed.Authorization).toBeUndefined()
  })

  it('reads download_links from a 28-day response', () => {
    expect(
      parseLinkResponse({
        download_links: ['https://example.test/a.ndjson'],
        report_start_day: '2026-03-01',
        report_end_day: '2026-03-28',
      }),
    ).toEqual({
      downloadLinks: ['https://example.test/a.ndjson'],
      reportDay: null,
      reportStartDay: '2026-03-01',
      reportEndDay: '2026-03-28',
    })
  })
})
