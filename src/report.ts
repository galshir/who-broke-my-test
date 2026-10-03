import { relative } from 'node:path'
import type { FindResult } from './find.js'

const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code: number) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s)
export const c = {
  red: paint(31),
  green: paint(32),
  yellow: paint(33),
  cyan: paint(36),
  dim: paint(2),
  bold: paint(1),
}

function unique(messages: string[]) {
  return [...new Set(messages)]
}

function firstLine(text: string | undefined) {
  return text?.split('\n').find((l) => l.trim())?.trim()
}

export function formatResult(result: FindResult, root: string): string {
  const rel = (file: string) => relative(root, file) || file
  const lines: string[] = []

  switch (result.status) {
    case 'found': {
      const where = `${rel(result.target.file)} > ${result.target.fullName}`
      lines.push(`${c.red('✗')} ${c.bold(where)}`)
      if (result.error) lines.push(`  ${c.dim(firstLine(result.error) ?? '')}`)
      lines.push('')
      lines.push(
        result.culprits.length === 1
          ? `${c.green('🎯 Culprit')}${c.dim(` (${result.trials} runs)`)}`
          : `${c.green(`🎯 ${result.culprits.length} culprits, the failure needs all of them`)}${c.dim(` (${result.trials} runs)`)}`,
      )
      for (const culprit of result.culprits) {
        const name = culprit.test ? `${rel(culprit.file)} > ${culprit.test}` : `${rel(culprit.file)} ${c.dim('(module-level code or hooks)')}`
        lines.push(`   ${c.bold(name)}`)
        const leaks = unique(culprit.leaks.map((l) => l.message))
        if (leaks.length > 0) {
          lines.push(`   ${c.yellow('Leaked:')}`)
          for (const leak of leaks) lines.push(`     • ${leak}`)
        } else {
          lines.push(
            `   ${c.dim('No in-process leak detected: look for shared external state (database, files, ports, module mocks).')}`,
          )
        }
      }
      break
    }
    case 'fails-alone':
      lines.push(`${c.yellow('!')} ${c.bold(`${rel(result.target.file)} > ${result.target.fullName}`)}`)
      lines.push('  Fails when run completely on its own, so no other test is breaking it.')
      break
    case 'not-reproduced':
      lines.push(`${c.yellow('!')} Could not reproduce an order-dependent failure ${c.dim(`(${result.trials} runs)`)}`)
      lines.push(`  ${result.hint}`)
      break
    case 'target-not-found':
      lines.push(`${c.red('✗')} ${result.message}`)
      break
  }

  return lines.join('\n')
}
