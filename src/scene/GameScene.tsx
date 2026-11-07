import { PerformanceMonitor, Sparkles } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useState } from 'react';
import * as THREE from 'three';
import { useStore } from '../game/store';
import type { HeroPack, Suit } from '../heroes';
import { Arena, Lights } from './Arena';
import { Boss } from './Boss';
import { CameraRig } from './CameraRig';
import { Effects } from './Effects';
import { HeroRig } from './HeroRig';
import { Monsters } from './Monsters';
import { Particles } from './Particles';
import { Projectiles } from './Projectiles';

export function GameScene({ hero, suit }: { hero: HeroPack; suit: Suit }) {
  const quality = useStore((s) => (s.forcedLowQuality ? 'low' : s.settings.quality));
  const setForcedLow = useStore((s) => s.setForcedLowQuality);
  const [dpr, setDpr] = useState<number>(() => Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2));
  const maxDpr = quality === 'high' ? 2 : 1.25;

  return (
    <Canvas
      dpr={Math.min(dpr, maxDpr)}
      camera={{ fov: 60, near: 0.1, far: 60, position: [0, 0.4, 9] }}
      gl={{ antialias: quality === 'high', powerPreference: 'high-performance', alpha: false, stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#3a1230']} />
      <fog attach="fog" args={['#3a1230', 10, 26]} />
      <PerformanceMonitor
        bounds={() => [40, 58]}
        flipflops={3}
        onChange={({ factor }) => setDpr(Math.round((0.7 + 1.3 * factor) * 10) / 10)}
        onFallback={() => setForcedLow(true)}
      />
      <Lights />
      <Suspense fallback={null}>
        <Arena />
        <HeroRig hero={hero} suit={suit} />
        <Monsters />
        <Boss />
        <Projectiles hero={hero} suit={suit} />
        <Particles quality={quality} />
        {quality === 'high' && <Sparkles count={60} scale={[9, 5, 8]} size={3} speed={0.3} opacity={0.5} color="#ffd6f0" />}
      </Suspense>
      <CameraRig />
      {quality === 'high' && <Effects />}
    </Canvas>
  );
}
