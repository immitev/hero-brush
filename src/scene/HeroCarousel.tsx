/** 3D carousel used by the Hero Select screen. */
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { HEROES, type Suit } from '../heroes';
import { toon } from './materials';
import { HeroModel, createHeroAnim, type HeroAnim } from './heroes/HeroModel';

const RADIUS = 2.6;

function Pedestal({ active }: { active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.4;
  });
  return (
    <mesh ref={ref} position={[0, -0.06, 0]} material={active ? pedestalActive : pedestalIdle}>
      <cylinderGeometry args={[0.95, 1.05, 0.12, 24]} />
    </mesh>
  );
}
const pedestalActive = toon('#7d63d9');
const pedestalIdle = toon('#3b2b6b');

function Ring({ index, suits, setFacing }: { index: number; suits: readonly Suit[]; setFacing: (i: number) => void }) {
  const ring = useRef<THREE.Group>(null);
  const anims = useRef<HeroAnim[]>(HEROES.map(() => createHeroAnim('idle')));
  const angle = useRef(0);
  const lastReported = useRef(-1);

  useFrame((state, dt) => {
    const g = ring.current;
    if (!g) return;
    const target = -(index / HEROES.length) * Math.PI * 2;
    let d = target - angle.current;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    angle.current += d * (1 - Math.exp(-dt * 6));
    g.rotation.y = angle.current;
    for (const a of anims.current) {
      a.modeT = state.clock.elapsedTime;
      a.speed = 0;
    }
    if (lastReported.current !== index) {
      lastReported.current = index;
      setFacing(index);
    }
  });

  return (
    <group ref={ring}>
      {HEROES.map((hero, i) => {
        const a = (i / HEROES.length) * Math.PI * 2;
        const x = Math.sin(a) * RADIUS;
        const z = Math.cos(a) * RADIUS;
        return (
          <group key={hero.id} position={[x, -0.9, z]} rotation={[0, a, 0]}>
            <Pedestal active={i === index} />
            <HeroModel hero={hero} suit={suits[i]} anim={{ current: anims.current[i] }} />
          </group>
        );
      })}
    </group>
  );
}

export function HeroCarousel({ index, suits, onFacing }: { index: number; suits: readonly Suit[]; onFacing?: (i: number) => void }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 42, position: [0, 0.6, 9.6], near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, camera }) => {
        gl.toneMapping = THREE.NoToneMapping;
        camera.lookAt(0, -0.75, RADIUS);
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <hemisphereLight args={['#ffffff', '#4b2a6e', 1.1]} />
      <directionalLight position={[3, 6, 5]} intensity={2.2} />
      <directionalLight position={[-4, 2, 3]} intensity={0.6} color="#9fd8ff" />
      <Ring index={index} suits={suits} setFacing={onFacing ?? (() => undefined)} />
    </Canvas>
  );
}
