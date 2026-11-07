import { PerformanceMonitor, Sparkles } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useStore } from '../game/store';
import type { HeroPack, Suit } from '../heroes';
import { Arena, Lights } from './Arena';
import { Brush } from './Brush';
import { CameraRig } from './CameraRig';
import { Effects } from './Effects';
import { HeroRig } from './HeroRig';
import { Particles } from './Particles';

export const ARENA_BG = '#e9b5cd';

/** Procedural room reflections for the enamel / gum materials (no downloads, built once). */
function Environment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.28;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

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
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.82;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={[ARENA_BG]} />
      <fog attach="fog" args={['#d9a3bf', 16, 34]} />
      <PerformanceMonitor
        bounds={() => [40, 58]}
        flipflops={3}
        onChange={({ factor }) => setDpr(Math.round((0.7 + 1.3 * factor) * 10) / 10)}
        onFallback={() => setForcedLow(true)}
      />
      <Environment />
      <Lights />
      <Suspense fallback={null}>
        <Arena highQuality={quality === 'high'} />
        <HeroRig hero={hero} suit={suit} />
        <Brush hero={hero} suit={suit} />
        <Particles quality={quality} />
        {quality === 'high' && <Sparkles count={40} scale={[9, 5, 8]} size={3} speed={0.3} opacity={0.4} color="#ffffff" />}
      </Suspense>
      <CameraRig />
      {quality === 'high' && <Effects />}
    </Canvas>
  );
}
