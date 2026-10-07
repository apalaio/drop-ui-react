# Testing

> **Purpose:** When to write a `*.spec.ts`, a `*.test.tsx`, or a Playwright `*.e2e.ts`, and how to write each.
> **Last updated:** 2026-10-07

---

## Three test styles

Unit and component tests run on **Vitest**, as two projects of one `vitest.config.ts`; end-to-end tests run on **Playwright**. The file suffix indicates **both** the testing style and the environment.

| Style                    | File suffix  | Environment                                    | What it tests                                                                  | Command                                    |
| ------------------------ | ------------ | ---------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------ |
| Vitest                   | `*.spec.ts`  | `jsdom`                                        | Store factories, pure functions, the announcer, input → class mappings         | `npm test -- --watch=false`                |
| Vitest + Testing Library | `*.test.tsx` | Real Chromium via `@vitest/browser-playwright` | Component **rendering and behaviour**: branches, DOM output, a11y roles, focus | `npm run test:components -- --watch=false` |
| Playwright               | `*.e2e.ts`   | The served app (`npm run dev`) in Chromium     | Cross-component user flows, above all palette → canvas drag & drop             | `npm run e2e`                              |

Wiring:

- [`vitest.config.ts`](../../vitest.config.ts) declares the projects `unit` (`src/**/*.spec.ts`) and `components` (`src/**/*.test.tsx`). It is standalone and does not read `vite.config.ts`. Type-checking of every test file goes through `tsconfig.test.json`, so `npm run build` fails on a type error in a test.
- Both projects load [`src/test/setup.ts`](../../src/test/setup.ts), which registers the `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toHaveAttribute`, …). The components project first loads [`src/test/setup.browser.ts`](../../src/test/setup.browser.ts), which shims the `process` global those matchers expect, sets Base UI's `BASE_UI_ANIMATIONS_DISABLED` switch the way `src/main.tsx` does (so a closed menu or dialog leaves the page at once, as in the app), and switches off React's `act()` environment flag (see [Firing events](#firing-events)).
- [`src/test/render-with-stores.tsx`](../../src/test/render-with-stores.tsx) is the mount helper for every component that reads a store.
- [`playwright.config.ts`](../../playwright.config.ts) starts `npm run dev` on `http://localhost:5173`.

### A new dependency goes on the pre-bundle list

`vitest.config.ts` holds `BROWSER_DEPENDENCIES`: every package a component test loads in the browser. Vite bundles them together before the first test. A package that is missing from the list is bundled on first use, in the middle of the run, with **its own copy of React**, and every hook then throws `Invalid hook call`. So when a component gains an import from `node_modules` (a new Base UI subpath such as `@base-ui/react/tooltip` counts), add it to the list in the same change.

---

## Choosing a runner

| If the test asserts on…                                                                     | Write it as                                                                                           |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A store action transforming state, a store guard, what a store announces                    | `*.spec.ts`                                                                                           |
| A pure function (`resolveDrop`, `selectCells`, `cellLabel`)                                 | `*.spec.ts`                                                                                           |
| An input → class mapping (`OUTLINE`, `displayClass`)                                         | `*.spec.ts`                                                                                           |
| Rendered text, button labels, a conditional (`&&`, `? :`), a `switch` case, a `.map`         | `*.test.tsx`                                                                                          |
| Aria roles and names, form-control accessibility, empty-state rendering                     | `*.test.tsx`                                                                                          |
| An event handler with a visible result                                                      | `*.test.tsx`: fire the event and assert the observable effect                                         |
| An event handler whose only result is a callback **prop** (`onSubmit`, `onConfirm`, `onMoved`) | `*.test.tsx`: pass a `vi.fn()` as the prop and assert it fired                                        |
| An event handler whose only result is a change in a store                                   | `*.test.tsx`: read the store the test mounted (see [Reading the store](#reading-the-store))           |
| Where the focus is after an interaction                                                     | `*.test.tsx` (focus only behaves in a real browser)                                                   |
| A flow spanning several components: dragging from the palette onto the canvas, reordering    | `*.e2e.ts`                                                                                            |

When in doubt: if you would assert on a DOM node or a user interaction in one component, write a `*.test.tsx`. If there is no DOM in it at all, write a `*.spec.ts`. If the behaviour only exists when several components and real pointer events work together, write a `*.e2e.ts`.

**A store, the announcer or a pure function never gets a `*.test.tsx`.** There is nothing to render, so the browser runner has nothing to assert. Unit-test its logic in a `*.spec.ts`; its effects in a real browser are proved by the `*.test.tsx` of the **component that consumes it**.

**A component has no class to instantiate**, so a spec cannot call one of its handlers. A handler is covered by one of three things: a spec of the pure function it delegates to (`BuilderShell`'s drop → `resolveDrop`), a component test asserting a callback prop, or a component test reading the store.

### When a component needs both

A component whose only observable difference between two inputs is a set of classes carries a `*.spec.ts` for that mapping next to its `*.test.tsx`. `DroppedElement` is the example: [`dropped-element.spec.ts`](../../src/app/features/builder/dropped-element/dropped-element.spec.ts) covers `OUTLINE` and `displayClass`, and that the wrapper carries them; [`dropped-element.test.tsx`](../../src/app/features/builder/dropped-element/dropped-element.test.tsx) covers everything a user can see or do.

### E2E is for flows, not coverage

Component tests (`*.test.tsx`) are the deliberately cheap layer, fast to write and fast to run, and they carry the per-component coverage bar. E2E is **not** a substitute for them: a component's branches are covered in its `*.test.tsx` even when an E2E test happens to pass through them. Reserve `*.e2e.ts` for what no single component can prove:

- Drag & drop between the palette and the canvas (dnd-kit relies on real pointer events and layout, which a single-component render doesn't have).
- Reordering dropped elements on the canvas.
- Any flow whose result depends on several components sharing state through the builder store.

E2E conventions:

- Tests live in `e2e/` at the repo root and are named `*.e2e.ts`, never `*.spec.ts` or `*.test.tsx`, which are reserved for Vitest.
- The six files are a **contract kept identical in a second repository**. Before changing an assertion, read [What does not differ](../../docs/angular-react-divergence.md#what-does-not-differ): it changes in both places or not at all.
- Playwright starts `npm run dev` on `http://localhost:5173` automatically (or reuses one already running).
- Prefer role/text locators (`page.getByRole`, `page.getByText`, `page.getByTestId`) over CSS selectors.

---

## Writing a Vitest unit test (`*.spec.ts`)

Plain Vitest. Globals (`describe`, `it`, `expect`, `vi`, `beforeEach`, etc.) are available without importing (`vitest/globals` is in `tsconfig.test.json`).

A store is created through its factory, driven through its actions, and read with `getState()`. Nothing is rendered.

```ts
import { Announce } from '../../../shared/announcer/announcer';
import { BuilderStore, createBuilderStore, selectCells } from './builder-store';

describe('BuilderStore', () => {
  let announce: ReturnType<typeof vi.fn<Announce>>;
  let store: BuilderStore;

  beforeEach(() => {
    announce = vi.fn<Announce>();
    store = createBuilderStore({ announce });
  });

  it('announces an added element by its palette label and cell', () => {
    store.getState().setGridSize('columns', 2);

    store.getState().addElement(store.getState().paletteItems[0], { row: 0, column: 1 }, 0);

    expect(announce).toHaveBeenLastCalledWith('Block text added to Row 1, column 2.');
  });
});
```

### Key conventions for `*.spec.ts`

| Convention                | Detail                                                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One store per test        | Call the factory inside the test or in `beforeEach`. A store shared between tests leaks state from one to the next                                                                                           |
| Reading state             | `store.getState().grid`. `getState()` returns a new object after every action, so read it again after acting; never hold on to an earlier result                                                           |
| Derived data              | Call the exported selector on the state: `selectCells(grid, canvasElements)`. Hooks (`useCells`) do not run outside a component                                                                              |
| Preset state              | `createBuilderStore({ announce, initial: { grid, canvasElements } })`, `createThemeStore({ announce, declaredTheme: 'fantasy' })`                                                                            |
| The announcer             | Pass `vi.fn<Announce>()` as `announce` and assert on it. It is the store's one injected dependency, so asserting on it is asserting on the store's output                                                   |
| The document              | A store never touches it (ADR 0001 rule 11), so a store spec has none. `createAnnouncer` takes a `Document`: give it a detached one, `document.implementation.createHTMLDocument()`, so nothing has to be cleaned up |
| Spies                     | `vi.fn()` for an injected function. Never `vi.spyOn` a store's own action                                                                                                                                    |
| Class mappings            | Assert on the exported mapping (`OUTLINE.div`), and render with `createElement` (a `.ts` file has no JSX) only to prove the component applies it; this is the one place `classList` is read                |
| What jsdom lacks          | `matchMedia` (stub it with `vi.stubGlobal` when a rendered component calls it), layout, real focus order. Anything that needs those is a `*.test.tsx`                                                        |
| Per-test timeouts         | Don't add. A slow test is too slow, not under-budgeted                                                                                                                                                       |

---

## Writing a Vitest component test (`*.test.tsx`)

Use `render` from `@testing-library/react`, or `renderWithStores` for a component that reads a store, and query through `screen`.

```tsx
import { screen } from '@testing-library/react';
import { renderWithStores } from '../../../../test/render-with-stores';
import { TextCanvasElement } from '../models/canvas-element';
import { GridLayout } from '../models/grid-layout';
import { Canvas } from './canvas';

describe(Canvas.name, () => {
  const dropHint = 'Drop elements here';
  const single: GridLayout = { rows: 1, columns: 1 };
  const element: TextCanvasElement = {
    uid: 'element-1',
    type: 'div',
    paletteUid: 'palette-div',
    text: 'enter text',
    row: 0,
    column: 0,
  };

  function mount(canvasElements: TextCanvasElement[] = []) {
    return renderWithStores(<Canvas />, { initial: { grid: single, canvasElements } });
  }

  describe('with dropped elements', () => {
    beforeEach(() => {
      mount([element]);
    });

    it('should not render the drop hint', () => {
      expect(screen.queryByText(dropHint)).not.toBeInTheDocument();
    });
  });

  describe('without dropped elements', () => {
    beforeEach(() => {
      mount();
    });

    it('should render the drop hint', () => {
      expect(screen.getByText(dropHint)).toBeInTheDocument();
    });
  });
});
```

### Setup

| Convention                                | Detail                                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Import the component from a relative path | `import { Canvas } from './canvas'`                                                                                                                                |
| Define named constants for test data      | Declare `const label = 'some-label'` at the top of `describe`: no magic strings in assertions                                                                     |
| Build fixtures per element kind           | A `TextCanvasElement`, a `DropdownCanvasElement`, … each written out. Spread only within one kind (`{ ...div, uid: 'second' }`), never one kind into another (ADR 0002) |
| Preset the store, don't stub it           | `renderWithStores(ui, { initial })`. The real store with known state is the "world" the component renders; see [Drive branches](#drive-branches-never-set-state)   |
| `render` is synchronous                   | `beforeEach(() => { mount(); })`, with a block body. Only make `mount` `async` when it has to wait for a portal, as the dialogs' does                              |

`renderWithStores(ui, options)` creates one builder store and one theme store, wraps `ui` in both providers, and returns Testing Library's result plus `builderStore` and `themeStore`.

| Option     | Type                    | Purpose                                                                                                                                             |
| ---------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initial`  | `Partial<BuilderState>` | Preset `grid`, `canvasElements`, `paletteItems`. What is left out keeps its default                                                                 |
| `announce` | `Announce`              | Defaults to a real `createAnnouncer()`, so the live region is in the DOM and `screen.findByText('Theme changed to dracula.')` can read it           |
| `theme`    | `string`                | The theme the theme store is told the page declares, as `main.tsx` tells it `index.html`'s. Defaults to `fantasy`                                   |
| `dnd`      | `boolean`               | Wraps in a `DndContext` with the pointer sensor only, like the shell's. Defaults to `true`; pass `false` for `BuilderShell` and `App`, which bring their own |

After each test the helper removes `data-theme` from `<html>` and the announcer's live regions. Testing Library unmounts the tree by itself, and the `themes.css` link goes with it.

**The helper does not theme the page.** `<html data-theme>` and the `themes.css` link are the work of `DocumentTheme`, which `App` renders. A test of any other component asserts the theme where that component shows it (`ThemePicker`'s button description) or in `themeStore.getState()`; that the document follows is covered in [`document-theme.test.tsx`](../../src/app/features/theme/document-theme/document-theme.test.tsx).

**A controlled component needs a host.** The dialogs take `open` and `onOpenChange` and render nothing while closed. To test opening, closing and where focus returns, write a small host component in the test file that holds the `open` state and renders an `Open` button and an `<output>` for the result; see [`confirmation-dialog.test.tsx`](../../src/app/shared/confirmation-dialog/confirmation-dialog.test.tsx). The same goes for a component that takes its data as props but changes it through a store: `dropped-element.test.tsx` has a host that reads the element back from the store, the way `Canvas` does.

### Test structure

| Convention                      | Detail                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Top-level `describe`            | Use `ComponentName.name` as the string                                                                           |
| Nested `describe`               | Group by element or scenario, e.g. `'with dropped elements'`, `'without dropped elements'`                       |
| Every `it` starts with `should` | `it('should render the drop hint', ...)`                                                                         |
| One thing per `it`              | Each `it` tests one specific element or behaviour. Small, focused tests make failures immediately obvious to fix |
| Shared setup                    | Use `beforeEach(() => { mount(...); })` when multiple `it` blocks in a `describe` share the same mount           |
| No comments                     | Test files carry none. A name that needs explaining is the wrong name                                            |

### Querying the DOM

**DO**

| Query                                                                   | When to use                                                                                                             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `screen.getByText('...')`                                               | Element has visible text and you are asserting presence                                                                 |
| `screen.getByRole('link' \| 'button' \| 'heading', { name: /label/i })` | Element has an ARIA role; add `{ name }` when multiple elements share the same role                                     |
| `screen.getByTestId('x')`                                               | Non-text element (a dropped `<div>`, icon, spinner), asserting presence. Add `data-testid` to the component if missing  |
| `screen.queryByText` / `screen.queryByRole` / `screen.queryByTestId`    | Asserting **absence**: `queryBy*` returns `null` instead of throwing                                                    |
| `screen.getAllByRole` / `screen.getAllByTestId`                         | Multiple elements of the same role or test id, asserting all are present. Throws if none found                          |
| `screen.queryAllByRole` / `screen.queryAllByTestId`                     | Multiple elements, asserting all are absent. Returns `[]` instead of throwing                                           |
| `await screen.findByRole(...)` / `await waitFor(() => expect(...))`     | Anything Base UI does on its own time: a menu or dialog appearing or going, focus arriving. See [Waiting](#waiting)     |
| `within(element).getByRole(...)`                                        | Scoping to a cell, a dialog or a menu when the same name occurs twice on the page                                       |

Always query through `screen`, not through the `container` that `render` returns: Base UI renders menus and dialogs in a portal under `<body>`, outside the container.

**DON'T**

| What to avoid                                                                                                                                  | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSS class selectors of any kind, via **any** root: `container.querySelector('.some-class')`, `document.querySelector('.some-class …')`, etc. | Couples tests to class names (Tailwind/DaisyUI utilities), which are implementation details and break on markup refactors. If the element has no role, text, or test id to query by, add a `data-testid` to the component; never fall back to a class selector.                                                                                                                                                                                       |
| `toHaveClass` / `classList`, always. `toHaveAttribute` for styling or wiring internals                                                         | Tests technical internals, not what the user sees. `toHaveAttribute` **is** correct for state the user or a screen reader observes (`aria-expanded`, `aria-checked`, `aria-disabled`, `aria-live`, `role`, `placeholder`, `min` / `max`) and for purpose-built `data-*` hooks such as `data-uid` / `data-element-type`. Prefer `toBeDisabled()` / `toBeChecked()` / `toHaveValue()` / `toHaveFocus()` / `toHaveAccessibleDescription()` where they apply. |
| Spy assertions on a store action, a hook or a module function (`vi.spyOn(...)`, `vi.mock(...)`)                                                | A `*.test.tsx` asserts the **outcome**, never that a call happened. See [Never spy in a component test](#never-spy-in-a-component-test).                                                                                                                                                                                                                                                                                                              |
| `getBy*` for absence checks                                                                                                                    | `getBy*` throws before the assertion runs; use `queryBy*` instead                                                                                                                                                                                                                                                                                                                                                                                     |

There is no class-selector exception. Everything Base UI and dnd-kit put on the page that a test needs has a role (`menu`, `menuitem`, `menuitemradio`, `dialog`, `alertdialog`), and what has none (a dialog backdrop, a menu positioner) is not ours to assert on. A DOM property is fine where it is the honest way to reach something: `element.parentElement` for the wrapper of a dropped element, `input.form` for the form of a field. The same goes for an attribute selector on an element that has no role and no text, when those attributes are what the test is about: `document-theme.test.tsx` finds the stylesheet `<link>` by its `rel` and `href`, which a `data-testid` would hide.

**A disabled menu item is `aria-disabled`, not `disabled`.** Base UI keeps a disabled `Menu.Item` focusable and marks it `aria-disabled="true"`; an enabled one has no such attribute. jest-dom's `toBeDisabled()` only knows the native `disabled` attribute, so assert `toHaveAttribute('aria-disabled', 'true')` and `not.toHaveAttribute('aria-disabled')`. (Playwright's `toBeDisabled()` does read `aria-disabled`, which is why the E2E files can use it.)

### Assertions

- Always leave a blank line before `expect(...)` or a block of `expect` calls.
- All `getBy*` calls: always wrap in `expect(...).toBeInTheDocument()`.
- `getAllByRole` / `getAllByTestId`: always use `expect(screen.getAllByRole('x').length).toBe(n)` to assert an exact count. Calling either bare looks like an assertion but isn't: it only throws on zero matches.
- Never use `getByTestId` and `getByText` on the same element: that tests the same thing twice.
- For absence of a single element, wrap `queryBy*` in `expect(...).not.toBeInTheDocument()`.
- For absence of all elements of a role, use `expect(screen.queryAllByRole('x').length).toBe(0)`.

```ts
// DO
expect(screen.getByText(label)).toBeInTheDocument();
expect(screen.getByTestId('dropped-div')).toBeInTheDocument();
expect(screen.queryByTestId('dropped-div')).not.toBeInTheDocument();

// DON'T
screen.getByText(label); // missing toBeInTheDocument
expect(screen.getByRole('list').classList).toContain('menu'); // class assertion
```

### Firing events

`fireEvent` from `@testing-library/react` is the default. It is synchronous and wrapped in `act()`, so what the event caused has rendered by the time it returns.

| To…                                   | Use                                                                                                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Click a button, a menu item, a trigger | `fireEvent.click(element)`. It opens a Base UI menu as well, although a real pointer opens it on `mousedown`                                                                |
| Type into a field                     | `fireEvent.input(field, { target: { value } })`. React's `onChange` hears it                                                                                                |
| Commit a field (`LayoutPanel`)        | `fireEvent.change(field)` after the `input`: the native `change` event, which is what the panel listens to                                                                  |
| Pick a `<select>` option              | `fireEvent.change(select, { target: { value } })`                                                                                                                           |
| Submit a form programmatically        | `fireEvent.submit(field.form)`, on the `<form>` itself. A `submit` event fired on a field inside it never reaches React's `onSubmit`, and the test passes without testing anything |
| Press real keys                       | `await userEvent.keyboard('{Enter}')` from `vitest/browser`, after `element.focus()`                                                                                        |

Use **real keys** when the behaviour belongs to the browser or to Base UI's keyboard handling rather than to our handler: Enter submitting a form, Enter or Space opening a menu on its first item, arrow keys and typeahead inside a menu, Escape closing it, Backspace leaving a date input half-filled. `userEvent` from `vitest/browser` drives Chromium through the DevTools protocol, the same way Playwright does; it is asynchronous, so `await` it and then `waitFor` the outcome. `@testing-library/user-event` is not used: it simulates the events in JavaScript, which `fireEvent` already does more simply.

Because real keys and Base UI's own timers update React outside `act()`, `setup.browser.ts` switches `IS_REACT_ACT_ENVIRONMENT` off for the components project. Without that React logs a warning for every such update. `render` and `fireEvent` still wrap themselves in `act()`.

### Waiting

`render` and `fireEvent` leave the page rendered, so most assertions need no waiting. Wait for what happens later:

| What                                              | How                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A menu or dialog appearing                        | `await screen.findByRole('menu', { name })`                                                       |
| A menu or dialog closing                          | `await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())`                 |
| Focus arriving (initial focus, focus return)      | `await waitFor(() => expect(element).toHaveFocus())`. Base UI moves focus a frame after it opens or closes |
| The outcome of `userEvent.keyboard`               | `await waitFor(...)`                                                                              |

Never wait with a timeout or a fixed number of frames.

### What to test

Component tests cover the **happy flow** and every branch of the component. Guards and edge cases of a store action belong in the store's `*.spec.ts`, where the action can be called directly.

**One coverage bar: the whole file.** Touching a component _at all_ requires its `*.test.tsx` to thoroughly cover **every branch in the file**, not just the branch you happened to change. If the file doesn't exist yet, create it; if it exists but is partial, fill it out to full coverage as part of your change.

**Definition of done for a component test file:** every branch of the JSX is exercised. Before calling it done, read the component top to bottom and confirm each of these has a test:

- Every `&&` and every `? :`: assert what renders when the condition is true **and** that it is absent when false.
- Every `switch` `case` (`DroppedElement`'s `switch (element.type)` gains a case per new element type, and each one needs its `it`), asserting the other cases are absent.
- Every `.map`: assert it renders one item per entry of a populated list **and** the empty state for an empty one.
- Every event handler prop (`onClick`, `onChange`, `onSubmit`, …): fire it and assert the effect.
- Every callback prop the component calls: assert it fired, and that it did not when it should not.

If a branch genuinely belongs in a `*.spec.ts` (a store guard, a pure function's edge case), cover it there instead and don't duplicate it here, but it must be covered _somewhere_, not skipped. Drag & drop is the standing example: what a drop resolves to is covered in `canvas-drop.spec.ts`, the real drag in a `*.e2e.ts`, and no component test drags anything.

**DO**

- Test both sides of a condition. When a single condition controls multiple elements of the same role, assert the whole group with `getAllByRole` / `queryAllByRole`, not just one representative.
- Test `switch` cases: one `it` per `case`.
- Test event handlers by firing the event and asserting the **observable effect**.
- When a callback is **passed into** the component as a prop (`onSubmit`, `onConfirm`, `onOpenChange`, `onMoved`, `onRemoved`, `actionsButtonRef`), that callback _is_ the component's contract: pass `vi.fn()` and assert it fired, with what, and in which order (`mock.invocationCallOrder`) when the order is part of the contract.

**DON'T**

| What to skip                                                                           | Why                                                                                                                                                                         |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guards and edge cases of a store action                                                | Cover in the store's `*.spec.ts`: call the action directly and assert on the state                                                                                          |
| Static markup outside any condition                                                    | It always renders: there is no branch to verify                                                                                                                             |
| Reaching a branch by reaching into the component                                       | There is no supported way to set a component's `useState` from outside, and anything that fakes one tests the fake. See [Drive branches](#drive-branches-never-set-state)   |
| Whether a store action was called                                                      | Assert the result: the DOM, or the store's state. See [Reading the store](#reading-the-store)                                                                               |
| CSS classes, dnd-kit attributes, or other technical details                            | Test what the user sees. Whether something is draggable is proved by dragging it, in a `*.e2e.ts`                                                                           |
| What Base UI itself does (that a menu traps arrow keys, that a dialog traps Tab)        | The library has its own tests. Test what **we** configured: the name, the items and their order, initial focus, where focus returns, what closes it                         |

**Smell test for a presence assertion.** Before keeping any `expect(screen.getBy…(…)).toBeInTheDocument()`, delete the line and ask: _which branch now goes untested?_ If the answer is "none" (the element renders unconditionally, or its presence is already implied by a sibling test that queries the same element), then it was a **static-presence assertion**. Leave it deleted.

### Variant classes belong in a `*.spec.ts`

Some inputs produce **nothing** a browser test may assert except a class (`OUTLINE[type]`, `displayClass(type)`). Asserting them in a `*.test.tsx` is a class-name assertion (banned above); deleting them loses real logic. So they move down a layer: export the mapping from the component file and assert it in the `*.spec.ts`, plus one render there proving the component applies it.

If the state is genuinely dynamic behaviour whose only DOM output is a class, add a purpose-built `data-*` attribute alongside the class and assert that instead.

### Reading the store

`renderWithStores` returns the stores it created. A component test may read them to assert the **outcome** of an interaction that has no result in the DOM of the component under test:

```tsx
const { builderStore } = renderWithStores(<ElementPalette />, { initial: { paletteItems: [divItem] } });
fireEvent.click(screen.getByRole('button', { name: 'Add Div' }));

fireEvent.click(await screen.findByRole('menuitem', { name: 'Row 1, column 1' }));

expect(builderStore.getState().canvasElements.length).toBe(1);
```

| Allowed                                                                                     | Not allowed                                                             |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `builderStore.getState()` after the interaction, and `selectCells(...)` on it                | `vi.spyOn(builderStore.getState(), 'addElement')`                       |
| `builderStore.subscribe(...)` collecting the states an interaction went through             | Replacing an action, or `setState` to fake a result                     |
| Calling an action **as setup or as the outside world** (`setGridSize` to see `Canvas` re-render) | Calling an action instead of the interaction the test is named after    |

Prefer the DOM whenever the component shows the result itself. Read the store when it does not: the palette adds to a canvas it does not render, the layout panel resizes a grid it does not draw. `subscribe` answers "how many times, and through which states" without a spy: `layout-panel.test.tsx` uses it to prove that typing "12" commits once, as 12, and never as 1.

### Drive branches, never set state

A component test reaches a branch the way a user reaches it.

| To reach a branch that depends on…                    | Drive it with…                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| A prop                                                | `render(<C prop={…} />)`                                                                                                       |
| Store state                                           | `renderWithStores(<C />, { initial: { … } })`. Configuring the world is not poking internals                                   |
| A user action (opened menu, typed text, picked value) | Fire the **event** (`fireEvent.click(...)`, type into the field) and let the component update its own state                     |
| A controlled prop that changes (`open`)               | A host component in the test file that holds the state                                                                         |

If a branch is genuinely unreachable through props, preset state, or events, it is dead code: remove it rather than faking a way in.

### Never spy in a component test

Spying on a store action, a hook, or a module function and asserting it was called tests the wiring and nothing else. Replace it with an assertion on the **observable effect**:

| The interaction…                        | Assert on…                 | How                                                                                         |
| --------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------- |
| Renders or removes something            | The DOM                    | `getByText` / `getAllByTestId(...)` / `queryAllByTestId(...)` count                         |
| Changes a value a field shows           | The field                  | `toHaveValue(...)`                                                                          |
| Moves focus                             | The element                | `await waitFor(() => expect(element).toHaveFocus())`                                        |
| Announces something                     | The live region            | `expect(await screen.findByText(message)).toHaveAttribute('aria-live', 'polite')`           |
| Changes a store and nothing on the page | The store                  | `builderStore.getState()`; see [Reading the store](#reading-the-store)                      |
| Reports to its parent                   | The callback prop          | `vi.fn()` passed as the prop                                                                |

The only `vi.fn()` in a component test is one the test **passes in**: a callback prop, or `announce` given to `renderWithStores`.

### Debugging

```ts
screen.debug(); // full DOM
screen.debug(screen.getByTestId('x')); // scoped to one element
```

`Invalid hook call` in every test of a file means a package is missing from `BROWSER_DEPENDENCIES` (see the top of this guide). A menu that will not open on a real Enter means the test rendered a `DndContext` with dnd-kit's default sensors, whose keyboard sensor takes the key: use `renderWithStores`, which has the pointer sensor only.

---

## Touched components require component test coverage

| Situation                                                                    | Requirement                                                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A component's markup or behaviour is touched and a `*.test.tsx` exists       | Bring the file to **full-file coverage**: every branch, not only the branch you changed    |
| A component's markup or behaviour is touched and **no** `*.test.tsx` exists  | The file must be **created** in the same change with **full-file coverage**                |
| Touch is non-behavioural (formatting, rename-only, comment edits)            | No new coverage required                                                                   |
| A store action, a pure function or a class mapping is touched                | Its `*.spec.ts` covers the change; see [Choosing a runner](#choosing-a-runner)             |

### Exemption: sweeping mechanical changes

The full-file rule is calibrated for **feature work**. It does **not** apply to a **sweeping, behaviour-preserving mechanical change** applied uniformly across many components (a library-migration codemod, a repo-wide rename, a formatting sweep), under all of these conditions:

| Condition                        | Requirement                                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Qualifies**                    | The edit is the **same mechanical, behaviour-preserving transform** across **many** components. A normal multi-file feature does **not** qualify.  |
| **Compile-safe**                 | `npm run build` passes: the type check of every component and test is the safety net that replaces per-file tests.                                 |
| **Behaviour changes carved out** | Any file where the change is **not** purely mechanical still owes full-file coverage, and a bug fix still owes its [regression test](#bug-fixes). |

When in doubt about whether a change is "mechanical", it isn't.

---

## Bug fixes

Every bug fix requires a **regression test**. If the bug was in rendering or in a component's behaviour, the regression test belongs in `*.test.tsx`. If it was in a store or a pure function, it belongs in `*.spec.ts`. If it only shows up across components (a drop landing at the wrong index), it belongs in `*.e2e.ts`, under the rule for those files in [E2E is for flows, not coverage](#e2e-is-for-flows-not-coverage).
