import type { ScopeMode } from './slug'

export const GITHUB_API = 'https://api.github.com'
export const GITHUB_API_VERSION = '2026-03-10'

export type ReportLinks = {
  downloadLinks: string[]
  reportDay: string | null
  reportStartDay: string | null
  reportEndDay: string | null
}

export function latestReportUrl(mode: ScopeMode, slug: string): string {
  if (mode === 'enterprise') {
    return `${GITHUB_API}/enterprises/${encodeURIComponent(slug)}/copilot/metrics/reports/enterprise-28-day/latest`
  }
  return `${GITHUB_API}/orgs/${encodeURIComponent(slug)}/copilot/metrics/reports/organization-28-day/latest`
}

export function dayReportUrl(mode: ScopeMode, slug: string, day: string): string {
  const query = `day=${encodeURIComponent(day)}`
  if (mode === 'enterprise') {
    return `${GITHUB_API}/enterprises/${encodeURIComponent(slug)}/copilot/metrics/reports/enterprise-1-day?${query}`
  }
  return `${GITHUB_API}/orgs/${encodeURIComponent(slug)}/copilot/metrics/reports/organization-1-day?${query}`
}

export function githubHeaders(url: string, token: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (new URL(url).host !== 'api.github.com') return headers
  headers.Authorization = `Bearer ${token}`
  headers['X-GitHub-Api-Version'] = GITHUB_API_VERSION
  return headers
}

export function parseLinkResponse(body: unknown): ReportLinks | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'GitHub returned an empty report response.' }
  const record = body as Record<string, unknown>
  if (!Array.isArray(record.download_links) || record.download_links.some((link) => typeof link !== 'string')) {
    return { error: 'GitHub response has no download_links array.' }
  }
  return {
    downloadLinks: record.download_links,
    reportDay: typeof record.report_day === 'string' ? record.report_day : null,
    reportStartDay: typeof record.report_start_day === 'string' ? record.report_start_day : null,
    reportEndDay: typeof record.report_end_day === 'string' ? record.report_end_day : null,
  }
}

export function describeFetchFailure(error: unknown): string {
  if (error instanceof TypeError) {
    return 'The browser blocked the GitHub request. Authenticated calls from a page often fail CORS. Download the NDJSON report and drop it here, or run the collector in a fork.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'The report request failed.'
}
