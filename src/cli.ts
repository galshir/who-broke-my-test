#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { findPolluter } from './find.js'
import { c, formatResult } from './report.js'

const HELP = `
${c.bold('who-broke-my-test')} - find the test that breaks your test

${c.bold('Usage')}
  npx who-broke-my-test <test-file> [options]

${c.bold('Options')}
  -t, --test <name>     Failing test (full name or part of it). Default: first failing test
  -r, --root <dir>      Project root (default: current directory)
  -c, --config <path>   Vitest config file
      --project <name>  Vitest project to use (workspaces)
      --no-isolate      Run trials without test isolation (like isolate: false)
      --json            Print the result as JSON
      --verbose         Show the output of every trial run
  -h, --help            Show this help
  -v, --version         Show the version

${c.bold('Exit codes')}
  0  culprit found
  1  no order-dependent failure found
  2  error
`

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      test: { type: 'string', short: 't' },
      root: { type: 'string', short: 'r' },
      config: { type: 'string', short: 'c' },
      project: { type: 'string' },
      'no-isolate': { type: 'boolean' },
      json: { type: 'boolean' },
      verbose: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  })

  if (values.version) {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
    console.log(pkg.version)
    return 0
  }
  if (values.help || positionals.length !== 1) {
    console.log(HELP)
    return values.help ? 0 : 2
  }

  const root = resolve(values.root ?? process.cwd())
  const started = Date.now()
  const progress = (text: string) => {
    if (!values.json) process.stderr.write(`${c.dim(text)}\n`)
  }

  const result = await findPolluter({
    root,
    file: resolve(process.cwd(), positionals[0]!),
    test: values.test,
    config: values.config ? resolve(process.cwd(), values.config) : undefined,
    project: values.project,
    isolate: values['no-isolate'] ? false : undefined,
    verbose: values.verbose,
    onProgress: (event) => {
      if (event.type === 'phase') progress(`› ${event.message}`)
      else if (values.verbose) progress(`  run ${event.trials}: ${event.remaining} candidate(s) left`)
    },
  })

  if (values.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(`\n${formatResult(result, root)}\n`)
    progress(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`)
  }
  return result.status === 'found' ? 0 : result.status === 'target-not-found' ? 2 : 1
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(c.red(error instanceof Error ? error.message : String(error)))
    process.exit(2)
  },
)
