/**
 * Renders the hero where the simulation says it is (travelling between teeth,
 * scrubbing a monster or the boss) and feeds the animation state. While
 * scrubbing, the body turns three-quarters towards the camera and the brush
 * arm swings back towards the monster so face and brush both read. During the
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
/** A bit larger on narrow phones so the hero still reads. */
export const ARENA_HERO_SCALE_PORTRAIT = 0.68;
/** How much the body turns towards the camera while scrubbing (0 = face monster, 1 = face camera). */
const SCRUB_FACE_CAMERA = 0.55;
const MAX_ARM_YAW = 1.25;
const MAX_ARM_PITCH = 1.0;

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
  const armYaw = useRef(0);
  const armPitch = useRef(0);

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
      camDir.copy(cam.position).sub(g.position);
      const camYaw = Math.atan2(camDir.x, camDir.z);
      const targetYaw = Math.atan2(h.facing[0], h.facing[2]);
      let bodyYaw = targetYaw;
      let wantArmYaw = 0;
      let wantArmPitch = 0;
      const scale = rt.aspect < 1 ? ARENA_HERO_SCALE_PORTRAIT : ARENA_HERO_SCALE;
      if (h.state === 'scrub') {
        bodyYaw = lerpAngle(targetYaw, camYaw, SCRUB_FACE_CAMERA);
        wantArmYaw = THREE.MathUtils.clamp(angleDiff(bodyYaw, targetYaw), -MAX_ARM_YAW, MAX_ARM_YAW);
        if (h.aim) {
          // pitch the brush arm towards monsters above/below the hand (chewing surfaces)
          const shoulderY = g.position.y + 0.98 * scale;
          const dh = Math.max(0.3, Math.hypot(h.aim[0] - g.position.x, h.aim[2] - g.position.z));
          wantArmPitch = THREE.MathUtils.clamp(Math.atan2(h.aim[1] - shoulderY, dh), -MAX_ARM_PITCH, MAX_ARM_PITCH);
        }
      } else if (h.state === 'idle') {
        bodyYaw = camYaw;
      }
      yaw.current = lerpAngle(yaw.current, bodyYaw, 1 - Math.exp(-dt * 8));
      armYaw.current += (wantArmYaw - armYaw.current) * (1 - Math.exp(-dt * 10));
      armPitch.current += (wantArmPitch - armPitch.current) * (1 - Math.exp(-dt * 10));
      a.armYaw = armYaw.current;
      a.armPitch = armPitch.current;
      g.scale.setScalar(scale);
    } else {
      // intro / victory: centre stage, facing the camera
      cam.getWorldDirection(fwd);
      right.crossVectors(fwd, cam.up).normalize();
      up.crossVectors(right, fwd).normalize();
      desired.copy(cam.position).addScaledVector(fwd, 4.2).addScaledVector(up, -1.2);
      g.position.lerp(desired, 1 - Math.exp(-dt * 4));
      camDir.copy(cam.position).sub(g.position);
      yaw.current = lerpAngle(yaw.current, Math.atan2(camDir.x, camDir.z), 1 - Math.exp(-dt * 4));
      a.armYaw = 0;
      a.armPitch = 0;
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

function angleDiff(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + angleDiff(a, b) * t;
}
