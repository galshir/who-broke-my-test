/**
 * Setup file injected into every trial. It snapshots process-wide state
 * around each test and each module and appends whatever is still different
 * afterwards to WBMT_PROBE_OUT as JSON lines.
 *
 * It is registered before the project's own setup files, and Vitest runs
 * `afterEach` / `afterAll` hooks in reverse order by default, so the
 * comparison happens after the test's own cleanup has run.
 */
import { appendFileSync } from 'node:fs'
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from 'vitest'
import type { Leak, LeakRecord } from './types.js'

const out = process.env.WBMT_PROBE_OUT

/** Globals whose identity tells us they were replaced and not put back. */
const WATCHED: Array<[string, () => unknown]> = [
  ['Date', () => globalThis.Date],
  ['Date.now', () => Date.now],
  ['Math.random', () => Math.random],
  ['fetch', () => globalThis.fetch],
  ['setTimeout', () => globalThis.setTimeout],
  ['setInterval', () => globalThis.setInterval],
  ['queueMicrotask', () => globalThis.queueMicrotask],
  ['console.log', () => console.log],
  ['console.info', () => console.info],
  ['console.warn', () => console.warn],
  ['console.error', () => console.error],
  ['console.debug', () => console.debug],
  ['process.exit', () => process.exit],
  ['JSON.parse', () => JSON.parse],
  ['JSON.stringify', () => JSON.stringify],
]

const PROCESS_EVENTS = ['unhandledRejection', 'uncaughtException', 'exit', 'warning', 'SIGINT', 'SIGTERM'] as const

/** Globals Vitest or Node add on their own between tests. */
const IGNORED_GLOBALS = new Set(['__vitest_worker__', '__vitest_index__', '__vitest_mocker__', '__VITEST_GENERATE_UI_TOKEN__'])

interface Snapshot {
  env: Record<string, string | undefined>
  globals: Set<string>
  watched: Map<string, unknown>
  fakeTimers: boolean
  cwd: string
  listeners: Map<string, number>
  handles: Map<string, number>
}

function countHandles(): Map<string, number> {
  const counts = new Map<string, number>()
  const info = (process as { getActiveResourcesInfo?: () => string[] }).getActiveResourcesInfo?.() ?? []
  for (const type of info) counts.set(type, (counts.get(type) ?? 0) + 1)
  return counts
}

function take(): Snapshot {
  return {
    env: { ...process.env },
    globals: new Set(Object.getOwnPropertyNames(globalThis)),
    watched: new Map(WATCHED.map(([name, get]) => [name, safe(get)])),
    fakeTimers: vi.isFakeTimers(),
    cwd: process.cwd(),
    listeners: new Map(PROCESS_EVENTS.map((e) => [e, process.listenerCount(e)])),
    handles: countHandles(),
  }
}

function safe(get: () => unknown): unknown {
  try {
    return get()
  } catch {
    return undefined
  }
}

function show(value: string | undefined): string {
  return value === undefined ? '(unset)' : JSON.stringify(value)
}

function compare(before: Snapshot): Leak[] {
  const after = take()
  const leaks: Leak[] = []

  const envKeys = new Set([...Object.keys(before.env), ...Object.keys(after.env)])
  for (const key of envKeys) {
    if (key === 'WBMT_PROBE_OUT' || key.startsWith('VITEST')) continue
    if (before.env[key] !== after.env[key]) {
      leaks.push({ kind: 'env', message: `process.env.${key} changed ${show(before.env[key])} → ${show(after.env[key])}` })
    }
  }

  for (const name of after.globals) {
    if (!before.globals.has(name) && !IGNORED_GLOBALS.has(name)) {
      leaks.push({ kind: 'global', message: `globalThis.${name} was added and never removed` })
    }
  }
  for (const name of before.globals) {
    if (!after.globals.has(name) && !IGNORED_GLOBALS.has(name)) {
      leaks.push({ kind: 'global', message: `globalThis.${name} was deleted` })
    }
  }

  for (const [name, get] of WATCHED) {
    const now = safe(get)
    if (now === before.watched.get(name)) continue
    if (vi.isMockFunction(now)) {
      leaks.push({ kind: 'spy', message: `${name} is still a mock/spy (missing mockRestore / vi.restoreAllMocks)` })
    } else {
      leaks.push({ kind: 'patched', message: `${name} was replaced and not restored` })
    }
  }

  if (!before.fakeTimers && after.fakeTimers) {
    leaks.push({ kind: 'fake-timers', message: 'fake timers are still on (missing vi.useRealTimers())' })
  }

  if (before.cwd !== after.cwd) {
    leaks.push({ kind: 'cwd', message: `process.cwd() changed ${before.cwd} → ${after.cwd}` })
  }

  for (const [event, count] of after.listeners) {
    const added = count - (before.listeners.get(event) ?? 0)
    if (added > 0) leaks.push({ kind: 'listeners', message: `${added} process.on('${event}') listener(s) left behind` })
  }

  for (const [type, count] of after.handles) {
    const added = count - (before.handles.get(type) ?? 0)
    if (added > 0) leaks.push({ kind: 'handles', message: `${added} open ${type} handle(s) left behind (timer, socket or server)` })
  }

  return leaks
}

function record(entry: LeakRecord) {
  if (!out || entry.leaks.length === 0) return
  try {
    appendFileSync(out, `${JSON.stringify(entry)}\n`)
  } catch {
    // never break the user's run
  }
}

function currentFile(): string {
  return expect.getState().testPath ?? ''
}

// Taken before the test module is imported, so its top-level code is covered.
const moduleSnapshot = take()
let testSnapshot: Snapshot | undefined

beforeAll(() => {
  // Count handles from inside a hook, like at afterAll time: Vitest keeps a
  // timer of its own running while a hook executes.
  moduleSnapshot.handles = countHandles()
})

beforeEach(() => {
  testSnapshot = take()
})

interface TaskLike {
  name: string
  suite?: TaskLike
  filepath?: string
}

/** `describe > test`, the same shape as TestCase.fullName in reporters (no file name). */
function testName(task: TaskLike): string {
  const names: string[] = []
  for (let t: TaskLike | undefined = task; t && t.filepath === undefined; t = t.suite) {
    if (t.name) names.unshift(t.name)
  }
  return names.join(' > ')
}

afterEach((context) => {
  if (!testSnapshot) return
  record({ scope: 'test', file: currentFile(), name: testName(context.task as TaskLike), leaks: compare(testSnapshot) })
  testSnapshot = undefined
})

afterAll(() => {
  record({ scope: 'file', file: currentFile(), leaks: compare(moduleSnapshot) })
})
