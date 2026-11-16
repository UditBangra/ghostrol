// Small helpers for building the in-page interface without a framework.

import { inputShortLabel, inputLabel, type InputCode, type LayoutMap } from '../core/inputs';
import { TARGET_GLYPHS, TARGET_NAMES, type Target } from '../core/targets';
import MARK from '../../assets/mark.svg';

/** Tag of the element that hosts everything we draw on the page. */
export const OVERLAY_TAG = 'ghostrol-overlay';

export type Child = Node | string | false | null | undefined;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  for (const child of children) if (child) el.append(child);
  return el;
}

export function keycap(code: InputCode, layout?: LayoutMap): HTMLElement {
  const el = h('span', 'cap', inputShortLabel(code, layout));
  el.title = inputLabel(code, layout);
  return el;
}

const FACE = new Set<Target>(['a', 'b', 'x', 'y']);

export function glyph(target: Target): HTMLElement {
  const el = h('span', FACE.has(target) ? `glyph face ${target}` : 'glyph', TARGET_GLYPHS[target]);
  el.title = TARGET_NAMES[target];
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

let markUrl = '';

/** Where the skull icon is, once the bridge has said where the extension's files are. */
export function setMarkUrl(url: string): void {
  markUrl = url;
}

/**
 * The Ghostrol skull: the icon artwork, or a simpler drawn skull until its address is
 * known or if the page refuses to load it.
 */
export function mark(className: string): Element {
  if (!markUrl) return drawnMark(className);
  const img = h('img', className);
  img.alt = '';
  img.addEventListener(
    'error',
    () => {
      markUrl = '';
      img.replaceWith(drawnMark(className));
    },
    { once: true },
  );
  img.src = markUrl;
  return img;
}

/** Built node by node from our own SVG file, because the site may forbid innerHTML. */
function drawnMark(className: string): SVGSVGElement {
  const open: Element[] = [];
  let root: Element | null = null;
  for (const [, close, tag, attrs, selfClosing] of MARK.matchAll(/<(\/?)([\w:]+)([^>]*?)(\/?)>/g)) {
    if (close) {
      open.pop();
      continue;
    }
    const el = document.createElementNS(SVG_NS, tag!);
    for (const [, name, value] of attrs!.matchAll(/([\w:-]+)="([^"]*)"/g)) {
      if (name!.startsWith('xmlns')) continue;
      if (name === 'xlink:href') el.setAttributeNS(XLINK_NS, name, value!);
      else el.setAttribute(name!, value!);
    }
    if (open.length) open[open.length - 1]!.append(el);
    else root = el;
    if (!selfClosing) open.push(el);
  }
  const svg = root as SVGSVGElement;
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

/** Splits **bold** parts of a message into text and <b> nodes. */
export function richText(message: string): Node[] {
  return message.split('**').map((part, i) => {
    if (i % 2 === 0) return document.createTextNode(part);
    return h('b', '', part);
  });
}
