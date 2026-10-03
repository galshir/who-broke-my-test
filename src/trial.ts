import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { LeakRecord, TrialRequest, TrialResult, Unit } from './types.js'

export interface TrialOptions {
  root: string
  config?: string
  project?: string
  isolate?: boolean
  /** Print the child's own output (the user's console.log, Vitest warnings). */
  verbose?: boolean
}

export interface TrialOutcome extends TrialResult {
  leaks: LeakRecord[]
}

const childScript = fileURLToPath(new URL('./child.js', import.meta.url))

export class TrialRunner {
  private readonly dir = mkdtempSync(join(tmpdir(), 'wbmt-'))
  private counter = 0
  trials = 0

  constructor(private readonly options: TrialOptions) {}

  async run(units: Unit[], extra: { runLast?: string } = {}): Promise<TrialOutcome> {
    this.trials++
    const n = ++this.counter
    const request: TrialRequest = {
      root: this.options.root,
      config: this.options.config,
      project: this.options.project,
      isolate: this.options.isolate,
      units,
      runLast: extra.runLast,
      probeOut: join(this.dir, `probe-${n}.jsonl`),
      resultOut: join(this.dir, `result-${n}.json`),
    }
    const requestPath = join(this.dir, `request-${n}.json`)
    writeFileSync(requestPath, JSON.stringify(request))

    const { code, output } = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
      const child = spawn(process.execPath, [childScript, requestPath], {
        cwd: this.options.root,
        env: { ...process.env, FORCE_COLOR: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let output = ''
      const collect = (chunk: Buffer) => {
        output += chunk.toString()
        if (this.options.verbose) process.stderr.write(chunk)
      }
      child.stdout.on('data', collect)
      child.stderr.on('data', collect)
      child.on('error', reject)
      child.on('close', (code) => resolve({ code, output }))
    })

    if (!existsSync(request.resultOut)) {
      throw new Error(`Vitest trial crashed (exit code ${code}).\n${output.trim().split('\n').slice(-20).join('\n')}`)
    }

    const result = JSON.parse(readFileSync(request.resultOut, 'utf8')) as TrialResult
    const leaks = existsSync(request.probeOut)
      ? readFileSync(request.probeOut, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line) as LeakRecord)
      : []
    return { ...result, leaks }
  }

  dispose() {
    rmSync(this.dir, { recursive: true, force: true })
  }
}
