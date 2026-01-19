import { EffectComposer, Bloom } from '@react-three/postprocessing';

export default function NeonBloom() {
  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={0.2}
        luminanceSmoothing={0.9}
        intensity={1.5}
        radius={0.8}
      />
    </EffectComposer>
  );
}
