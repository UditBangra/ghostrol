// Plots how mouse speed turns into stick tilt for the current curve and anti-deadzone.

import { shape } from '../core/mouse';

export function CurveGraph({ curve, antiDeadzone }: { curve: number; antiDeadzone: number }) {
  const size = 120;
  const points: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = i / 40;
    const y = i === 0 ? 0 : shape(x, curve, antiDeadzone);
    points.push(`${(x * size).toFixed(1)},${(size - y * size).toFixed(1)}`);
  }
  return (
    <figure class="curve">
      <svg viewBox={`-4 -4 ${size + 8} ${size + 8}`} role="img" aria-label="Mouse response curve">
        <rect x={0} y={0} width={size} height={size} class="curve-frame" />
        <line x1={0} y1={size} x2={size} y2={0} class="curve-linear" />
        <polyline points={points.join(' ')} class="curve-line" />
      </svg>
      <figcaption class="faint">Mouse speed across, stick tilt up</figcaption>
    </figure>
  );
}
