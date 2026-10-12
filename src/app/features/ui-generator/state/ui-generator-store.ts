import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { createStore, StoreApi } from 'zustand/vanilla';
import { Announce } from '../../../shared/announcer/announcer';
import { GeneratedElement } from '../../builder/models/generated-element';
import { UiGeneratorError, UiGeneratorService } from '../services/ui-generator-service';

export type UiGeneratorStatus = 'idle' | 'generating' | 'error';

export interface UiGeneratorState {
  status: UiGeneratorStatus;
  error: string | null;
}

export interface UiGeneratorActions {
  /** Resolves with the generated elements, or with null when there are none to show. */
  generate(text: string): Promise<GeneratedElement[] | null>;
}

export type UiGeneratorStore = StoreApi<UiGeneratorState & UiGeneratorActions>;

export const GENERATE_FAILED = 'Could not generate a UI.';

export function createUiGeneratorStore({
  announce,
  service,
  initial,
}: {
  announce: Announce;
  service: UiGeneratorService;
  initial?: Partial<UiGeneratorState>;
}): UiGeneratorStore {
  return createStore<UiGeneratorState & UiGeneratorActions>()((set, get) => ({
    status: 'idle',
    error: null,
    ...initial,
    async generate(text) {
      const description = text.trim();
      if (get().status === 'generating' || description === '') {
        return null;
      }
      set({ status: 'generating', error: null });
      try {
        const elements = await service.generate(description);
        set({ status: 'idle' });
        return elements;
      } catch (failure) {
        const error = failure instanceof UiGeneratorError ? failure.message : GENERATE_FAILED;
        set({ status: 'error', error });
        announce(error);
        return null;
      }
    },
  }));
}

export const UiGeneratorStoreContext = createContext<UiGeneratorStore | null>(null);

export function useUiGeneratorStore<T>(
  selector: (state: UiGeneratorState & UiGeneratorActions) => T,
): T {
  const store = useContext(UiGeneratorStoreContext);
  if (!store) {
    throw new Error('useUiGeneratorStore needs a <UiGeneratorStoreContext> provider above it.');
  }
  return useStore(store, selector);
}
