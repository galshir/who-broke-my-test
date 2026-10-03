import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findPolluter } from '../dist/index.js'

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

const find = (name: string, file: string, test?: string) => findPolluter({ root: fixture(name), file, test })

describe('findPolluter (end to end, real Vitest runs)', () => {
  it('finds a polluting test earlier in the same file and what it leaked', async () => {
    const result = await find('in-file', 'settings.spec.ts')
    expect(result.status).toBe('found')
    if (result.status !== 'found') return
    expect(result.scope).toBe('test')
    expect(result.target.fullName).toBe('settings > enables debug logging in test mode')
    expect(result.culprits).toEqual([
      expect.objectContaining({ test: 'settings > switches to production mode' }),
    ])
    expect(result.culprits[0]!.leaks.map((l) => l.message)).toContain('process.env.NODE_ENV changed "test" → "production"')
  })

  it('finds a polluting test in another file when isolation is off', async () => {
    const result = await find('cross-file', 'user.spec.ts')
    expect(result.status).toBe('found')
    if (result.status !== 'found') return
    expect(result.culprits).toHaveLength(1)
    expect(result.culprits[0]!.file).toMatch(/auth\.spec\.ts$/)
    expect(result.culprits[0]!.test).toBe('logs in as admin')
    expect(result.culprits[0]!.leaks.map((l) => l.kind).sort()).toEqual(['global', 'spy'])
  })

  it('blames module-level code when no single test is responsible', async () => {
    const result = await find('module-level', 'client.spec.ts')
    expect(result.status).toBe('found')
    if (result.status !== 'found') return
    expect(result.scope).toBe('file')
    expect(result.culprits[0]!.file).toMatch(/api\.spec\.ts$/)
    expect(result.culprits[0]!.test).toBeUndefined()
    expect(result.culprits[0]!.leaks.map((l) => l.message)).toContain(
      'process.env.API_URL changed (unset) → "https://prod.example.com"',
    )
  })

  it('reports every polluter when the failure needs several of them', async () => {
    const result = await find('multi', 'flags.spec.ts')
    expect(result.status).toBe('found')
    if (result.status !== 'found') return
    expect(result.culprits.map((c) => c.test)).toEqual(['turns on feature A', 'turns on feature B'])
  })

  it('says so when the test fails on its own', async () => {
    const result = await find('fails-alone', 'broken.spec.ts')
    expect(result.status).toBe('fails-alone')
  })

  it('says so when nothing fails', async () => {
    const result = await find('clean', 'ok.spec.ts')
    expect(result.status).toBe('not-reproduced')
  })

  it('reports an unknown test name', async () => {
    const result = await find('clean', 'ok.spec.ts', 'does not exist')
    expect(result.status).toBe('target-not-found')
  })
})
