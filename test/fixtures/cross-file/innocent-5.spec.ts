import { describe, expect, it } from 'vitest'

describe('innocent module 5', () => {
  it('adds numbers', () => {
    expect(5 + 5).toBe(10)
  })

  it('joins strings', () => {
    expect(['a', 'b'].join('-')).toBe('a-b')
  })

  it('maps arrays', () => {
    expect([1, 2, 3].map((x) => x * 5)).toEqual([5, 10, 15])
  })
})
