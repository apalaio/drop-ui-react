// jest-dom's matchers read `process` (via picocolors), which doesn't exist in the browser runner.
// Must run before src/test/setup.ts, so it is listed first in the components project's setupFiles.
(globalThis as { process?: unknown }).process ??= { env: {}, argv: [], platform: 'browser' };

// As in src/main.tsx, which no component test loads: Base UI unmounts a closed popup at once.
(globalThis as { BASE_UI_ANIMATIONS_DISABLED?: boolean }).BASE_UI_ANIMATIONS_DISABLED = true;

/*
 * Component tests press real keys and wait for what Base UI does on its own timers, so most updates
 * happen outside act() by design and React's warning about each one is noise. Testing Library turns
 * the flag on in a beforeAll of its own; a beforeEach runs after that. Its render and fireEvent
 * still wrap themselves in act(), so what they cause is rendered by the time they return.
 */
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
});
