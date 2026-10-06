# DropUI (React)

A drag & drop UI builder: pick an element type from the palette and drag it onto the canvas, or add it from the keyboard through the palette menus. This is the React port of the Angular app in the sibling `drop-ui` repository; the two share one end-to-end suite and are meant to behave the same.

## Stack

React 19, Vite 8 and TypeScript 6. State in [Zustand](https://zustand.docs.pmnd.rs/) stores, drag & drop with [dnd-kit](https://dndkit.com/), menus and dialogs with [Base UI](https://base-ui.com/), styling with Tailwind 4 and DaisyUI 5.

## Commands

| Command                                    | What it does                                                    |
| ------------------------------------------ | --------------------------------------------------------------- |
| `npm run dev`                              | Dev server on `http://localhost:5173/`                          |
| `npm run build`                            | Type-checks the app, the tests and the configs, then builds     |
| `npm test -- --watch=false`                | Unit tests (`*.spec.ts`, jsdom)                                 |
| `npm run test:components -- --watch=false` | Component tests (`*.test.tsx`, real Chromium)                   |
| `npm run e2e`                              | Playwright end-to-end tests (`e2e/*.e2e.ts`), starts the server |

## Layout

```
src/
  main.tsx                 creates the announcer and both stores, provides them, renders <App />
  app/features/builder/    models, the builder store, the shell, canvas, palette, layout panel, dropped elements
  app/features/theme/      the theme store and the theme picker
  app/shared/              the screen reader announcer and the two general dialogs
e2e/                       end-to-end tests
docs/adr/                  the decisions behind the stores and the element model
```

daisyUI's prebuilt theme stylesheets are not bundled: the build copies them to `themes/` and `themes.css`, `index.html` links the starting theme, and the theme store loads the rest when the theme list is first opened.

## Decisions

- [ADR 0001: Feature state lives in Zustand stores](docs/adr/0001-feature-state-in-zustand-stores.md)
- [ADR 0002: Canvas elements are a discriminated union](docs/adr/0002-canvas-elements-as-a-discriminated-union.md)
