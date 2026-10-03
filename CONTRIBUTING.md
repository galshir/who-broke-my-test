# Contributing

Thanks for helping! Most contributions here are small and self-contained: a new kind of leak, a new runner, a clearer message.

## Setup (about 2 minutes)

```bash
git clone https://github.com/<you>/who-broke-my-test
cd who-broke-my-test
npm install
npm test        # builds, then runs unit and end-to-end tests
```

## How the code is laid out

| File | What it does |
|---|---|
| `src/cli.ts` | Argument parsing and output |
| `src/find.ts` | The search: run alone, run the suite, bisect, narrow down |
| `src/search.ts` | `minimize()`, the order-preserving bisection (pure, easy to test) |
| `src/trial.ts` | Starts one trial in a fresh child process |
| `src/child.ts` | Runs Vitest through its Node API with a fixed file order |
| `src/probe.ts` | Setup file injected into trials, records leaked state |
| `src/report.ts` | Terminal formatting |
| `test/fixtures/*` | Tiny Vitest projects with a known polluter. Each one is a real scenario |

## Adding a new kind of leak

1. Add the snapshot and the comparison in `src/probe.ts` (`take()` and `compare()`).
2. Add a fixture under `test/fixtures/<name>` with one polluting test and one victim.
3. Add a case to `test/e2e.test.ts` that checks the leak message.

## Adding a fixture for a bug you hit

If the tool missed a culprit in your project, the most useful thing you can send is a fixture that reproduces it: a folder with a `vitest.config.ts`, a polluter and a victim. A failing test is a perfect PR on its own.

## Pull requests

- Keep a PR to one change, and add a fixture or unit test for it.
- Run `npm test` and `npm run typecheck` before pushing.
- Use conventional commit messages (`fix:`, `feat:`, `docs:`, `test:`).

PRs get a first review within a couple of days.
