/**
 * Moves the camera between zone poses with smooth damping, gently follows the
 * hero (blended with the zone pose so the row stays framed), applies boss
 * shake, and publishes aspect / camera position to the runtime for the
 * simulation's on-screen checks.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { verticalFov } from '../game/framing';
import { BOSS_CAMERA, INTRO_CAMERA, cameraPoseForZone } from '../game/mouth';
import { runtime } from '../game/runtime';

const targetPos = new THREE.Vector3();
const targetLook = new THREE.Vector3();
const focus = new THREE.Vector3();
const poseTarget = new THREE.Vector3();

export function CameraRig() {
  const look = useRef(new THREE.Vector3(0, 0, 0));
  const first = useRef(true);
  const shakeSeed = useRef(0);

  useFrame((state, dt) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const rt = runtime;
    const aspect = state.size.width / Math.max(1, state.size.height);
    rt.aspect = aspect;

    let pose;
    let follow = 0;
    if (rt.phase === 'countdown' || rt.phase === 'idle') pose = INTRO_CAMERA;
    else if (rt.phase === 'victory') pose = BOSS_CAMERA;
    else if (rt.bossActive) {
      pose = BOSS_CAMERA;
      follow = 0.12;
    } else {
      pose = cameraPoseForZone(rt.zoneIndex);
      follow = 0.3;
    }
    targetPos.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    poseTarget.set(pose.target[0], pose.target[1], pose.target[2]);
    targetLook.copy(poseTarget);

    if (follow > 0) {
      // focus between the hero and what it is scrubbing
      const h = rt.hero;
      focus.set(h.pos[0], h.pos[1] + 0.5, h.pos[2]);
      if (h.aim) focus.lerp(new THREE.Vector3(h.aim[0], h.aim[1], h.aim[2]), 0.5);
      focus.sub(poseTarget);
      // keep the vertical drift small so the row never leaves the frame
      focus.y = THREE.MathUtils.clamp(focus.y, -0.7, 0.7);
      targetLook.addScaledVector(focus, follow);
      targetPos.addScaledVector(focus, follow * 0.45);
    }

    const vfov = verticalFov(aspect);
    if (Math.abs(cam.fov - vfov) > 0.1) {
      cam.fov = vfov;
      cam.updateProjectionMatrix();
    }

    if (first.current) {
      first.current = false;
      cam.position.copy(targetPos);
      look.current.copy(targetLook);
    } else {
      const k = 1 - Math.exp(-dt * 2.2);
      cam.position.lerp(targetPos, k);
      look.current.lerp(targetLook, k);
    }
    rt.camPos = [cam.position.x, cam.position.y, cam.position.z];
    if (rt.shake > 0.01) {
      shakeSeed.current += dt * 40;
      const s = rt.shake * 0.12;
      cam.position.x += Math.sin(shakeSeed.current * 1.3) * s;
      cam.position.y += Math.cos(shakeSeed.current * 1.7) * s;
    }
    cam.lookAt(look.current);
  });
  return null;
}
