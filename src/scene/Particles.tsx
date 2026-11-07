/**
 * Instanced particle bursts (monster pops, boss hits, sparkles) and foam
 * bubbles. Consumes `runtime.events` each frame.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { sfx } from '../audio/sfx';
import { teethForZone, perchOn } from '../game/mouth';
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
  const burstCount = quality === 'high' ? 360 : 140;
  const foamCount = quality === 'high' ? 70 : 24;
  const burstRef = useRef<THREE.InstancedMesh>(null);
  const foamRef = useRef<THREE.InstancedMesh>(null);
  const bursts = useMemo(() => makePool(burstCount), [burstCount]);
  const foam = useMemo(() => makePool(foamCount), [foamCount]);
  const burstMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const foamMat = useMemo(
    () =>
      new THREE.MeshToonMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    [],
  );
  const burstGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const foamGeo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  const foamTimer = useRef(0);
  const sparkleTimer = useRef(0);

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

  useFrame((state, dtRaw) => {
    const rt = runtime;
    if (rt.paused) return; // freeze everything (no spawning, no integration) while paused
    const dt = Math.min(dtRaw, 0.05);
    // consume events
    for (const e of rt.events) {
      if (e.type === 'pop') {
        emit(bursts, e.pos[0], e.pos[1] + 0.25, e.pos[2], e.color, e.count ?? 18, 3.2, 0.09, 0.7, 5);
        emit(bursts, e.pos[0], e.pos[1] + 0.25, e.pos[2], '#ffffff', 6, 2, 0.05, 0.4, 0);
        sfx.pop();
      } else if (e.type === 'hit') {
        emit(bursts, e.pos[0], e.pos[1] + 0.25, e.pos[2], e.color, 8, 1.5, 0.06, 0.4, 0);
        sfx.cocoon();
      } else if (e.type === 'bossHit') {
        emit(bursts, e.pos[0], e.pos[1], e.pos[2] + 0.9, '#c084fc', 22, 3.5, 0.1, 0.6, 4);
        emit(bursts, e.pos[0], e.pos[1], e.pos[2] + 0.9, '#ffffff', 8, 2.5, 0.06, 0.4, 0);
        sfx.bossHit();
      } else if (e.type === 'bossDefeated') {
        emit(bursts, e.pos[0], e.pos[1], e.pos[2], '#c084fc', 90, 5, 0.16, 1.4, 3);
        emit(bursts, e.pos[0], e.pos[1], e.pos[2], '#ffd166', 60, 6, 0.1, 1.6, 2);
        emit(bursts, e.pos[0], e.pos[1], e.pos[2], '#ffffff', 40, 4, 0.08, 1.2, 0);
        sfx.bossDefeated();
      } else if (e.type === 'zoneClean') {
        for (const t of teethForZone(e.zoneIndex)) {
          const zone = e.zoneIndex;
          const perch = perchOn(t, zone >= 4 ? 'chewing' : 'outside', 0.1);
          emit(bursts, perch.pos[0], perch.pos[1], perch.pos[2], '#ffffff', 4, 1.2, 0.06, 0.8, -0.5);
          emit(bursts, perch.pos[0], perch.pos[1], perch.pos[2], '#9af5ff', 3, 1.0, 0.05, 0.8, -0.5);
        }
        sfx.sparkle();
      } else if (e.type === 'sparkle') {
        emit(bursts, e.pos[0], e.pos[1], e.pos[2], '#ffffff', 5, 1, 0.05, 0.6, -0.4);
      }
    }
    rt.events.length = 0;

    // ambient sparkles on clean teeth of the current zone
    if (rt.phase === 'playing' || rt.phase === 'victory') {
      sparkleTimer.current -= dt;
      if (sparkleTimer.current <= 0) {
        sparkleTimer.current = quality === 'high' ? 0.18 : 0.35;
        const zi = rt.phase === 'victory' ? Math.floor(Math.random() * 6) : rt.zoneIndex;
        const clean = rt.phase === 'victory' ? 1 : rt.zoneClean[zi];
        if (clean > 0.5) {
          const teeth = teethForZone(zi);
          const t = teeth[Math.floor(Math.random() * teeth.length)];
          const perch = perchOn(t, zi >= 4 ? 'chewing' : 'outside', 0.05);
          emit(bursts, perch.pos[0] + (Math.random() - 0.5) * 0.4, perch.pos[1] + (Math.random() - 0.5) * 0.4, perch.pos[2], '#ffffff', 2, 0.4, 0.04 + clean * 0.03, 0.5, -0.6);
        }
      }
      // foam bubbles around the teeth being brushed
      foamTimer.current -= dt;
      if (rt.phase === 'playing' && foamTimer.current <= 0) {
        foamTimer.current = quality === 'high' ? 0.08 : 0.2;
        const teeth = teethForZone(rt.zoneIndex);
        const t = teeth[Math.floor(Math.random() * teeth.length)];
        const perch = perchOn(t, rt.zoneIndex >= 4 ? 'chewing' : 'outside', 0.15);
        emit(foam, perch.pos[0] + (Math.random() - 0.5) * 0.5, perch.pos[1] + (Math.random() - 0.5) * 0.5, perch.pos[2] + (Math.random() - 0.5) * 0.3, '#ffffff', 1, 0.25, 0.07, 1.8, -0.35);
      }
    }

    // integrate
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
    void state;
  });

  return (
    <group>
      <instancedMesh ref={burstRef} args={[burstGeo, burstMat, burstCount]} frustumCulled={false} />
      <instancedMesh ref={foamRef} args={[foamGeo, foamMat, foamCount]} frustumCulled={false} />
    </group>
  );
}
