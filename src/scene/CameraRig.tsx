/**
 * Moves the camera between the choreography's per-stop poses with smooth
 * damping and a gentle follow of the brush head, and publishes aspect /
 * camera position to the runtime.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { STOPS, cameraForStop } from '../game/choreo';
import { verticalFov } from '../game/framing';
import { INTRO_CAMERA, VICTORY_CAMERA } from '../game/mouth';
import { runtime } from '../game/runtime';

const targetPos = new THREE.Vector3();
const targetLook = new THREE.Vector3();
const focus = new THREE.Vector3();
const poseTarget = new THREE.Vector3();

export function CameraRig() {
  const look = useRef(new THREE.Vector3(0, 0, 0));
  const first = useRef(true);

  useFrame((state, dt) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const rt = runtime;
    const aspect = state.size.width / Math.max(1, state.size.height);
    rt.aspect = aspect;

    let pose;
    let follow = 0;
    if (rt.phase === 'countdown' || rt.phase === 'idle') pose = INTRO_CAMERA;
    else if (rt.phase === 'victory') pose = VICTORY_CAMERA;
    else {
      pose = cameraForStop(STOPS[rt.stopIndex], aspect);
      follow = 0.22;
    }
    targetPos.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    poseTarget.set(pose.target[0], pose.target[1], pose.target[2]);
    targetLook.copy(poseTarget);

    if (follow > 0) {
      focus.set(rt.brush.pos[0], rt.brush.pos[1], rt.brush.pos[2]).sub(poseTarget);
      focus.y = THREE.MathUtils.clamp(focus.y, -0.5, 0.5);
      targetLook.addScaledVector(focus, follow);
      targetPos.addScaledVector(focus, follow * 0.35);
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
      const k = 1 - Math.exp(-dt * 2.4);
      cam.position.lerp(targetPos, k);
      look.current.lerp(targetLook, k);
    }
    rt.camPos = [cam.position.x, cam.position.y, cam.position.z];
    cam.lookAt(look.current);
  });
  return null;
}
