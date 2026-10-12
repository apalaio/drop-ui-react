import { SubmitEvent, useId, useState } from 'react';
import { useBuilderStore } from '../../builder/state/builder-store';
import { MAX_TEXT_LENGTH } from '../models/generation-request';
import { useUiGeneratorStore } from '../state/ui-generator-store';

const LABEL = 'Describe a UI';

export function PromptBox({ className = '' }: { className?: string }) {
  const status = useUiGeneratorStore((state) => state.status);
  const error = useUiGeneratorStore((state) => state.error);
  const generate = useUiGeneratorStore((state) => state.generate);
  const loadGeneratedElements = useBuilderStore((state) => state.loadGeneratedElements);
  const [text, setText] = useState('');
  const fieldId = useId();

  const generating = status === 'generating';

  async function submit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const elements = await generate(text);
    if (elements) {
      loadGeneratedElements(elements);
    }
  }

  return (
    <form
      className={`border-t border-base-300 p-4 ${className}`}
      aria-label={LABEL}
      aria-busy={generating}
      onSubmit={(event) => void submit(event)}
    >
      <label
        htmlFor={fieldId}
        className="mb-2 block text-xs font-semibold tracking-wide text-base-content/70 uppercase"
      >
        {LABEL}
      </label>

      <textarea
        id={fieldId}
        className="textarea mb-2 w-full textarea-sm"
        rows={2}
        placeholder="A signup form with name, birthday and country"
        maxLength={MAX_TEXT_LENGTH}
        value={text}
        onChange={({ target }) => setText(target.value)}
      />

      <button
        type="submit"
        className="btn btn-sm btn-primary"
        disabled={generating || text.trim() === ''}
      >
        {generating && <span className="loading loading-xs loading-spinner" aria-hidden="true" />}
        {generating ? 'Generating…' : 'Generate'}
      </button>

      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </form>
  );
}
