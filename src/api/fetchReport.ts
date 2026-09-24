import { dayReportUrl, describeApiFailure, describeDownloadFailure, githubHeaders, latestReportUrl, parseLinkResponse, type ReportLinks } from '../domain/github'
import { parseReport } from '../domain/parseReport'
import type { ScopeMode } from '../domain/slug'
import { MAX_DAY_REQUESTS, missingDays, type DateRange } from '../domain/timeframe'

export type LiveReport = ReportLinks & {
  texts: string[]
  downloadWarnings: string[]
}

export async function fetchLatestReport(mode: ScopeMode, slug: string, token: string): Promise<LiveReport> {
  return fetchReportAt(latestReportUrl(mode, slug), mode, token)
}

export async function fetchScopedReport(
  mode: ScopeMode,
  slug: string,
  token: string,
  range: DateRange | null,
): Promise<LiveReport> {
  if (range && range.from === range.to) {
    return fetchReportAt(dayReportUrl(mode, slug, range.from), mode, token)
  }
  const latest = await fetchLatestReport(mode, slug, token)
  if (!range) return latest
  const covered = parseReport(latest.texts.join('\n')).points
  const missing = missingDays(covered, range)
  if (missing.length === 0) return latest
  if (missing.length > MAX_DAY_REQUESTS) {
    return {
      ...latest,
      downloadWarnings: [
        `The usage metrics API has no start or end parameter. ${missing.length} days in this UTC range are outside the latest 28-day report, which is more than ${MAX_DAY_REQUESTS} one-day requests. Upload NDJSON for the missing days.`,
      ],
    }
  }
  const texts = [...latest.texts]
  const downloadWarnings = [...latest.downloadWarnings]
  let reportDay = latest.reportDay
  let reportStartDay = latest.reportStartDay
  let reportEndDay = latest.reportEndDay
  const downloadLinks = [...latest.downloadLinks]
  for (const day of missing) {
    try {
      const report = await fetchReportAt(dayReportUrl(mode, slug, day), mode, token)
      texts.push(...report.texts)
      downloadLinks.push(...report.downloadLinks)
      reportDay = report.reportDay ?? reportDay
      if (report.reportStartDay && (!reportStartDay || report.reportStartDay < reportStartDay)) {
        reportStartDay = report.reportStartDay
      }
      if (report.reportEndDay && (!reportEndDay || report.reportEndDay > reportEndDay)) {
        reportEndDay = report.reportEndDay
      }
    } catch (error) {
      downloadWarnings.push(error instanceof Error ? error.message : `Could not download ${day}.`)
    }
  }
  return { downloadLinks, reportDay, reportStartDay, reportEndDay, texts, downloadWarnings }
}

async function fetchReportAt(url: string, mode: ScopeMode, token: string): Promise<LiveReport> {
  let response: Response
  try {
    response = await fetch(url, { headers: githubHeaders(url, token) })
  } catch (error) {
    throw new Error(describeApiFailure(error))
  }
  if (!response.ok) throw new Error(await githubError(response, mode))
  const links = parseLinkResponse(await response.json())
  if ('error' in links) throw new Error(links.error)
  const texts: string[] = []
  for (const link of links.downloadLinks) texts.push(await downloadReport(link))
  return { ...links, texts, downloadWarnings: [] }
}

async function downloadReport(link: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(link)
  } catch (error) {
    throw new Error(describeDownloadFailure(error, link))
  }
  if (!response.ok) {
    throw new Error(`Report download failed (${response.status}). Download this file and drop it here: ${link}`)
  }
  return response.text()
}

async function githubError(response: Response, mode: ScopeMode): Promise<string> {
  let message = response.statusText
  try {
    const body = (await response.json()) as { message?: unknown }
    if (typeof body.message === 'string') message = body.message
  } catch {
    message = response.statusText
  }
  if (response.status === 401 || response.status === 403) {
    const scope = mode === 'enterprise' ? 'manage_billing:copilot or read:enterprise' : 'read:org'
    return `${message} A classic PAT needs ${scope}. The Copilot usage metrics policy must be enabled.`
  }
  if (response.status === 404) {
    return `${message} Check the slug. Reports exist only after the usage metrics policy is enabled.`
  }
  return message || `GitHub returned ${response.status}.`
}
