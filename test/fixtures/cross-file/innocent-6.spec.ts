import { describe, expect, it } from 'vitest'

describe('innocent module 6', () => {
  it('adds numbers', () => {
    expect(6 + 6).toBe(12)
  })

  it('joins strings', () => {
    expect(['a', 'b'].join('-')).toBe('a-b')
  })

  it('maps arrays', () => {
    expect([1, 2, 3].map((x) => x * 6)).toEqual([6, 12, 18])
  })
})
