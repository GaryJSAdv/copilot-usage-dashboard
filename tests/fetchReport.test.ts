import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchLatestReport, fetchScopedReport } from '../src/api/fetchReport'

const apiUrl = 'https://api.github.com/enterprises/acme/copilot/metrics/reports/enterprise-28-day/latest'
const fileUrl = 'https://objects.githubusercontent.com/report.ndjson?token=signed'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchLatestReport', () => {
  it('calls api.github.com with headers and downloads the signed URL with none', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    vi.stubGlobal(
      'fetch',
      async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), init })
        if (String(url) === apiUrl) {
          return new Response(JSON.stringify({ download_links: [fileUrl], report_start_day: '2026-03-01', report_end_day: '2026-03-28' }), {
            status: 200,
          })
        }
        return new Response('{"day":"2026-03-01"}\n', { status: 200 })
      },
    )

    const report = await fetchLatestReport('enterprise', 'acme', 'secret')
    expect(report.texts).toEqual(['{"day":"2026-03-01"}\n'])
    expect(calls.map((call) => call.url)).toEqual([apiUrl, fileUrl])
    expect(calls[0]?.init?.headers).toEqual({
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer secret',
      'X-GitHub-Api-Version': '2026-03-10',
    })
    expect(calls[1]?.init).toBeUndefined()
  })

  it('names the file host when the signed download is blocked', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (String(url) === apiUrl) {
        return new Response(JSON.stringify({ download_links: [fileUrl] }), { status: 200 })
      }
      throw new TypeError('Failed to fetch')
    })

    await expect(fetchLatestReport('enterprise', 'acme', 'secret')).rejects.toThrow(fileUrl)
    await expect(fetchLatestReport('enterprise', 'acme', 'secret')).rejects.toThrow(/file host/)
  })

  it('requests the 1-day report when the range is a single UTC day', async () => {
    const dayUrl = 'https://api.github.com/enterprises/acme/copilot/metrics/reports/enterprise-1-day?day=2026-03-02'
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(String(url))
      if (String(url) === dayUrl) {
        return new Response(JSON.stringify({ download_links: [fileUrl], report_day: '2026-03-02' }), { status: 200 })
      }
      return new Response('{"day":"2026-03-02","loc_added_sum":10}\n', { status: 200 })
    })
    const report = await fetchScopedReport('enterprise', 'acme', 'secret', { from: '2026-03-02', to: '2026-03-02' })
    expect(calls).toEqual([dayUrl, fileUrl])
    expect(report.texts[0]).toContain('loc_added_sum')
    expect(calls.some((url) => url.includes('enterprise-28-day'))).toBe(false)
  })

  it('filters from the 28-day report and requests only missing days with the day parameter', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(String(url))
      const href = String(url)
      if (href.endsWith('/enterprise-28-day/latest')) {
        return new Response(
          JSON.stringify({ download_links: [fileUrl], report_start_day: '2026-03-01', report_end_day: '2026-03-02' }),
          { status: 200 },
        )
      }
      if (href === fileUrl) return new Response('{"day":"2026-03-01","loc_added_sum":4}\n', { status: 200 })
      if (href.includes('day=2026-03-02')) {
        return new Response(JSON.stringify({ download_links: ['https://objects.githubusercontent.com/day.ndjson'] }), { status: 200 })
      }
      if (href.includes('day.ndjson')) return new Response('{"day":"2026-03-02","loc_added_sum":9}\n', { status: 200 })
      return new Response('missing', { status: 404 })
    })
    const report = await fetchScopedReport('enterprise', 'acme', 'secret', { from: '2026-03-01', to: '2026-03-02' })
    expect(report.texts.join('\n')).toContain('2026-03-02')
    expect(calls.some((url) => url.includes('enterprise-1-day?day=2026-03-02'))).toBe(true)
    expect(calls.some((url) => url.includes('day=2026-03-01'))).toBe(false)
  })

  it('keeps the signed URL when a missing day download is blocked', async () => {
    const dayFile = 'https://copilot-reports.github.com/day.ndjson?sig=1'
    vi.stubGlobal('fetch', async (url: string) => {
      const href = String(url)
      if (href.endsWith('/enterprise-28-day/latest')) {
        return new Response(JSON.stringify({ download_links: [fileUrl] }), { status: 200 })
      }
      if (href === fileUrl) return new Response('{"day":"2026-03-01","loc_added_sum":4}\n', { status: 200 })
      if (href.includes('day=2026-03-02')) {
        return new Response(JSON.stringify({ download_links: [dayFile] }), { status: 200 })
      }
      throw new TypeError('Failed to fetch')
    })
    const report = await fetchScopedReport('enterprise', 'acme', 'secret', { from: '2026-03-01', to: '2026-03-02' })
    expect(report.texts[0]).toContain('2026-03-01')
    expect(report.downloadWarnings.join('\n')).toContain(dayFile)
    expect(report.downloadWarnings.join('\n')).toMatch(/file host/)
  })
})
