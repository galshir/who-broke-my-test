import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

type VitestNode = typeof import('vitest/node')

type ExportTarget = string | { [condition: string]: ExportTarget } | null | undefined

function pickImport(target: ExportTarget): string | undefined {
  if (typeof target === 'string') return target
  if (!target) return undefined
  for (const condition of ['node', 'import', 'default']) {
    const found = pickImport(target[condition])
    if (found) return found
  }
  return undefined
}

/**
 * Loads `vitest/node` from the project under test, so trials run with the
 * same Vitest version the project uses. Falls back to the copy installed
 * next to this package.
 */
export async function loadVitestNode(root: string): Promise<VitestNode> {
  try {
    const require = createRequire(join(root, 'package.json'))
    const pkgPath = require.resolve('vitest/package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { exports?: Record<string, ExportTarget> }
    const entry = pickImport(pkg.exports?.['./node'])
    if (entry) return (await import(pathToFileURL(join(dirname(pkgPath), entry)).href)) as VitestNode
  } catch {
    // fall through
  }
  return import('vitest/node')
}
