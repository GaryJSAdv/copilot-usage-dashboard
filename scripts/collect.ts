import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { latestReportUrl, githubHeaders, parseLinkResponse } from '../src/domain/github'
import { mergePoints, parseReport } from '../src/domain/parseReport'
import type { DailyPoint } from '../src/domain/metrics'
import type { ScopeMode } from '../src/domain/slug'

const root = fileURLToPath(new URL('..', import.meta.url))
const outPath = resolve(root, 'public/data/series.json')

const token = process.env.GH_TOKEN ?? ''
const org = process.env.ORG_SLUG ?? ''
const enterprise = process.env.ENTERPRISE_SLUG ?? ''
const mode: ScopeMode = process.env.COPILOT_SCOPE === 'org' || (!enterprise && org) ? 'org' : 'enterprise'
const slug = mode === 'org' ? org : enterprise

if (!token || !slug) {
  console.error('Set GH_TOKEN and ENTERPRISE_SLUG. For an organization report, set COPILOT_SCOPE=org and ORG_SLUG.')
  process.exit(1)
}

const url = latestReportUrl(mode, slug)
const response = await fetch(url, { headers: githubHeaders(url, token) })
if (!response.ok) {
  const body = await response.text()
  console.error(`GitHub returned ${response.status}: ${body}`)
  process.exit(1)
}
const links = parseLinkResponse(await response.json())
if ('error' in links) {
  console.error(links.error)
  process.exit(1)
}

const texts: string[] = []
for (const link of links.downloadLinks) {
  const download = await fetch(link, { headers: githubHeaders(link, token) })
  if (!download.ok) {
    console.error(`Download failed ${download.status} for ${link}`)
    process.exit(1)
  }
  texts.push(await download.text())
}

const parsed = parseReport(texts.join('\n'))
if (parsed.errors.length > 0) {
  console.error(parsed.errors.map((issue) => `line ${issue.line}: ${issue.message}`).join('\n'))
}
const existing = readExisting(outPath)
const points = mergePoints(existing, parsed.points)
mkdirSync(dirname(outPath), { recursive: true })
const payload = {
  generated_at: new Date().toISOString(),
  scope: `${mode}:${slug}`,
  report_start_day: links.reportStartDay ?? parsed.reportStartDay,
  report_end_day: links.reportEndDay ?? parsed.reportEndDay,
  points,
}
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`)
console.log(`Wrote ${points.length} days to ${outPath}`)
if (parsed.unknownKeys.length > 0) {
  console.log(`Unrecognized fields: ${parsed.unknownKeys.join(', ')}`)
}

function readExisting(path: string): DailyPoint[] {
  if (!existsSync(path)) return []
  const body = JSON.parse(readFileSync(path, 'utf8')) as { points?: DailyPoint[] }
  return Array.isArray(body.points) ? body.points : []
}
