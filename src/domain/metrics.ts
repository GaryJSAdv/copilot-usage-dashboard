export const ACTIVITY_METRICS = [
  'code_acceptance_activity_count',
  'code_generation_activity_count',
  'user_initiated_interaction_count',
  'loc_added_sum',
  'loc_suggested_to_add_sum',
  'loc_suggested_to_delete_sum',
  'loc_deleted_sum',
] as const

export const ACTIVE_USER_METRICS = [
  'daily_active_users',
  'weekly_active_users',
  'monthly_active_users',
] as const

export const TOKEN_PATHS = [
  'totals_by_cli.token_usage.prompt_tokens_sum',
  'totals_by_cli.token_usage.output_tokens_sum',
  'totals_by_copilot_app.token_usage.prompt_tokens_sum',
  'totals_by_copilot_app.token_usage.output_tokens_sum',
] as const

export type ActivityMetric = (typeof ACTIVITY_METRICS)[number]
export type ActiveUserMetric = (typeof ACTIVE_USER_METRICS)[number]
export type TokenPath = (typeof TOKEN_PATHS)[number]
export type ChartMetric = ActivityMetric | ActiveUserMetric | TokenPath

export type DailyPoint = {
  day: string
  activity: Partial<Record<ActivityMetric, number>>
  activeUsers: Partial<Record<ActiveUserMetric, number>>
  tokens: Partial<Record<TokenPath, number>>
}

export type ReportKind = 'aggregated' | 'user'

export type DayFragment = {
  day: string
  kind: ReportKind
  point: DailyPoint
}

export const ACTIVITY_LABELS: Record<ActivityMetric, string> = {
  code_acceptance_activity_count: 'Acceptances',
  code_generation_activity_count: 'Generations',
  user_initiated_interaction_count: 'Interactions',
  loc_added_sum: 'Lines added',
  loc_suggested_to_add_sum: 'Lines suggested to add',
  loc_suggested_to_delete_sum: 'Lines suggested to delete',
  loc_deleted_sum: 'Lines deleted',
}

export const ACTIVE_USER_LABELS: Record<ActiveUserMetric, string> = {
  daily_active_users: 'Daily active users',
  weekly_active_users: 'Weekly active users',
  monthly_active_users: 'Monthly active users',
}

export const TOKEN_LABELS: Record<TokenPath, string> = {
  'totals_by_cli.token_usage.prompt_tokens_sum': 'CLI prompt tokens',
  'totals_by_cli.token_usage.output_tokens_sum': 'CLI output tokens',
  'totals_by_copilot_app.token_usage.prompt_tokens_sum': 'Copilot app prompt tokens',
  'totals_by_copilot_app.token_usage.output_tokens_sum': 'Copilot app output tokens',
}

const KNOWN_TOP_LEVEL = new Set<string>([
  'day',
  'enterprise_id',
  'organization_id',
  'etl_id',
  'day_partition',
  'entity_id_partition',
  'user_id',
  'user_login',
  'ai_credits_used',
  'user_initiated_interaction_count',
  'code_generation_activity_count',
  'code_acceptance_activity_count',
  'loc_suggested_to_add_sum',
  'loc_suggested_to_delete_sum',
  'loc_added_sum',
  'loc_deleted_sum',
  'used_agent',
  'used_chat',
  'used_cli',
  'used_copilot_app',
  'used_copilot_coding_agent',
  'used_copilot_cloud_agent',
  'used_copilot_code_review_active',
  'used_copilot_code_review_passive',
  'ai_adoption_phase',
  'distinct_skill_use_count',
  'distinct_custom_agent_use_count',
  'distinct_mcp_use_count',
  'distinct_slash_cmd_use_count',
  'distinct_plugin_use_count',
  'totals_by_skill',
  'totals_by_custom_agent',
  'totals_by_mcp',
  'totals_by_slash_cmd',
  'totals_by_plugin',
  'totals_by_cli',
  'totals_by_copilot_app',
  'totals_by_3rd_party_agent',
  'totals_by_ide',
  'totals_by_feature',
  'totals_by_language_feature',
  'totals_by_language_model',
  'totals_by_model_feature',
  'daily_active_users',
  'weekly_active_users',
  'monthly_active_users',
  'monthly_active_chat_users',
  'monthly_active_agent_users',
  'daily_active_copilot_cloud_agent_users',
  'weekly_active_copilot_cloud_agent_users',
  'monthly_active_copilot_cloud_agent_users',
  'daily_active_copilot_code_review_users',
  'weekly_active_copilot_code_review_users',
  'monthly_active_copilot_code_review_users',
  'daily_passive_copilot_code_review_users',
  'weekly_passive_copilot_code_review_users',
  'monthly_passive_copilot_code_review_users',
  'daily_active_cli_users',
  'daily_active_copilot_app_users',
  'daily_active_vscode_agent_users',
  'weekly_active_cli_users',
  'weekly_active_copilot_app_users',
  'weekly_active_vscode_agent_users',
  'monthly_active_cli_users',
  'monthly_active_copilot_app_users',
  'monthly_active_vscode_agent_users',
  'totals_by_vscode_agent',
  'totals_by_ai_adoption_phase',
  'pull_requests',
  'report_start_day',
  'report_end_day',
  'created_at',
  'copilot_feature_engagement',
  'day_totals',
  'repo_id',
  'repo_owner_name',
  'repo_name',
  'repo_visibility',
  'team_id',
  'slug',
])

const KNOWN_CLI = new Set([
  'session_count',
  'request_count',
  'prompt_count',
  'token_usage',
  'last_known_cli_version',
])

const KNOWN_APP = new Set([
  'session_count',
  'request_count',
  'prompt_count',
  'token_usage',
])

const KNOWN_TOKEN = new Set([
  'output_tokens_sum',
  'prompt_tokens_sum',
  'avg_tokens_per_request',
])

export function unknownKeysInRecord(value: Record<string, unknown>): string[] {
  const unknown: string[] = []
  for (const key of Object.keys(value)) {
    if (!KNOWN_TOP_LEVEL.has(key)) unknown.push(key)
  }
  collectNestedUnknown(value.totals_by_cli, 'totals_by_cli', KNOWN_CLI, unknown)
  collectNestedUnknown(value.totals_by_copilot_app, 'totals_by_copilot_app', KNOWN_APP, unknown)
  return unknown
}

function collectNestedUnknown(
  value: unknown,
  prefix: string,
  known: Set<string>,
  unknown: string[],
): void {
  if (!isRecord(value)) return
  for (const key of Object.keys(value)) {
    if (!known.has(key)) unknown.push(`${prefix}.${key}`)
  }
  if (isRecord(value.token_usage)) {
    for (const key of Object.keys(value.token_usage)) {
      if (!KNOWN_TOKEN.has(key)) unknown.push(`${prefix}.token_usage.${key}`)
    }
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value
}

export function readTokenUsage(
  source: unknown,
  prefix: 'totals_by_cli' | 'totals_by_copilot_app',
): Partial<Record<TokenPath, number>> {
  if (!isRecord(source) || !isRecord(source.token_usage)) return {}
  const usage = source.token_usage
  const tokens: Partial<Record<TokenPath, number>> = {}
  const prompt = finiteNumber(usage.prompt_tokens_sum)
  const output = finiteNumber(usage.output_tokens_sum)
  if (prompt !== undefined) {
    tokens[`${prefix}.token_usage.prompt_tokens_sum`] = prompt
  }
  if (output !== undefined) {
    tokens[`${prefix}.token_usage.output_tokens_sum`] = output
  }
  return tokens
}
