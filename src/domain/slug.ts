export type ScopeMode = 'enterprise' | 'org'

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export function parseSlug(input: string, mode: ScopeMode): { slug: string } | { error: string } {
  const raw = input.trim()
  if (!raw) return { error: mode === 'enterprise' ? 'Enter an enterprise slug.' : 'Enter an organization slug.' }

  const fromUrl = slugFromUrl(raw, mode)
  if (fromUrl && 'error' in fromUrl) return fromUrl
  const slug = fromUrl && 'slug' in fromUrl ? fromUrl.slug : raw
  if (!SLUG.test(slug)) {
    return { error: 'Use a slug made of letters, numbers, dots, hyphens, or underscores.' }
  }
  return { slug }
}

function slugFromUrl(raw: string, mode: ScopeMode): { slug: string } | { error: string } | null {
  if (!/^https?:\/\//i.test(raw) && !/^github\.com\//i.test(raw)) return null
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return { error: 'That URL is not valid.' }
  }
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
    return { error: 'Paste a github.com enterprises or orgs URL, or the slug itself.' }
  }
  const parts = url.pathname.split('/').filter(Boolean)
  if (mode === 'enterprise') {
    if (parts[0] !== 'enterprises' || !parts[1]) {
      return { error: 'Enterprise URLs look like https://github.com/enterprises/your-slug.' }
    }
    return { slug: parts[1] }
  }
  if (parts[0] === 'orgs' && parts[1]) return { slug: parts[1] }
  if (parts[0] === 'enterprises') {
    return { error: 'That URL is an enterprise. Switch scope to Enterprise, or paste an organization slug.' }
  }
  if (parts.length === 1) return { slug: parts[0] }
  return { error: 'Organization URLs look like https://github.com/orgs/your-org or https://github.com/your-org.' }
}
