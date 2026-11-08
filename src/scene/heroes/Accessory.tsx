/**
 * Wardrobe add-ons, built from primitives in head-local space (head sphere of
 * radius 0.46 centred at the origin, face towards +Z).
 */
import { useMemo } from 'react';
import type { AccessoryId } from '../../heroes';
import { glow, toon } from '../materials';

export function Accessory({ id }: { id: AccessoryId | undefined }) {
  const m = useMemo(
    () => ({
      gold: toon('#f6c445'),
      gem: glow('#ff5c7a', 1.4),
      gemB: glow('#4fd1ff', 1.4),
      lens: toon('#1b1340'),
      frame: toon('#ff4f9a'),
      shine: toon('#ffffff'),
      cap: toon('#2f80ed'),
      capBrim: toon('#ffd166'),
      phones: toon('#ff5c7a'),
      cushion: toon('#2b2f3a'),
      bow: toon('#ff6fb5'),
      bowKnot: toon('#e0457f'),
    }),
    [],
  );
  if (!id) return null;

  if (id === 'crown') {
    const points = [-2, -1, 0, 1, 2];
    return (
      <group position={[0, 0.4, -0.02]} rotation={[-0.12, 0, 0.08]}>
        <mesh material={m.gold}>
          <cylinderGeometry args={[0.27, 0.25, 0.14, 20, 1, true]} />
        </mesh>
        {points.map((k) => {
          const a = (k * Math.PI) / 5;
          return (
            <mesh key={k} position={[Math.sin(a) * 0.26, 0.13, Math.cos(a) * 0.26]} material={m.gold}>
              <coneGeometry args={[0.055, 0.14, 8]} />
            </mesh>
          );
        })}
        {points.map((k) => {
          const a = (k * Math.PI) / 5 + Math.PI;
          return (
            <mesh key={`b${k}`} position={[Math.sin(a) * 0.26, 0.13, Math.cos(a) * 0.26]} material={m.gold}>
              <coneGeometry args={[0.055, 0.14, 8]} />
            </mesh>
          );
        })}
        <mesh position={[0, 0, 0.27]} material={m.gem}>
          <sphereGeometry args={[0.05, 12, 10]} />
        </mesh>
        <mesh position={[0.2, 0, 0.18]} material={m.gemB}>
          <sphereGeometry args={[0.035, 10, 8]} />
        </mesh>
        <mesh position={[-0.2, 0, 0.18]} material={m.gemB}>
          <sphereGeometry args={[0.035, 10, 8]} />
        </mesh>
      </group>
    );
  }

  if (id === 'shades') {
    return (
      <group position={[0, 0.07, 0.43]}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.16, 0, 0]} rotation={[0, s * 0.28, 0]}>
            <mesh scale={[1, 0.8, 0.35]} material={m.frame}>
              <sphereGeometry args={[0.13, 16, 12]} />
            </mesh>
            <mesh position={[0, 0, 0.03]} scale={[0.85, 0.66, 0.3]} material={m.lens}>
              <sphereGeometry args={[0.13, 16, 12]} />
            </mesh>
            <mesh position={[-0.04, 0.04, 0.075]} material={m.shine}>
              <sphereGeometry args={[0.022, 8, 6]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.02, 0.02]} rotation={[0, 0, Math.PI / 2]} material={m.frame}>
          <cylinderGeometry args={[0.018, 0.018, 0.1, 8]} />
        </mesh>
      </group>
    );
  }

  if (id === 'cap') {
    return (
      <group position={[0, 0.1, 0]} rotation={[-0.1, 0, 0]}>
        <mesh material={m.cap}>
          <sphereGeometry args={[0.485, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 0.02, 0.48]} scale={[1, 1, 0.9]} rotation={[0.18, 0, 0]} material={m.capBrim}>
          <cylinderGeometry args={[0.3, 0.3, 0.035, 20, 1, false, -Math.PI / 2, Math.PI]} />
        </mesh>
        <mesh position={[0, 0.48, 0]} material={m.capBrim}>
          <sphereGeometry args={[0.05, 10, 8]} />
        </mesh>
      </group>
    );
  }

  if (id === 'headphones') {
    return (
      <group position={[0, 0.02, -0.02]}>
        <mesh material={m.phones}>
          <torusGeometry args={[0.5, 0.045, 8, 24, Math.PI]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.48, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
            <mesh material={m.phones}>
              <cylinderGeometry args={[0.16, 0.16, 0.12, 18]} />
            </mesh>
            <mesh position={[0, -s * 0.07, 0]} material={m.cushion}>
              <cylinderGeometry args={[0.13, 0.13, 0.04, 18]} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  // bow
  return (
    <group position={[0.22, 0.38, 0.08]} rotation={[0.2, 0, -0.5]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.12, 0, 0]} rotation={[0, 0, (s * Math.PI) / 2]} scale={[1, 1, 0.55]} material={m.bow}>
          <coneGeometry args={[0.12, 0.22, 12]} />
        </mesh>
      ))}
      <mesh material={m.bowKnot}>
        <sphereGeometry args={[0.06, 12, 10]} />
      </mesh>
    </group>
  );
}
