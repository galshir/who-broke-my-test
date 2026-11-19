import { expect, it } from 'vitest'

process.env.WBMT_SINGLE_MODULE_MODE = 'production'

it('passes without changing the environment', () => expect(1 + 1).toBe(2))
