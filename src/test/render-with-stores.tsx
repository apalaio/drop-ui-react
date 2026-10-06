import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { render, RenderResult } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import {
  BuilderState,
  BuilderStore,
  BuilderStoreContext,
  createBuilderStore,
} from '../app/features/builder/state/builder-store';
import {
  ALL_THEMES_STYLESHEET,
  createThemeStore,
  ThemeStore,
  ThemeStoreContext,
} from '../app/features/theme/state/theme-store';
import { Announce, createAnnouncer } from '../app/shared/announcer/announcer';

export const STARTING_THEME = 'fantasy';

export interface RenderWithStoresOptions {
  initial?: Partial<BuilderState>;
  announce?: Announce;
  theme?: string;
  dnd?: boolean;
}

export type RenderWithStoresResult = RenderResult & {
  builderStore: BuilderStore;
  themeStore: ThemeStore;
};

/*
 * The pointer sensor alone, as in BuilderShell. dnd-kit's default set adds a keyboard sensor, which
 * starts a drag on Enter or Space and so swallows the key that opens a menu.
 */
function DragContext({ children }: { children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  return <DndContext sensors={sensors}>{children}</DndContext>;
}

export function renderWithStores(
  ui: ReactElement,
  {
    initial,
    announce = createAnnouncer(),
    theme = STARTING_THEME,
    dnd = true,
  }: RenderWithStoresOptions = {},
): RenderWithStoresResult {
  document.documentElement.setAttribute('data-theme', theme);
  const builderStore = createBuilderStore({ announce, initial });
  const themeStore = createThemeStore({ announce });

  function Providers({ children }: { children: ReactNode }) {
    return (
      <ThemeStoreContext value={themeStore}>
        <BuilderStoreContext value={builderStore}>
          {dnd ? <DragContext>{children}</DragContext> : children}
        </BuilderStoreContext>
      </ThemeStoreContext>
    );
  }

  return Object.assign(render(ui, { wrapper: Providers }), { builderStore, themeStore });
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.head
    .querySelectorAll(`link[href="${ALL_THEMES_STYLESHEET}"]`)
    .forEach((link) => link.remove());
  document.body.querySelectorAll(':scope > [aria-live]').forEach((region) => region.remove());
});
