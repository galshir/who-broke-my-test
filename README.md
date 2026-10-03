# who-broke-my-test

**Your test passes on its own and fails in the full run. Some other test broke it. This finds which one, and what it left behind.**

```
$ npx who-broke-my-test tests/user.spec.ts

› Running user.spec.ts on its own
› Passes on its own, running the whole suite in one worker with user.spec.ts last
› Checking that the 7 file(s) before it reproduce the failure
› Bisecting 7 file(s) that run before user.spec.ts
› Narrowing down to a test in auth.spec.ts

✗ user.spec.ts > creates user as guest
  expected { role: 'admin' } to be undefined

🎯 Culprit (12 runs)
   auth.spec.ts > logs in as admin
   Leaked:
     • globalThis.currentUser was added and never removed
     • console.error is still a mock/spy (missing mockRestore / vi.restoreAllMocks)
```

No config, no changes to your tests. Works with [Vitest](https://vitest.dev) 4 and 5.

## Why

Order-dependent failures ("test pollution") are some of the most expensive bugs in a test suite. One test sets an env var, leaves fake timers on, forgets to restore a spy, or writes to a global. A test hundreds of files later fails with an error that has nothing to do with the cause. The usual way to find it is to comment out tests by hand until it passes.

That is a search problem, and computers are good at search.

## How it works

1. **Runs the failing file on its own.** If the test fails there, it is either broken (and we tell you) or broken by an earlier test in the same file.
2. **Runs the whole suite in one worker with your file last**, to reproduce the failure and record which files ran before it. (Vitest normally runs previously failed files first, so its order changes from run to run; putting the target last gives every other file a chance to run before it.)
3. **Bisects** the tests or files that ran first, keeping the order, until it has the smallest set that still breaks your test. One polluter among 1000 files takes about 20 runs. If the failure needs two polluters together (one sets something up, another depends on it), it finds both.
4. **Narrows a culprit file down to a single test**, or tells you the problem is the module's top-level code or hooks.
5. **Shows what leaked.** A probe compares process state before and after each test, after the test's own cleanup has run:

| Leak | Example |
|---|---|
| env vars | `process.env.NODE_ENV changed "test" → "production"` |
| globals | `globalThis.currentUser was added and never removed` |
| spies | `console.error is still a mock/spy` |
| patched builtins | `Date.now was replaced and not restored` |
| fake timers | `fake timers are still on (missing vi.useRealTimers())` |
| working directory | `process.cwd() changed` |
| process listeners | `1 process.on('unhandledRejection') listener(s) left behind` |
| open handles | `1 open Timeout handle(s) left behind` |

Every trial runs in a fresh process, so trials never leak into each other.

## Usage

```bash
npx who-broke-my-test <test-file> [options]
```

| Option | |
|---|---|
| `-t, --test <name>` | The failing test (full name or part of it). Default: the first failing test in the file |
| `-r, --root <dir>` | Project root. Default: current directory |
| `-c, --config <path>` | Vitest config file |
| `--project <name>` | Vitest project to use, for workspaces |
| `--no-isolate` | Run trials with `isolate: false` |
| `--json` | Machine-readable result |
| `--verbose` | Show the output of every trial run |

Exit codes: `0` culprit found, `1` no order-dependent failure, `2` error.

### Programmatic API

```ts
import { findPolluter } from 'who-broke-my-test'

const result = await findPolluter({ root: process.cwd(), file: 'tests/user.spec.ts' })
if (result.status === 'found') console.log(result.culprits)
```

## Good to know

- **Cross-file pollution through memory needs shared state.** By default Vitest isolates every test file, so tests in different files can only break each other through things outside the process: a database, files on disk, a port. With `isolate: false` (in your config or with `--no-isolate`) they share memory too, which is where most cross-file pollution comes from.
- **The probe sees the process, not the outside world.** If the culprit leaks database rows or files, you get the culprit but no "Leaked" list.
- **`vi.mock` module mocks are not detected** as leaks yet.
- **Flaky is not the same as order-dependent.** If the failure does not reproduce in a sequential run, it is probably timing or randomness, and this tool tells you so instead of guessing.

## Roadmap

- Jest, Mocha and `node:test` runners
- Run the whole suite and find every polluted test in one go
- Detect leaked `vi.mock`, `vi.stubGlobal` and DOM state (jsdom / happy-dom)
- GitHub Action that comments the culprit on a failing PR

Want to help? See [CONTRIBUTING.md](CONTRIBUTING.md): many of these are small, self-contained pieces.

## License

MIT
