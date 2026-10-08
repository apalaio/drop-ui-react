import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { createStore, StoreApi } from 'zustand/vanilla';
import { Announce } from '../../../shared/announcer/announcer';
import { Fact } from '../models/fact';
import { FactService } from '../services/fact-service';

export type FactStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface FactState {
  fact: Fact | null;
  status: FactStatus;
}

export interface FactActions {
  loadToday(): Promise<void>;
  loadRandom(): Promise<void>;
}

export type FactStore = StoreApi<FactState & FactActions>;

export const LOAD_FAILED = 'Could not load a fact.';

export function createFactStore({
  announce,
  service,
  initial,
}: {
  announce: Announce;
  service: FactService;
  initial?: Partial<FactState>;
}): FactStore {
  return createStore<FactState & FactActions>()((set, get) => {
    async function load(request: () => Promise<Fact>, announced: boolean): Promise<void> {
      set({ status: 'loading' });
      try {
        const fact = await request();
        set({ fact, status: 'loaded' });
        if (announced) {
          announce(fact.text);
        }
      } catch {
        set({ status: 'error' });
        if (announced) {
          announce(LOAD_FAILED);
        }
      }
    }

    return {
      fact: null,
      status: 'idle',
      ...initial,
      async loadToday() {
        if (get().status === 'idle') {
          await load(() => service.today(), false);
        }
      },
      async loadRandom() {
        if (get().status !== 'loading') {
          await load(() => service.random(), true);
        }
      },
    };
  });
}

export const FactStoreContext = createContext<FactStore | null>(null);

export function useFactStore<T>(selector: (state: FactState & FactActions) => T): T {
  const store = useContext(FactStoreContext);
  if (!store) {
    throw new Error('useFactStore needs a <FactStoreContext> provider above it.');
  }
  return useStore(store, selector);
}
