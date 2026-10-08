# DropUI (React)

A drag & drop UI builder: pick an element type from the palette and drag it onto the canvas, or add it from the keyboard through the palette menus. This is the React port of an Angular app: [docs/angular-react-divergence.md](docs/angular-react-divergence.md) records what the two share and how they differ.

## Stack

React 19, Vite 8 and TypeScript 6. State in [Zustand](https://zustand.docs.pmnd.rs/) stores, backend calls with `fetch` behind our own interceptors, drag & drop with [dnd-kit](https://dndkit.com/), menus and dialogs with [Base UI](https://base-ui.com/), styling with Tailwind 4 and DaisyUI 5.

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
  main.tsx                 creates the announcer, the HTTP client and the stores, provides them, renders <App />
  app/features/builder/    models, the builder store, the shell, canvas, palette, layout panel, dropped elements
  app/features/theme/      the theme store, the theme picker and the component that themes the page
  app/features/fact/       the fact service, the fact store and the panel that shows a fact from a public API
  app/shared/              the screen reader announcer, the HTTP client and its interceptors, the two general dialogs
e2e/                       end-to-end tests
docs/adr/                  the decisions behind the stores and the element model
docs/                      the journal of how this app differs from the Angular one
```

daisyUI's prebuilt theme stylesheets are not bundled: the build copies them to `themes/` and `themes.css`, `index.html` links the starting theme, and `DocumentTheme` links the rest when the theme list is first opened.

## Decisions

- [ADR 0001: Feature state lives in Zustand stores](docs/adr/0001-feature-state-in-zustand-stores.md)
- [ADR 0002: Canvas elements are a discriminated union](docs/adr/0002-canvas-elements-as-a-discriminated-union.md)
