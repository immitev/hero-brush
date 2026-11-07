/**
 * Renders the hero where the simulation says it is (travelling between teeth,
 * scrubbing a monster or the boss) and feeds the animation state. During the
 * countdown and the victory screen it stands in front of the camera instead.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { runtime } from '../game/runtime';
import type { HeroPack, Suit } from '../heroes';
import { HeroModel, createHeroAnim, type HeroAnim } from './heroes/HeroModel';

/** Heroes are built ~1.8 tall; scaled down in the arena so they do not cover the teeth. */
export const ARENA_HERO_SCALE = 0.6;

const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const desired = new THREE.Vector3();
const camDir = new THREE.Vector3();

export function HeroRig({ hero, suit }: { hero: HeroPack; suit: Suit }) {
  const group = useRef<THREE.Group>(null);
  const anim = useRef<HeroAnim>(createHeroAnim('fight'));
  const modeStart = useRef(0);
  const lastMode = useRef<HeroAnim['mode']>('fight');
  const yaw = useRef(0);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const cam = state.camera;
    const rt = runtime;
    const a = anim.current;

    const mode: HeroAnim['mode'] = rt.phase === 'victory' ? 'celebrate' : rt.phase === 'playing' ? 'fight' : 'idle';
    if (mode !== lastMode.current) {
      lastMode.current = mode;
      modeStart.current = state.clock.elapsedTime;
    }
    a.mode = mode;
    a.modeT = state.clock.elapsedTime - modeStart.current;
    a.state = rt.hero.state;
    a.speed = rt.paused ? 0 : rt.hero.speed;

    if (rt.phase === 'playing') {
      const h = rt.hero;
      desired.set(h.pos[0], h.pos[1], h.pos[2]);
      g.position.lerp(desired, 1 - Math.exp(-dt * 12));
      const targetYaw = Math.atan2(h.facing[0], h.facing[2]);
      yaw.current = lerpAngle(yaw.current, targetYaw, 1 - Math.exp(-dt * 8));
      g.scale.setScalar(ARENA_HERO_SCALE);
    } else {
      // intro / victory: centre stage, facing the camera
      cam.getWorldDirection(fwd);
      right.crossVectors(fwd, cam.up).normalize();
      up.crossVectors(right, fwd).normalize();
      desired.copy(cam.position).addScaledVector(fwd, 4.2).addScaledVector(up, -1.2);
      g.position.lerp(desired, 1 - Math.exp(-dt * 4));
      camDir.copy(cam.position).sub(g.position);
      yaw.current = lerpAngle(yaw.current, Math.atan2(camDir.x, camDir.z), 1 - Math.exp(-dt * 4));
      g.scale.setScalar(0.9);
    }
    g.rotation.y = yaw.current;
  });

  return (
    <group ref={group} scale={ARENA_HERO_SCALE}>
      <HeroModel hero={hero} suit={suit} anim={anim} />
    </group>
  );
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
