export type Announce = (message: string) => void;

/** Speaks messages to screen readers through one polite live region, added to `<body>` on first use. */
export function createAnnouncer(document: Document = window.document): Announce {
  let region: HTMLElement | undefined;

  return (message) => {
    if (!region) {
      region = document.createElement('div');
      region.className = 'sr-only';
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      document.body.appendChild(region);
    }
    // Emptied first, so a message equal to the last one is still a change and is spoken again.
    region.textContent = '';
    region.textContent = message;
  };
}
