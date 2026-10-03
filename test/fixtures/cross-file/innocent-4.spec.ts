import { describe, expect, it } from 'vitest'

describe('innocent module 4', () => {
  it('adds numbers', () => {
    expect(4 + 4).toBe(8)
  })

  it('joins strings', () => {
    expect(['a', 'b'].join('-')).toBe('a-b')
  })

  it('maps arrays', () => {
    expect([1, 2, 3].map((x) => x * 4)).toEqual([4, 8, 12])
  })
})
