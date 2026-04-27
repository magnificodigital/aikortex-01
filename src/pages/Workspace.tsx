import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";

const Workspace = () => {
  const { isClient } = useAuth();
  if (isClient) return <Navigate to="/home" replace />;
  return <WorkspaceShell mode="owner" />;
};

export default Workspace;
