import { useEffect, useRef } from 'preact/hooks';
import { FireFrame } from './fire';

/**
 * Fire around the edges of the window, or of the nearest positioned parent when contained.
 * Power 0 leaves embers, 1 is a full fire. Ghost fire burns in pale spectral colors.
 */
export function FireBorder(props: { power: number; ghost?: boolean; contained?: boolean }) {
  const { power, ghost = false, contained } = props;
  const canvas = useRef<HTMLCanvasElement>(null);
  const fire = useRef<FireFrame | null>(null);
  useEffect(() => {
    if (!canvas.current) return;
    fire.current = FireFrame.create(canvas.current);
    fire.current?.setPower(power);
    fire.current?.setGhost(ghost);
    return () => {
      fire.current?.destroy();
      fire.current = null;
    };
  }, []);
  useEffect(() => fire.current?.setPower(power), [power]);
  useEffect(() => fire.current?.setGhost(ghost), [ghost]);
  return <canvas ref={canvas} class={contained ? 'fire contained' : 'fire'} aria-hidden="true" />;
}
