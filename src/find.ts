import { relative, resolve } from 'node:path'
import { minimize } from './search.js'
import { TrialRunner, type TrialOptions, type TrialOutcome } from './trial.js'
import type { LeakRecord, TestOutcome, Unit } from './types.js'

export interface FindOptions extends TrialOptions {
  /** Test file that fails when the suite runs, but not on its own. */
  file: string
  /** Full name (or part of it) of the failing test. Defaults to the first failing test. */
  test?: string
  onProgress?: (event: ProgressEvent) => void
}

export type ProgressEvent =
  | { type: 'phase'; message: string }
  | { type: 'trial'; trials: number; remaining: number }

export type FindResult =
  | {
      status: 'found'
      scope: 'test' | 'file'
      target: TestOutcome
      /** Error the target fails with when the culprits run first. */
      error?: string
      culprits: Culprit[]
      trials: number
    }
  | { status: 'fails-alone'; target: TestOutcome; trials: number }
  | { status: 'not-reproduced'; trials: number; hint: string }
  | { status: 'target-not-found'; trials: number; message: string }

export interface Culprit {
  file: string
  /** Full test name, or undefined when the whole module (top-level code or hooks) is to blame. */
  test?: string
  leaks: LeakRecord['leaks']
}

const display = (root: string, file: string) => relative(root, file) || file

function matches(test: TestOutcome, name: string | undefined) {
  if (!name) return true
  return test.fullName === name || test.fullName.includes(name)
}

function pickTarget(tests: TestOutcome[], file: string, name: string | undefined, state?: TestOutcome['state']) {
  const inFile = tests.filter((t) => t.file === file && matches(t, name))
  const exact = name ? inFile.filter((t) => t.fullName === name) : []
  const pool = exact.length > 0 ? exact : inFile
  return state ? pool.find((t) => t.state === state) : pool[0]
}

function stateOf(result: TrialOutcome, id: string) {
  return result.tests.find((t) => t.id === id)
}

export async function findPolluter(options: FindOptions): Promise<FindResult> {
  const root = resolve(options.root)
  const file = resolve(options.root, options.file)
  const runner = new TrialRunner({ ...options, root })
  const phase = (message: string) => options.onProgress?.({ type: 'phase', message })
  const step = (remaining: number) => options.onProgress?.({ type: 'trial', trials: runner.trials, remaining })

  try {
    // 1. The target module on its own.
    phase(`Running ${display(root, file)} on its own`)
    const alone = await runner.run([{ file, label: display(root, file) }])
    const fileTests = alone.tests.filter((t) => t.file === file)
    if (fileTests.length === 0) {
      return { status: 'target-not-found', trials: runner.trials, message: `No tests found in ${display(root, file)}` }
    }
    if (options.test && !fileTests.some((t) => matches(t, options.test))) {
      return {
        status: 'target-not-found',
        trials: runner.trials,
        message: `No test matching "${options.test}" in ${display(root, file)}`,
      }
    }

    const failingInFile = pickTarget(alone.tests, file, options.test, 'failed')
    if (failingInFile) {
      // 2a. It fails inside its own module: is it on its own, or because of an earlier test?
      phase(`"${failingInFile.fullName}" fails in its own file, running it by itself`)
      const single = await runner.run([{ file, testIds: [failingInFile.id], label: failingInFile.fullName }])
      if (stateOf(single, failingInFile.id)?.state === 'failed') {
        return { status: 'fails-alone', target: failingInFile, trials: runner.trials }
      }
      return await withinFile(failingInFile, fileTests)
    }

    // 2b. The module passes on its own, run the whole suite in order.
    // Vitest runs previously failed files first, so its usual order is not
    // stable. Running the target last gives every other file a chance to
    // run before it.
    phase(`Passes on its own, running the whole suite in one worker with ${display(root, file)} last`)
    const full = await runner.run([], { runLast: file })
    const target = pickTarget(full.tests, file, options.test, 'failed')
    if (!target) {
      return {
        status: 'not-reproduced',
        trials: runner.trials,
        hint:
          'The test passed in a sequential full run as well. If it only fails in CI or in parallel runs, ' +
          'try --no-isolate (the pollution may need shared module state) or run it a few times: it may be flaky rather than order-dependent.',
      }
    }
    return await acrossFiles(target, full)
  } finally {
    runner.dispose()
  }

  async function withinFile(target: TestOutcome, fileTests: TestOutcome[]): Promise<FindResult> {
    const before = fileTests.slice(0, fileTests.findIndex((t) => t.id === target.id))
    phase(`Bisecting ${before.length} earlier test(s) in ${display(root, file)}`)

    const unitFor = (ids: string[]): Unit => ({ file, testIds: [...ids, target.id], label: display(root, file) })
    const fails = async (subset: TestOutcome[]) =>
      stateOf(await runner.run([unitFor(subset.map((t) => t.id))]), target.id)?.state === 'failed'

    if (before.length === 0 || !(await fails(before))) {
      return {
        status: 'not-reproduced',
        trials: runner.trials,
        hint:
          `"${target.fullName}" fails when its whole file runs, but not with only the tests before it. ` +
          'It may depend on hooks, on tests running concurrently, or on timing.',
      }
    }

    const culprits = await minimize(before, fails, step)
    const proof = await runner.run([unitFor(culprits.map((t) => t.id))])
    return {
      status: 'found',
      scope: 'test',
      target,
      error: stateOf(proof, target.id)?.error,
      culprits: culprits.map((c) => ({
        file,
        test: c.fullName,
        leaks: proof.leaks.filter((l) => l.scope === 'test' && l.name === c.fullName).flatMap((l) => l.leaks),
      })),
      trials: runner.trials,
    }
  }

  async function acrossFiles(target: TestOutcome, full: TrialOutcome): Promise<FindResult> {
    const order = full.files
    const before = order.slice(0, order.indexOf(file))
    const targetOnly: Unit = { file, testIds: [target.id], label: target.fullName }
    const targetFile: Unit = { file, label: display(root, file) }

    // Prefer running just the target test; fall back to its whole module if
    // the failure needs earlier tests from the same file as well.
    let targetUnit = targetOnly
    const failsWith = async (units: Unit[]) => stateOf(await runner.run([...units, targetUnit]), target.id)?.state === 'failed'
    const asUnits = (files: string[]): Unit[] => files.map((f) => ({ file: f, label: display(root, f) }))

    phase(`Checking that the ${before.length} file(s) before it reproduce the failure`)
    if (!(await failsWith(asUnits(before)))) {
      targetUnit = targetFile
      if (!(await failsWith(asUnits(before)))) {
        return {
          status: 'not-reproduced',
          trials: runner.trials,
          hint:
            'The test failed in the full run, but not when only the files before it ran. The failure may depend on timing ' +
            'or on files that run after it (e.g. global setup/teardown); try running with --verbose.',
        }
      }
    }

    phase(`Bisecting ${before.length} file(s) that run before ${display(root, file)}`)
    const files = await minimize(before, (subset) => failsWith(asUnits(subset)), step)

    // Drill into a single culprit file to name the test.
    const culprits: Culprit[] = []
    let proofUnits: Unit[] = asUnits(files)
    if (files.length === 1) {
      const culpritFile = files[0]!
      const tests = full.tests.filter((t) => t.file === culpritFile && t.state !== 'skipped')
      if (tests.length > 0) {
        phase(`Narrowing down to a test in ${display(root, culpritFile)}`)
        const unit = (subset: TestOutcome[]): Unit => ({ file: culpritFile, testIds: subset.map((t) => t.id), label: display(root, culpritFile) })
        const failingTests = (await failsWith([unit(tests)]))
          ? await minimize(tests, (subset) => failsWith([unit(subset)]), step)
          : []
        // If the module still breaks the target without those tests, the
        // culprit is top-level code or a hook, not a test.
        const others = tests.filter((t) => !failingTests.includes(t))
        const moduleLevel = failingTests.length === 0 || (others.length > 0 && (await failsWith([unit(others)])))
        if (!moduleLevel) {
          proofUnits = [unit(failingTests)]
          const proof = await runner.run([...proofUnits, targetUnit])
          for (const t of failingTests) {
            culprits.push({
              file: culpritFile,
              test: t.fullName,
              leaks: proof.leaks.filter((l) => l.scope === 'test' && l.name === t.fullName).flatMap((l) => l.leaks),
            })
          }
          return {
            status: 'found',
            scope: 'test',
            target,
            error: stateOf(proof, target.id)?.error,
            culprits,
            trials: runner.trials,
          }
        }
      }
    }

    const proof = await runner.run([...proofUnits, targetUnit])
    return {
      status: 'found',
      scope: 'file',
      target,
      error: stateOf(proof, target.id)?.error,
      culprits: files.map((f) => ({
        file: f,
        leaks: proof.leaks.filter((l) => l.file === f).flatMap((l) => l.leaks),
      })),
      trials: runner.trials,
    }
  }
}
