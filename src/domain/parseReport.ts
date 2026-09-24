import {
  ACTIVE_USER_METRICS,
  ACTIVITY_METRICS,
  type ActiveUserMetric,
  type ActivityMetric,
  type DailyPoint,
  type DayFragment,
  finiteNumber,
  isRecord,
  readTokenUsage,
  type TokenPath,
  unknownKeysInRecord,
} from './metrics'

const DAY = /^\d{4}-\d{2}-\d{2}$/

export type ParseIssue = {
  line: number
  message: string
}

export type ParseResult = {
  points: DailyPoint[]
  unknownKeys: string[]
  skipped: ParseIssue[]
  errors: ParseIssue[]
  reportStartDay: string | null
  reportEndDay: string | null
}

export function parseReport(text: string): ParseResult {
  const fragments: DayFragment[] = []
  const unknown = new Set<string>()
  const skipped: ParseIssue[] = []
  const errors: ParseIssue[] = []
  let reportStartDay: string | null = null
  let reportEndDay: string | null = null

  const documents = splitDocuments(text, errors)
  documents.forEach((value, index) => {
    ingest(value, index + 1, {
      fragments,
      unknown,
      skipped,
      errors,
      setWindow(start, end) {
        if (start) reportStartDay = start
        if (end) reportEndDay = end
      },
    })
  })

  return {
    points: mergeFragments(fragments),
    unknownKeys: [...unknown].sort(),
    skipped,
    errors,
    reportStartDay,
    reportEndDay,
  }
}

export function mergePoints(existing: DailyPoint[], incoming: DailyPoint[]): DailyPoint[] {
  const byDay = new Map(existing.map((point) => [point.day, point]))
  for (const point of incoming) byDay.set(point.day, point)
  return [...byDay.values()].sort(byDayAsc)
}

type IngestContext = {
  fragments: DayFragment[]
  unknown: Set<string>
  skipped: ParseIssue[]
  errors: ParseIssue[]
  setWindow: (start: string | null, end: string | null) => void
}

function splitDocuments(text: string, errors: ParseIssue[]): unknown[] {
  const trimmed = text.replace(/^\uFEFF/, '').trim()
  if (!trimmed) return []
  try {
    return [JSON.parse(trimmed) as unknown]
  } catch {
    const documents: unknown[] = []
    const lines = trimmed.split(/\r?\n/)
    lines.forEach((line, index) => {
      const body = line.trim()
      if (!body) return
      try {
        documents.push(JSON.parse(body) as unknown)
      } catch {
        errors.push({ line: index + 1, message: 'Line is not JSON' })
      }
    })
    return documents
  }
}

function ingest(value: unknown, line: number, ctx: IngestContext): void {
  if (Array.isArray(value)) {
    for (const item of value) ingest(item, line, ctx)
    return
  }
  if (!isRecord(value)) {
    ctx.errors.push({ line, message: 'Report entry is not an object' })
    return
  }
  if (Array.isArray(value.day_totals)) {
    const start = typeof value.report_start_day === 'string' ? value.report_start_day : null
    const end = typeof value.report_end_day === 'string' ? value.report_end_day : null
    ctx.setWindow(start, end)
    for (const item of value.day_totals) ingest(item, line, ctx)
    return
  }
  const fragment = fragmentFromRecord(value, line, ctx)
  if (fragment) ctx.fragments.push(fragment)
}

function fragmentFromRecord(
  value: Record<string, unknown>,
  line: number,
  ctx: IngestContext,
): DayFragment | null {
  for (const key of unknownKeysInRecord(value)) ctx.unknown.add(key)
  if ('repo_id' in value) {
    ctx.skipped.push({ line, message: 'Skipped repository report' })
    return null
  }
  if ('team_id' in value) {
    ctx.skipped.push({ line, message: 'Skipped user-teams report' })
    return null
  }
  if (typeof value.day !== 'string' || !DAY.test(value.day)) {
    ctx.errors.push({ line, message: 'Record has no day in YYYY-MM-DD form' })
    return null
  }

  const kind = 'user_id' in value || 'user_login' in value ? 'user' : 'aggregated'
  const activity: Partial<Record<ActivityMetric, number>> = {}
  for (const key of ACTIVITY_METRICS) {
    const count = finiteNumber(value[key])
    if (count !== undefined) activity[key] = count
  }
  const activeUsers: Partial<Record<ActiveUserMetric, number>> = {}
  if (kind === 'aggregated') {
    for (const key of ACTIVE_USER_METRICS) {
      const count = finiteNumber(value[key])
      if (count !== undefined) activeUsers[key] = count
    }
  }
  const tokens: Partial<Record<TokenPath, number>> = {
    ...readTokenUsage(value.totals_by_cli, 'totals_by_cli'),
    ...readTokenUsage(value.totals_by_copilot_app, 'totals_by_copilot_app'),
  }
  return {
    day: value.day,
    kind,
    point: { day: value.day, activity, activeUsers, tokens },
  }
}

function mergeFragments(fragments: DayFragment[]): DailyPoint[] {
  const byDay = new Map<string, DayFragment[]>()
  for (const fragment of fragments) {
    const list = byDay.get(fragment.day) ?? []
    list.push(fragment)
    byDay.set(fragment.day, list)
  }
  const points: DailyPoint[] = []
  for (const [day, list] of byDay) {
    const aggregated = list.filter((item) => item.kind === 'aggregated')
    if (aggregated.length > 0) {
      points.push(aggregated[aggregated.length - 1].point)
      continue
    }
    points.push(sumUserFragments(day, list))
  }
  return points.sort(byDayAsc)
}

function sumUserFragments(day: string, list: DayFragment[]): DailyPoint {
  const activity: Partial<Record<ActivityMetric, number>> = {}
  const tokens: Partial<Record<TokenPath, number>> = {}
  for (const fragment of list) {
    addPartial(activity, fragment.point.activity)
    addPartial(tokens, fragment.point.tokens)
  }
  return { day, activity, activeUsers: {}, tokens }
}

function addPartial<K extends string>(target: Partial<Record<K, number>>, extra: Partial<Record<K, number>>): void {
  for (const key of Object.keys(extra) as K[]) {
    const value = extra[key]
    if (value === undefined) continue
    target[key] = (target[key] ?? 0) + value
  }
}

function byDayAsc(a: { day: string }, b: { day: string }): number {
  if (a.day < b.day) return -1
  if (a.day > b.day) return 1
  return 0
}
