/**
 * Returns a minimal subset of `candidates` that still makes `fails` return
 * true, keeping the original order. `fails(all candidates)` must be true.
 *
 * With a single polluter this is a plain bisection and needs about
 * log2(n) * 2 trials. When the failure needs several polluters together
 * (A sets something up, B relies on it), neither half fails on its own, so
 * each half is minimized while the other half stays in the run.
 */
export async function minimize<T>(
  candidates: readonly T[],
  fails: (subset: T[]) => Promise<boolean>,
  onStep?: (remaining: number) => void,
): Promise<T[]> {
  const index = new Map(candidates.map((c, i) => [c, i]))
  const ordered = (items: T[]) => [...items].sort((a, b) => index.get(a)! - index.get(b)!)

  async function recurse(cands: T[], context: T[]): Promise<T[]> {
    onStep?.(cands.length)
    if (cands.length <= 1) return cands

    const half = Math.ceil(cands.length / 2)
    const left = cands.slice(0, half)
    const right = cands.slice(half)

    if (await fails(ordered([...context, ...left]))) return recurse(left, context)
    if (await fails(ordered([...context, ...right]))) return recurse(right, context)

    // Both halves are needed.
    const minLeft = await recurse(left, [...context, ...right])
    const minRight = await recurse(right, [...context, ...minLeft])
    return ordered([...minLeft, ...minRight])
  }

  return recurse([...candidates], [])
}
