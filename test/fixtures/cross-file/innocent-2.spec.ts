import { describe, expect, it } from 'vitest'

describe('innocent module 2', () => {
  it('adds numbers', () => {
    expect(2 + 2).toBe(4)
  })

  it('joins strings', () => {
    expect(['a', 'b'].join('-')).toBe('a-b')
  })

  it('maps arrays', () => {
    expect([1, 2, 3].map((x) => x * 2)).toEqual([2, 4, 6])
  })
})
