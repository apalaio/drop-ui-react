# Angular and React: how the two DropUI apps differ

DropUI exists twice: as the Angular app in the sibling `drop-ui` repository, and as this React port of it. This journal records where the code of the two differs and why.

It is the only document in this repository that describes the Angular app. The ADRs, the guides and the README describe the React app on its own terms, and anything that compares the two belongs here.

**What belongs here.** A difference in how the two apps are built that comes from the framework or from the libraries that go with it. What the user sees and can do is meant to be the same in both. The few known exceptions are listed under [Visible differences the tests do not cover](#visible-differences-the-tests-do-not-cover), and a new one is a defect until it is listed there.

**How to add an entry.** Add it at the end, under a heading with the date. Say what each app does, why they differ, and what follows for someone working on either. An earlier entry is not rewritten; when a later one replaces it, add one line to the earlier entry that says so.

Paths that start with `drop-ui/` are in the Angular repository. All others are in this one.

## What does not differ

- **Behaviour.** The six Playwright files in `e2e/` are identical in both repositories. They are the contract that both apps behave the same, so an assertion changes in both `e2e/` folders or in neither. Only `playwright.config.ts` differs, in the port and in the command that starts the dev server. What the six files do not assert can still differ.
- **The element model.** The four files in `src/app/features/builder/models/` are identical. [ADR 0002](adr/0002-canvas-elements-as-a-discriminated-union.md) was decided for the Angular app on 2026-10-05, before the port, and holds here unchanged. Only its two rules about rendering (7 and 8) are written for TSX in this repository.
- **What the stores hold and do.** The same state fields, the same actions with the same arguments and guards, and the same wording of every announcement. The React builder store has one action more, `dropElement`, since [2026-10-08](#2026-10-08-the-react-store-applies-a-drop).
- **Styling.** Tailwind 4 and daisyUI 5. In both, daisyUI's prebuilt theme stylesheets are copied as assets, `index.html` names and links the starting theme, and `themes.css` is loaded when the theme list is first opened.
- **Folder layout.** `src/app/features/<feature>/` with `models/`, `state/` and one folder per component, and `src/app/shared/`.

## 2026-10-06: the port

Everything in this section has been true since the React app was first written.

### The state container

|                           | Angular                                                                                     | React                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Store                     | An NgRx SignalStore: `signalStore(withState, withComputed, withMethods, …)`                 | A Zustand vanilla store returned by a factory: `createBuilderStore({ announce, initial })` |
| Reaches a component by    | `inject(BuilderStore)`. The store is `providedIn: 'root'` and is created on first injection | React context and a selector hook. `main.tsx` creates both stores before the first render  |
| Reading                   | A signal call in the template: `store.grid()`                                               | One selector per value: `useBuilderStore((state) => state.grid)`                           |
| Writing                   | `patchState` inside a store method                                                          | `set` inside an action                                                                     |
| What the store depends on | `inject(LiveAnnouncer)`                                                                     | Arguments of the factory                                                                   |
| Write protection          | Built in: nothing outside the store can patch its state                                     | A convention: the store object has `setState`, and components are only ever given the hook |

**Why.** Angular has dependency injection and signals built in. React has neither. A value shared across the tree travels through context, and a component re-renders when a hook it calls reports a change, which is why each value read gets a selector of its own.

**What follows.**

- A Zustand selector must return the same value for the same state, or the component renders without end. Signals have no such rule. See the costs in [ADR 0001](adr/0001-feature-state-in-zustand-stores.md).
- State and actions are one object in Zustand (`BuilderState & BuilderActions`). In a SignalStore they are separate features.
- ADR 0001 exists in both repositories, each written for its own store library. Rules 1 to 10 cover the same ground in both. Rule 11 differs since [2026-10-07](#2026-10-07-theme-side-effects-leave-the-react-store). Rule 12 is about a different subject in each: where RxJS may appear there, the store announcing its changes here.

### Derived data

**Angular.** `cells` is a `withComputed` signal on the store. It is computed once, cached for every reader, and not computed at all until something reads it.

**React.** [`selectCells(grid, canvasElements)`](../src/app/features/builder/state/builder-store.ts) is a pure function, and the `useCells()` hook memoises it separately in each component that calls it.

**What follows.**

- A React component that needs the cells only some of the time is split off, so that the hook runs only while it is mounted: `OtherCellItems` in [`dropped-element.tsx`](../src/app/features/builder/dropped-element/dropped-element.tsx) and `CellItems` in [`element-palette.tsx`](../src/app/features/builder/element-palette/element-palette.tsx). In Angular the same lists are read in a menu's `ng-template`, which is not rendered until the menu opens.
- Angular's `DroppedElement` works out its own position among the elements of its cell with a `computed` over the store. React's receives `index` and `siblingCount` as props from the canvas loop. A selector that filtered the store's array the way that `computed` does would return a new array on every call.

### The screen reader announcer

**Angular.** Each store injects the CDK's `LiveAnnouncer`. `drop-ui/src/styles.css` imports `@angular/cdk/a11y-prebuilt.css`, which hides the live region.

**React.** There is no CDK, so the app has its own: [`createAnnouncer()`](../src/app/shared/announcer/announcer.ts) adds one polite live region to `<body>` on first use. `main.tsx` creates it once and hands the same `announce` function to both store factories.

### Components

|               | Angular                                                                                                 | React                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Shape         | A class with `input()`, `output()` and `computed()`, plus an `.html` template                           | A function with props in one `.tsx` file. An output becomes a callback prop (`onMoved`, `onRemoved`)                     |
| Host element  | `<dui-dropped-element>` is an element on the page. It carries the classes and `data-uid` through `host` | None. The component renders its own wrapper `<div>`, and a caller's classes arrive as a `className` prop (`ThemePicker`) |
| Branching     | `@if`, `@for`, `@switch` in the template. `@default never(el)` checks that every type is handled        | `&&`, `.map` and a `switch` in `ElementBody`, which ends in `assertNever(element)`                                       |
| Popup content | An `ng-template` in the same template                                                                   | JSX nested in the popup's parts                                                                                          |
| Naming        | Selector prefix `dui-`                                                                                  | PascalCase named export in a kebab-case file                                                                             |

**What follows.** A React file holds more components than its Angular counterpart: `CanvasCell`, `ElementBody`, `Datepicker`, `EditTextDialog`, `PaletteEntry`, `GridSizeInput`. A hook may only be called at the top level of a component, so anything that needs state or a store value of its own, once per list item or only under a condition, becomes a component.

### A parent reaching its children

Both apps move the keyboard focus after an element is moved or deleted from its menu, because the element is rendered anew and the focus would otherwise drop to `<body>`.

**Angular.** `Canvas` finds the moved element among `viewChildren(DroppedElement)` and calls its `focusActions()` method in `afterNextRender`. The cell of a deleted element is passed from the template as a template reference.

**React.** A parent cannot query its children or call methods on them. [`Canvas`](../src/app/features/builder/canvas/canvas.tsx) hands down ref callbacks that fill two maps (cells and actions buttons), records what to focus in `pendingFocus` state when a child calls `onMoved` or `onRemoved`, and focuses it in a `useEffect` once the change has rendered.

### Drag and drop

|                                   | Angular                                                                                                            | React                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library                           | `@angular/cdk/drag-drop`                                                                                           | `@dnd-kit/core` and `@dnd-kit/sortable`                                                                                                                                         |
| Wiring                            | Directives: `cdkDropList` on each cell and on the palette, `cdkDrag` on each item, `CdkDropListGroup` on the shell | One `DndContext` in `BuilderShell`, and hooks: `useDraggable` (palette item), `useSortable` (dropped element), `useDroppable` (cell)                                            |
| Who handles a drop                | `Canvas.drop`. The CDK supplies the target cell and the index                                                      | `BuilderShell`. dnd-kit supplies what was dragged and what it was over, and [`resolveDrop`](../src/app/features/builder/state/canvas-drop.ts) works out the cell and the index |
| The shell                         | An empty class                                                                                                     | Owns the drag context, the sensor, the drop handler and the palette's drag overlay                                                                                              |
| The copy that follows the pointer | Built by the CDK                                                                                                   | A `DragOverlay` we render: the shell's for a palette item, each `DroppedElement`'s own for itself                                                                               |
| Visual feedback                   | Global CSS on the CDK's classes (`.cdk-drag-placeholder`, `.cdk-drop-list-receiving`, …)                           | Classes chosen in the component from the hook's state (`DROP_ZONE_STATE` in `canvas.tsx`)                                                                                       |
| Reduced motion                    | A media query around the transition of `.cdk-drag-animating`                                                       | `usePrefersReducedMotion()` switches off dnd-kit's transitions and drop animation                                                                                               |
| Controls inside a draggable       | `(mousedown)` and `(touchstart)` stop propagation                                                                  | `noDrag` stops `pointerdown`. A menu popup needs it too, because React events cross a portal                                                                                    |
| The palette                       | A drop list that accepts nothing                                                                                   | Draggable only. An item released over no cell slides back                                                                                                                       |

Since [2026-10-08](#2026-10-08-the-react-store-applies-a-drop) the React shell passes a drop on to the builder store, which calls `resolveDrop`. That entry replaces the rows "Who handles a drop" and "The shell" for React, and `canvas-drop.ts` and its spec are in `state/` since then.

**Why.** The CDK's drag and drop is a set of directives that owns sorting, the drop index and the preview. dnd-kit provides sensors, collision detection and hooks, and leaves the rest to the app.

**What follows.**

- The drop index is our own logic in React, with a spec of its own: [`canvas-drop.spec.ts`](../src/app/features/builder/state/canvas-drop.spec.ts). Angular's `canvas.spec.ts` instead calls `Canvas.drop` with a fake CDK event.
- React silences dnd-kit's own screen reader messages (`SILENT` in [`builder-shell.tsx`](../src/app/features/builder/builder-shell/builder-shell.tsx)), so that only the store announces a drop.

### Menus

**Angular.** `@angular/cdk/menu` directives (`cdkMenuTriggerFor`, `cdkMenu`, `cdkMenuItem`, `cdkMenuItemRadio`) on our own `<button>` and `<ul>` elements. `drop-ui/src/styles.css` imports `@angular/cdk/overlay-prebuilt.css` to position the overlays.

**React.** Base UI's `Menu` parts (`Root`, `Trigger`, `Portal`, `Positioner`, `Popup`, `Item`, `RadioItem`, `SubmenuRoot`).

**What follows.** Base UI needed four things that the CDK did not:

- `aria-labelledby={undefined}` on every popup. Base UI names a popup after its trigger, which would win over our `aria-label`.
- [`useFirstItemFocus`](../src/app/shared/menu-first-item-focus.ts). Base UI moves focus into an opened menu a frame later, so a menu opened from the keyboard has its first item focused at once.
- `BASE_UI_ANIMATIONS_DISABLED`, set in `main.tsx` and in the component test setup, so that a closed popup leaves the page at once.
- `ElementPalette` controls which palette menu is open and closes it when a drag starts. Base UI opens a menu on pointer down, which is also how a drag begins.

A menu item is a `<button>` in Angular and a `<div role="menuitem">` in React. The role, the name and the order are the same.

The theme list starts on the current theme in both. Angular does it in an `effect` that calls the menu's `setActiveMenuItem`. React focuses the checked item through a ref in `onOpenChangeComplete`.

### Dialogs

|                     | Angular                                                                                                     | React                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Opening             | A function call: `openConfirmationDialog(dialog, options)` calls the CDK's `Dialog.open`                    | Rendering: the opener keeps which dialog is open in `useState` and renders `<ConfirmationDialog open … />` |
| The result          | An Observable the caller subscribes to                                                                      | Callback props: `onConfirm`, `onSubmit`                                                                    |
| Labelling           | `drop-ui/src/app/shared/dialog-labelling.ts` generates the ids for `aria-labelledby` and `aria-describedby` | Base UI's `Title` and `Description` parts do it. `dialog-styles.ts` holds only the shared classes          |
| Where focus returns | `restoreFocus`, an element                                                                                  | `finalFocus`, a ref                                                                                        |

**What follows.**

- The dialogs' `closed` stream is the only place the Angular app uses RxJS. The React app does not use it at all.
- A React dialog is a controlled component, so its test needs a small host component that holds the `open` state.

### Forms inside the dialogs

**Angular.** Signal forms (`@angular/forms/signals`): `form(model, …)` over a `linkedSignal`, with validation and submission declared on the form. The two form dialogs are imported when first opened, because signal forms would otherwise add about 60 kB to the initial bundle.

**React.** `useState` and an `invalid` value derived from it. The form is its own component, mounted only while the dialog is open, so it starts from its props on every open. Both dialogs are imported statically.

### Form controls on the page

**Controls on the canvas.** Angular binds one way, `[value]="el.value"`, and writes in an `(input)` handler. Between store updates the field keeps whatever the user typed, so a date with one part being retyped simply stays as it is. React's controls are controlled (`value` plus `onChange`), and React writes the store's value back on every render. `Datepicker` in `dropped-element.tsx` therefore keeps an `incomplete` flag and shows the empty value while a part is being retyped.

**The grid size fields.** Both apps commit on the native `change` event, not per keystroke. In Angular that is `(change)` in the template. React's `onChange` fires on every keystroke, so `GridSizeInput` in [`layout-panel.tsx`](../src/app/features/builder/layout-panel/layout-panel.tsx) adds a native `change` listener in an effect. Its `onChange` only keeps what is being typed in a local `draft`, which the field shows until the commit or a blur drops it and the store's size shows again.

### Start-up, build and dev server

|              | Angular                                                  | React                                                                                                         |
| ------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Tooling      | Angular CLI                                              | Vite                                                                                                          |
| Start-up     | `bootstrapApplication(App, appConfig)` into `<dui-root>` | `createRoot` on `#root`, with the first render inside `flushSync` so the app is on the page by the load event |
| Theme assets | The `assets` list in `angular.json`                      | `vite-plugin-static-copy` in `vite.config.ts`                                                                 |
| Dev server   | Port 4200                                                | Port 5173                                                                                                     |

**Why the ports differ.** Outside CI, Playwright reuses a dev server that is already running. On a shared port it could attach to the other app's server and test the wrong app.

### Tests

|                               | Angular                                                                                                   | React                                                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File suffixes                 | `*.spec.ts`, `*.test.ts`, `*.e2e.ts`                                                                      | `*.spec.ts`, `*.test.tsx`, `*.e2e.ts`                                                                                                                     |
| Running Vitest                | Through Angular CLI builders configured in `angular.json`                                                 | Directly, as two projects of one `vitest.config.ts`                                                                                                       |
| A store spec                  | `TestBed.inject(BuilderStore)`, then read its signals                                                     | Call the factory with a `vi.fn()` as the announcer, then read `getState()`                                                                                |
| The store in a component test | A stub in `providers`: an object of signals                                                               | The real store with preset state, through `renderWithStores(ui, { initial })`. The test may read it afterwards                                            |
| A component's handlers        | A `*.spec.ts` creates the class in an injection context and calls its methods. Outputs are asserted there | There is no class. A handler is covered by a spec of the pure function it delegates to, by a `vi.fn()` passed as a callback prop, or by reading the store |

**What follows.**

- The Angular app has a `*.spec.ts` beside most components. The React app has five specs: the two stores, the announcer, `canvas-drop` and the class mappings of `DroppedElement`.
- The React component project has set-up the Angular one does not need. `BROWSER_DEPENDENCIES` in `vitest.config.ts` lists every package to bundle before the first test, because one bundled later brings its own copy of React and every hook then fails. `src/test/setup.browser.ts` also switches off React's `act()` environment flag.

### Visible differences the tests do not cover

These were noted while the app was ported. No test in either repository asserts them, so nothing fails if one of them changes.

- **A click outside the delete confirmation.** In Angular it closes the dialog, which is the CDK dialog's default. In React the confirmation is a Base UI `AlertDialog`, which stays open until Cancel, Delete or Escape.
- **Dropping an element that was dragged on the canvas.** In Angular the CDK slides it into its new place, unless reduced motion is requested. In React the copy that followed the pointer disappears at once (`dropAnimation={null}` in `dropped-element.tsx`).
- **Dragging an element over another cell.** In Angular the CDK shows the faded placeholder where the element would land in that cell. In React the placeholder stays in the element's own cell until the drop, because dnd-kit moves a sortable only among the elements of its own list.
- **The fact panel.** Added on [2026-10-08](#2026-10-08-a-backend-call-in-react-only): the bottom of the React sidebar holds a panel that shows a fact loaded from a public API. The Angular sidebar has no such panel.

## 2026-10-07: theme side effects leave the React store

At the port, the React theme store did what the Angular one does: it wrote the theme to `<html data-theme>` and added the `themes.css` link itself. Since this date it does neither.

**Angular.** `ThemeStore` starts two `effect`s in `withHooks`. One writes the theme to `<html data-theme>`, the other appends the link to `<head>`. The store reads its starting theme from the injected `DOCUMENT`.

**React.** The store holds state and nothing else. [`DocumentTheme`](../src/app/features/theme/document-theme/document-theme.tsx), which `App` renders, writes the attribute in a `useEffect` and renders the link. `main.tsx` reads `data-theme` from the page and passes it to the store's factory as `declaredTheme`.

**Why.** An Angular `effect` can be created wherever there is an injection context, and the framework ends it with whatever owns it. A store is as good a place for one as a component. React's effects exist only inside components. Outside one, the same work is a hand-made `store.subscribe` that changes the page as soon as the factory is called and is never cleaned up.

**What follows.**

- Rule 11 of ADR 0001 now says different things in the two repositories: "Side effects go in `withHooks`" there, "A store touches nothing outside itself" here.
- The link is appended to `<head>` in Angular and stays. In React it is rendered inside `#root` and goes when `DocumentTheme` unmounts.
- The Angular store spec sets `data-theme` on the real document, flushes effects and cleans up after itself. The React store spec passes a string and has no DOM, and what happens to the page is covered in [`document-theme.test.tsx`](../src/app/features/theme/document-theme/document-theme.test.tsx).
- In React the page follows the theme only where `DocumentTheme` is mounted. A component mounted alone in a test changes the store and leaves `<html>` as it was.

## 2026-10-08: a backend call, in React only

**React.** A panel named "Did you know?" sits at the bottom of the sidebar. It shows the fact of the day from a public API (`uselessfacts.jsph.pl`) and loads a random one when its button is pressed. Four pieces are behind it, each a factory that is given the one before it, and [`main.tsx`](../src/main.tsx) wires them together:

- an HTTP client, which is `fetch` wrapped in interceptors: [`src/app/shared/http/`](../src/app/shared/http/http-client.ts);
- a service that knows the addresses and checks the answers: [`fact-service.ts`](../src/app/features/fact/services/fact-service.ts);
- a third store, which holds the fact and whether one is loading: [`fact-store.ts`](../src/app/features/fact/state/fact-store.ts);
- the panel: [`fact-panel.tsx`](../src/app/features/fact/fact-panel/fact-panel.tsx).

**Angular.** The app has no such panel, calls no backend and does not use `HttpClient`.

**Why.** The panel was added here to see how a backend call is built in React, which has no dependency injection, no `HttpClient` and no interceptors of its own. Nothing was added to the Angular app.

**What follows.**

- The panel is a visible difference that no test in either repository covers. It is listed under [Visible differences the tests do not cover](#visible-differences-the-tests-do-not-cover).
- The six files in `e2e/` are unchanged and pass in both apps, because the panel is built around what they assert. It has no heading, as `app.e2e.ts` lists the headings of the page. Its button comes after the palette, as `keyboard.e2e.ts` counts the Tab presses from the theme picker to the first palette item. Its text is not in a list item, as the drag tests find a palette item by its text among the list items of the sidebar, and a fact can contain "div" or "span". It is held to the bottom of the sidebar and grows upwards, so a fact arriving moves neither the palette nor the canvas.
- The first fact is loaded without an announcement. An announcement would replace the one an e2e test is waiting for.
- Each page an e2e test opens in the React app sends one request to the API. No assertion depends on the answer. The Angular e2e run sends none.
- Rule 13 of ADR 0001 exists in this repository only.

## 2026-10-08: the React store applies a drop

At the port, the React shell worked out where a drop lands and then called `addElement` or `moveElement`. Since this date the builder store does both, in an action the Angular store does not have.

**React.** `BuilderShell` hands what dnd-kit reports at the end of a drag, the data of what was dragged and of what it was released over, to the store's `dropElement(dragged, target)`. The action derives the cells from the state of that moment, has [`resolveDrop`](../src/app/features/builder/state/canvas-drop.ts) work out the cell and the index, applies the result through `addElement` or `moveElement`, and returns whether there was a drop. The shell needs that answer at once: it decides whether the copy of a palette item slides back to the palette. The shell selects nothing from the store but this action.

**Angular.** Unchanged. `Canvas.drop` gets the cell and the index from the CDK and calls `addElement` or `moveElement`. The shell is an empty class.

**Why.** To resolve a drop itself, the React shell needed the cells, and the only way a component gets them is `useCells()`, which subscribes it. The shell is the root of the app and nothing under it is memoised, so every change to the elements, each keystroke in a dropped text input included, rendered the whole tree again. A React component is given the selector hook and nothing that reads the store when an event fires ([ADR 0001](adr/0001-feature-state-in-zustand-stores.md), rule 5), so what an event needs from the state of that moment has to be an action. Angular has no such problem to solve. The CDK supplies the cell and the index, and a signal read inside an event handler subscribes nothing.

**What follows.**

- The React builder store has an action the Angular one lacks. `addElement` and `moveElement` are the same in both, and the keyboard paths call them directly in both.
- What a drop does is unchanged, so the two apps still behave the same and the six files in `e2e/` are untouched.
- `canvas-drop.ts` and its spec moved from `canvas/` to `state/`, next to their one caller. [`canvas-drop.spec.ts`](../src/app/features/builder/state/canvas-drop.spec.ts) covers what a drag resolves to, and the `dropElement` block of [`builder-store.spec.ts`](../src/app/features/builder/state/builder-store.spec.ts) covers what the drop does to the canvas and what it announces. Angular's `canvas.spec.ts` covers both by calling `Canvas.drop`.
- `resolveDrop` reads only the identity of what a drag was released over: the row and column of a cell, the `uid` of an element. dnd-kit hands back the data a droppable registered at its last render. The CDK computes its index when the drop happens.
- Rules 3, 6, 7, 10 and 12 of ADR 0001 mention `dropElement` in this repository only.
