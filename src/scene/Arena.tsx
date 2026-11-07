import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ARCH_RX, ARCH_RZ, LOWER_GUM_Y, TEETH, type ToothDef, UPPER_GUM_Y, zonesForTooth } from '../game/mouth';
import { runtime } from '../game/runtime';
import { ToothMaterial, toon } from './materials';

function toothGeometry(t: ToothDef): THREE.BufferGeometry {
  const [w, h, d] = t.size;
  const radius = t.kind === 'molar' ? 0.22 : t.kind === 'incisor' ? 0.12 : 0.16;
  const geo = new RoundedBoxGeometry(w, h, d, 4, radius);
  if (t.kind === 'molar' || t.kind === 'premolar') {
    // chewing surface: dimple the top (local +Y) a little for cusps
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (y > h * 0.3) {
        const bump = Math.cos((x / w) * Math.PI * 2) * Math.cos((z / d) * Math.PI * 2);
        pos.setY(i, y - 0.05 + bump * 0.05);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  } else if (t.kind === 'canine') {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) {
        const k = 1 - (y / (h / 2)) * 0.45;
        pos.setX(i, pos.getX(i) * k);
        pos.setZ(i, pos.getZ(i) * k);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  } else {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) pos.setZ(i, pos.getZ(i) * (1 - (y / (h / 2)) * 0.35));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
  return geo;
}

function Tooth({ def }: { def: ToothDef }) {
  const material = useMemo(() => new ToothMaterial(), []);
  const geometry = useMemo(() => toothGeometry(def), [def]);
  const zones = useMemo(() => zonesForTooth(def), [def]);
  // Orientation: local +Z faces outward, local +Y towards the chewing surface.
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

  return <mesh geometry={geometry} material={material} position={def.pos} rotation={rotation} castShadow receiveShadow />;
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

function Gums() {
  const gumMat = useMemo(() => toon('#f06a8a'), []);
  const gumDark = useMemo(() => toon('#d64f74'), []);
  const upper = useMemo(() => new THREE.TubeGeometry(archCurve(UPPER_GUM_Y + 0.32, 1.0), 48, 0.6, 14, false), []);
  const lower = useMemo(() => new THREE.TubeGeometry(archCurve(LOWER_GUM_Y - 0.32, 1.0), 48, 0.6, 14, false), []);
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
        <sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, UPPER_GUM_Y + 1.1, -0.6]} rotation={[Math.PI, 0, 0]} scale={[2.9, 0.2, 2.9]} material={gumDark}>
        <sphereGeometry args={[1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* floor of the mouth */}
      <mesh position={[0, LOWER_GUM_Y - 1.0, -0.6]} rotation={[Math.PI, 0, 0]} scale={[2.9, 0.8, 2.9]} material={gumDark}>
        <sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  );
}

function Tongue() {
  const mat = useMemo(() => toon('#e84a6f'), []);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = LOWER_GUM_Y - 0.25 + Math.sin(t * 1.3) * 0.04;
    ref.current.rotation.x = -0.15 + Math.sin(t * 0.9) * 0.03;
  });
  return (
    <mesh ref={ref} position={[0, LOWER_GUM_Y - 0.25, -0.8]} scale={[1.9, 0.55, 2.4]} material={mat}>
      <sphereGeometry args={[1, 28, 18]} />
    </mesh>
  );
}

function Lips() {
  const mat = useMemo(() => toon('#d6336c'), []);
  const upper = useMemo(() => new THREE.TubeGeometry(archCurve(UPPER_GUM_Y + 1.25, 1.36, -0.1), 48, 0.42, 12, false), []);
  const lower = useMemo(() => new THREE.TubeGeometry(archCurve(LOWER_GUM_Y - 1.25, 1.36, 0.1), 48, 0.42, 12, false), []);
  return (
    <group>
      <mesh geometry={upper} material={mat} />
      <mesh geometry={lower} material={mat} />
    </group>
  );
}

function Interior() {
  const mat = useMemo(
    () =>
      new THREE.MeshToonMaterial({
        color: '#5a1d3f',
        side: THREE.BackSide,
      }),
    [],
  );
  return (
    <mesh material={mat} position={[0, 0, -2]}>
      <sphereGeometry args={[16, 32, 24]} />
    </mesh>
  );
}

export function Arena() {
  return (
    <group>
      <Interior />
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
      <hemisphereLight args={['#ffe9f3', '#5a1d3f', 0.9]} />
      <directionalLight position={[4, 8, 6]} intensity={2.2} color="#fff4e0" />
      <directionalLight position={[-6, 2, 4]} intensity={0.7} color="#9fd8ff" />
      <pointLight position={[0, 0.4, 2]} intensity={6} distance={9} color="#ffd1e8" />
    </>
  );
}
