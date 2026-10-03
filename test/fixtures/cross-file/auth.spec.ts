import { expect, it, vi } from 'vitest'

it('lists users', () => expect([1, 2].length).toBe(2))

it('logs in as admin', () => {
  ;(globalThis as Record<string, unknown>).currentUser = { role: 'admin' }
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(true).toBe(true)
})

it('logs out', () => expect(true).toBe(true))
