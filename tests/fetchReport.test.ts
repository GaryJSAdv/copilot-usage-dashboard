import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchLatestReport } from '../src/api/fetchReport'

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
})
