import { expect, it } from 'vitest'

it('uses the test mode', () => {
  expect(process.env.WBMT_SINGLE_MODULE_MODE ?? 'test').toBe('test')
})
