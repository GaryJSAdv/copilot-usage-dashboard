import { describeFetchFailure, githubHeaders, latestReportUrl, parseLinkResponse, type ReportLinks } from '../domain/github'
import type { ScopeMode } from '../domain/slug'

export type LiveReport = ReportLinks & {
  texts: string[]
}

export async function fetchLatestReport(mode: ScopeMode, slug: string, token: string): Promise<LiveReport> {
  let response: Response
  try {
    response = await fetch(latestReportUrl(mode, slug), { headers: githubHeaders(latestReportUrl(mode, slug), token) })
  } catch (error) {
    throw new Error(describeFetchFailure(error))
  }
  if (!response.ok) {
    throw new Error(await githubError(response, mode))
  }
  const links = parseLinkResponse(await response.json())
  if ('error' in links) throw new Error(links.error)
  const texts: string[] = []
  for (const link of links.downloadLinks) {
    texts.push(await downloadReport(link, token))
  }
  return { ...links, texts }
}

async function downloadReport(link: string, token: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(link, { headers: githubHeaders(link, token) })
  } catch (error) {
    throw new Error(describeFetchFailure(error))
  }
  if (!response.ok) {
    throw new Error(`Report download failed (${response.status}). Open the signed link from GitHub and upload the file.`)
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
