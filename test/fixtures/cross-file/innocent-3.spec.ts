import { describe, expect, it } from 'vitest'

describe('innocent module 3', () => {
  it('adds numbers', () => {
    expect(3 + 3).toBe(6)
  })

  it('joins strings', () => {
    expect(['a', 'b'].join('-')).toBe('a-b')
  })

  it('maps arrays', () => {
    expect([1, 2, 3].map((x) => x * 3)).toEqual([3, 6, 9])
  })
})
