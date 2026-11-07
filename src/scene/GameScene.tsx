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

export const ARENA_BG = '#e9b5cd';

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
      <color attach="background" args={[ARENA_BG]} />
      <fog attach="fog" args={['#d9a3bf', 12, 30]} />
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
        <Particles quality={quality} />
        {quality === 'high' && <Sparkles count={50} scale={[9, 5, 8]} size={3} speed={0.3} opacity={0.45} color="#ffffff" />}
      </Suspense>
      <CameraRig />
      {quality === 'high' && <Effects />}
    </Canvas>
  );
}
