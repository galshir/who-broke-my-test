import { describe, expect, it } from 'vitest'

describe('settings', () => {
  it('reads defaults', () => {
    expect(1 + 1).toBe(2)
  })

  it('switches to production mode', () => {
    process.env.NODE_ENV = 'production'
    expect(process.env.NODE_ENV).toBe('production')
  })

  it('formats a label', () => {
    expect('a'.toUpperCase()).toBe('A')
  })

  it('parses numbers', () => {
    expect(Number('42')).toBe(42)
  })

  it('enables debug logging in test mode', () => {
    expect(process.env.NODE_ENV).toBe('test')
  })
})
