import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ARCH_RX, ARCH_RZ, LOWER_GUM_Y, TEETH, type ToothDef, UPPER_GUM_Y, zonesForTooth } from '../game/mouth';
import { runtime } from '../game/runtime';
import { GradientBackdropMaterial, ToothMaterial, toon } from './materials';

/**
 * Cute tooth shapes: a well-rounded crown that bellies out in the middle,
 * narrows towards the gum, with soft cusps on molars and a gentle edge on
 * incisors. Local +Y is the chewing surface, local +Z the outside.
 */
function toothGeometry(t: ToothDef): THREE.BufferGeometry {
  const [w, h, d] = t.size;
  const radius = Math.min(w, d) * (t.kind === 'incisor' ? 0.36 : 0.45);
  const geo = new RoundedBoxGeometry(w, h, d, 6, radius);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = y / h + 0.5; // 0 at the gum, 1 at the chewing edge
    // belly in the middle, neck towards the gum
    let k = 0.86 + 0.18 * Math.sin(Math.PI * Math.min(1, u * 1.1));
    if (t.kind === 'canine' && u > 0.55) k *= 1 - (u - 0.55) * 0.9;
    if (t.kind === 'incisor' && u > 0.5) k *= 1 - (u - 0.5) * 0.25;
    let nx = x * k;
    let nz = z * (t.kind === 'incisor' && u > 0.5 ? k * (1 - (u - 0.5) * 0.5) : k);
    let ny = y;
    if ((t.kind === 'molar' || t.kind === 'premolar') && y > h * 0.3) {
      // soft cusps
      const bump = Math.cos((x / w) * Math.PI * 2) * Math.cos((z / d) * Math.PI * 2);
      ny = y - 0.03 + bump * 0.035;
    }
    pos.setXYZ(i, nx, ny, nz);
    void nx;
    void nz;
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function Tooth({ def }: { def: ToothDef }) {
  const material = useMemo(() => new ToothMaterial(), []);
  const geometry = useMemo(() => toothGeometry(def), [def]);
  const zones = useMemo(() => zonesForTooth(def), [def]);
  const rotation = useMemo<[number, number, number]>(() => {
    const yaw = Math.atan2(def.outward[0], def.outward[2]);
    return def.row === 'upper' ? [Math.PI, -yaw, 0] : [0, yaw, 0];
  }, [def]);

  useFrame((state) => {
    const u = material.uniforms;
    u.uCleanOuter.value = runtime.zoneClean[zones.outside];
    u.uCleanInner.value = runtime.zoneClean[zones.inside];
    u.uTime.value = state.clock.elapsedTime;
  });

  return <mesh geometry={geometry} material={material} position={def.pos} rotation={rotation} />;
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

const GUM = '#f6a9c4';
const GUM_DEEP = '#ef93b4';
const LIP = '#f08bb3';
const TONGUE = '#f47c9d';

function Gums() {
  const gumMat = useMemo(() => toon(GUM), []);
  const gumDark = useMemo(() => toon(GUM_DEEP), []);
  const upper = useMemo(() => new THREE.TubeGeometry(archCurve(UPPER_GUM_Y + 0.32, 1.0), 48, 0.6, 16, false), []);
  const lower = useMemo(() => new THREE.TubeGeometry(archCurve(LOWER_GUM_Y - 0.32, 1.0), 48, 0.6, 16, false), []);
  const upperInner = useMemo(() => new THREE.TubeGeometry(archCurve(UPPER_GUM_Y + 0.55, 0.78), 40, 0.5, 12, false), []);
  const lowerInner = useMemo(() => new THREE.TubeGeometry(archCurve(LOWER_GUM_Y - 0.55, 0.78), 40, 0.5, 12, false), []);
  return (
    <group>
      <mesh geometry={upper} material={gumMat} />
      <mesh geometry={lower} material={gumMat} />
      <mesh geometry={upperInner} material={gumDark} />
      <mesh geometry={lowerInner} material={gumDark} />
      {/* palate */}
      <mesh position={[0, UPPER_GUM_Y + 1.1, -0.6]} scale={[2.9, 0.9, 2.9]} material={gumDark}>
        <sphereGeometry args={[1, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, UPPER_GUM_Y + 1.1, -0.6]} rotation={[Math.PI, 0, 0]} scale={[2.9, 0.2, 2.9]} material={gumDark}>
        <sphereGeometry args={[1, 28, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* floor of the mouth */}
      <mesh position={[0, LOWER_GUM_Y - 1.0, -0.6]} rotation={[Math.PI, 0, 0]} scale={[2.9, 0.8, 2.9]} material={gumDark}>
        <sphereGeometry args={[1, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  );
}

function Tongue() {
  const mat = useMemo(() => toon(TONGUE), []);
  const tip = useMemo(() => toon('#f78fac'), []);
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = LOWER_GUM_Y - 0.25 + Math.sin(t * 1.3) * 0.04;
    ref.current.rotation.x = -0.15 + Math.sin(t * 0.9) * 0.03;
  });
  return (
    <group ref={ref} position={[0, LOWER_GUM_Y - 0.25, -0.8]}>
      <mesh scale={[1.9, 0.5, 2.4]} material={mat}>
        <sphereGeometry args={[1, 32, 20]} />
      </mesh>
      {/* glossy highlight blob + friendly rounded tip */}
      <mesh position={[0, 0.35, 1.6]} scale={[1.2, 0.35, 0.9]} material={tip}>
        <sphereGeometry args={[1, 20, 12]} />
      </mesh>
      <mesh position={[-0.5, 0.42, 0.4]} scale={[0.5, 0.08, 0.7]} material={tip}>
        <sphereGeometry args={[1, 14, 10]} />
      </mesh>
    </group>
  );
}

function Lips() {
  const mat = useMemo(() => toon(LIP), []);
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
  const mat = useMemo(() => new GradientBackdropMaterial('#ffd3e4', '#b7628e'), []);
  return (
    <mesh material={mat} position={[0, 0, -2]}>
      <sphereGeometry args={[18, 32, 24]} />
    </mesh>
  );
}

export function Arena() {
  return (
    <group>
      <Backdrop />
      <Gums />
      <Lips />
      <Tongue />
      {TEETH.map((t) => (
        <Tooth key={t.index} def={t} />
      ))}
    </group>
  );
}

export function Lights() {
  return (
    <>
      <hemisphereLight args={['#fff6fa', '#d98ab0', 0.95]} />
      <directionalLight position={[4, 8, 6]} intensity={1.25} color="#fff7ec" />
      <directionalLight position={[-6, 2, 4]} intensity={0.55} color="#cfe6ff" />
      <pointLight position={[0, 0.4, 3]} intensity={1.4} distance={10} color="#ffe3ef" />
    </>
  );
}
