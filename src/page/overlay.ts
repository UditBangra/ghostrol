// In-page interface: the capture prompt, short messages, the input display and the
// controls panel. Everything lives in a closed shadow root so the site's styles cannot
// reach it and ours cannot leak out.
//
// xCloud puts its own player container in full screen, not the page, and only the full
// screen element and its children are drawn then. So the overlay moves into whatever
// element is in full screen, and back out afterwards.

import { h, mark, OVERLAY_TAG, richText } from './dom';
import { Hud } from './hud';
import { ControlsPanel } from './panel';
import { STYLE } from './styles';

const TOAST_MS = 3600;

/** Elements that cannot draw children, so the overlay cannot live inside them. */
const NO_CHILDREN = new Set(['VIDEO', 'CANVAS', 'IMG', 'IFRAME', 'EMBED', 'OBJECT']);

export class Overlay {
  readonly hud = new Hud();
  readonly panel = new ControlsPanel();
  private host: HTMLElement | null = null;
  private readonly root = h('div', 'root');
  private readonly style = h('style');
  private readonly toast = h('div', 'toast');
  private readonly prompt = h(
    'button',
    'prompt',
    h('span', 'cap accent', 'Click'),
    h('span', '', 'the game to play with your mouse'),
    h('span', 'dim', 'Esc lets go'),
  );
  private toastTimer = 0;
  private fontUrl = '';

  /** Called when the user clicks the capture prompt. */
  onCaptureClick: () => void = () => {};

  constructor() {
    this.toast.setAttribute('role', 'status');
    this.prompt.type = 'button';
    this.prompt.hidden = true;
    this.prompt.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onCaptureClick();
    });
    this.root.append(this.toast, this.hud.el, this.prompt, this.panel.el);
    document.addEventListener('fullscreenchange', () => this.place());
  }

  setFontUrl(url: string): void {
    if (url === this.fontUrl) return;
    this.fontUrl = url;
    this.style.textContent = STYLE(url);
  }

  /** Adds the overlay to the page the first time something needs to be shown. */
  ensure(): boolean {
    if (this.host) return true;
    if (!document.body) return false;
    this.host = document.createElement(OVERLAY_TAG);
    const shadow = this.host.attachShadow({ mode: 'closed' });
    shadow.append(this.style, this.root);
    this.place();
    return true;
  }

  private place(): void {
    const host = this.host;
    if (!host) return;
    const full = document.fullscreenElement;
    const parent = full && !NO_CHILDREN.has(full.tagName) ? full : document.documentElement;
    if (host.parentNode !== parent) parent.append(host);
  }

  /** Shows a short message. Parts in **double asterisks** are set in bold. */
  say(message: string): void {
    if (!this.ensure()) return;
    this.toast.replaceChildren(mark('mark'), h('span', '', ...richText(message)));
    this.toast.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('on'), TOAST_MS);
  }

  showPrompt(visible: boolean): void {
    if (!visible && !this.host) return;
    if (!this.ensure()) return;
    this.prompt.hidden = !visible;
  }
}
