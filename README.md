# DropUI (React)

A drag & drop UI builder: pick an element type from the palette and drag it onto the canvas, or add it from the keyboard through the palette menus. This is the React port of an Angular app: [docs/angular-react-divergence.md](docs/angular-react-divergence.md) records what the two share and how they differ.

## Stack

React 19, Vite 8 and TypeScript 6. State in [Zustand](https://zustand.docs.pmnd.rs/) stores, backend calls with `fetch` behind our own interceptors, an [Express](https://expressjs.com/) server that asks the Claude API to turn a description into elements, drag & drop with [dnd-kit](https://dndkit.com/), menus and dialogs with [Base UI](https://base-ui.com/), styling with Tailwind 4 and DaisyUI 5.

## Commands

| Command                                    | What it does                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `npm run dev`                              | Dev server on `http://localhost:5173/` and the backend on 3001          |
| `npm run server`                           | The backend alone, on `http://localhost:3001/`                          |
| `npm run build`                            | Type-checks the app, the tests, the configs and the server, then builds |
| `npm test -- --watch=false`                | Unit tests (`*.spec.ts`: jsdom for `src/`, Node for `server/`)          |
| `npm run test:components -- --watch=false` | Component tests (`*.test.tsx`, real Chromium)                           |
| `npm run e2e`                              | Playwright end-to-end tests (`e2e/*.e2e.ts`), starts the server         |

## Layout

```
src/
  main.tsx                 creates the announcer, the HTTP client and the stores, provides them, renders <App />
  app/features/builder/    models, the builder store, the shell, canvas, palette, layout panel, dropped elements
  app/features/theme/      the theme store, the theme picker and the component that themes the page
  app/features/fact/       the fact service, the fact store and the panel that shows a fact from a public API
  app/shared/              the screen reader announcer, the HTTP client and its interceptors, the two general dialogs
server/                    the Express backend: the app factory, the Claude call and the check of its answer
e2e/                       end-to-end tests
docs/adr/                  the decisions behind the stores and the element model
docs/                      the journal of how this app differs from the Angular one
```

daisyUI's prebuilt theme stylesheets are not bundled: the build copies them to `themes/` and `themes.css`, `index.html` links the starting theme, and `DocumentTheme` links the rest when the theme list is first opened.

## Backend

An Express server in `server/`, started by `npm run dev` next to the Vite dev server (`npm run dev:web` and `npm run dev:server` start one of the two). `POST /api/generate-ui` takes `{ "text": "a signup form with name, birthday and country" }` and answers `{ "elements": [...] }`: the canvas elements Claude made of the description, each checked on the server before it is sent. The Vite dev server proxies `/api` to the backend, so the app calls it by its relative address.

The backend needs an Anthropic API key. Copy `.env.example` to `.env`, which git ignores, and fill it in:

| Variable            | Default           | What it sets                                           |
| ------------------- | ----------------- | ------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | none              | The key of the Claude API                              |
| `ANTHROPIC_MODEL`   | `claude-opus-5-5` | The model that turns a description into elements       |
| `API_PORT`          | `3001`            | The port of the backend, and where Vite proxies `/api` |

Without a key the backend still starts, and answers `503` to every generation. It answers `400` to a missing, blank or too long description and `502` when the call to Claude fails or its answer is not a list of known elements. Every error is `{ "error": "..." }`.

## Decisions

- [ADR 0001: Feature state lives in Zustand stores](docs/adr/0001-feature-state-in-zustand-stores.md)
- [ADR 0002: Canvas elements are a discriminated union](docs/adr/0002-canvas-elements-as-a-discriminated-union.md)
