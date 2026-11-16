// Fire along the bottom and lower sides of a panel, drawn with a WebGL shader.
//
// Flames are layered noise moving upward, warped by a second noise so they twist and
// split like real flames, and colored by temperature: deep red at the tips, orange,
// then yellow-white at the hottest base. Embers rise from the base and a warm glow
// lights the edge. Ghost fire burns the same way in cold, pale spectral colors. The
// canvas is blended additively, so where there is no fire it changes nothing.
//
// Cost: drawn at a reduced resolution (fire is soft, so it does not show), with an early
// exit for the empty middle. It stops when the page is hidden, and draws a single still
// frame when the user prefers reduced motion.
//
// Startup: the noise comes from a small texture of random values instead of being
// computed, because Direct3D's shader compiler unrolls the computed version into a huge
// program. On an Intel laptop that compile blocked the popup for 2 to 4 seconds; the
// texture version compiles in about 0.2 s. It also compiles in the background where the
// browser supports it, and the canvas fades in once the first frame is drawn, so the
// popup opens at once and the fire lights a moment later.

/** Side of the noise texture. A power of two, so it can repeat in WebGL 1. */
const NOISE_SIZE = 256;

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision mediump float;
uniform vec2 u_res;     // canvas size in pixels
uniform float u_px;     // canvas pixels per CSS pixel
uniform float u_time;   // seconds
uniform float u_power;  // 0 smoldering .. 1 full fire
uniform float u_ghost;  // 0 ember fire, 1 ghost fire
uniform sampler2D u_noise; // NOISE_SIZE square of random values, repeating

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Value noise. Sampling between two texel centers at i + smoothstep(f) makes the linear
// filter do the smooth blend, so one lookup replaces four hashes and three mixes.
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return texture2D(u_noise, (i + u + 0.5) / ${NOISE_SIZE}.0).r;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

// Color by temperature, 0 cold to 1 hottest.
vec3 heat(float t) {
  vec3 c = vec3(0.0);
  c = mix(c, vec3(0.36, 0.02, 0.01), smoothstep(0.0, 0.3, t));
  c = mix(c, vec3(0.82, 0.13, 0.02), smoothstep(0.25, 0.55, t));
  c = mix(c, vec3(1.0, 0.42, 0.05), smoothstep(0.5, 0.76, t));
  c = mix(c, vec3(1.0, 0.72, 0.28), smoothstep(0.72, 0.92, t));
  c = mix(c, vec3(1.0, 0.93, 0.75), smoothstep(0.9, 1.0, t));
  return c;
}

// Ghost fire: deep teal at the tips, through pale sea green, to bone white.
vec3 spectral(float t) {
  vec3 c = vec3(0.0);
  c = mix(c, vec3(0.03, 0.06, 0.07), smoothstep(0.0, 0.3, t));
  c = mix(c, vec3(0.09, 0.22, 0.24), smoothstep(0.25, 0.55, t));
  c = mix(c, vec3(0.3, 0.52, 0.52), smoothstep(0.5, 0.76, t));
  c = mix(c, vec3(0.68, 0.84, 0.8), smoothstep(0.72, 0.92, t));
  c = mix(c, vec3(0.93, 0.98, 0.92), smoothstep(0.9, 1.0, t));
  return c;
}

// Flames burning off an edge. p: position in CSS pixels, rise: distance from the edge,
// along: position along it, reach: how far the tallest tongues go. The noise always
// moves up the screen, because fire rises whichever edge it burns on.
float flame(vec2 p, float rise, float along, float reach, float seed) {
  float t = u_time;
  // Turbulence moving up the screen, warped so it curls.
  vec2 q = p / vec2(24.0, 20.0);
  vec2 warp = vec2(
    fbm(q * 0.8 + vec2(seed, -t * 0.9)),
    fbm(q * 0.8 + vec2(seed + 5.2, -t * 1.2))
  ) - 0.5;
  float turb = fbm(q + warp * 1.4 + vec2(seed, -t * 2.1));
  // Tongues: neighbouring flames of different heights that grow and shrink.
  float tongue = fbm(vec2(along / 26.0 + seed, t * 0.55));
  float height = reach * (0.25 + 1.5 * tongue * tongue) * (0.55 + 0.9 * turb);
  float body = 1.0 - rise / max(height, 0.001);
  // The very base burns a little cooler than just above it, as real flames do.
  float base = 0.72 + 0.28 * smoothstep(0.0, 5.0, rise);
  return clamp(body * base * (0.55 + 0.9 * turb) * 1.4, 0.0, 1.0);
}

float embers(vec2 p) {
  float glow = 0.0;
  for (int layer = 0; layer < 2; layer++) {
    float l = float(layer);
    vec2 cell = vec2(22.0, 30.0) * (1.0 + l * 0.7);
    vec2 q = p;
    q.y -= u_time * (26.0 + 16.0 * l);
    q.x += sin(q.y * 0.045 + l * 2.0) * 5.0;
    vec2 id = floor(q / cell);
    float chance = hash(id + l * 7.1);
    vec2 at = (id + 0.2 + 0.6 * vec2(hash(id * 1.37 + 3.1), hash(id * 0.71 + 8.4))) * cell;
    float flicker = 0.55 + 0.45 * sin(u_time * (7.0 + 5.0 * chance) + chance * 40.0);
    float size = 1.3 + 1.1 * hash(id + 2.2);
    glow += step(0.7, chance) * flicker * smoothstep(size, 0.0, length(q - at)) * 1.4;
  }
  return glow;
}

void main() {
  vec2 p = gl_FragCoord.xy / u_px;          // CSS pixels, origin bottom left
  vec2 size = u_res / u_px;
  float left = p.x;
  float right = size.x - p.x;
  float bottom = p.y;
  float top = size.y - p.y;
  float side = min(left, right);

  // Nothing burns in the middle of the panel.
  if (bottom > 120.0 && side > 34.0 && top > 14.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float power = 0.35 + 0.65 * u_power;

  // Bottom edge: the main fire.
  float f = flame(p, bottom, p.x, 34.0 * power, 0.0);

  // Sides: flames hug the wall, tallest at the bottom corners, dying out higher up.
  float climb = 1.0 - smoothstep(size.y * 0.08, size.y * (0.3 + 0.2 * u_power), bottom);
  f = max(f, flame(p, left, p.y, 13.0 * power, 11.0) * climb);
  f = max(f, flame(p, right, p.y, 13.0 * power, 23.0) * climb);

  // Most of the fire burns orange and yellow; only a few spots get white hot.
  float hot = smoothstep(0.55, 0.8, fbm(p / 26.0 + vec2(0.0, -u_time * 1.2)));
  float temp = f * (0.8 + 0.22 * hot);
  vec3 color = mix(heat(temp), spectral(temp), u_ghost);

  // The glow the fire throws on the frame, breathing slowly.
  float breathe = 0.75 + 0.25 * fbm(vec2(u_time * 0.6, 3.0));
  float glow = exp(-bottom / 16.0) * 0.32 + exp(-side / 8.0) * 0.16 * climb + exp(-top / 5.0) * 0.07;
  color += mix(vec3(0.85, 0.22, 0.04), vec3(0.16, 0.34, 0.34), u_ghost) * glow * breathe * power;

  // Embers drifting up near the edges.
  float near = (1.0 - smoothstep(30.0, 150.0, bottom)) * max(
    1.0 - smoothstep(10.0, 34.0, side),
    1.0 - smoothstep(10.0, 60.0, bottom)
  );
  color += mix(vec3(1.0, 0.6, 0.2), vec3(0.72, 0.92, 0.88), u_ghost) * embers(p) * near * power;

  gl_FragColor = vec4(color, 1.0);
}
`;

/** Canvas pixels per CSS pixel. Fire is soft, so a little under full resolution is plenty. */
const RESOLUTION = 0.75;

type Uniform = 'res' | 'px' | 'time' | 'power' | 'ghost';

/** Random bytes from a fixed seed, so the fire looks the same every time. */
function noiseData(): Uint8Array {
  const data = new Uint8Array(NOISE_SIZE * NOISE_SIZE);
  let x = 0x9e3779b9;
  for (let i = 0; i < data.length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    data[i] = x & 255;
  }
  return data;
}

export class FireFrame {
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private uniforms: Record<Uniform, WebGLUniformLocation | null> | null = null;
  /** Animation frame of the running fire. */
  private frame = 0;
  /** Animation frame of the wait for the shader to finish compiling. */
  private compiling = 0;
  private started = performance.now();
  private power = 1;
  private target = 1;
  private ghost = 0;
  private primed = false;
  private lastDraw = 0;
  private readonly still: boolean;
  private readonly observer: ResizeObserver;

  /** Returns null when WebGL is not available, in which case there is simply no fire. */
  static create(canvas: HTMLCanvasElement): FireFrame | null {
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    });
    if (!gl) return null;
    try {
      return new FireFrame(canvas, gl);
    } catch {
      return null;
    }
  }

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext,
  ) {
    this.gl = gl;
    // Nothing here may ask the GPU about the program: any such question waits for the
    // compile to finish, which is the stall this is built to avoid.
    const program = gl.createProgram()!;
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, FRAGMENT],
    ] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    // Fixed before linking, so it never has to be looked up.
    gl.bindAttribLocation(program, 0, 'a_pos');
    gl.linkProgram(program);
    this.program = program;

    // One triangle that covers the canvas.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      NOISE_SIZE,
      NOISE_SIZE,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      noiseData(),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    document.addEventListener('visibilitychange', this.onVisibility);
    canvas.addEventListener('webglcontextlost', this.stop);
    this.resize();

    const parallel = gl.getExtension('KHR_parallel_shader_compile');
    if (parallel) this.waitForCompile(parallel.COMPLETION_STATUS_KHR);
    else this.compiled();
  }

  /** Checks once a frame whether the background compile is done, without waiting on it. */
  private waitForCompile(status: number): void {
    const check = () => {
      if (this.gl.getProgramParameter(this.program, status)) {
        this.compiling = 0;
        this.compiled();
      } else {
        this.compiling = requestAnimationFrame(check);
      }
    };
    this.compiling = requestAnimationFrame(check);
  }

  private compiled(): void {
    const { gl, program } = this;
    // A shader that fails to build simply leaves the edges without fire.
    if (gl.isContextLost() || !gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'u_noise'), 0);
    this.uniforms = {
      res: gl.getUniformLocation(program, 'u_res'),
      px: gl.getUniformLocation(program, 'u_px'),
      time: gl.getUniformLocation(program, 'u_time'),
      power: gl.getUniformLocation(program, 'u_power'),
      ghost: gl.getUniformLocation(program, 'u_ghost'),
    };
    this.started = performance.now();
    if (this.still) this.draw(2.5);
    else if (!document.hidden) this.frame = requestAnimationFrame(this.tick);
    // Fade in from the first frame (see .fire.lit).
    requestAnimationFrame(() => this.canvas.classList.add('lit'));
  }

  /** True once the shader is built and frames can be drawn. */
  get ready(): boolean {
    return this.uniforms !== null;
  }

  /** 0 for embers only, 1 for a full fire. Changes ease in over about a second. */
  setPower(power: number): void {
    this.target = Math.min(1, Math.max(0, power));
    // The first value applies at once, so the fire does not flare up on opening.
    if (!this.primed) {
      this.primed = true;
      this.power = this.target;
    }
    if (this.still) {
      this.power = this.target;
      this.draw(2.5);
    }
  }

  setGhost(ghost: boolean): void {
    this.ghost = ghost ? 1 : 0;
    if (this.still) this.draw(2.5);
  }

  /** Draws one frame at a given time in seconds, for still images and tests. */
  draw(seconds: number): void {
    const { gl, canvas, uniforms } = this;
    if (!uniforms) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uniforms.res, canvas.width, canvas.height);
    gl.uniform1f(uniforms.px, canvas.width / Math.max(1, canvas.clientWidth));
    gl.uniform1f(uniforms.time, seconds);
    gl.uniform1f(uniforms.power, this.power);
    gl.uniform1f(uniforms.ghost, this.ghost);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy(): void {
    this.stop();
    cancelAnimationFrame(this.compiling);
    this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  private resize(): void {
    const scale = Math.min(devicePixelRatio, 2) * RESOLUTION;
    const width = Math.max(1, Math.round(this.canvas.clientWidth * scale));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * scale));
    if (width === this.canvas.width && height === this.canvas.height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.still) this.draw(2.5);
  }

  private readonly tick = (now: number): void => {
    const dt = Math.min(0.1, (now - (this.lastDraw || now)) / 1000);
    this.lastDraw = now;
    this.power += (this.target - this.power) * Math.min(1, dt * 2.5);
    this.draw((now - this.started) / 1000);
    this.frame = requestAnimationFrame(this.tick);
  };

  private readonly stop = (): void => {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) this.stop();
    else if (this.ready && !this.still && !this.frame) {
      this.lastDraw = 0;
      this.frame = requestAnimationFrame(this.tick);
    }
  };
}
