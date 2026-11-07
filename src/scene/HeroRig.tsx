/**
 * Renders the hero where the simulation says it stands (following the
 * brush between stops) and points its right arm at the brush grip. While
 * brushing the body turns part-way towards the camera so the face reads.
 * During the countdown and the victory screen it stands in front of the camera.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { gripPoint } from '../game/choreo';
import { HERO_SCALE } from '../game/mouth';
import { runtime } from '../game/runtime';
import type { HeroPack, Suit } from '../heroes';
import { HeroModel, createHeroAnim, type HeroAnim } from './heroes/HeroModel';

/** How much the body turns towards the camera while brushing (0 = face the teeth, 1 = face camera). */
const BRUSH_FACE_CAMERA = 0.65;
/** The body never turns more than this (radians) away from the camera while playing. */
const MAX_AWAY_FROM_CAMERA = 1.2;

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
  const hand = useRef(new THREE.Vector3());

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
    a.holdBrush = false;

    if (rt.phase === 'playing' || rt.phase === 'countdown') {
      const h = rt.hero;
      desired.set(h.pos[0], h.pos[1], h.pos[2]);
      g.position.lerp(desired, 1 - Math.exp(-dt * 14));
      camDir.copy(cam.position).sub(g.position);
      const camYaw = Math.atan2(camDir.x, camDir.z);
      const targetYaw = Math.atan2(h.facing[0], h.facing[2]);
      let bodyYaw = rt.phase === 'countdown' ? camYaw : lerpAngle(targetYaw, camYaw, BRUSH_FACE_CAMERA);
      const away = angleDiff(camYaw, bodyYaw);
      if (Math.abs(away) > MAX_AWAY_FROM_CAMERA) bodyYaw = camYaw + Math.sign(away) * MAX_AWAY_FROM_CAMERA;
      yaw.current = lerpAngle(yaw.current, bodyYaw, 1 - Math.exp(-dt * 8));
      if (rt.phase === 'playing') {
        const grip = gripPoint(rt.brush);
        hand.current.set(grip[0], grip[1], grip[2]);
        a.handTarget = hand.current;
      } else {
        a.handTarget = null;
        a.holdBrush = true;
      }
      g.scale.setScalar(HERO_SCALE);
    } else {
      // intro / victory: centre stage, facing the camera
      cam.getWorldDirection(fwd);
      right.crossVectors(fwd, cam.up).normalize();
      up.crossVectors(right, fwd).normalize();
      desired.copy(cam.position).addScaledVector(fwd, 4.2).addScaledVector(up, -1.2);
      g.position.lerp(desired, 1 - Math.exp(-dt * 4));
      camDir.copy(cam.position).sub(g.position);
      yaw.current = lerpAngle(yaw.current, Math.atan2(camDir.x, camDir.z), 1 - Math.exp(-dt * 4));
      a.handTarget = null;
      a.holdBrush = false;
      g.scale.setScalar(0.9);
    }
    g.rotation.y = yaw.current;
  });

  return (
    <group ref={group} scale={HERO_SCALE}>
      <HeroModel hero={hero} suit={suit} anim={anim} />
    </group>
  );
}

function angleDiff(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + angleDiff(a, b) * t;
}
