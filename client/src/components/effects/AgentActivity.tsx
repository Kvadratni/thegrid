import BashEffect from './BashEffect';
import ReadEffect from './ReadEffect';
import WriteEffect from './WriteEffect';
import EditEffect from './EditEffect';
import SearchEffect from './SearchEffect';
import TaskSpawnEffect from './TaskSpawnEffect';

interface AgentActivityProps {
  position: [number, number, number];
  color: string;
  isActive: boolean;
  toolName?: string;
}

export default function AgentActivity({ position, isActive, toolName }: AgentActivityProps) {
  if (!isActive || !toolName) return null;

  // Render tool-specific effect
  switch (toolName) {
    case 'Bash':
    case 'Delete':
      return <BashEffect position={position} />;

    case 'Read':
      return <ReadEffect position={position} />;

    case 'Write':
    case 'NotebookEdit':
      return <WriteEffect position={position} />;

    case 'Edit':
      return <EditEffect position={position} />;

    case 'Grep':
    case 'Glob':
      return <SearchEffect position={position} />;

    case 'Task':
      return <TaskSpawnEffect position={position} />;

    default:
      // For unknown tools, show a subtle pulse
      return (
        <mesh position={position}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial color="#888888" transparent opacity={0.3} />
        </mesh>
      );
  }
}
