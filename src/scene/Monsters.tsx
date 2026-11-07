/** Plaque monsters ("Gunkoids") rendered from a fixed pool of slots. */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { runtime } from '../game/runtime';
import { toon } from './materials';

const POOL = 8;
const up = new THREE.Vector3(0, 1, 0);
const n = new THREE.Vector3();
const q = new THREE.Quaternion();

// foam blob offsets around a monster (unit sphere directions)
const FOAM_DIRS: [number, number, number][] = [
  [0.9, 0.3, 0.3], [-0.8, 0.4, 0.4], [0.2, 1.0, 0.1], [-0.3, -0.6, 0.7], [0.6, -0.5, 0.6], [-0.6, 0.7, -0.4], [0.1, 0.2, 1.0], [0.7, 0.8, -0.3],
];

function Gunkoid({ slot }: { slot: number }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const foam = useRef<THREE.Group>(null);
  const m = useMemo(
    () => ({
      body: toon('#a9d65c'),
      bodyDark: toon('#7fae3f'),
      eye: toon('#ffffff'),
      pupil: toon('#1a1a1a'),
      brow: toon('#4b5a2a'),
      foam: toon('#ffffff'),
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
    const w = state.clock.elapsedTime * 7 + m0.seed * 10;
    let s = 1;
    let sx = 1;
    let sy = 1;
    if (m0.state === 'rising') {
      s = Math.min(1, age / 0.45);
      s *= 1.2 - 0.2 * s;
    } else if (m0.state === 'alive') {
      sy = 1 + Math.sin(w) * 0.08;
      sx = 1 - Math.sin(w) * 0.06;
    } else if (m0.state === 'foamed') {
      // squeezed by the foam: flattens and wobbles before popping
      const k = Math.min(1, age / 0.45);
      sx = 1 + 0.35 * k + Math.sin(age * 40) * 0.05;
      sy = 1 - 0.5 * k;
    } else if (m0.state === 'dying') {
      s = Math.max(0, 1 - age / 0.25) * (1 + age * 2);
    }
    g.scale.set(s * sx, s * sy, s * sx);
    if (body.current) body.current.rotation.y = Math.sin(w * 0.5) * 0.3;
    if (foam.current) {
      const f = m0.state === 'dying' ? 0 : m0.foam;
      foam.current.visible = f > 0.02;
      foam.current.children.forEach((c, i) => {
        const k = Math.min(1, Math.max(0, f * 1.4 - i * 0.12));
        c.scale.setScalar(0.05 + k * 0.1 + Math.sin(w * 1.3 + i) * 0.01);
      });
    }
  });

  return (
    <group ref={group} visible={false}>
      <group position={[0, 0.28, 0]}>
        <group ref={body}>
          <mesh material={m.body}>
            <sphereGeometry args={[0.3, 18, 14]} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.22, 0.2 + Math.sin(i) * 0.04, Math.sin(a) * 0.22]} rotation={[Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]} material={m.bodyDark}>
                <coneGeometry args={[0.06, 0.18, 6]} />
              </mesh>
            );
          })}
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
          <mesh position={[0, -0.08, 0.27]} rotation={[0.3, 0, 0]} material={m.pupil}>
            <boxGeometry args={[0.14, 0.05, 0.03]} />
          </mesh>
        </group>
        {/* foam that builds up while scrubbing */}
        <group ref={foam} visible={false}>
          {FOAM_DIRS.map((d, i) => (
            <mesh key={i} position={[d[0] * 0.27, d[1] * 0.27, d[2] * 0.27]} material={m.foam} scale={0.001}>
              <sphereGeometry args={[1, 10, 8]} />
            </mesh>
          ))}
        </group>
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
