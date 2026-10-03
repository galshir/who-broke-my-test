import { describe, expect, it } from 'vitest'
import { minimize } from './search.js'

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

/** A failure that happens when every polluter in `needed` ran. */
function oracle(needed: number[]) {
  let calls = 0
  const fails = async (subset: number[]) => {
    calls++
    return needed.every((n) => subset.includes(n))
  }
  return { fails, calls: () => calls }
}

describe('minimize', () => {
  it('finds a single polluter', async () => {
    const { fails } = oracle([37])
    expect(await minimize(range(100), fails)).toEqual([37])
  })

  it('needs about 2 * log2(n) trials for a single polluter', async () => {
    const { fails, calls } = oracle([700])
    await minimize(range(1000), fails)
    expect(calls()).toBeLessThanOrEqual(2 * Math.ceil(Math.log2(1000)))
  })

  it('finds polluters that only fail together, in their original order', async () => {
    const { fails } = oracle([3, 81])
    expect(await minimize(range(100), fails)).toEqual([3, 81])
  })

  it('finds three cooperating polluters', async () => {
    const { fails } = oracle([5, 50, 95])
    expect(await minimize(range(100), fails)).toEqual([5, 50, 95])
  })

  it('always hands subsets to the oracle in the original order', async () => {
    const seen: number[][] = []
    await minimize(range(20), async (subset) => {
      seen.push(subset)
      return subset.includes(2) && subset.includes(17)
    })
    for (const subset of seen) expect(subset).toEqual([...subset].sort((a, b) => a - b))
  })

  it('returns the single candidate as is', async () => {
    expect(await minimize(['only'], async () => true)).toEqual(['only'])
  })

  it('returns an empty list for no candidates', async () => {
    expect(await minimize([], async () => true)).toEqual([])
  })
})
