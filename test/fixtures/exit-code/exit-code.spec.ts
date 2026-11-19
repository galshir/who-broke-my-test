import { expect, it } from 'vitest'

it('restores a temporary exit code', () => {
  const previous = process.exitCode
  process.exitCode = 2
  process.exitCode = previous
})

it('sets a nonzero exit code', () => {
  process.exitCode = 1
})

it('starts without an exit code', () => {
  expect(process.exitCode).toBeUndefined()
})
