import { createAnnouncer } from './announcer';

describe('createAnnouncer', () => {
  const message = 'Block text added to Row 1, column 1.';
  const otherMessage = 'Block text deleted.';
  let page: Document;

  function liveRegions(root: Document = page): HTMLElement[] {
    return Array.from(root.body.querySelectorAll<HTMLElement>('[aria-live]'));
  }

  beforeEach(() => {
    page = document.implementation.createHTMLDocument();
  });

  it('adds no live region before anything is announced', () => {
    createAnnouncer(page);

    expect(liveRegions()).toEqual([]);
  });

  it('adds one polite live region to the body on the first announcement', () => {
    const announce = createAnnouncer(page);

    announce(message);

    expect(liveRegions().length).toBe(1);
    expect(liveRegions()[0].parentElement).toBe(page.body);
    expect(liveRegions()[0].getAttribute('aria-live')).toBe('polite');
  });

  it('has the region read out as a whole', () => {
    const announce = createAnnouncer(page);

    announce(message);

    expect(liveRegions()[0].getAttribute('aria-atomic')).toBe('true');
  });

  it('keeps the region out of sight without hiding it from screen readers', () => {
    const announce = createAnnouncer(page);

    announce(message);
    const [region] = liveRegions();

    expect(region.classList).toContain('sr-only');
    expect(region.hidden).toBe(false);
    expect(region.hasAttribute('aria-hidden')).toBe(false);
  });

  it('writes the message as the text of the region', () => {
    const announce = createAnnouncer(page);

    announce(message);

    expect(liveRegions()[0].textContent).toBe(message);
  });

  it('reuses the region for later messages', () => {
    const announce = createAnnouncer(page);

    announce(message);
    announce(otherMessage);

    expect(liveRegions().length).toBe(1);
  });

  it('replaces the previous message with the next one', () => {
    const announce = createAnnouncer(page);

    announce(message);
    announce(otherMessage);

    expect(liveRegions()[0].textContent).toBe(otherMessage);
  });

  it('writes a repeated message again, so it is spoken a second time', () => {
    const announce = createAnnouncer(page);
    announce(message);
    const observer = new MutationObserver(() => undefined);
    observer.observe(liveRegions()[0], { childList: true, characterData: true, subtree: true });

    announce(message);
    const changes = observer.takeRecords();
    observer.disconnect();

    expect(changes.length).toBeGreaterThan(0);
    expect(liveRegions()[0].textContent).toBe(message);
  });

  it('gives each announcer a region of its own', () => {
    createAnnouncer(page)(message);
    createAnnouncer(page)(otherMessage);

    expect(liveRegions().map((region) => region.textContent)).toEqual([message, otherMessage]);
  });

  it('announces in the page document unless given another', () => {
    const announce = createAnnouncer();

    announce(message);
    const regions = liveRegions(document);
    regions.forEach((region) => region.remove());

    expect(regions.map((region) => region.textContent)).toEqual([message]);
  });
});
