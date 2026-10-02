import { describe, expect, it } from 'vitest'
import { previewName, previewUrl } from './preview-name'

describe('previewName', () => {
  it.each([
    ['feat/worker-previews', 'feat-worker-previews'],
    ['Fix/Drop_On_Card', 'fix-drop-on-card'],
    ['docs/audit--docs/', 'docs-audit-docs'],
    ['123-hotfix', 'b-123-hotfix'],
    ['日本語のブランチ', 'preview'],
    ['---', 'preview'],
  ])('turns %j into %j', (branch, name) => {
    expect(previewName(branch)).toBe(name)
  })

  it('keeps the first label of the address within 63 characters', () => {
    const name = previewName(`feat/${'a-very-long-branch-name-'.repeat(5)}`)
    expect(`${name}-kanban-web`.length).toBeLessThanOrEqual(63)
    expect(name).toMatch(/^[a-z][a-z0-9-]*[a-z0-9]$/)
  })

  it('gives two long branches that start the same different names', () => {
    const base = `feat/${'x'.repeat(80)}`
    expect(previewName(`${base}-one`)).not.toBe(previewName(`${base}-two`))
  })

  it('always gives the same name for the same branch', () => {
    const branch = `feat/${'y'.repeat(80)}`
    expect(previewName(branch)).toBe(previewName(branch))
  })
})

describe('previewUrl', () => {
  it('is the Preview address on the ut-code workers.dev subdomain', () => {
    expect(previewUrl('feat-x')).toBe('https://feat-x-kanban-web.ut-code.workers.dev')
  })
})
