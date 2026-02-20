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

    const currentDirName = currentPath.split('/').pop() || '';
    const currentPathParts = currentPath.split('/').filter(Boolean);

    return agents.filter((agent) => {
      // Spawned agents from the Grid UI are always visible
      if (agent.sessionId.startsWith('grid-')) return true;

      if (!agent.currentPath) return false;

      const agentPath = agent.currentPath;

      // Case 1: Exact prefix match (both absolute paths)
      if (agentPath.startsWith(currentPath + '/') || agentPath === currentPath) {
        return true;
      }

      // Case 2: Agent's workingDirectory matches
      if (agent.workingDirectory && (
        agent.workingDirectory.startsWith(currentPath) ||
        currentPath.startsWith(agent.workingDirectory)
      )) {
        return true;
      }

      // Case 3: Agent path starts with a recognizable suffix of currentPath
      const meaningfulDepth = Math.min(3, currentPathParts.length);
      for (let i = currentPathParts.length - meaningfulDepth; i < currentPathParts.length; i++) {
        const suffix = currentPathParts.slice(i).join('/');
        if (agentPath === suffix || agentPath.startsWith(suffix + '/')) {
          return true;
        }
      }

      // Case 4: Agent path starts with the current directory name followed by /
      if (currentDirName && agentPath.startsWith(currentDirName + '/')) {
        return true;
      }

      return false;
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
