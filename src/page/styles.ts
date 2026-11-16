// Styles for everything drawn over the game. Same materials as the popup and Studio
// (see docs/DESIGN.md), kept here because the page cannot load extension CSS files.
//
// No blurred shadows anywhere: drawn over a playing video, a soft shadow on a fading
// element cost hundreds of milliseconds per frame on machines without fast graphics.
// Hard keycap skirts are free and fit the design better anyway.

export const STYLE = (fontUrl: string) => `
@font-face {
  font-family: 'Archivo';
  src: url('${fontUrl}') format('woff2-variations'), url('${fontUrl}') format('woff2');
  font-weight: 100 900;
  font-stretch: 62% 125%;
  font-display: swap;
}
:host { all: initial; }
.root {
  --case: #1b1d22;
  --plate: #22252b;
  --plate-line: #2d3038;
  --well: #17191d;
  --cap: #30333b;
  --cap-top: #3a3e47;
  --cap-edge: #15171b;
  --legend: #ece6d6;
  --legend-dim: #aaa596;
  --legend-faint: #727068;
  --honey: #f2b13a;
  --honey-deep: #b57d16;
  --honey-ink: #2b1d04;
  --pad-a: #7fb069;
  --pad-b: #d9644f;
  --pad-x: #5b8fd4;
  --pad-y: #e0b84a;
  --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483646;
  font: 500 13px/1.35 'Archivo', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  color: var(--legend);
  -webkit-font-smoothing: antialiased;
}
b { font-weight: 650; font-stretch: 112%; }
.mark { flex: none; width: 22px; height: 22px; }
.mark.big { width: 40px; height: 40px; margin: -2px -2px -2px -4px; }
[hidden] { display: none !important; }

/* Keycaps and controller glyphs */
.cap {
  display: inline-grid;
  place-items: center;
  min-width: 26px;
  height: 26px;
  padding: 0 7px 2px;
  border-radius: 6px;
  background: linear-gradient(var(--cap-top), var(--cap) 70%);
  box-shadow: inset 0 -3px 0 var(--cap-edge), inset 0 1px 0 rgba(255, 255, 255, 0.07);
  font-weight: 640;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  transition: translate 70ms var(--ease), box-shadow 70ms var(--ease);
}
.cap.accent {
  background: linear-gradient(#f6c25a, var(--honey) 70%);
  color: var(--honey-ink);
  box-shadow: inset 0 -3px 0 var(--honey-deep), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.glyph {
  display: inline-grid;
  place-items: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: 12px;
  background: var(--well);
  color: var(--legend-dim);
  font-size: 11px;
  font-weight: 680;
  white-space: nowrap;
  box-shadow: inset 0 0 0 1px var(--plate-line);
  transition: color 90ms ease, box-shadow 90ms ease;
}
.glyph.face { width: 24px; padding: 0; color: var(--case); box-shadow: none; }
.glyph.a { background: var(--pad-a); }
.glyph.b { background: var(--pad-b); }
.glyph.x { background: var(--pad-x); }
.glyph.y { background: var(--pad-y); }
.dim { color: var(--legend-dim); }
.faint { color: var(--legend-faint); }

/* Message */
.toast {
  position: absolute;
  top: 18px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: min(560px, calc(100vw - 32px));
  padding: 7px 14px 8px 9px;
  background: var(--case);
  border-radius: 9px;
  box-shadow: 0 0 0 1px var(--plate-line), 0 3px 0 var(--cap-edge);
  opacity: 0;
  will-change: opacity, translate;
  translate: -50% -8px;
  transition: opacity 180ms ease, translate 220ms var(--ease);
}
.toast.on { opacity: 1; translate: -50% 0; }

/* Capture prompt */
.prompt {
  position: absolute;
  bottom: 28px;
  left: 50%;
  translate: -50% 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 8px 8px;
  border: 0;
  background: var(--case);
  border-radius: 10px;
  box-shadow: 0 0 0 1px var(--plate-line), 0 3px 0 var(--cap-edge);
  pointer-events: auto;
  cursor: pointer;
  font: inherit;
  color: inherit;
  white-space: nowrap;
  animation: rise 200ms var(--ease);
}
.prompt:hover .cap.accent { translate: 0 1px; box-shadow: inset 0 -2px 0 var(--honey-deep); }
.prompt:focus-visible { outline: 2px solid var(--honey); outline-offset: 3px; }

/* Input display */
.hud {
  position: absolute;
  bottom: 22px;
  left: 22px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.hud.right { left: auto; right: 22px; align-items: flex-end; }
.chips { display: flex; flex-direction: column; align-items: inherit; gap: 6px; }
.chip {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 12px 0 5px;
  border-radius: 10px;
  background: rgba(24, 26, 31, 0.9);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06), 0 2px 0 rgba(0, 0, 0, 0.45);
  will-change: opacity, translate;
  animation: chip-in 150ms var(--ease);
  transition: opacity 200ms ease, translate 200ms var(--ease); /* FADE_MS in hud.ts */
}
.hud.right .chip { flex-direction: row-reverse; padding: 0 5px 0 12px; animation-name: chip-in-right; }
.chip.gone { opacity: 0; translate: -10px 0; }
.hud.right .chip.gone { translate: 10px 0; }
.chip .to { color: var(--legend-faint); font-size: 14px; line-height: 1; }
.hud.right .chip .to { rotate: 180deg; }
.chip .what {
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--legend-dim);
  font-size: 12.5px;
}
.chip.held .cap { translate: 0 2px; box-shadow: inset 0 -1px 0 var(--cap-edge), inset 0 1px 0 rgba(255, 255, 255, 0.05); }
.chip.held .glyph:not(.face) { color: var(--legend); box-shadow: inset 0 0 0 1.5px var(--honey); }
.chip.held .glyph.face { box-shadow: 0 0 0 2px rgba(242, 177, 58, 0.55); }
.chip.held .what { color: var(--legend); }
.pad {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(24, 26, 31, 0.88);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.05);
}
.stick { position: relative; width: 52px; height: 52px; border-radius: 50%; background: var(--well); box-shadow: inset 0 0 0 1px var(--plate-line); }
.stick i { position: absolute; left: 50%; top: 50%; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%; background: linear-gradient(var(--cap-top), var(--cap)); box-shadow: inset 0 0 0 1.5px var(--legend-dim); }
.stick.on i { box-shadow: inset 0 0 0 1.5px var(--honey); }
.pad-mid { display: grid; gap: 6px; }
.trig { display: grid; grid-template-columns: 16px 46px; align-items: center; gap: 5px; font-size: 10px; font-weight: 700; color: var(--legend-faint); }
.trig span { display: block; height: 6px; border-radius: 3px; background: var(--well); overflow: hidden; }
.trig span i { display: block; height: 100%; width: 100%; transform-origin: left; scale: 0 1; background: var(--honey); }
.face-dots { display: grid; grid-template-columns: repeat(4, 11px); gap: 5px; margin-top: 2px; }
.face-dots i { width: 11px; height: 11px; border-radius: 50%; background: #34373f; transition: background-color 60ms ease; }
.face-dots i.on.a { background: var(--pad-a); }
.face-dots i.on.b { background: var(--pad-b); }
.face-dots i.on.x { background: var(--pad-x); }
.face-dots i.on.y { background: var(--pad-y); }

/* Controls panel */
.scrim {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(8, 9, 11, 0.6);
  pointer-events: auto;
  animation: fade 140ms ease;
}
.scrim.peek { pointer-events: none; background: rgba(8, 9, 11, 0.42); }
.panel {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: min(880px, 100%);
  max-height: min(680px, 100%);
  overflow: hidden;
  border-radius: 14px;
  background: var(--case);
  box-shadow: 0 0 0 1px var(--plate-line), 0 4px 0 var(--cap-edge);
  will-change: opacity, scale;
  animation: panel-in 180ms var(--ease);
}
/* A thin lit edge along the top, like the light strip on a console. */
.panel::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(242, 177, 58, 0.9) 30%, #ff7a3d 55%, transparent);
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px 15px;
  border-bottom: 1px solid var(--plate-line);
  background: linear-gradient(var(--plate), var(--case));
}
.panel-title { flex: 1; min-width: 0; }
.panel-title h2 {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 21px;
  font-weight: 780;
  font-stretch: 122%;
  line-height: 1.15;
  letter-spacing: -0.01em;
}
.panel-title p { margin: 2px 0 0; color: var(--legend-dim); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.back {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 14px 2px;
  border: 0;
  border-radius: 7px;
  background: linear-gradient(#f6c25a, var(--honey) 70%);
  box-shadow: inset 0 -3px 0 var(--honey-deep), inset 0 1px 0 rgba(255, 255, 255, 0.35);
  color: var(--honey-ink);
  font: inherit;
  font-weight: 680;
  white-space: nowrap;
  cursor: pointer;
}
.back:active { translate: 0 2px; box-shadow: inset 0 -1px 0 var(--honey-deep); }
.back:focus-visible, .choice:focus-visible, .step:focus-visible { outline: 2px solid var(--honey); outline-offset: 2px; }
.peek-note { flex: none; color: var(--legend-dim); font-size: 12.5px; white-space: nowrap; }
.panel-body { display: grid; grid-template-columns: minmax(0, 1fr) 250px; min-height: 0; }
.keys { min-height: 0; overflow: auto; padding: 14px 18px 18px; }
.cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 28px; align-items: start; }
.group {
  display: grid;
  grid-template-columns: minmax(84px, max-content) max-content minmax(0, 1fr);
  align-items: center;
  gap: 8px 10px;
  margin: 0 0 16px;
}
.group h3 { grid-column: 1 / -1; margin: 0 0 -2px; color: var(--legend-faint); font-size: 12px; font-weight: 650; }
.row { display: contents; }
.row .codes { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
.row .glyph { justify-self: center; }
.row .what { min-width: 0; overflow-wrap: anywhere; font-size: 13px; }
.side { display: grid; align-content: start; gap: 18px; min-height: 0; overflow: auto; padding: 14px 16px 18px; border-left: 1px solid var(--plate-line); background: #191b1f; }
.side h3 { margin: 0 0 6px; color: var(--legend-faint); font-size: 12px; font-weight: 650; }
.choices { display: grid; gap: 2px; }
.choice {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 32px;
  padding: 6px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--legend-dim);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 100ms ease, color 100ms ease;
}
.choice span { min-width: 0; overflow-wrap: anywhere; }
.choice::before { content: ''; flex: none; width: 8px; height: 8px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--legend-faint); }
.choice:hover { background: var(--plate); color: var(--legend); }
.choice[aria-checked='true'] { background: #2a2416; color: var(--legend); }
.choice[aria-checked='true']::before { background: var(--honey); box-shadow: 0 0 0 3px rgba(242, 177, 58, 0.22); }
.scrim.peek .choice, .scrim.peek .step { opacity: 0.6; }
.stepper { display: flex; align-items: center; gap: 8px; }
.step {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 28px;
  padding: 0 0 2px;
  border: 0;
  border-radius: 6px;
  background: linear-gradient(var(--cap-top), var(--cap) 70%);
  box-shadow: inset 0 -3px 0 var(--cap-edge), inset 0 1px 0 rgba(255, 255, 255, 0.07);
  color: var(--legend);
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}
.step:active { translate: 0 2px; box-shadow: inset 0 -1px 0 var(--cap-edge); }
.speed-value { min-width: 34px; text-align: center; font-size: 15px; font-weight: 700; }
.side small { display: block; margin-top: 6px; color: var(--legend-faint); font-size: 11.5px; }
.hints { display: grid; gap: 7px; font-size: 12.5px; color: var(--legend-dim); }
.hints div { display: flex; align-items: center; gap: 8px; }
.hints .cap { height: 22px; min-width: 22px; padding: 0 6px 2px; font-size: 11px; border-radius: 5px; }
.notes { margin: 2px 0 0; padding-top: 12px; border-top: 1px solid var(--plate-line); color: var(--legend-dim); font-size: 12.5px; }

@media (max-width: 700px) {
  .panel-body { grid-template-columns: 1fr; overflow: auto; }
  .cols { grid-template-columns: minmax(0, 1fr); }
  .keys { overflow: visible; }
  .side { border-left: 0; border-top: 1px solid var(--plate-line); overflow: visible; }
}

@keyframes fade { from { opacity: 0; } }
@keyframes rise { from { opacity: 0; translate: -50% 8px; } }
@keyframes panel-in { from { opacity: 0; scale: 0.97; translate: 0 6px; } }
@keyframes chip-in { from { opacity: 0; translate: -12px 0; } }
@keyframes chip-in-right { from { opacity: 0; translate: 12px 0; } }

@media (prefers-reduced-motion: reduce) {
  *, *::before { animation: none !important; transition: none !important; }
}
`;
