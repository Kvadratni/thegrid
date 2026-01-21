import { useMemo } from 'react';
import Grid from './Grid';
import FileSystem from './FileSystem';
import LightCycle from './LightCycle';
import CameraController from './CameraController';
import NeonBloom from './effects/NeonBloom';
import { useAgentStore } from '../stores/agentStore';

export default function TronScene() {
  const agents = useAgentStore((state) => state.agents);
  const fileSystem = useAgentStore((state) => state.fileSystem);
  const currentPath = useAgentStore((state) => state.currentPath);

  // Only show agents that are working within the current directory
  const visibleAgents = useMemo(() => {
    if (!currentPath) return agents;
    return agents.filter((agent) => {
      if (!agent.currentPath) return false;
      // Agent is visible if their working path is within the current directory
      return agent.currentPath.startsWith(currentPath);
    });
  }, [agents, currentPath]);

  return (
    <>
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 30, 100]} />

      <ambientLight intensity={0.1} />
      <pointLight position={[0, 50, 0]} intensity={0.5} color="#00FFFF" />

      <Grid />

      {fileSystem && <FileSystem node={fileSystem} position={[0, 0, 0]} />}

      {visibleAgents.map((agent) => (
        <LightCycle
          key={`${agent.sessionId}-${agent.agentType}`}
          agent={agent}
        />
      ))}

      <CameraController />

      <NeonBloom />
    </>
  );
}
