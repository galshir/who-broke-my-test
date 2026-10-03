# Issues to open before launch

Each one is scoped so a first-time contributor can finish it in an evening. Label the first group `good first issue`.

## good first issue

1. **Detect leaked `vi.stubGlobal` / `vi.stubEnv`.** Report them by name ("missing vi.unstubAllGlobals()") instead of as a plain global/env change. Files: `src/probe.ts`, plus a fixture.
2. **Detect `Math.random` seeded or replaced by a library.** Add it to `WATCHED` with a fixture that uses a seeded RNG.
3. **Detect a leaked `process.exitCode`.** Snapshot it in `take()` and compare it.
4. **Detect leaked `process.umask()` / `process.title` changes.** Same pattern as `cwd`.
5. **`--json` schema doc.** Document the JSON output in the README, with an example for each status.
6. **Show the target's file:line.** Use the test location from Vitest (`TestCase.location`) in the report header.
7. **Color-free output test.** Add a test for `formatResult` with `NO_COLOR=1`, so output stays stable for CI logs.
8. **Fixture: leaked fake timers across files.** A polluter calls `vi.useFakeTimers()` without restoring it, and the victim uses `setTimeout`.

## help wanted

9. **Jest runner.** Add a `src/runners/jest.ts` that implements the same trial contract (ordered units in, test outcomes out), using `--runTestsByPath` and `--testNamePattern`.
10. **`node:test` runner.**
11. **`--all` mode.** Run the suite once, then find culprits for every order-dependent failure in one go.
12. **jsdom / happy-dom leaks.** Report leftover `document.body` children, `localStorage` keys and event listeners on `window`.
13. **Module-level culprit in a file with a single test.** Today that case is reported as the test. Run the module with no tests to tell the two apart.
14. **GitHub Action.** When a test fails in CI but passes on retry alone, run the tool and comment the culprit on the PR.
