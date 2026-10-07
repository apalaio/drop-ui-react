# ADR 0001: Feature state lives in Zustand stores

- **Status:** Accepted
- **Date:** 2026-10-06
- **Amended:** 2026-10-07 (rule 11)
- **Scope:** all application state under `src/app/features/`

## Context

DropUI is a single-screen builder. The components that need the same data sit in different branches of the component tree:

- the element palette lists the element types that can be dragged;
- the layout panel sets the grid size;
- the canvas renders one drop zone per grid cell;
- each dropped element edits, moves or deletes itself.

Passing this data through props and callbacks would route every change through the shell component, which would do nothing with it but pass it on. A React component also re-renders whenever something it reads changes, so the state container has to let a component subscribe to just the part it reads: typing into a dropped text input must not re-render the theme picker.

## Decision

Shared state is held in Zustand stores (`zustand` 5): vanilla stores, handed to components through React context. The rules below describe how a store is written and used.

### Where stores live

1. **One store per feature**, in `src/app/features/<feature>/state/<feature>-store.ts`. The file exports a factory, a context and a selector hook. [`main.tsx`](../../src/main.tsx) creates one instance of each store and provides it at the root. Today there are two: [`builder-store.ts`](../../src/app/features/builder/state/builder-store.ts) and [`theme-store.ts`](../../src/app/features/theme/state/theme-store.ts).
2. **Stores do not use each other.** A component that needs two stores calls both hooks. What both stores need, such as the announcer, is passed to each factory.

### How components use a store

3. **Components read through the store's hook**, with a selector that picks one thing: `useBuilderStore((state) => state.grid)`. A component keeps no shared state of its own. `useState` is for UI state nothing else reads: which dialog is open, which palette menu, where focus goes next.
4. **A component rendered once per list item takes its item as a prop.** `DroppedElement` receives its element from the canvas loop, and still writes through the store.
5. **Components never change state themselves.** The hook hands out state and actions, and an action is the only way a component changes anything. The store object, which has `setState`, is held by `main.tsx` and by tests, never by a component.

### How a store is written

6. **Each action is one `set` call**, so one user action is one atomic state change. An action that builds the new state from the old one passes an updater function, which returns new objects and arrays and never changes the old ones. An action that only overwrites fields, such as `setTheme`, passes the fields.
7. **The store owns its invariants.** It validates and normalises what it is given, and callers pass raw values. Examples: `setGridSize` ignores non-finite numbers and clamps to 1–12; `setTheme` ignores names that are not daisyUI themes; `updateText` ignores an element that has no text; `updateValue` ignores a dropdown value that none of its options has, and `updateOptions` moves the selection to the first option when the selected one is gone; `moveElement` and `removeElement` ignore a `uid` that is not on the canvas.
8. **Derived data is a pure exported function and is never stored.** `selectCells(grid, canvasElements)` builds the cells. Components get them from `useCells()`, which selects `grid` and `canvasElements` separately and derives the cells with `useMemo`.
9. **Stored state is flat.** `canvasElements` is one array for the whole canvas. Each element carries its `row` and `column`, and the order of two elements in the same cell is their relative order in the array.
10. **Pure helpers are module-level functions above the factory** (`createElement`, `insertIntoCell`, `clampGridSize`), so actions stay short and the helpers need no store to reason about.
11. **A store touches nothing outside itself; keeping the page in step with state is a component's job.** A store never reads or writes the DOM and never subscribes to itself. What has to match the state at all times is rendered, or synchronised in a `useEffect`, by a component that reads the store. [`DocumentTheme`](../../src/app/features/theme/document-theme/document-theme.tsx) writes `theme` to `<html data-theme>` in an effect, since React does not render `<html>`, and renders the `<link>` to the stylesheet holding every theme once `allThemesRequested` is set. `loadAllThemes` only sets that flag.
12. **The store announces its own changes.** An announcement belongs to the user action, not to the state the action leaves behind: nothing is announced when the app starts in a theme. So it is made where the action is, not in an effect. Each factory takes an `announce(message)` function, and an action calls it after its `set`, so a drag and its keyboard alternative tell screen reader users the same thing. No component calls the announcer.

### How stores are tested

A store is tested for real in a `*.spec.ts`: the spec calls the factory with a `vi.fn()` as `announce`, then calls actions and reads state through `store.getState()`. No spec needs a DOM, because no store touches one. A component test mounts the component under real stores, created with the state the test needs through the factories' options (`initial`, `declaredTheme`). See [the testing guide](../../.claude/guides/testing.md).

## Consequences

**Benefits**

- Any component can read or change builder state without the shell relaying it.
- A component re-renders only when what it selected changes.
- State transitions are in one file per feature and can be unit-tested without rendering anything.
- A component cannot corrupt state, because it only has actions and the store checks every input.
- The cells cannot drift from the grid or the element list, because they are derived from them.
- A store is created by a function that takes what it depends on, so a test gives it a spy for the announcer, a preset canvas or a starting theme without mocking a module.
- A store is state and actions and nothing else, so what the app does to the page is found in components, where a React developer looks for it.

**Costs and limits**

- **A selector must return the same value for the same state.** Zustand compares what a selector returns by identity, so one that builds an array or object returns a "new" value on every call and the component renders without end. Zustand's `useShallow` lifts that for a flat array or object whose entries are already in the state. The cells are arrays inside an array, which it does not compare, so they are derived in `useCells()` and not in a selector.
- **Write protection is a convention.** A Zustand store object has `setState`, and anything that holds the object can call it. Rule 5 holds because components are only ever given the hook.
- **State and actions share one object.** `BuilderState & BuilderActions` is what a selector sees, and the factory's `initial` option covers the state half only.
- **One document at a time.** `main.tsx` provides one builder store for the whole app. A second canvas would need its own provider around its own part of the tree.
- **Nothing is persisted.** State is in memory and a reload resets it. Persistence would be added behind the store, where the factory is the seam, not in components.
- **The cells are recomputed in full on every element or grid change**, once in each component that calls `useCells()`. Each run filters the whole element list once per cell. This is fine at the 12 × 12 cap and would need indexing if the cap is raised.
- **Flat storage makes some results depend on history.** When the grid shrinks and two cells merge, the merged order follows the array, which reflects the order of earlier drops and moves.
- **The theme store is told its starting theme by the page.** The stylesheet of the starting theme has to be on the page before any script runs, so `index.html` themes the first paint itself: it names the starting theme in `data-theme` on `<html>` and links that theme's CSS. `main.tsx` reads the name from that attribute and hands it to the factory as `declaredTheme`, which makes `index.html` the only place the default theme is written. A spec passes the name itself, and a component test passes it as the `theme` option of `renderWithStores`.
- **The page follows the theme only where `DocumentTheme` is mounted.** `App` renders it. A component mounted alone in a test changes the store and leaves `<html>` as it was.
- **Components depend on the concrete store.** Reusing a builder component elsewhere means putting a `BuilderStoreContext` provider above it; without one the hook throws.

## Alternatives considered

- **Props and callbacks through the shell.** Rejected: the palette, layout panel, canvas and dropped elements would all communicate through a component with no logic for that state.
- **State in React context with `useReducer`.** Workable, but every consumer of a context re-renders on every change to its value, and each feature would invent its own structure for actions and derived data.
- **Redux Toolkit.** Rejected as too much ceremony for a client-only app with two small state slices.
- **Zustand's `create`, a hook bound to one module-level store.** Rejected: a module singleton cannot be handed an announcer, a starting canvas or a starting theme, which is what the specs and component tests rely on.
- **Side effects run by the store, from `store.subscribe` in the factory.** This is what the first version of this ADR prescribed. Rejected: the factory then changed the page as it was called and never unsubscribed, which is only safe for a store created once outside React, and the specs needed a detached document to keep it off the real one.
- **The stylesheet link with `precedence`**, React's own way to load a stylesheet. Rejected: React moves such a link to `<head>` and leaves it there when the component unmounts, so a test could not start from a page without it. Rendered in place, the link loads the same stylesheet and goes with the component.
