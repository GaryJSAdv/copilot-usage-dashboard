import type { ScopeMode } from './domain/slug'

const KEY = 'copilot-usage-dashboard.v1'

export type StoredSession = {
  mode: ScopeMode
  slug: string
  token: string
}

export function loadSession(): StoredSession | null {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<StoredSession>
    if ((value.mode !== 'enterprise' && value.mode !== 'org') || typeof value.slug !== 'string' || typeof value.token !== 'string') {
      return null
    }
    return { mode: value.mode, slug: value.slug, token: value.token }
  } catch {
    return null
  }
}

export function saveSession(session: StoredSession): void {
  sessionStorage.setItem(KEY, JSON.stringify(session))
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY)
}
