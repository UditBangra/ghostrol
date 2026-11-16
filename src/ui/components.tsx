import type { ComponentChildren } from 'preact';
import { inputShortLabel, inputLabel, type InputCode, type LayoutMap } from '../core/inputs';
import { TARGET_GLYPHS, TARGET_NAMES, type Target } from '../core/targets';
import { BRAND } from '../shared/brand';
import { useThumb } from './hooks';

/** The product name in blackletter (see .wordmark in tokens.css). */
export function Wordmark({ class: className }: { class?: string }) {
  return <span class={className ? `wordmark ${className}` : 'wordmark'}>{BRAND.name}</span>;
}

export function Keycap(props: {
  code: InputCode;
  layout?: LayoutMap | undefined;
  small?: boolean;
  accent?: boolean;
  down?: boolean;
}) {
  const classes = ['cap'];
  if (props.small) classes.push('small');
  if (props.accent) classes.push('accent');
  if (props.down) classes.push('down');
  return (
    <kbd class={classes.join(' ')} title={inputLabel(props.code, props.layout)}>
      {inputShortLabel(props.code, props.layout)}
    </kbd>
  );
}

export function KeyList(props: {
  codes: readonly InputCode[] | undefined;
  layout?: LayoutMap | undefined;
  pressed?: ReadonlySet<string>;
  small?: boolean;
}) {
  if (!props.codes?.length) return <span class="faint">Not bound</span>;
  return (
    <span class="keylist">
      {props.codes.map((code) => (
        <Keycap
          key={code}
          code={code}
          layout={props.layout}
          small={props.small ?? false}
          down={props.pressed?.has(code) ?? false}
        />
      ))}
    </span>
  );
}

const FACE = new Set(['a', 'b', 'x', 'y']);

export function Glyph({ target }: { target: Target }) {
  const face = FACE.has(target);
  return (
    <span
      class={face ? `glyph face ${target}` : 'glyph'}
      title={TARGET_NAMES[target]}
      aria-label={TARGET_NAMES[target]}
    >
      {TARGET_GLYPHS[target]}
    </span>
  );
}

export function Switch(props: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      class="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
    />
  );
}

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  hint?: string;
  /** Shown but locked, for presets that cannot be changed. */
  disabled?: boolean;
  onInput: (value: number) => void;
}) {
  const fill = ((props.value - props.min) / (props.max - props.min)) * 100;
  const id = `slider-${props.label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div class={props.disabled ? 'slider locked' : 'slider'}>
      <div class="slider-head">
        <label for={id}>{props.label}</label>
        <output for={id}>{props.format ? props.format(props.value) : props.value}</output>
      </div>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        disabled={props.disabled}
        style={{ '--fill': `${fill}%` }}
        onInput={(e) => props.onInput(Number((e.target as HTMLInputElement).value))}
      />
      {props.hint && <small>{props.hint}</small>}
    </div>
  );
}

export function Row(props: {
  label: ComponentChildren;
  hint?: ComponentChildren;
  children: ComponentChildren;
}) {
  return (
    <div class="row">
      <div class="row-text">
        <div>{props.label}</div>
        {props.hint && <small class="dim">{props.hint}</small>}
      </div>
      {props.children}
    </div>
  );
}

/**
 * A row of choices. The chosen one is a keycap that slides to whichever you pick, so
 * the eye follows the change. Buttons with aria-pressed, as before, for screen readers.
 */
export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const ref = useThumb<HTMLDivElement>('[aria-pressed="true"]', props.value);
  return (
    <div
      ref={ref}
      class={props.compact ? 'segmented compact' : 'segmented'}
      role="group"
      aria-label={props.label}
    >
      <span class="thumb" aria-hidden="true" />
      {props.options.map(([value, text]) => (
        <button
          key={value}
          type="button"
          aria-pressed={props.value === value}
          disabled={props.disabled}
          onClick={() => props.onChange(value)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/**
 * Content that a choice brings in. It slides open to its natural height and fades in,
 * and closes the same way, instead of popping in. Closed content stays in the page but
 * cannot be reached by keyboard or screen readers.
 */
export function Reveal(props: { open: boolean; children: ComponentChildren }) {
  return (
    <div class={props.open ? 'reveal open' : 'reveal'} inert={!props.open}>
      <div class="reveal-inner">{props.children}</div>
    </div>
  );
}
