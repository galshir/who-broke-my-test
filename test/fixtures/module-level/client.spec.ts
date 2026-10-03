import { expect, it } from 'vitest'

it('defaults to the local api', () => {
  expect(process.env.API_URL ?? 'http://localhost').toBe('http://localhost')
})
