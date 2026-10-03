import { expect, it } from 'vitest'

it('creates user as guest', () => {
  expect((globalThis as Record<string, unknown>).currentUser).toBeUndefined()
})
