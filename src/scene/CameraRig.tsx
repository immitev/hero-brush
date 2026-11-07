/** Moves the camera between zone poses with smooth damping, plus boss shake. */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { BOSS_CAMERA, INTRO_CAMERA, cameraPoseForZone } from '../game/mouth';
import { runtime } from '../game/runtime';

const targetPos = new THREE.Vector3();
const targetLook = new THREE.Vector3();

export function CameraRig() {
  const look = useRef(new THREE.Vector3(0, 0, 0));
  const first = useRef(true);
  const shakeSeed = useRef(0);

  useFrame((state, dt) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const rt = runtime;
    let pose;
    if (rt.phase === 'countdown' || rt.phase === 'idle') pose = INTRO_CAMERA;
    else if (rt.phase === 'victory') pose = BOSS_CAMERA;
    else if (rt.bossActive) pose = BOSS_CAMERA;
    else pose = cameraPoseForZone(rt.zoneIndex);
    targetPos.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    targetLook.set(pose.target[0], pose.target[1], pose.target[2]);

    // keep the horizontal field of view roughly constant across aspect ratios
    const aspect = state.size.width / Math.max(1, state.size.height);
    const hfov = 52;
    const vfov = THREE.MathUtils.clamp((2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / aspect) * 180) / Math.PI, 42, 85);
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
