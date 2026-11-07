import * as THREE from 'three';
import { CELLS_PER_TOOTH, CELLS_U, CELLS_V, SURFACES } from '../game/plaque';

let gradient: THREE.DataTexture | null = null;

/** Soft 4-step gradient map that gives MeshToonMaterial a gentle cel-shaded look (heroes). */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([120, 175, 225, 255]);
  gradient = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

export function toon(color: THREE.ColorRepresentation, extra: Partial<THREE.MeshToonMaterialParameters> = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });
}

export function glow(color: THREE.ColorRepresentation, intensity = 2.2): THREE.MeshBasicMaterial {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
}

/** Per-tooth plaque texture: 8 cells wide × 12 rows (outer 0–3, inner 4–7, chewing 8–11), 255 = clean. */
export function createPlaqueTexture(): THREE.DataTexture {
  const data = new Uint8Array(CELLS_PER_TOOTH);
  const tex = new THREE.DataTexture(data, CELLS_U, CELLS_V * SURFACES.length, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const PLAQUE_GLSL_COMMON = `
  uniform sampler2D uPlaque;
  uniform vec3 uToothSize;
  uniform float uFlipU;
  uniform vec3 uTint;
  uniform float uPlaqueStrength;
  varying vec3 vObjPos;
  varying vec3 vObjNormal;

  // cleanliness 0..1 at this fragment, and the gum→edge coordinate of wall surfaces
  vec2 hbPlaque() {
    vec3 n = normalize(vObjNormal);
    float u = vObjPos.x / uToothSize.x + 0.5;
    u = mix(u, 1.0 - u, uFlipU);
    float band;
    float v;
    float gumV = 0.0;
    if (n.y > 0.55) {
      band = 2.0;
      v = vObjPos.z / uToothSize.z + 0.5;
    } else {
      band = n.z >= 0.0 ? 0.0 : 1.0;
      v = vObjPos.y / uToothSize.y + 0.5;
      gumV = 1.0 - v;
    }
    v = clamp(v, 0.0, 1.0);
    float ty = (band * 4.0 + 0.5 + v * 3.0) / 12.0;
    float clean = texture2D(uPlaque, vec2(clamp(u, 0.03, 0.97), ty)).r;
    return vec2(clean, gumV);
  }
`;

/**
 * Enamel: physically based (clearcoat sheen, slight ivory variation, a touch of
 * translucency at the incisal edge) with a thin yellowish plaque film driven by
 * the per-cell plaque texture. Local +X runs along the row, +Y towards the
 * chewing edge, +Z towards the lips/cheeks.
 */
export class EnamelMaterial extends THREE.MeshPhysicalMaterial {
  readonly uniforms: {
    uPlaque: { value: THREE.DataTexture };
    uToothSize: { value: THREE.Vector3 };
    uFlipU: { value: number };
    uTint: { value: THREE.Color };
    uPlaqueStrength: { value: number };
  };

  constructor(plaque: THREE.DataTexture, size: [number, number, number], flipU: boolean, tint: THREE.ColorRepresentation, highQuality: boolean) {
    super({
      color: '#ece4d2',
      roughness: 0.38,
      metalness: 0,
      clearcoat: highQuality ? 0.35 : 0,
      clearcoatRoughness: 0.3,
      envMapIntensity: highQuality ? 0.35 : 0.25,
    });
    this.uniforms = {
      uPlaque: { value: plaque },
      uToothSize: { value: new THREE.Vector3(size[0], size[1], size[2]) },
      uFlipU: { value: flipU ? 1 : 0 },
      uTint: { value: new THREE.Color(tint) },
      uPlaqueStrength: { value: 1 },
    };
    this.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n varying vec3 vObjPos;\n varying vec3 vObjNormal;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n vObjPos = position;\n vObjNormal = normal;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${PLAQUE_GLSL_COMMON}`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           vec2 pq = hbPlaque();
           float film = (1.0 - pq.x) * uPlaqueStrength;
           film *= 0.5 + 0.5 * smoothstep(0.0, 0.35, pq.y + 0.25) ;
           film = clamp(film * (1.0 + 0.7 * smoothstep(0.55, 1.0, pq.y)), 0.0, 1.0);
           vec3 enamel = diffuseColor.rgb * uTint;
           // slightly cooler, more translucent-looking incisal edge
           float edge = smoothstep(0.72, 1.0, 1.0 - pq.y) * step(0.5, 1.0 - step(0.55, normalize(vObjNormal).y));
           enamel = mix(enamel, vec3(0.86, 0.9, 0.94), edge * 0.28);
           vec3 plaqueColor = vec3(0.89, 0.83, 0.58);
           diffuseColor.rgb = mix(enamel, plaqueColor, film * 0.62);`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
           roughnessFactor = clamp(roughnessFactor + film * 0.4, 0.0, 1.0);`,
        );
    };
    this.customProgramCacheKey = () => `hero-brush-enamel-${highQuality ? 'hq' : 'lq'}`;
  }
}

/** Vertical gradient sphere used as the mouth backdrop (seen from the inside). */
export class GradientBackdropMaterial extends THREE.ShaderMaterial {
  constructor(top: THREE.ColorRepresentation, bottom: THREE.ColorRepresentation) {
    super({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(top) },
        uBottom: { value: new THREE.Color(bottom) },
      },
      vertexShader: `
        varying float vY;
        void main() {
          vY = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        varying float vY;
        void main() {
          float k = smoothstep(-0.8, 0.9, vY);
          gl_FragColor = vec4(mix(uBottom, uTop, k), 1.0);
          #include <colorspace_fragment>
        }`,
    });
  }
}
