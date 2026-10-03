import { expect, it } from 'vitest'

const g = globalThis as Record<string, unknown>

it('innocent 1', () => expect(true).toBe(true))
it('turns on feature A', () => {
  g.featureA = true
})
it('innocent 2', () => expect(true).toBe(true))
it('innocent 3', () => expect(true).toBe(true))
it('turns on feature B', () => {
  g.featureB = true
})
it('innocent 4', () => expect(true).toBe(true))
it('legacy mode is used when A and B are not both on', () => {
  expect(Boolean(g.featureA && g.featureB)).toBe(false)
})
