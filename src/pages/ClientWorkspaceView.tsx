import { useParams } from "react-router-dom";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";

const ClientWorkspaceView = () => {
  const { clientId } = useParams<{ clientId: string }>();
  return <WorkspaceShell mode="read_only" clientId={clientId} />;
};

export default ClientWorkspaceView;
