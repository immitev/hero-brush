/**
 * The giant mouth: anatomically shaped teeth (incisors, canines, premolars,
 * molars) with enamel + plaque film, scalloped gums with papillae, tongue and
 * lips. Built procedurally so the app stays offline and small.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ARCH_RX, ARCH_RZ, LOWER_GUM_Y, TEETH, TONGUE_CENTER, TONGUE_HALF, type ToothDef, UPPER_GUM_Y, gumSign } from '../game/mouth';
import { writeToothImage } from '../game/plaque';
import { runtime } from '../game/runtime';
import { EnamelMaterial, GradientBackdropMaterial, createPlaqueTexture } from './materials';

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Crown shape per tooth kind. Local frame: +X along the row, +Y towards the
 * chewing edge (−h/2 is the gumline), +Z towards the lips/cheek.
 */
function toothGeometry(t: ToothDef, highQuality: boolean): THREE.BufferGeometry {
  const [w, h, d] = t.size;
  const radius = Math.min(w, d) * (t.kind === 'incisor' ? 0.3 : 0.4);
  let geo: THREE.BufferGeometry = new RoundedBoxGeometry(w, h, d, highQuality ? 8 : 5, radius);
  geo = mergeVertices(geo, 1e-4);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = y / h + 0.5; // 0 gumline .. 1 chewing edge
    // cervical neck + a bellied crown
    let s = 0.82 + 0.18 * smoothstep(0, 0.35, u);
    s *= 1 + 0.08 * Math.sin(Math.PI * Math.min(1, u * 1.15));
    let nx = x * s;
    let nz = z * s;
    let ny = y;
    const top = smoothstep(0.74, 1.0, u); // the chewing/incisal end
    if (t.kind === 'incisor') {
      nx *= 0.76 + 0.3 * u; // shovel: wider at the edge
      nz *= 1 - 0.5 * u; // and thinner
      if (z > 0) nz += 0.045 * Math.sin(Math.PI * u); // labial convexity
      ny -= top * 0.03 * Math.abs(x / (w / 2)); // slightly rounded corners of the edge
    } else if (t.kind === 'canine') {
      const k = Math.max(0, u - 0.4) / 0.6;
      nx *= 1 - 0.5 * k * k;
      nz *= 1 - 0.3 * k;
      ny += top * 0.08 * (1 - Math.abs(x / (w / 2))); // a single cusp
    } else if (t.kind === 'premolar') {
      const cusps = Math.abs(Math.cos((Math.PI * z) / d)); // buccal + lingual cusps
      const groove = Math.exp(-((z / 0.11) * (z / 0.11)));
      ny += top * (0.07 * cusps - 0.05 * groove);
    } else {
      const cusps = Math.abs(Math.sin((2 * Math.PI * x) / w)) * Math.abs(Math.sin((2 * Math.PI * z) / d)); // four cusps
      const grooves = Math.exp(-((x / 0.1) * (x / 0.1))) + Math.exp(-((z / 0.1) * (z / 0.1)));
      ny += top * (0.075 * cusps - 0.035 * grooves);
    }
    pos.setXYZ(i, nx, ny, nz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Rotation that maps local +X/+Y/+Z to (row direction, towards the edge, outward). */
function toothQuaternion(t: ToothDef): THREE.Quaternion {
  const gs = gumSign(t);
  const x = new THREE.Vector3(...t.tangent).multiplyScalar(-gs); // keep the basis right-handed
  const y = new THREE.Vector3(0, -gs, 0);
  const z = new THREE.Vector3(...t.outward);
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/** Subtle ivory variation per tooth. */
function toothTint(t: ToothDef): THREE.Color {
  const k = ((t.index * 7919) % 97) / 97;
  return new THREE.Color().setHSL(0.11 - k * 0.02, 0.2 + k * 0.1, 0.84 - k * 0.04);
}

function Tooth({ def, highQuality }: { def: ToothDef; highQuality: boolean }) {
  const plaqueTex = useMemo(() => createPlaqueTexture(), []);
  const material = useMemo(
    () => new EnamelMaterial(plaqueTex, def.size, def.row === 'upper', toothTint(def), highQuality),
    [plaqueTex, def, highQuality],
  );
  const geometry = useMemo(() => toothGeometry(def, highQuality), [def, highQuality]);
  const quaternion = useMemo(() => toothQuaternion(def), [def]);
  const scratch = useMemo(() => new Uint8Array(96), []);

  useFrame(() => {
    const p = runtime.plaque;
    if (p.changed[def.index]) {
      p.changed[def.index] = 0;
      writeToothImage(p, def.index, scratch);
      (plaqueTex.image.data as Uint8Array).set(scratch);
      plaqueTex.needsUpdate = true;
    }
  });

  return <mesh geometry={geometry} material={material} position={def.pos} quaternion={quaternion} />;
}

function archCurve(y: number, scale = 1, lift = 0): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const span = 190;
  for (let i = 0; i <= 24; i++) {
    const a = ((-span / 2 + (i * span) / 24) * Math.PI) / 180;
    pts.push(new THREE.Vector3(ARCH_RX * scale * Math.sin(a), y + lift * Math.abs(Math.sin(a)), ARCH_RZ * scale * Math.cos(a)));
  }
  return new THREE.CatmullRomCurve3(pts);
}

const GUM = '#e8a0b6';
const GUM_DEEP = '#d98aa4';
const GUM_MARGIN = '#d27d9b';
const LIP = '#de8aa6';
const TONGUE = '#df7b95';

function gumMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, envMapIntensity: 0.3 });
}

function Gums({ highQuality }: { highQuality: boolean }) {
  const gum = useMemo(() => gumMaterial(GUM), []);
  const deep = useMemo(() => gumMaterial(GUM_DEEP), []);
  const margin = useMemo(() => gumMaterial(GUM_MARGIN), []);
  const seg = highQuality ? 64 : 40;
  const upper = useMemo(() => new THREE.TubeGeometry(archCurve(UPPER_GUM_Y + 0.34, 1.0), seg, 0.58, 18, false), [seg]);
  const lower = useMemo(() => new THREE.TubeGeometry(archCurve(LOWER_GUM_Y - 0.34, 1.0), seg, 0.58, 18, false), [seg]);
  const upperInner = useMemo(() => new THREE.TubeGeometry(archCurve(UPPER_GUM_Y + 0.55, 0.78), 40, 0.5, 12, false), []);
  const lowerInner = useMemo(() => new THREE.TubeGeometry(archCurve(LOWER_GUM_Y - 0.55, 0.78), 40, 0.5, 12, false), []);
  // scalloped gumline: a collar around every tooth neck + papillae between neighbours
  const collars = useMemo(
    () =>
      TEETH.map((t) => {
        const gs = gumSign(t);
        const y = t.pos[1] + gs * (t.size[1] / 2 - 0.1);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
        const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(t.outward[0], t.outward[2]));
        return { pos: [t.pos[0], y, t.pos[2]] as [number, number, number], quat: yaw.multiply(q), scale: [t.size[0] / 2 + 0.08, t.size[2] / 2 + 0.08, 1] as [number, number, number] };
      }),
    [],
  );
  const papillae = useMemo(() => {
    const out: [number, number, number][] = [];
    for (const row of ['upper', 'lower'] as const) {
      const teeth = TEETH.filter((t) => t.row === row);
      for (let i = 0; i + 1 < teeth.length; i++) {
        const a = teeth[i];
        const b = teeth[i + 1];
        const gs = gumSign(a);
        out.push([(a.pos[0] + b.pos[0]) / 2, (a.pos[1] + b.pos[1]) / 2 + gs * (a.size[1] / 2 - 0.02), (a.pos[2] + b.pos[2]) / 2]);
      }
    }
    return out;
  }, []);
  return (
    <group>
      <mesh geometry={upper} material={gum} />
      <mesh geometry={lower} material={gum} />
      <mesh geometry={upperInner} material={deep} />
      <mesh geometry={lowerInner} material={deep} />
      {collars.map((c, i) => (
        <mesh key={`c${i}`} position={c.pos} quaternion={c.quat} scale={c.scale} material={margin}>
          <torusGeometry args={[1, 0.3, 8, 22]} />
        </mesh>
      ))}
      {papillae.map((p, i) => (
        <mesh key={`p${i}`} position={p} material={gum}>
          <sphereGeometry args={[0.16, 12, 10]} />
        </mesh>
      ))}
      {/* palate */}
      <mesh position={[0, UPPER_GUM_Y + 1.1, -0.6]} scale={[2.9, 0.9, 2.9]} material={deep}>
        <sphereGeometry args={[1, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, UPPER_GUM_Y + 1.1, -0.6]} rotation={[Math.PI, 0, 0]} scale={[2.9, 0.2, 2.9]} material={deep}>
        <sphereGeometry args={[1, 28, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* floor of the mouth */}
      <mesh position={[0, LOWER_GUM_Y - 1.0, -0.6]} rotation={[Math.PI, 0, 0]} scale={[2.9, 0.8, 2.9]} material={deep}>
        <sphereGeometry args={[1, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  );
}

function Tongue() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: TONGUE, roughness: 0.55, envMapIntensity: 0.3 }), []);
  const groove = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d96d8b', roughness: 0.6 }), []);
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = TONGUE_CENTER[1] + Math.sin(t * 1.3) * 0.03;
  });
  return (
    <group ref={ref} position={TONGUE_CENTER}>
      <mesh scale={TONGUE_HALF} material={mat}>
        <sphereGeometry args={[1, 36, 24]} />
      </mesh>
      {/* median groove */}
      <mesh position={[0, TONGUE_HALF[1] - 0.02, -0.3]} scale={[0.09, 0.05, 1.6]} material={groove}>
        <sphereGeometry args={[1, 10, 8]} />
      </mesh>
    </group>
  );
}

function Lips() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: LIP, roughness: 0.5, envMapIntensity: 0.3 }), []);
  const upper = useMemo(() => new THREE.TubeGeometry(archCurve(UPPER_GUM_Y + 1.25, 1.36, -0.1), 48, 0.42, 14, false), []);
  const lower = useMemo(() => new THREE.TubeGeometry(archCurve(LOWER_GUM_Y - 1.25, 1.36, 0.1), 48, 0.42, 14, false), []);
  return (
    <group>
      <mesh geometry={upper} material={mat} />
      <mesh geometry={lower} material={mat} />
    </group>
  );
}

function Backdrop() {
  const mat = useMemo(() => new GradientBackdropMaterial('#ffd9e6', '#b86d95'), []);
  return (
    <mesh material={mat} position={[0, 0, -2]}>
      <sphereGeometry args={[18, 32, 24]} />
    </mesh>
  );
}

export function Arena({ highQuality }: { highQuality: boolean }) {
  return (
    <group>
      <Backdrop />
      <Gums highQuality={highQuality} />
      <Lips />
      <Tongue />
      {TEETH.map((t) => (
        <Tooth key={t.index} def={t} highQuality={highQuality} />
      ))}
    </group>
  );
}

export function Lights() {
  return (
    <>
      {/* kept low: the enamel is near-white, so anything brighter blows the teeth out */}
      <hemisphereLight args={['#fff1f6', '#b86d8f', 0.32]} />
      <directionalLight position={[4, 8, 6]} intensity={0.95} color="#fff7ec" />
      <directionalLight position={[-6, 2, 4]} intensity={0.3} color="#cfe6ff" />
      <pointLight position={[0, -0.6, 5]} intensity={0.25} distance={12} color="#ffe3ef" />
    </>
  );
}
