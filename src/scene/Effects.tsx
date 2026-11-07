import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';

export function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.02} intensity={0.8} radius={0.6} />
      <Vignette eskil={false} offset={0.3} darkness={0.35} />
    </EffectComposer>
  );
}
