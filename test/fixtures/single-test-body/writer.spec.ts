import { it } from 'vitest'

it('changes the environment', () => {
  process.env.WBMT_SINGLE_MODULE_MODE = 'production'
})
