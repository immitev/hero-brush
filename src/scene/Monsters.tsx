/** Plaque monsters ("Gunkoids") rendered from a fixed pool of slots. */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { runtime } from '../game/runtime';
import { glow, toon } from './materials';

const POOL = 8;
const up = new THREE.Vector3(0, 1, 0);
const n = new THREE.Vector3();
const q = new THREE.Quaternion();

function Gunkoid({ slot }: { slot: number }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const cocoon = useRef<THREE.Mesh>(null);
  const m = useMemo(
    () => ({
      body: toon('#9ccf5a'),
      bodyDark: toon('#6f9a3a'),
      eye: toon('#ffffff'),
      pupil: toon('#1a1a1a'),
      brow: toon('#3a4a1f'),
      cocoon: toon('#f4f4f4'),
      glowEye: glow('#ff7b7b', 1.5),
    }),
    [],
  );

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const list = runtime.monsters;
    const m0 = list[slot];
    if (!m0) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const t = runtime.elapsed;
    const age = t - m0.stateAt;
    g.position.set(m0.pos[0], m0.pos[1], m0.pos[2]);
    n.set(m0.normal[0], m0.normal[1], m0.normal[2]);
    q.setFromUnitVectors(up, n);
    g.quaternion.copy(q);
    // wobble
    const w = state.clock.elapsedTime * 7 + m0.seed * 10;
    let s = 1;
    if (m0.state === 'rising') s = Math.min(1, age / 0.45);
    else if (m0.state === 'dying') s = Math.max(0, 1 - age / 0.25) * (1 + age * 2);
    const bounce = m0.state === 'alive' ? 1 + Math.sin(w) * 0.08 : 1;
    const squash = m0.state === 'alive' ? 1 - Math.sin(w) * 0.06 : 1;
    const pop = s * (m0.state === 'rising' ? 1.2 - 0.2 * s : 1);
    g.scale.set(pop * squash, pop * bounce, pop * squash);
    if (body.current) body.current.rotation.y = Math.sin(w * 0.5) * 0.3;
    if (cocoon.current) {
      const c = m0.state === 'cocooned';
      cocoon.current.visible = c;
      if (c) {
        const k = Math.min(1, age / 0.15);
        cocoon.current.scale.setScalar(0.4 + k * 0.85);
        cocoon.current.rotation.y += 0.2;
      }
    }
  });

  return (
    <group ref={group} visible={false}>
      <group position={[0, 0.28, 0]}>
        <mesh ref={body} material={m.body}>
          <sphereGeometry args={[0.3, 18, 14]} />
        </mesh>
        {/* spikes */}
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.22, 0.2 + Math.sin(i) * 0.04, Math.sin(a) * 0.22]} rotation={[Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]} material={m.bodyDark}>
              <coneGeometry args={[0.06, 0.18, 6]} />
            </mesh>
          );
        })}
        {/* eyes */}
        {[-1, 1].map((sgn) => (
          <group key={sgn} position={[sgn * 0.12, 0.08, 0.24]}>
            <mesh material={m.eye}>
              <sphereGeometry args={[0.085, 12, 10]} />
            </mesh>
            <mesh position={[0, 0, 0.06]} material={m.pupil}>
              <sphereGeometry args={[0.04, 10, 8]} />
            </mesh>
            <mesh position={[0, 0.09, 0.03]} rotation={[0, 0, sgn * -0.5]} material={m.brow}>
              <boxGeometry args={[0.14, 0.035, 0.03]} />
            </mesh>
          </group>
        ))}
        {/* mouth */}
        <mesh position={[0, -0.08, 0.27]} rotation={[0.3, 0, 0]} material={m.pupil}>
          <boxGeometry args={[0.14, 0.05, 0.03]} />
        </mesh>
        {/* web cocoon overlay */}
        <mesh ref={cocoon} visible={false} material={m.cocoon}>
          <icosahedronGeometry args={[0.36, 1]} />
        </mesh>
      </group>
    </group>
  );
}

export function Monsters() {
  const slots = useMemo(() => Array.from({ length: POOL }, (_, i) => i), []);
  return (
    <group>
      {slots.map((i) => (
        <Gunkoid key={i} slot={i} />
      ))}
    </group>
  );
}
