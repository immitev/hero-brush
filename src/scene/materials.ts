import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;

/** Soft 4-step gradient map that gives MeshToonMaterial a gentle cel-shaded look. */
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

/**
 * Tooth material: cel-shaded ivory with a `cleanliness` pair (outer/inner
 * surface). Dirty teeth are only lightly warm-tinted with a few soft, pale
 * plaque spots; clean teeth are bright white with gloss and twinkling sparkles.
 * Local +Z must point outward (lip/cheek side) and local +Y towards the chewing
 * surface.
 */
export class ToothMaterial extends THREE.MeshToonMaterial {
  readonly uniforms = {
    uCleanOuter: { value: 0 },
    uCleanInner: { value: 0 },
    uTime: { value: 0 },
    uSpotColor: { value: new THREE.Color('#e6d6a3') },
    uDirtyColor: { value: new THREE.Color('#f6efd8') },
    uCleanColor: { value: new THREE.Color('#fbfbff') },
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
           varying vec3 vObjNormal;
           varying vec3 vWorldPos;
           varying vec3 vWorldNormal;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vObjPos = position;
           vObjNormal = normal;
           vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
           vWorldNormal = normalize(mat3(modelMatrix) * normal);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uCleanOuter;
           uniform float uCleanInner;
           uniform float uTime;
           uniform vec3 uSpotColor;
           uniform vec3 uDirtyColor;
           uniform vec3 uCleanColor;
           varying vec3 vObjPos;
           varying vec3 vObjNormal;
           varying vec3 vWorldPos;
           varying vec3 vWorldNormal;
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
           // a few soft, round plaque spots that fade away as the tooth gets cleaner
           float n = hb_noise(vObjPos * 4.5 + 3.0);
           float th = 0.64 + hbClean * 0.5;
           float spots = smoothstep(th, th + 0.14, n) * 0.55;
           vec3 base = mix(uDirtyColor, uCleanColor, smoothstep(0.0, 1.0, hbClean));
           base = mix(base, uSpotColor, spots);
           diffuseColor.rgb *= base;`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           // glossy highlight from a fixed WORLD light (top-front), so undersides and
           // chewing surfaces seen from below do not light up when the camera looks up
           vec3 hbN = normalize(vWorldNormal);
           vec3 hbViewW = normalize(cameraPosition - vWorldPos);
           vec3 hbHalf = normalize(hbViewW + normalize(vec3(0.4, 1.0, 0.7)));
           float hbSpec = pow(max(dot(hbN, hbHalf), 0.0), 48.0);
           float hbRim = pow(1.0 - max(dot(hbN, hbViewW), 0.0), 3.0);
           float gloss = mix(0.3, 1.0, hbClean);
           totalEmissiveRadiance += vec3(hbSpec * 0.4 * gloss + hbRim * 0.05 * gloss);
           float tw = hb_hash(floor(vObjPos * 11.0) + floor(uTime * 3.0));
           float sp = step(0.982, tw) * smoothstep(0.8, 1.0, hbClean);
           totalEmissiveRadiance += vec3(1.6, 1.6, 1.8) * sp;`,
        );
    };
    this.customProgramCacheKey = () => 'hero-brush-tooth-v4';
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
