/**
 * Runs a single trial in its own process, so nothing from one trial can
 * leak into the next. Invoked by trial.ts as `node child.js <request.json>`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadVitestNode } from './resolve.js'
import type { TestOutcome, TrialRequest, TrialResult } from './types.js'

const request = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as TrialRequest
const probe = fileURLToPath(new URL('./probe.js', import.meta.url))

/** Runs the modules in exactly the order they were handed in. */
class KeepOrderSequencer {
  constructor(_ctx: unknown) {}
  async shard<T>(files: T[]): Promise<T[]> {
    return files
  }
  async sort<T>(files: T[]): Promise<T[]> {
    return files
  }
}

function moveLast<T extends { moduleId: string }>(specs: T[], moduleId: string | undefined): T[] {
  if (!moduleId) return specs
  return [...specs.filter((s) => s.moduleId !== moduleId), ...specs.filter((s) => s.moduleId === moduleId)]
}

function stringifyError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

async function main() {
  const { createVitest, BaseSequencer } = await loadVitestNode(request.root)

  process.env.WBMT_PROBE_OUT = request.probeOut
  // Same environment `vitest run` sets up before creating its instance.
  process.env.TEST = 'true'
  process.env.VITEST = 'true'
  process.env.NODE_ENV ??= 'test'

  const vitest = await createVitest(
    'test',
    {
      root: request.root,
      config: request.config,
      watch: false,
      reporters: [],
      // One worker, one file after another: the order is the experiment.
      fileParallelism: false,
      maxWorkers: 1,
      ...(request.isolate === undefined ? {} : { isolate: request.isolate }),
      // Tests left out on purpose must not fail the run with "no tests".
      passWithNoTests: true,
    },
    // `test` is added to Vite's UserConfig by vitest/config, which we do not load here.
    {
      test: {
        setupFiles: [probe],
        sequence: { sequencer: KeepOrderSequencer },
      },
    } as never,
  )

  try {
    const all = await vitest.globTestSpecifications()
    const project = request.project
      ? all.find((s) => s.project.name === request.project)?.project
      : all[0]?.project
    if (!project) throw new Error(`No test project found${request.project ? ` named "${request.project}"` : ''}`)

    // No units means "the whole suite, in the order Vitest would pick", with
    // the target moved to the end so everything else gets a chance to run first.
    const specs =
      request.units.length === 0
        ? moveLast(await new BaseSequencer(vitest).sort(all.filter((s) => s.project === project)), request.runLast)
        : request.units.map((unit) =>
            unit.testIds
              ? project.createSpecification(unit.file, { testIds: unit.testIds })
              : project.createSpecification(unit.file),
          )

    const run = await vitest.runTestSpecifications(specs)

    const tests: TestOutcome[] = []
    for (const module of run.testModules) {
      for (const test of module.children.allTests()) {
        const result = test.result()
        tests.push({
          id: test.id,
          file: module.moduleId,
          fullName: test.fullName,
          state: result.state,
          error: result.state === 'failed' ? stringifyError(result.errors[0]) : undefined,
        })
      }
    }

    const result: TrialResult = {
      tests,
      files: run.testModules.map((m) => m.moduleId),
      unhandledErrors: run.unhandledErrors.map(stringifyError),
    }
    writeFileSync(request.resultOut, JSON.stringify(result))
  } finally {
    await vitest.close()
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    process.stderr.write(`${error?.stack ?? error}\n`)
    process.exit(2)
  },
)
