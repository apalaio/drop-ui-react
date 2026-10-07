import { JSX } from 'react';
import { BuilderShell } from './app/features/builder/builder-shell/builder-shell';
import { DocumentTheme } from './app/features/theme/document-theme/document-theme';

export function App(): JSX.Element {
  return (
    <>
      <DocumentTheme />
      <BuilderShell />
    </>
  );
}
