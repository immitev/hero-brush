/** The Cavity King: big purple blob with a crown. Scrubbed into foam for the last 20 s. */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { bossRadius } from '../game/mouth';
import { runtime } from '../game/runtime';
import { glow, toon } from './materials';

const FOAM_DIRS: [number, number, number][] = [
  [-0.9, 0.2, 0.4], [-0.7, -0.4, 0.6], [-0.5, 0.7, 0.5], [-0.95, -0.1, -0.2], [-0.3, 0.9, 0.3], [-0.6, -0.75, 0.2],
  [0.1, 0.6, 0.8], [0.3, -0.3, 0.9], [0.8, 0.5, 0.3], [0.6, -0.6, 0.5], [-0.2, -0.95, 0.2], [0.9, -0.1, -0.4],
];

export function Boss() {
  const group = useRef<THREE.Group>(null);
  const foam = useRef<THREE.Group>(null);
  const bodyMat = useMemo(() => toon('#7c4dab'), []);
  const m = useMemo(
    () => ({
      dark: toon('#5a3184'),
      crown: toon('#f2c14e'),
      eye: glow('#ff7b7b', 1.6),
      teeth: toon('#f6f6f6'),
      mouth: toon('#2b1444'),
      foam: toon('#ffffff'),
    }),
    [],
  );
  const baseColor = useMemo(() => new THREE.Color('#7c4dab'), []);
  const white = useMemo(() => new THREE.Color('#ffffff'), []);
  const shown = useRef(0);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const rt = runtime;
    const t = state.clock.elapsedTime;
    const want = rt.bossActive ? 1 : 0;
    shown.current += (want - shown.current) * (1 - Math.exp(-dt * (want ? 2.5 : 6)));
    const s = shown.current;
    if (s < 0.01) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const health = rt.bossHealth;
    const sinceHit = rt.elapsed - rt.bossHitAt;
    const hitK = sinceHit < 0.2 ? 1 - sinceHit / 0.2 : 0;
    const wob = 1 + Math.sin(t * 3) * 0.04;
    const shrinkBoom = rt.bossActive ? 1 : Math.max(0, 1 - (1 - s) * 1.4);
    g.scale.setScalar(bossRadius(health) * s * wob * shrinkBoom * (1 + hitK * 0.12));
    g.position.set(rt.bossPos[0], rt.bossPos[1] + (1 - s) * 2.5, rt.bossPos[2]);
    g.rotation.y = Math.sin(t * 0.7) * 0.25 + (hitK ? Math.sin(t * 90) * 0.1 : 0);
    g.rotation.z = hitK * Math.sin(t * 60) * 0.08;
    bodyMat.color.copy(baseColor).lerp(white, hitK * 0.8);
    bodyMat.emissive.setScalar(hitK * 0.5);
    if (foam.current) {
      const f = rt.bossActive ? rt.bossFoam : 0;
      foam.current.visible = f > 0.02;
      foam.current.children.forEach((c, i) => {
        const k = Math.min(1, Math.max(0, f * 1.6 - i * 0.07));
        c.scale.setScalar(0.05 + k * 0.42 + Math.sin(t * 2 + i) * 0.02);
      });
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh material={bodyMat}>
        <sphereGeometry args={[1, 28, 22]} />
      </mesh>
      {[
        [0.7, 0.4, 0.4],
        [-0.65, 0.5, 0.45],
        [0.3, -0.7, 0.6],
        [-0.5, -0.5, 0.6],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} material={m.dark}>
          <sphereGeometry args={[0.35, 14, 10]} />
        </mesh>
      ))}
      <group position={[0, 0.95, 0]}>
        <mesh material={m.crown}>
          <cylinderGeometry args={[0.42, 0.5, 0.3, 12]} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.4, 0.3, Math.sin(a) * 0.4]} material={m.crown}>
              <coneGeometry args={[0.1, 0.32, 6]} />
            </mesh>
          );
        })}
      </group>
      {[-1, 1].map((sgn) => (
        <group key={sgn} position={[sgn * 0.35, 0.25, 0.85]}>
          <mesh material={m.eye}>
            <sphereGeometry args={[0.17, 14, 12]} />
          </mesh>
          <mesh position={[0, 0, 0.13]} material={m.mouth}>
            <sphereGeometry args={[0.08, 10, 8]} />
          </mesh>
          <mesh position={[0, 0.2, 0.02]} rotation={[0, 0, sgn * -0.6]} material={m.dark}>
            <boxGeometry args={[0.36, 0.08, 0.08]} />
          </mesh>
        </group>
      ))}
      <group position={[0, -0.3, 0.86]} rotation={[0.4, 0, 0]}>
        <mesh material={m.mouth}>
          <boxGeometry args={[0.8, 0.3, 0.2]} />
        </mesh>
        {[-0.28, -0.1, 0.1, 0.28].map((x, i) => (
          <mesh key={i} position={[x, 0.08, 0.08]} rotation={[Math.PI, 0, 0]} material={m.teeth}>
            <coneGeometry args={[0.07, 0.16, 5]} />
          </mesh>
        ))}
      </group>
      {/* foam that buries the boss as it is scrubbed */}
      <group ref={foam} visible={false}>
        {FOAM_DIRS.map((d, i) => (
          <mesh key={i} position={[d[0] * 0.95, d[1] * 0.95, d[2] * 0.95]} material={m.foam} scale={0.001}>
            <sphereGeometry args={[1, 12, 10]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
