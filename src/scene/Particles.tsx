/**
 * Foam bubbles along the brush head and sparkles when a tooth surface comes
 * clean. Consumes `runtime.events` each frame.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { sfx } from '../audio/sfx';
import { runtime } from '../game/runtime';

interface P {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
  gravity: number;
}

const dummy = new THREE.Object3D();
const color = new THREE.Color();

function makePool(n: number): P[] {
  return Array.from({ length: n }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 0.1, r: 1, g: 1, b: 1, gravity: 0 }));
}

export function Particles({ quality }: { quality: 'low' | 'high' }) {
  const burstCount = quality === 'high' ? 240 : 100;
  const foamCount = quality === 'high' ? 110 : 40;
  const burstRef = useRef<THREE.InstancedMesh>(null);
  const foamRef = useRef<THREE.InstancedMesh>(null);
  const bursts = useMemo(() => makePool(burstCount), [burstCount]);
  const foam = useMemo(() => makePool(foamCount), [foamCount]);
  const burstMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const foamMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, transparent: true, opacity: 0.8, depthWrite: false }), []);
  const burstGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const foamGeo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  const foamTimer = useRef(0);

  const emit = (pool: P[], x: number, y: number, z: number, hex: string, count: number, speed: number, size: number, life: number, gravity: number) => {
    color.set(hex);
    let n = 0;
    for (const p of pool) {
      if (p.alive) continue;
      p.alive = true;
      p.x = x;
      p.y = y;
      p.z = z;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = speed * (0.4 + Math.random() * 0.8);
      p.vx = Math.sin(ph) * Math.cos(th) * sp;
      p.vy = Math.cos(ph) * sp + speed * 0.3;
      p.vz = Math.sin(ph) * Math.sin(th) * sp;
      p.maxLife = life * (0.6 + Math.random() * 0.6);
      p.life = p.maxLife;
      p.size = size * (0.5 + Math.random());
      const v = 0.8 + Math.random() * 0.5;
      p.r = color.r * v;
      p.g = color.g * v;
      p.b = color.b * v;
      p.gravity = gravity;
      if (++n >= count) break;
    }
  };

  useFrame((_state, dtRaw) => {
    const rt = runtime;
    if (rt.paused) return;
    const dt = Math.min(dtRaw, 0.05);
    const hi = quality === 'high';
    for (const e of rt.events) {
      if (e.type === 'stroke') {
        emit(foam, e.pos[0], e.pos[1], e.pos[2], '#ffffff', hi ? 3 : 1, 0.45, 0.05, 1.1, -0.2);
        sfx.scrub();
      } else if (e.type === 'toothClean') {
        emit(bursts, e.pos[0], e.pos[1], e.pos[2], '#ffffff', hi ? 10 : 6, 1.2, 0.045, 0.7, -0.3);
        emit(bursts, e.pos[0], e.pos[1], e.pos[2], '#9af5ff', 5, 1.0, 0.035, 0.7, -0.3);
        sfx.squeak();
      } else if (e.type === 'segmentDone') {
        sfx.zoneChime();
      } else if (e.type === 'allClean') {
        sfx.sparkle();
      }
    }
    rt.events.length = 0;

    // a steady trickle of small foam bubbles while the bristles are on a surface
    if (rt.phase === 'playing' && rt.brush.contact) {
      foamTimer.current -= dt;
      if (foamTimer.current <= 0) {
        foamTimer.current = hi ? 0.09 : 0.2;
        const b = rt.brush;
        const jx = (Math.random() - 0.5) * 0.5;
        emit(foam, b.pos[0] + b.axis[0] * jx, b.pos[1] + b.axis[1] * jx + 0.02, b.pos[2] + b.axis[2] * jx, '#ffffff', 1, 0.2, 0.04, 1.0, -0.15);
      }
    }

    const stepPool = (pool: P[], mesh: THREE.InstancedMesh | null, colored: boolean, shrink: boolean) => {
      if (!mesh) return;
      let i = 0;
      for (const p of pool) {
        if (p.alive) {
          p.life -= dt;
          if (p.life <= 0) p.alive = false;
          p.vy -= p.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          const k = p.life / p.maxLife;
          const s = shrink ? p.size * (0.2 + k) : p.size * Math.min(1, (1 - k) * 6 + 0.2) * (0.6 + 0.4 * k);
          dummy.position.set(p.x, p.y, p.z);
          dummy.rotation.set(p.life * 3, p.life * 2, 0);
          dummy.scale.setScalar(Math.max(0.0001, s));
          if (colored) {
            const glowK = 1.2 + k * 1.3;
            color.setRGB(p.r * glowK, p.g * glowK, p.b * glowK);
            mesh.setColorAt(i, color);
          }
        } else {
          dummy.position.set(0, -999, 0);
          dummy.scale.setScalar(0.0001);
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        i++;
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (colored && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    stepPool(bursts, burstRef.current, true, true);
    stepPool(foam, foamRef.current, false, false);
  });

  return (
    <group>
      <instancedMesh ref={burstRef} args={[burstGeo, burstMat, burstCount]} frustumCulled={false} />
      <instancedMesh ref={foamRef} args={[foamGeo, foamMat, foamCount]} frustumCulled={false} />
    </group>
  );
}
