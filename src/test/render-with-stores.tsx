import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { render, RenderResult } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import {
  BuilderState,
  BuilderStore,
  BuilderStoreContext,
  createBuilderStore,
} from '../app/features/builder/state/builder-store';
import { Fact } from '../app/features/fact/models/fact';
import { FactService } from '../app/features/fact/services/fact-service';
import {
  createFactStore,
  FactState,
  FactStore,
  FactStoreContext,
} from '../app/features/fact/state/fact-store';
import {
  createThemeStore,
  ThemeStore,
  ThemeStoreContext,
} from '../app/features/theme/state/theme-store';
import { Announce, createAnnouncer } from '../app/shared/announcer/announcer';

export const STARTING_THEME = 'fantasy';

export const FACT_OF_THE_DAY: Fact = { id: 'fact-today', text: 'Honey never spoils.' };
export const RANDOM_FACT: Fact = { id: 'fact-random', text: 'Bananas are berries.' };

export interface RenderWithStoresOptions {
  initial?: Partial<BuilderState>;
  announce?: Announce;
  theme?: string;
  dnd?: boolean;
  factService?: FactService;
  factState?: Partial<FactState>;
}

export type RenderWithStoresResult = RenderResult & {
  builderStore: BuilderStore;
  themeStore: ThemeStore;
  factStore: FactStore;
};

function DragContext({ children }: { children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  return <DndContext sensors={sensors}>{children}</DndContext>;
}

export function createFactServiceStub(): FactService {
  return {
    today: () => Promise.resolve(FACT_OF_THE_DAY),
    random: () => Promise.resolve(RANDOM_FACT),
  };
}

export function renderWithStores(
  ui: ReactElement,
  {
    initial,
    announce = createAnnouncer(),
    theme = STARTING_THEME,
    dnd = true,
    factService = createFactServiceStub(),
    factState,
  }: RenderWithStoresOptions = {},
): RenderWithStoresResult {
  const builderStore = createBuilderStore({ announce, initial });
  const themeStore = createThemeStore({ announce, declaredTheme: theme });
  const factStore = createFactStore({ announce, service: factService, initial: factState });

  function Providers({ children }: { children: ReactNode }) {
    return (
      <ThemeStoreContext value={themeStore}>
        <BuilderStoreContext value={builderStore}>
          <FactStoreContext value={factStore}>
            {dnd ? <DragContext>{children}</DragContext> : children}
          </FactStoreContext>
        </BuilderStoreContext>
      </ThemeStoreContext>
    );
  }

  return Object.assign(render(ui, { wrapper: Providers }), {
    builderStore,
    themeStore,
    factStore,
  });
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.body.querySelectorAll(':scope > [aria-live]').forEach((region) => region.remove());
});
