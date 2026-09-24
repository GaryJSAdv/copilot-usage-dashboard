import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('boot', () => {
  it('does not load the sample fixture when the app starts', () => {
    const app = readFileSync(resolve('src/App.tsx'), 'utf8')
    const main = readFileSync(resolve('src/main.tsx'), 'utf8')
    const ui = `${app}\n${main}`
    expect(ui).not.toContain('sample-usage')
    expect(ui).not.toContain('loadSample')
    expect(ui).not.toContain("'sample'")
    expect(ui).not.toContain('synthetic')
    expect(app).toContain('loadPublished')
    expect(app).toContain('No report loaded')
  })
})
