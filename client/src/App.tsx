import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import TronScene from './components/TronScene';
import HUD from './components/HUD';
import { useAgentEvents } from './hooks/useAgentEvents';

function App() {
  useAgentEvents();
  // viewingFile is still tracked in store but now handled within the 3D scene

  return (
    <>
      <Canvas
        camera={{ position: [0, 20, -15], fov: 60 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#000000' }}
      >
        <Suspense fallback={null}>
          <TronScene />
        </Suspense>
      </Canvas>
      <HUD />
    </>
  );
}

export default App;
