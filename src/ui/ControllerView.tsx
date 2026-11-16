// Schematic controller drawing. Lights up whatever is pressed, shows stick positions,
// fills triggers by how far they are pulled, and can report clicks on a control.

import type { ControllerState } from '../core/engine';
import { BUTTON_INDEX, type Button, type Target } from '../core/targets';

interface Props {
  state?: ControllerState | null;
  selected?: Target | null;
  onPick?: (target: Target) => void;
}

const BODY =
  'M64 44C96 30 224 30 256 44C287 57 309 118 300 158C293 188 262 193 246 172L224 144C212 131 108 131 96 144L74 172C58 193 27 188 20 158C11 118 33 57 64 44Z';

const FACE: { name: Button; x: number; y: number; color: string }[] = [
  { name: 'y', x: 244, y: 66, color: 'var(--pad-y)' },
  { name: 'x', x: 226, y: 84, color: 'var(--pad-x)' },
  { name: 'b', x: 262, y: 84, color: 'var(--pad-b)' },
  { name: 'a', x: 244, y: 102, color: 'var(--pad-a)' },
];

const DPAD: { name: Button; x: number; y: number; w: number; h: number }[] = [
  { name: 'dpadUp', x: 121, y: 113, w: 12, h: 14 },
  { name: 'dpadDown', x: 121, y: 139, w: 12, h: 14 },
  { name: 'dpadLeft', x: 107, y: 127, w: 14, h: 12 },
  { name: 'dpadRight', x: 133, y: 127, w: 14, h: 12 },
];

export function ControllerView({ state, selected, onPick }: Props) {
  const value = (name: Button) => state?.buttons[BUTTON_INDEX[name]] ?? 0;
  const on = (name: Button) => value(name) > 0;
  const cls = (name: Target, extra = '') =>
    `part ${extra}${selected === name ? ' selected' : ''}${onPick ? ' pickable' : ''}`;
  const pick = (name: Target) => (onPick ? () => onPick(name) : undefined);
  const axes = state?.axes ?? [0, 0, 0, 0];

  return (
    <svg class="controller" viewBox="0 0 320 200" role="img" aria-label="Controller">
      <path d={BODY} class="body" />

      {(['lt', 'rt'] as const).map((name, i) => {
        const x = i === 0 ? 74 : 206;
        return (
          <g key={name} class={cls(name)} onClick={pick(name)}>
            <rect x={x} y={8} width={40} height={14} rx={5} class="well" />
            <rect x={x} y={8} width={40 * value(name)} height={14} rx={5} class="fill" />
            <text x={x + 20} y={18.5}>
              {name.toUpperCase()}
            </text>
          </g>
        );
      })}
      {(['lb', 'rb'] as const).map((name, i) => (
        <g key={name} class={cls(name, on(name) ? 'lit' : '')} onClick={pick(name)}>
          <rect x={i === 0 ? 62 : 192} y={27} width={66} height={11} rx={5} class="key" />
          <text x={i === 0 ? 95 : 225} y={35.5}>
            {name.toUpperCase()}
          </text>
        </g>
      ))}

      <Stick
        cx={96}
        cy={84}
        x={axes[0] ?? 0}
        y={axes[1] ?? 0}
        lit={on('ls')}
        className={cls('ls')}
        onClick={pick('ls')}
      />
      <Stick
        cx={200}
        cy={130}
        x={axes[2] ?? 0}
        y={axes[3] ?? 0}
        lit={on('rs')}
        className={cls('rs')}
        onClick={pick('rs')}
      />

      {DPAD.map((d) => (
        <rect
          key={d.name}
          {...{ x: d.x, y: d.y, width: d.w, height: d.h }}
          rx={2}
          class={cls(d.name, on(d.name) ? 'key lit' : 'key')}
          onClick={pick(d.name)}
        />
      ))}

      {FACE.map((f) => (
        <g key={f.name} class={cls(f.name, on(f.name) ? 'lit' : '')} onClick={pick(f.name)}>
          <circle
            cx={f.x}
            cy={f.y}
            r={9}
            class="face-btn"
            style={{ fill: on(f.name) ? f.color : undefined, stroke: f.color }}
          />
          <text x={f.x} y={f.y + 3.5} style={{ fill: on(f.name) ? 'var(--case)' : f.color }}>
            {f.name.toUpperCase()}
          </text>
        </g>
      ))}

      <circle
        cx={140}
        cy={84}
        r={6}
        class={cls('view', on('view') ? 'key lit' : 'key')}
        onClick={pick('view')}
      />
      <circle
        cx={180}
        cy={84}
        r={6}
        class={cls('menu', on('menu') ? 'key lit' : 'key')}
        onClick={pick('menu')}
      />
      <circle
        cx={160}
        cy={60}
        r={9}
        class={cls('guide', on('guide') ? 'key lit' : 'key')}
        onClick={pick('guide')}
      />
    </svg>
  );
}

function Stick(props: {
  cx: number;
  cy: number;
  x: number;
  y: number;
  lit: boolean;
  className: string;
  onClick: (() => void) | undefined;
}) {
  return (
    <g class={props.className} onClick={props.onClick}>
      <circle cx={props.cx} cy={props.cy} r={19} class="stick-well" />
      <circle
        cx={props.cx + props.x * 10}
        cy={props.cy + props.y * 10}
        r={11}
        class={props.lit ? 'stick-cap lit' : 'stick-cap'}
      />
    </g>
  );
}
