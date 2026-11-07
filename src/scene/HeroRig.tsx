/**
 * Places the hero in front of the camera during a session, turns it towards its
 * aim point and feeds the animation state from the runtime.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { runtime } from '../game/runtime';
import type { HeroPack, Suit } from '../heroes';
import { HeroModel, createHeroAnim, type HeroAnim } from './heroes/HeroModel';

const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const desired = new THREE.Vector3();
const aimV = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

export function HeroRig({ hero, suit }: { hero: HeroPack; suit: Suit }) {
  const group = useRef<THREE.Group>(null);
  const anim = useRef<HeroAnim>(createHeroAnim('fight'));
  const modeStart = useRef(0);
  const lastMode = useRef<HeroAnim['mode']>('fight');
  const yaw = useRef(0);
  const aimPoint = useMemo(() => new THREE.Vector3(), []);

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
    a.attackAge = rt.phase === 'playing' ? rt.elapsed - rt.heroAttackAt : Infinity;

    // position relative to the camera: lower-left of the frame, a bit in front
    cam.getWorldDirection(fwd);
    right.crossVectors(fwd, cam.up).normalize();
    up.crossVectors(right, fwd).normalize();
    const aspect = state.size.width / Math.max(1, state.size.height);
    const playing = rt.phase === 'playing';
    const boss = playing && rt.bossActive;
    const dist = playing ? 4.0 : 4.0;
    const side = playing ? (aspect < 1 ? (boss ? -1.2 : -0.95) : boss ? -2.4 : -1.8) : 0;
    const down = playing ? (aspect < 1 ? -1.45 : -1.3) : -1.1;
    desired.copy(cam.position).addScaledVector(fwd, dist).addScaledVector(right, side).addScaledVector(up, down);
    const k = 1 - Math.exp(-dt * 4);
    g.position.lerp(desired, k);

    // facing: aim at the target, blended slightly towards the camera so the face stays visible
    if (rt.phase === 'playing' && rt.heroAim) {
      aimV.set(rt.heroAim[0], rt.heroAim[1], rt.heroAim[2]);
      aimPoint.lerp(aimV, 1 - Math.exp(-dt * 6));
      lookTarget.copy(aimPoint).sub(g.position);
      lookTarget.y = 0;
      const targetYaw = Math.atan2(lookTarget.x, lookTarget.z);
      const camDir = cam.position.clone().sub(g.position);
      const camYaw = Math.atan2(camDir.x, camDir.z);
      const blended = lerpAngle(targetYaw, camYaw, 0.3);
      yaw.current = lerpAngle(yaw.current, blended, 1 - Math.exp(-dt * 5));
    } else {
      const camDir = cam.position.clone().sub(g.position);
      yaw.current = lerpAngle(yaw.current, Math.atan2(camDir.x, camDir.z), 1 - Math.exp(-dt * 4));
    }
    g.rotation.y = yaw.current;

    rt.heroPos = [g.position.x, g.position.y, g.position.z];
  });

  return (
    <group ref={group}>
      <HeroModel
        hero={hero}
        suit={suit}
        anim={anim}
        onHand={(p) => {
          runtime.heroHand = [p.x, p.y, p.z];
        }}
      />
    </group>
  );
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
