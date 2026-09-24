import { useEffect, useState } from 'react'
import { fetchScopedReport } from './api/fetchReport'
import {
  ACTIVE_USER_LABELS,
  ACTIVE_USER_METRICS,
  ACTIVITY_LABELS,
  ACTIVITY_METRICS,
  type ActiveUserMetric,
  type ActivityMetric,
  type ChartMetric,
  type DailyPoint,
  isRecord,
  TOKEN_LABELS,
  TOKEN_PATHS,
  type TokenPath,
} from './domain/metrics'
import { parseReport } from './domain/parseReport'
import { parseSlug, type ScopeMode } from './domain/slug'
import { filterPoints, resolveTimeframe, type TimeframePreset } from './domain/timeframe'
import { clearSession, loadSession, saveSession } from './storage'
import { Chart } from './ui/Chart'
import { ConnectionPanel, UploadPanel } from './ui/Panels'
import { TimeframeControl } from './ui/Timeframe'

type Origin = 'published' | 'upload' | 'live'

type Dataset = {
  origin: Origin
  label: string
  points: DailyPoint[]
  unknownKeys: string[]
  warnings: string[]
}

const ACTIVITY_COLORS = ['#1a7f37', '#0969da', '#bf8700']
const LOC_COLORS = ['#1a7f37', '#0969da', '#cf222e', '#8250df']
const USER_COLORS = ['#1a7f37', '#0969da', '#bf8700']
const TOKEN_COLORS = ['#1a7f37', '#0969da', '#bf8700', '#8250df']

const LOC_METRICS = [
  'loc_added_sum',
  'loc_suggested_to_add_sum',
  'loc_deleted_sum',
  'loc_suggested_to_delete_sum',
] as const satisfies readonly ActivityMetric[]

const ENGAGEMENT_METRICS = [
  'code_acceptance_activity_count',
  'code_generation_activity_count',
  'user_initiated_interaction_count',
] as const satisfies readonly ActivityMetric[]

export function App() {
  const stored = loadSession()
  const [mode, setMode] = useState<ScopeMode>(stored?.mode ?? 'enterprise')
  const [slug, setSlug] = useState(stored?.slug ?? '')
  const [token, setToken] = useState(stored?.token ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [booting, setBooting] = useState(true)
  const [preset, setPreset] = useState<TimeframePreset>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    let cancelled = false
    async function boot() {
      const published = await loadPublished()
      if (cancelled) return
      if (published) setDataset(published)
      setBooting(false)
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  async function connect() {
    const parsed = parseSlug(slug, mode)
    if ('error' in parsed) {
      setMessage(parsed.error)
      return
    }
    if (!token.trim()) {
      setMessage('Enter a personal access token.')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const range = resolveTimeframe(preset, from, to, new Date())
      if (range && 'error' in range) {
        setMessage(range.error)
        return
      }
      const report = await fetchScopedReport(mode, parsed.slug, token.trim(), range)
      saveSession({ mode, slug: parsed.slug, token: token.trim() })
      setSlug(parsed.slug)
      const parsedReport = parseReport(report.texts.join('\n'))
      const window =
        report.reportStartDay && report.reportEndDay
          ? `${report.reportStartDay} to ${report.reportEndDay}`
          : 'latest 28-day report'
      setDataset({
        origin: 'live',
        label: `${mode === 'enterprise' ? 'Enterprise' : 'Organization'} ${parsed.slug}, ${window}`,
        points: parsedReport.points,
        unknownKeys: parsedReport.unknownKeys,
        warnings: [...warningsFrom(parsedReport), ...report.downloadWarnings],
      })
      if (report.downloadWarnings.length > 0) {
        setMessage(report.downloadWarnings.join('\n\n'))
      } else if (parsedReport.points.length === 0) {
        setMessage('The report downloaded, and it has no daily usage rows.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The report request failed.')
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    clearSession()
    setToken('')
    setSlug('')
    setMessage(null)
    setDataset(null)
    void loadPublished().then((published) => {
      if (published) setDataset(published)
    })
  }

  async function loadFiles(files: File[]) {
    if (files.length === 0) return
    const texts = await Promise.all(files.map((file) => file.text()))
    applyText(texts.join('\n'), files.map((file) => file.name).join(', '))
  }

  function applyText(text: string, label: string) {
    const parsed = parseReport(text)
    if (parsed.points.length === 0 && parsed.errors.length > 0) {
      setMessage(parsed.errors[0]?.message ?? 'The file has no usage rows.')
      return
    }
    setMessage(null)
    setDataset({
      origin: 'upload',
      label,
      points: parsed.points,
      unknownKeys: parsed.unknownKeys,
      warnings: warningsFrom(parsed),
    })
  }

  const days = dataset?.points ?? []
  const rangeResult = resolveTimeframe(preset, from, to, new Date())
  const rangeError = rangeResult && 'error' in rangeResult ? rangeResult.error : null
  const activeRange = rangeResult && !('error' in rangeResult) ? rangeResult : null
  const visible = filterPoints(days, activeRange)
  const summary = summarize(visible)

  return (
    <main>
      <header>
        <p className="kicker">GitHub Copilot usage</p>
        <h1>Is engagement rising?</h1>
        <p className="lede">
          Acceptances, lines of code, and active users from the Copilot usage metrics reports. Token totals appear only
          when the report includes them.
        </p>
      </header>
      {dataset && <p className="banner quiet">{dataset.label}</p>}
      <TimeframeControl
        preset={preset}
        from={from}
        to={to}
        active={activeRange}
        onPreset={setPreset}
        onFrom={setFrom}
        onTo={setTo}
      />
      {rangeError && <p className="error">{rangeError}</p>}
      <div className="grid">
        <ConnectionPanel
          mode={mode}
          slug={slug}
          token={token}
          busy={busy}
          message={message}
          onMode={setMode}
          onSlug={setSlug}
          onToken={setToken}
          onConnect={() => void connect()}
          onClear={clear}
        />
        <UploadPanel onFiles={(files) => void loadFiles(files)} onPaste={(text) => applyText(text, 'Pasted report')} />
      </div>
      {!booting && !dataset && (
        <section className="panel">
          <h2>No report loaded</h2>
          <p>Connect with a token, or upload an NDJSON report. Charts stay empty until then.</p>
        </section>
      )}
      {dataset && days.length === 0 && (
        <section className="panel">
          <h2>No daily rows</h2>
          <p>The report loaded, and it has no daily usage rows.</p>
        </section>
      )}
      {dataset && days.length > 0 && visible.length === 0 && (
        <section className="panel">
          <h2>No rows in this timeframe</h2>
          <p>
            Nothing in the loaded report falls between {activeRange?.from} and {activeRange?.to} UTC. Choose All loaded,
            or upload NDJSON that covers those days.
          </p>
        </section>
      )}
      {visible.length > 0 && (
        <>
          <section className="stats">
            {summary.map((item) => (
              <article key={item.id} className="stat">
                <h2>{item.label}</h2>
                <p className="stat-value">{formatNumber(item.latest)}</p>
                <p className="muted">{item.detail}</p>
              </article>
            ))}
          </section>
          <Chart
            title="Acceptances"
            note="code_acceptance_activity_count, plus generation and interaction counts when the report has them"
            series={seriesFor(visible, ENGAGEMENT_METRICS, ACTIVITY_LABELS, ACTIVITY_COLORS)}
          />
          <Chart
            title="Lines of code added"
            note="loc_added_sum and loc_suggested_to_add_sum, plus loc_deleted_sum and loc_suggested_to_delete_sum when the report includes them"
            series={seriesFor(visible, LOC_METRICS, ACTIVITY_LABELS, LOC_COLORS)}
          />
          <Chart
            title="Active users"
            note="daily_active_users, weekly_active_users, and monthly_active_users on aggregated reports"
            series={seriesFor(visible, ACTIVE_USER_METRICS, ACTIVE_USER_LABELS, USER_COLORS)}
          />
          <Chart
            title="Tokens"
            note="prompt and output sums under totals_by_cli.token_usage and totals_by_copilot_app.token_usage"
            series={seriesFor(visible, TOKEN_PATHS, TOKEN_LABELS, TOKEN_COLORS)}
          />
          {dataset?.unknownKeys.length ? (
            <p className="muted">Ignored unrecognized fields: {dataset.unknownKeys.join(', ')}.</p>
          ) : null}
          {dataset?.warnings.map((warning) => (
            <p key={warning} className="muted">
              {warning}
            </p>
          ))}
          <DayTable points={visible} />
        </>
      )}
    </main>
  )
}

function DayTable({ points }: { points: DailyPoint[] }) {
  const showTokens = points.some((point) => Object.keys(point.tokens).length > 0)
  const rows = [...points].reverse()
  return (
    <section className="panel">
      <h2>Daily rows</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Acceptances</th>
              <th>Lines added</th>
              <th>Lines suggested</th>
              <th>Daily active users</th>
              {showTokens && <th>CLI prompt tokens</th>}
              {showTokens && <th>App output tokens</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((point) => (
              <tr key={point.day}>
                <td>{point.day}</td>
                <td>{cell(point.activity.code_acceptance_activity_count)}</td>
                <td>{cell(point.activity.loc_added_sum)}</td>
                <td>{cell(point.activity.loc_suggested_to_add_sum)}</td>
                <td>{cell(point.activeUsers.daily_active_users)}</td>
                {showTokens && <td>{cell(point.tokens['totals_by_cli.token_usage.prompt_tokens_sum'])}</td>}
                {showTokens && <td>{cell(point.tokens['totals_by_copilot_app.token_usage.output_tokens_sum'])}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function seriesFor<M extends ChartMetric>(
  points: DailyPoint[],
  metrics: readonly M[],
  labels: Record<M, string>,
  colors: string[],
) {
  return metrics.map((metric, index) => ({
    id: metric,
    label: labels[metric],
    color: colors[index] ?? '#333',
    points: points.map((point) => ({ day: point.day, value: valueOf(point, metric) })),
  }))
}

function valueOf(point: DailyPoint, metric: ChartMetric): number | null {
  if (isActivity(metric)) return point.activity[metric] ?? null
  if (isActiveUser(metric)) return point.activeUsers[metric] ?? null
  return point.tokens[metric as TokenPath] ?? null
}

function isActivity(metric: ChartMetric): metric is ActivityMetric {
  return (ACTIVITY_METRICS as readonly string[]).includes(metric)
}

function isActiveUser(metric: ChartMetric): metric is ActiveUserMetric {
  return (ACTIVE_USER_METRICS as readonly string[]).includes(metric)
}

function summarize(points: DailyPoint[]) {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return []
  const cards: { id: string; label: string; latest: number; detail: string }[] = []
  const acceptanceSum = sumOf(points, (point) => point.activity.code_acceptance_activity_count)
  const acceptance = pair(first.activity.code_acceptance_activity_count, last.activity.code_acceptance_activity_count)
  if (acceptanceSum !== null && acceptance) {
    cards.push({
      id: 'acceptances',
      label: 'Acceptances in range',
      latest: acceptanceSum,
      detail: `${formatNumber(acceptance.last)} on ${last.day} · ${delta(acceptance.first, acceptance.last)} since ${first.day}`,
    })
  }
  const addedSum = sumOf(points, (point) => point.activity.loc_added_sum)
  const added = pair(first.activity.loc_added_sum, last.activity.loc_added_sum)
  if (addedSum !== null && added) {
    cards.push({
      id: 'loc',
      label: 'Lines added',
      latest: addedSum,
      detail: `${formatNumber(added.last)} loc_added_sum on ${last.day} · ${delta(added.first, added.last)} since ${first.day}`,
    })
  }
  const suggestedSum = sumOf(points, (point) => point.activity.loc_suggested_to_add_sum)
  if (suggestedSum !== null) {
    cards.push({
      id: 'loc-suggested',
      label: 'Lines suggested to add',
      latest: suggestedSum,
      detail: `loc_suggested_to_add_sum from ${first.day} to ${last.day}`,
    })
  }
  const users = pair(first.activeUsers.daily_active_users, last.activeUsers.daily_active_users)
  if (users) {
    cards.push({
      id: 'dau',
      label: 'Daily active users',
      latest: users.last,
      detail: `${last.day} · ${delta(users.first, users.last)} since ${first.day}`,
    })
  }
  return cards
}

function sumOf(points: DailyPoint[], read: (point: DailyPoint) => number | undefined): number | null {
  let total = 0
  let seen = false
  for (const point of points) {
    const value = read(point)
    if (value === undefined) continue
    seen = true
    total += value
  }
  return seen ? total : null
}

function pair(first: number | undefined, last: number | undefined): { first: number; last: number } | null {
  if (first === undefined || last === undefined) return null
  return { first, last }
}

function delta(first: number, last: number): string {
  if (first === 0) return last === 0 ? 'no change' : 'up from zero'
  const pct = ((last - first) / first) * 100
  const rounded = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
  return rounded
}

function cell(value: number | undefined): string {
  return value === undefined ? 'n/a' : formatNumber(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function warningsFrom(parsed: ReturnType<typeof parseReport>): string[] {
  const warnings: string[] = []
  if (parsed.errors.length > 0) warnings.push(`${parsed.errors.length} line(s) could not be read.`)
  if (parsed.skipped.length > 0) warnings.push(`${parsed.skipped.length} repository or user-teams row(s) were skipped.`)
  return warnings
}

function publishedPoints(value: unknown): DailyPoint[] | null {
  if (!Array.isArray(value)) return null
  const points: DailyPoint[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.day !== 'string') return null
    if (!isRecord(item.activity) || !isRecord(item.activeUsers) || !isRecord(item.tokens)) return null
    points.push({
      day: item.day,
      activity: item.activity as DailyPoint['activity'],
      activeUsers: item.activeUsers as DailyPoint['activeUsers'],
      tokens: item.tokens as DailyPoint['tokens'],
    })
  }
  return points
}

async function loadPublished(): Promise<Dataset | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/series.json`)
    if (!response.ok) return null
    const body = (await response.json()) as { scope?: unknown; points?: unknown }
    const points = publishedPoints(body.points)
    if (!points || points.length === 0) return null
    return {
      origin: 'published',
      label: typeof body.scope === 'string' ? body.scope : 'Published snapshot',
      points,
      unknownKeys: [],
      warnings: [],
    }
  } catch {
    return null
  }
}

