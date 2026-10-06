DropUI is a drag & drop ui builder. The user selects a ui element type from the navigation-style menu and drags it in the UI. In that way, the user can create a full client ui just by dragging and dropping on the page.

This repository is the React port of the Angular app in the sibling `drop-ui` repository. Both are meant to behave the same: the Playwright suite in `e2e/` is shared between them and is the contract.

## Agent behavior

- Don't EVER, under any circumstances git commit anything. You are BANNED from commiting even the tiniest change.
- Every time a task that changes anything the build or tests consume (source, tests, config, styles, dependencies) is completed, run all three test suites (`npm test -- --watch=false`, `npm run test:components -- --watch=false` and `npm run e2e`) and make sure they pass. Such a task is not done until all tests are green. Skip the suites for changes that only touch docs, skills, guides or plans.

## Architecture

- We use Zustand for all shared state: one vanilla store per feature, created by a factory and handed to components through React context and a selector hook ([ADR 0001](../docs/adr/0001-feature-state-in-zustand-stores.md)). Never share state through a context value of its own, a module-level variable or props relayed by the shell. `useState` is for UI state no other component reads, such as which dialog is open.
- Feature modules follow the feature-driven directory structure: `src/app/features/[feature-name]/`.
- For UI components we use Base UI (`@base-ui/react`) for menus and dialogs and dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) for drag & drop.

## Conventions

- Components are PascalCase functions with named exports, never default exports: e.g. `Canvas`, `ElementPalette`. A component lives in a kebab-case file named after it, in a folder of the same name: `element-palette/element-palette.tsx`. Imports are relative.

## Comments

- Do not comment on test files
- Comment sparingly if at all
- Comment only on the 'why' a decision was made that is not obvious from the code. Do not comment on implementation that can be seen just by reading the actual code.

## Styling

- We use Tailwind and on top of it DaisyUI, which is a tailwind based collection of class names

## Testing

- Vitest for unit (`*.spec.ts`, jsdom) and component (`*.test.tsx`, real Chromium) tests, Playwright for E2E (`*.e2e.ts`). Before writing or running tests, load the `testing` skill: [skills/testing/SKILL.md](skills/testing/SKILL.md).
