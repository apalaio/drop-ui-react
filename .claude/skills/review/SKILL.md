---
name: review
description: Review code changes. Accepts a branch name, PR number, or defaults to current branch vs main. Examples - /review, /review feature/xyz, /review #123.
---

You are a senior React reviewer. Your core question for every change is: **"What's the intent, and is this the best approach?"**

For React conventions, go by the current guidance on react.dev for the React version in `package.json` (function components and hooks, `ref` as a prop, a context rendered as its own provider). The project's own decisions are in [ADR 0001](../../../docs/adr/0001-feature-state-in-zustand-stores.md) (stores) and [ADR 0002](../../../docs/adr/0002-canvas-elements-as-a-discriminated-union.md) (the element model).

## Input

The user may provide an argument:

- **No argument** — review current branch against `main` (including uncommitted changes in the working tree)
- **Branch name** (e.g. `feature/xyz`) — review that branch against `main`
- **PR reference** (e.g. `#123` or `123`) — use `gh pr diff <number>` and `gh pr view <number>` to get the changes

## Steps

1. **Gather context:**

- For branch reviews: `git log main..<ref> --oneline`, `git diff main...<ref> --name-status`, `git diff main...<ref>`; with no argument also `git status --short` and `git diff` for uncommitted work
- For PR reviews: `gh pr view <number>`, `gh pr diff <number>`

2. **Review each change** through these lenses:

   **Intent & approach** — Does the change solve the right problem? Is there a simpler or more idiomatic way?

   **React conventions** — Is state derived during render where it can be, instead of copied into `useState` and synced with an effect? Are effects only for synchronising with something outside React (the DOM, a subscription), with a cleanup where one is needed? Are list keys stable ids, never an index on a list that reorders or deletes? Are hooks called unconditionally?

   **Tests** — Updated for new behavior? AAA pattern? Proper mocking? Right layer? See [guides/testing.md](../../guides/testing.md) for the `*.spec.ts` / `*.test.tsx` / `*.e2e.ts` split.

   **Touched-component coverage** — **mandatory, [Critical].** See [guides/testing.md](../../guides/testing.md) § Touched components require component test coverage. For every component whose markup or behavior is touched in the diff:

- Find its sibling `*.test.tsx` (e.g. `canvas.tsx` → `canvas.test.tsx`). **Missing?** → [Critical]: the file must be created in this change. Do not accept "will add later" or "covered by E2E" — component tests are the cheap layer; E2E is not a substitute.
- **Exists?** → verify it covers **every render branch in the file** (each `&&` and ternary, each `switch` `case`, each `.map` and its empty fallback, every event handler), per the guide's definition of done. Missing branch coverage → [Critical].
- Only non-behavioral touches (formatting, rename-only, comment edits) are exempt. Logic that lives in a pure function with no markup of its own (`resolveDrop`, a store action, a class mapping) may be covered in `*.spec.ts` instead, per the choosing guide.
- **Also exempt: a touch that only applies a shared hook or props object** (`usePrefersReducedMotion`, `noDrag`), where the behavior change is entirely the shared piece's. Flag a _newly added_ per-consumer test of that shared behavior as [Minor]. The exemption dies as soon as the component's own markup or logic changes too.
- **Static-presence assertions** — `[Minor]`. Flag any `*.test.tsx` case that asserts presence of an element rendering **unconditionally** (static label, heading, landmark), or whose presence is already implied by a sibling test querying the same element. Apply the smell test in [guides/testing.md](../../guides/testing.md) § What to test.

  **E2E coverage** — **[Important].** If the diff changes drag & drop behavior (a `useDraggable`/`useSortable`/`useDroppable` call, the `DndContext` in `BuilderShell`, `resolveDrop`, a builder store action that a drop calls, a new palette element type), check that an `e2e/*.e2e.ts` test exercises the real drag. The branching of `resolveDrop` belongs in `canvas-drop.spec.ts`; the drag itself can only be proved in E2E.

  **Performance** — Does a store selector build a new array or object (in Zustand 5 that re-renders without end; select what is in the state and derive with `useMemo`, as `useCells()` does)? Does a component select more of the store than it reads? Are listeners, subscriptions and timers removed in the effect's cleanup? Is `useMemo`/`useCallback`/`memo` added without a reason that can be named (a ref callback that must stay stable, a derived array that is expensive to rebuild)?

  **Project-specific rules** — from `.claude/CLAUDE.md`. Each violation is **[Important]** unless noted:

- **State lives in Zustand stores** — per `CLAUDE.md` § Architecture and ADR 0001. Flag state shared between components that isn't in a store: a module-level mutable variable or a context holding state of its own (**[Critical]**), or `useState` lifted into `BuilderShell` and relayed through props when the builder store should own it. Store updates go through one `set` call inside an action, with an updater when the new state is built from the old — flag direct mutation of state arrays/objects, an action that calls `set` more than once for one user action (an action that waits for a service is the exception: once before the wait and once after it, per rule 13), and `setState` called on a store from outside its own file.
- **Stores touch nothing outside themselves** — per ADR 0001 rule 11. Flag a store file that reads or writes the DOM, or a factory that calls `store.subscribe` to run a side effect; keeping the page in step with state belongs to a component that reads the store, rendered where it can be and in a `useEffect` where it cannot, as `DocumentTheme` does.
- **A backend is reached through a service** — per ADR 0001 rule 13. Flag `fetch` called anywhere but `src/app/shared/http/http-client.ts`; a component or a store that imports the HTTP client or builds a URL; a service that checks `response.ok` or sets a time limit itself, which the interceptors do for every request; an answer cast to a model instead of checked; and a spec or component test that sends a real request.
- **The store announces** — per ADR 0001 rule 12. Flag a component that imports or calls the announcer; a change to the canvas or the theme is announced by the store action that made it, so a drag and its keyboard alternative say the same.
- **Hooks for component state** — in touched components, flag state copied from props or the store into `useState`; a value kept in a ref but read during render; state changed in place instead of set to a new array/object; a component reading the store object instead of the selector hook.
- **Feature-driven structure** — new feature code lives under `src/app/features/[feature-name]/` (components in their own folder, plus `models/` and `state/` as in `features/builder/`). Flag feature code dropped at `src/` or `src/app/` root or in a generic `components/`/`hooks/` folder.
- **Component naming** — per `CLAUDE.md` § Conventions: PascalCase function components with named exports, in a kebab-case file named after the component (`element-palette/element-palette.tsx`), imported by relative path. Flag default exports.
- **Base UI + dnd-kit for UI behavior** — menus, dialogs, focus trapping and focus return come from `@base-ui/react`; drag & drop from `@dnd-kit`. Flag hand-rolled equivalents (native HTML5 `draggable`/`dragstart`, a custom focus trap, custom arrow-key handling for a menu). Flag `attributes` from `useDraggable`/`useSortable` being spread onto an element: it makes every wrapper a tab stop and changes the accessibility tree; only `listeners` and `setNodeRef` are used, and the menus are the keyboard path. Flag a `DragOverlay` that can be mounted while another one is: a drag context tracks one, so `BuilderShell` mounts its own for palette drags only and `DroppedElement` its own while it is dragged. Flag a closing animation added to a menu or dialog without removing `BASE_UI_ANIMATIONS_DISABLED` from `main.tsx`, which unmounts a closed popup at once.
- **Tailwind + DaisyUI styling** — style with Tailwind utilities and DaisyUI component classes (`btn`, `menu`, `badge`, `navbar`, …) and DaisyUI theme tokens (`bg-base-100`, `text-base-content`, `border-base-300`) rather than hard-coded colours. Flag new component CSS that re-implements what a utility or DaisyUI class already does, and raw hex/rgb colours where a theme token exists.
- **Self-closing tags** — every component/element in the diff without children must use the self-closing form (`<Canvas />`). Grep the diff's TSX for `></` closing pairs with nothing between the tags.
- **No class selectors in component tests** — per [guides/testing.md](../../guides/testing.md) § Querying the DOM. Grep touched `*.test.tsx` files for `querySelector`/`querySelectorAll`, `classList` and `toHaveClass`; require `getByRole`/`getByLabelText`/`getByText`/`getByTestId` instead (adding a `data-testid` to the markup where needed). Not a violation: an attribute selector the guide allows, on an element with no role or text whose attributes are what the test is about (the stylesheet `<link>` in `document-theme.test.tsx`).
- **Test tooling** — flag any Jest or Enzyme config/usage (`jest.config`, `jest.fn`, `jest.mock`, `enzyme`) as **[Critical]**; Vitest only.

  **Green suites** — per `CLAUDE.md` § Agent behavior, a change is not done until `npm test -- --watch=false`, `npm run test:components -- --watch=false` and `npm run e2e` all pass. Run them and report the result; any failure is **[Critical]**.

3. **Output:**

### Intent & Approach

- What the change is trying to achieve and whether this is the best approach

### Files Changed

- Grouped by feature area

### Strengths

- Good patterns followed

### Concerns

For each issue:

1. **[Critical / Important / Minor]** Title
2. File reference + code snippet
3. Why it matters + recommended fix

### Test Results

- Pass/fail for each of the three suites

### Verdict

- Summary + critical blockers if any
