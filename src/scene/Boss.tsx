/** The Cavity King: big purple blob with a crown. Appears for the last 20 s. */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BOSS_POSITION } from '../game/mouth';
import { runtime } from '../game/runtime';
import { glow, toon } from './materials';

export function Boss() {
  const group = useRef<THREE.Group>(null);
  const bodyMat = useMemo(() => toon('#5b2a86'), []);
  const m = useMemo(
    () => ({
      dark: toon('#3b1a5c'),
      crown: toon('#f2c14e'),
      eye: glow('#ff5a5a', 1.8),
      teeth: toon('#f6f6f6'),
      mouth: toon('#1b0a2b'),
    }),
    [],
  );
  const baseColor = useMemo(() => new THREE.Color('#5b2a86'), []);
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
    const base = 0.5 + 0.6 * health; // shrinks as it loses
    const wob = 1 + Math.sin(t * 3) * 0.04;
    const shrinkBoom = rt.bossActive ? 1 : Math.max(0, 1 - (1 - s) * 1.4);
    g.scale.setScalar(base * s * wob * shrinkBoom * (1 + hitK * 0.15));
    g.position.set(BOSS_POSITION[0] + Math.sin(t * 1.3) * 0.2, BOSS_POSITION[1] + Math.sin(t * 2.1) * 0.15 + (1 - s) * 2.5, BOSS_POSITION[2]);
    g.rotation.y = Math.sin(t * 0.7) * 0.25 + (hitK ? Math.sin(t * 90) * 0.1 : 0);
    g.rotation.z = hitK * Math.sin(t * 60) * 0.08;
    bodyMat.color.copy(baseColor).lerp(white, hitK);
    bodyMat.emissive.setScalar(hitK * 0.6);
  });

  return (
    <group ref={group} visible={false}>
      <mesh material={bodyMat}>
        <sphereGeometry args={[1, 28, 22]} />
      </mesh>
      {/* lumps */}
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
      {/* crown */}
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
      {/* eyes */}
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
      {/* mouth with teeth */}
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
    </group>
  );
}
