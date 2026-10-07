---
name: testing
description: DropUI React testing conventions for Vitest (jsdom unit `*.spec.ts`, real-Chromium component `*.test.tsx`, React Testing Library) and Playwright (end-to-end `*.e2e.ts`). Use when writing, editing, or running tests, creating a new component (it needs a `*.test.tsx`), or verifying a completed task.
---

# Testing

The full conventions live in [guides/testing.md](../../guides/testing.md): read it before writing tests. Summary:

| Style                    | Suffix       | Runs in                      | Covers                                                                  | Command                                    |
| ------------------------ | ------------ | ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| Unit (Vitest)            | `*.spec.ts`  | jsdom                        | Store factories, pure functions, the announcer, input → class mappings  | `npm test -- --watch=false`                |
| Component (Vitest + RTL) | `*.test.tsx` | Real Chromium (browser mode) | Rendering and behaviour: every branch, roles, focus, callback props     | `npm run test:components -- --watch=false` |
| End-to-end (Playwright)  | `*.e2e.ts`   | Served app (`npm run dev`)   | Cross-component flows, above all palette → canvas drag & drop           | `npm run e2e`                              |

- We use Vitest. Do not generate Jest configuration files. One file: `vitest.config.ts` with the projects `unit` and `components`.
- A store spec calls the factory (`createBuilderStore({ announce: vi.fn() })`), drives its actions and reads `store.getState()`. A store spec has no DOM; the announcer's gets a detached document.
- Every component has a sibling `*.test.tsx` using React Testing Library (`render` + `screen`), covering every branch. A component that reads a store is mounted with `renderWithStores(ui, { initial })` from `src/test/render-with-stores.tsx`; a controlled component (the dialogs) through a small host component written in the test file.
- No class selectors, no `toHaveClass`, no `vi.spyOn` or `vi.mock` in `*.test.tsx`, and no comments in any test file. Reach a branch with props, preset store state or an event. Assert the DOM; a callback **prop** may be a `vi.fn()`; an effect that only lands in a store is read from the store `renderWithStores` returned.
- `fireEvent` for clicks and typing; `userEvent.keyboard` from `vitest/browser` for real keys (Enter, Escape, arrows, typeahead). Wait for Base UI menus, dialogs and focus with `findBy*` / `waitFor`, never with a timeout.
- A component that gains an import from `node_modules` (a new Base UI subpath counts) needs it added to `BROWSER_DEPENDENCIES` in `vitest.config.ts`, or every component test fails with `Invalid hook call`.
- E2E tests live in `e2e/` at the repo root and are a contract kept identical in a second repository: before changing an assertion, read [What does not differ](../../../docs/angular-react-divergence.md#what-does-not-differ). They are for flows no single component can prove, not a substitute for component tests. Prefer role/text/test-id locators over CSS selectors. Playwright serves the app on port 5173.
- A task is done only when `npm run build` and all three suites are green.
