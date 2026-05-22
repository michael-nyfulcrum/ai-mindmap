import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

const vertex = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amp * noise(p);
    p = mat2(1.62, -1.18, 1.18, 1.62) * p + 3.4;
    amp *= 0.5;
  }
  return value;
}

float stars(vec2 uv, float scale, float speed) {
  vec2 p = uv * scale + vec2(uTime * speed, -uTime * speed * 0.42);
  vec2 cell = floor(p);
  vec2 local = fract(p) - 0.5;
  float rnd = hash(cell);
  float star = smoothstep(0.038, 0.0, length(local));
  float glow = smoothstep(0.13, 0.0, length(local)) * 0.1;
  float twinkle = 0.62 + 0.38 * sin(uTime * (0.38 + rnd * 1.12) + rnd * 6.28);
  return (star + glow) * step(0.964, rnd) * twinkle;
}

void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 p = (uv - 0.5) * aspect;

  float t = uTime * 0.12;
  float radius = length(p);
  float angle = atan(p.y, p.x);
  float swirl = angle + radius * 6.2 - t * 4.6;
  float arm = pow(sin(swirl * 2.0) * 0.5 + 0.5, 1.6);
  float arm2 = pow(sin(swirl * 2.0 + 2.15) * 0.5 + 0.5, 2.2);
  float core = exp(-dot(p, p) * 5.4);
  float disk = exp(-radius * 1.35);
  float cloudA = fbm(p * 2.35 + vec2(t * 1.8, -t * 1.1));
  float cloudB = fbm(p * 3.45 + vec2(-t * 1.2, t * 1.7));
  float galaxyArms = (arm * 0.52 + arm2 * 0.26) * disk;
  float nebula = smoothstep(0.2, 0.88, cloudA * 0.42 + cloudB * 0.28 + galaxyArms * 0.54 + core * 0.48);
  float darkPockets = smoothstep(0.24, 0.72, fbm(p * 1.45 + vec2(-2.4, 5.1)));

  vec3 deep = vec3(0.022, 0.034, 0.074);
  vec3 blue = vec3(0.13, 0.46, 0.78);
  vec3 violet = vec3(0.36, 0.2, 0.72);
  vec3 pink = vec3(0.76, 0.24, 0.58);
  vec3 mint = vec3(0.2, 0.74, 0.6);

  vec3 color = deep;
  color = mix(color, blue, nebula * 0.34);
  color = mix(color, violet, smoothstep(0.1, 0.82, cloudB) * 0.26);
  color = mix(color, pink, galaxyArms * 0.42);
  color = mix(color, mint, core * 0.14);

  color *= mix(0.58, 1.0, darkPockets);

  float starField = stars(uv, 36.0, 0.006) + stars(uv + 0.27, 68.0, -0.005) * 0.68 + stars(uv + 0.61, 98.0, 0.004) * 0.32;
  float brightStars = stars(uv + vec2(0.13, -0.21), 18.0, -0.003);
  color += vec3(starField) * vec3(0.76, 0.84, 0.94);
  color += vec3(brightStars) * vec3(0.9, 0.76, 0.56) * 0.92;
  color += core * vec3(0.18, 0.17, 0.3);
  color += galaxyArms * vec3(0.06, 0.09, 0.16);

  float vignette = smoothstep(0.92, 0.18, length(p));
  color *= 0.62 + vignette * 0.42;

  gl_FragColor = vec4(color, 0.84);
}
`;

export function GalaxyBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new Renderer({
      canvas,
      alpha: true,
      antialias: false,
      depth: false,
      dpr: Math.min(window.devicePixelRatio || 1, 1.5),
      powerPreference: "low-power",
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: [1, 1] },
    };
    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(Math.max(1, width), Math.max(1, height));
      uniforms.uResolution.value = [Math.max(1, width), Math.max(1, height)];
    };

    let frame = 0;
    let start = performance.now();
    const render = (time: number) => {
      uniforms.uTime.value = (time - start) / 1000;
      renderer.render({ scene: mesh });
      if (!reducedMotion) {
        frame = window.requestAnimationFrame(render);
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    if (reducedMotion) {
      start = performance.now();
      render(start + 1200);
    } else {
      frame = window.requestAnimationFrame(render);
    }

    return () => {
      observer.disconnect();
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      program.remove();
    };
  }, []);

  return (
    <div className="galaxy-background" aria-hidden="true" ref={containerRef}>
      <canvas ref={canvasRef} />
      <div className="galaxy-background-fallback" />
    </div>
  );
}
