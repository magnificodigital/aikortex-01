import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface AgencyClient {
  id: string;
  client_name: string;
  client_email: string | null;
  status: string | null;
  client_user_id?: string | null;
  workspace_slug?: string | null;
}

export interface ActiveWorkspace {
  type: "agency" | "client";
  id: string;
  name: string;
  clientUserId?: string;
  slug?: string;
}

interface WorkspaceContextType {
  agencyName: string;
  agencyProfileId: string | null;
  clients: AgencyClient[];
  activeWorkspace: ActiveWorkspace;
  switchToAgency: () => void;
  switchToClient: (client: AgencyClient) => void;
  loading: boolean;
  refreshClients: () => Promise<void>;
  isClientMode: boolean;
  activeClientUserId?: string;
  isReadOnlyView: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const WS_ACTIVE_KEY = "aikortex_active_workspace";

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [agencyName, setAgencyName] = useState("Meu Workspace");
  const [agencyProfileId, setAgencyProfileId] = useState<string | null>(null);
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState<ActiveWorkspace>({
    type: "agency", id: "", name: "Meu Workspace",
  });

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const load = async () => {
      try {
        // Direct client login — no agency profile, force client workspace
        if (profile?.tenant_type === "client") {
          const clientName = profile?.full_name ?? user.email ?? "Cliente";
          setAgencyName(clientName);
          setAgencyProfileId(null);
          setClients([]);
          setActiveWorkspace({ type: "client", id: user.id, name: clientName });
          return;
        }

        const { data: agency } = await supabase
          .from("agency_profiles")
          .select("id, agency_name")
          .eq("user_id", user.id)
          .maybeSingle();

        const name = agency?.agency_name || "Meu Workspace";
        setAgencyName(name);
        setAgencyProfileId(agency?.id ?? null);

        let loadedClients: AgencyClient[] = [];
        if (agency?.id) {
          const { data } = await supabase
            .from("agency_clients")
            .select("id, client_name, client_email, status, client_user_id, workspace_slug")
            .eq("agency_id", agency.id)
            .eq("status", "active")
            .order("client_name");
          loadedClients = data ?? [];
          setClients(loadedClients);
        }

        // Restore saved workspace
        try {
          const saved = localStorage.getItem(WS_ACTIVE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.type === "client") {
              const exists = loadedClients.find(c => c.id === parsed.id);
              if (exists) {
                setActiveWorkspace({
                  type: "client",
                  id: parsed.id,
                  name: parsed.name,
                  clientUserId: exists.client_user_id ?? undefined,
                });
                return;
              }
            }
          }
        } catch { /* ignore */ }

        setActiveWorkspace({ type: "agency", id: agency?.id ?? "", name });
      } catch (err) {
        console.error("Error loading workspace:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, profile]);

  const switchToAgency = useCallback(() => {
    navigate("/home");
    // Context will auto-update via the location watcher below
  }, [navigate]);

  const switchToClient = useCallback((client: AgencyClient) => {
    const slug = client.workspace_slug ?? client.id;
    navigate(`/workspace/${slug}`);
    // Context will auto-update via the location watcher below
  }, [navigate]);

  // Auto-sync activeWorkspace with the current URL
  useEffect(() => {
    if (!user || profile?.tenant_type === "client") return;

    const match = location.pathname.match(/^\/workspace\/([^/]+)/);
    if (!match) {
      if (activeWorkspace.type === "client" && agencyProfileId) {
        const ws: ActiveWorkspace = { type: "agency", id: agencyProfileId, name: agencyName };
        setActiveWorkspace(ws);
        localStorage.setItem(WS_ACTIVE_KEY, JSON.stringify(ws));
      }
      return;
    }

    const slug = match[1];
    if (activeWorkspace.type === "client" && activeWorkspace.slug === slug) return;

    supabase
      .from("agency_clients")
      .select("id, client_name, client_user_id, workspace_slug")
      .eq("workspace_slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const ws: ActiveWorkspace = {
            type: "client",
            id: data.id,
            name: data.client_name,
            clientUserId: data.client_user_id ?? undefined,
            slug: data.workspace_slug ?? undefined,
          };
          setActiveWorkspace(ws);
          localStorage.setItem(WS_ACTIVE_KEY, JSON.stringify(ws));
        }
      });
  }, [location.pathname, user, profile, agencyProfileId, agencyName, activeWorkspace.type, activeWorkspace.slug]);

  const refreshClients = useCallback(async () => {
    if (!agencyProfileId) return;
    const { data } = await supabase
      .from("agency_clients")
      .select("id, client_name, client_email, status, client_user_id, workspace_slug")
      .eq("agency_id", agencyProfileId)
      .eq("status", "active")
      .order("client_name");
    setClients(data ?? []);
  }, [agencyProfileId]);

  return (
    <WorkspaceContext.Provider value={{
      agencyName, agencyProfileId, clients,
      activeWorkspace, switchToAgency, switchToClient,
      loading, refreshClients,
      isClientMode: activeWorkspace.type === "client",
      activeClientUserId: activeWorkspace.type === "client" ? activeWorkspace.clientUserId : undefined,
      isReadOnlyView: activeWorkspace.type === "client" && profile?.tenant_type !== "client",
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
};
