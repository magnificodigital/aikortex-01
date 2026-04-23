/**
 * Re-exported from Workspace.tsx where the slug is resolved.
 * Inside a /workspace/:slug/* route, returns the client's owner_id.
 * Outside the workspace, returns "" (callers should fall back to user.id).
 */
export { useWorkspaceOwner } from "@/pages/Workspace";