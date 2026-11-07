/** Repulsor beams, web shots and batarangs, drawn from a pool. */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { runtime } from '../game/runtime';
import type { HeroPack, Suit } from '../heroes';
import { glow, toon } from './materials';

const POOL = 6;
const from = new THREE.Vector3();
const to = new THREE.Vector3();
const mid = new THREE.Vector3();
const ctrl = new THREE.Vector3();
const dir = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const q = new THREE.Quaternion();

function Slot({ slot, hero, suit }: { slot: number; hero: HeroPack; suit: Suit }) {
  const group = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Mesh>(null);
  const m = useMemo(
    () => ({
      beam: glow(suit.palette.attack, 2.5),
      beamCore: glow('#ffffff', 3),
      web: toon('#f7f7f7'),
      webLine: new THREE.MeshBasicMaterial({ color: '#f0f0f0' }),
      batarang: toon(suit.palette.attack),
    }),
    [suit],
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const p = runtime.projectiles[slot];
    if (!p) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const k = Math.min(1, (runtime.elapsed - p.bornAt) / p.duration);
    from.set(p.from[0], p.from[1], p.from[2]);
    to.set(p.to[0], p.to[1], p.to[2]);
    if (p.kind === 'beam') {
      // a glowing bar from hand to target, thinning out
      mid.lerpVectors(from, to, 0.5);
      g.position.copy(mid);
      dir.subVectors(to, from);
      const len = dir.length();
      q.setFromUnitVectors(up, dir.normalize());
      g.quaternion.copy(q);
      const thick = 1.2 - k;
      g.scale.set(thick, len, thick);
      if (flash.current) {
        flash.current.visible = true;
        flash.current.position.set(0, 0.5, 0);
        flash.current.scale.set((0.5 + k) / Math.max(thick, 0.01), (0.5 + k) / Math.max(len, 0.01), (0.5 + k) / Math.max(thick, 0.01));
      }
    } else if (p.kind === 'web') {
      mid.lerpVectors(from, to, k);
      g.position.copy(mid);
      g.quaternion.identity();
      g.scale.setScalar(0.5 + k * 0.8);
      if (beam.current) {
        // trailing strand from hand to blob
        dir.subVectors(mid, from);
        const len = dir.length();
        beam.current.position.copy(from).sub(mid).multiplyScalar(0.5).divideScalar(g.scale.x);
        beam.current.quaternion.setFromUnitVectors(up, dir.normalize());
        beam.current.scale.set(1, len / g.scale.x, 1);
      }
    } else {
      // batarang: quadratic arc with spin
      ctrl.lerpVectors(from, to, 0.5);
      ctrl.y += 1.1;
      const a = 1 - k;
      mid.set(
        a * a * from.x + 2 * a * k * ctrl.x + k * k * to.x,
        a * a * from.y + 2 * a * k * ctrl.y + k * k * to.y,
        a * a * from.z + 2 * a * k * ctrl.z + k * k * to.z,
      );
      g.position.copy(mid);
      g.rotation.set(Math.PI / 2, 0, k * Math.PI * 8);
      g.scale.setScalar(1);
    }
  });

  if (hero.attack === 'beam') {
    return (
      <group ref={group} visible={false}>
        <mesh material={m.beam}>
          <cylinderGeometry args={[0.07, 0.11, 1, 8, 1, true]} />
        </mesh>
        <mesh material={m.beamCore}>
          <cylinderGeometry args={[0.03, 0.05, 1, 6, 1, true]} />
        </mesh>
        <mesh ref={flash} material={m.beam}>
          <sphereGeometry args={[0.18, 10, 8]} />
        </mesh>
      </group>
    );
  }
  if (hero.attack === 'web') {
    return (
      <group ref={group} visible={false}>
        <mesh material={m.web}>
          <icosahedronGeometry args={[0.16, 1]} />
        </mesh>
        <mesh ref={beam} material={m.webLine}>
          <cylinderGeometry args={[0.012, 0.012, 1, 5, 1, true]} />
        </mesh>
      </group>
    );
  }
  return (
    <group ref={group} visible={false}>
      {/* batarang: two flat wings */}
      <mesh material={m.batarang}>
        <boxGeometry args={[0.46, 0.09, 0.03]} />
      </mesh>
      <mesh position={[-0.16, 0.06, 0]} rotation={[0, 0, 0.5]} material={m.batarang}>
        <boxGeometry args={[0.16, 0.07, 0.03]} />
      </mesh>
      <mesh position={[0.16, 0.06, 0]} rotation={[0, 0, -0.5]} material={m.batarang}>
        <boxGeometry args={[0.16, 0.07, 0.03]} />
      </mesh>
      <mesh position={[0, 0.06, 0]} material={m.batarang}>
        <boxGeometry args={[0.1, 0.1, 0.03]} />
      </mesh>
    </group>
  );
}

export function Projectiles({ hero, suit }: { hero: HeroPack; suit: Suit }) {
  const slots = useMemo(() => Array.from({ length: POOL }, (_, i) => i), []);
  return (
    <group>
      {slots.map((i) => (
        <Slot key={`${hero.id}-${i}`} slot={i} hero={hero} suit={suit} />
      ))}
    </group>
  );
}
