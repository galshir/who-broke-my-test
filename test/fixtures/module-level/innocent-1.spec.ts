import { describe, expect, it } from 'vitest'

describe('innocent module 1', () => {
  it('adds numbers', () => {
    expect(1 + 1).toBe(2)
  })

  it('joins strings', () => {
    expect(['a', 'b'].join('-')).toBe('a-b')
  })

  it('maps arrays', () => {
    expect([1, 2, 3].map((x) => x * 1)).toEqual([1, 2, 3])
  })
})
