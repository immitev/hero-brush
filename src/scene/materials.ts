import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;

/** 4-step gradient map that gives MeshToonMaterial its cel-shaded look. */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([80, 150, 215, 255]);
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

/**
 * Tooth material: cel-shaded, with a `cleanliness` pair (outer/inner surface)
 * that fades procedural grime blotches and a yellow tint into glossy white with
 * twinkling sparkles. Local +Z must point outward (lip/cheek side) and local +Y
 * towards the chewing surface.
 */
export class ToothMaterial extends THREE.MeshToonMaterial {
  readonly uniforms = {
    uCleanOuter: { value: 0 },
    uCleanInner: { value: 0 },
    uTime: { value: 0 },
    uGrimeColor: { value: new THREE.Color('#8a7a2c') },
    uYellowColor: { value: new THREE.Color('#e9d98a') },
    uCleanColor: { value: new THREE.Color('#eef1f8') },
  };

  constructor() {
    super({ color: '#ffffff', gradientMap: toonGradient() });
    this.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vObjPos;
           varying vec3 vObjNormal;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vObjPos = position;
           vObjNormal = normal;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uCleanOuter;
           uniform float uCleanInner;
           uniform float uTime;
           uniform vec3 uGrimeColor;
           uniform vec3 uYellowColor;
           uniform vec3 uCleanColor;
           varying vec3 vObjPos;
           varying vec3 vObjNormal;
           float hbClean;
           float hb_hash(vec3 p) {
             p = fract(p * 0.3183099 + vec3(0.1, 0.17, 0.13));
             p *= 17.0;
             return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
           }
           float hb_noise(vec3 p) {
             vec3 i = floor(p);
             vec3 f = fract(p);
             f = f * f * (3.0 - 2.0 * f);
             return mix(
               mix(mix(hb_hash(i), hb_hash(i + vec3(1,0,0)), f.x), mix(hb_hash(i + vec3(0,1,0)), hb_hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hb_hash(i + vec3(0,0,1)), hb_hash(i + vec3(1,0,1)), f.x), mix(hb_hash(i + vec3(0,1,1)), hb_hash(i + vec3(1,1,1)), f.x), f.y),
               f.z);
           }`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float outerMask = smoothstep(-0.2, 0.3, vObjNormal.z);
           hbClean = mix(uCleanInner, uCleanOuter, outerMask);
           float n = hb_noise(vObjPos * 7.0) * 0.55 + hb_noise(vObjPos * 19.0) * 0.45;
           float th = 0.42 + hbClean * 0.66;
           float spots = smoothstep(th, th + 0.1, n);
           vec3 base = mix(uYellowColor, uCleanColor, smoothstep(0.0, 1.0, hbClean));
           base = mix(base, uGrimeColor, spots * 0.9);
           diffuseColor.rgb *= base;`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           vec3 hbView = normalize(vViewPosition);
           vec3 hbHalf = normalize(hbView + normalize(vec3(0.35, 0.9, 0.5)));
           float hbSpec = pow(max(dot(normal, hbHalf), 0.0), 56.0);
           float hbRim = pow(1.0 - max(dot(normal, hbView), 0.0), 3.0);
           float gloss = mix(0.12, 1.0, hbClean);
           totalEmissiveRadiance += vec3(hbSpec * 0.8 * gloss + hbRim * 0.1 * gloss);
           float tw = hb_hash(floor(vObjPos * 11.0) + floor(uTime * 3.0));
           float sp = step(0.982, tw) * smoothstep(0.8, 1.0, hbClean);
           totalEmissiveRadiance += vec3(1.6, 1.6, 1.8) * sp;`,
        );
    };
    // make sure three re-caches the program for this material
    this.customProgramCacheKey = () => 'hero-brush-tooth';
  }
}
