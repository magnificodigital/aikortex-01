import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

/**
 * Returns the owner_id to use for all workspace data queries.
 * - When agency is viewing a client workspace → returns client's user ID.
 * - Otherwise → returns the logged-in user's ID.
 * This way the agency sees exactly the same data as the client.
 */
export const useWorkspaceOwner = () => {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const ownerId: string =
    activeWorkspace?.clientUserId ?? user?.id ?? "";

  return { ownerId };
};