import { useEffect } from 'react';
import { LOAD_FAILED, useFactStore } from '../state/fact-store';

const LABEL = 'Did you know?';

export function FactPanel({ className = '' }: { className?: string }) {
  const fact = useFactStore((state) => state.fact);
  const status = useFactStore((state) => state.status);
  const loadToday = useFactStore((state) => state.loadToday);
  const loadRandom = useFactStore((state) => state.loadRandom);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  const failed = status === 'error';

  return (
    <section className={`border-t border-base-300 p-4 ${className}`} aria-label={LABEL}>
      <p
        className="mb-2 text-xs font-semibold tracking-wide text-base-content/70 uppercase"
        aria-hidden="true"
      >
        {LABEL}
      </p>

      <p className="mb-2 text-sm">{failed ? LOAD_FAILED : (fact?.text ?? 'Loading…')}</p>

      <button
        type="button"
        className="btn btn-sm"
        aria-disabled={status === 'loading'}
        onClick={() => void loadRandom()}
      >
        {failed ? 'Try again' : 'Another fact'}
      </button>
    </section>
  );
}
