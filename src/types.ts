/** One unit that can be included in or left out of a trial run. */
export interface Unit {
  /** Absolute path of the test module. */
  file: string
  /**
   * Vitest test ids to run from `file`. `undefined` runs the whole module.
   */
  testIds?: string[]
  /** Human readable label, e.g. `auth.spec.ts > logs in as admin`. */
  label: string
}

export interface TrialRequest {
  root: string
  config?: string
  project?: string
  /**
   * Units in the order they must run. Empty means the whole suite in the
   * order Vitest picks, with `runLast` (if set) moved to the end.
   */
  units: Unit[]
  runLast?: string
  isolate?: boolean
  /** File the probe appends leak records to. */
  probeOut: string
  /** Where the child writes its {@link TrialResult}. */
  resultOut: string
}

export interface TestOutcome {
  id: string
  file: string
  fullName: string
  state: 'passed' | 'failed' | 'skipped' | 'pending'
  error?: string
}

export interface TrialResult {
  tests: TestOutcome[]
  /** Order the modules actually ran in. */
  files: string[]
  unhandledErrors: string[]
}

export interface Leak {
  kind: 'env' | 'global' | 'patched' | 'spy' | 'fake-timers' | 'cwd' | 'listeners' | 'handles'
  message: string
}

export interface LeakRecord {
  scope: 'test' | 'file'
  file: string
  /** Full test name for scope `test`. */
  name?: string
  leaks: Leak[]
}
