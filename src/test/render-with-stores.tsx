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
  const builderStore = createBuilderStore({ announce, initial });
  const themeStore = createThemeStore({ announce, declaredTheme: theme });

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
  document.body.querySelectorAll(':scope > [aria-live]').forEach((region) => region.remove());
});
