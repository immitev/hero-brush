import { EffectComposer, Vignette } from '@react-three/postprocessing';

/** High-quality tier only: a light vignette (bloom was removed: it hazed the near-white teeth). */
export function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <Vignette eskil={false} offset={0.35} darkness={0.3} />
    </EffectComposer>
  );
}
