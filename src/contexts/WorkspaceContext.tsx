import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface AgencyClient {
  id: string;
  client_name: string;
  client_email: string | null;
  status: string | null;
  client_user_id?: string | null;
  agency_id?: string;
  agency_name?: string;
}

export interface ActiveWorkspace {
  type: "agency" | "client";
  id: string;
  name: string;
  clientUserId?: string;
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
  agencies: { id: string; name: string }[];
  isPlatformOwner: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const WS_ACTIVE_KEY = "aikortex_active_workspace";

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { user, profile } = useAuth();
  const [agencyName, setAgencyName] = useState("Meu Workspace");
  const [agencyProfileId, setAgencyProfileId] = useState<string | null>(null);
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [agencies, setAgencies] = useState<{ id: string; name: string }[]>([]);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState<ActiveWorkspace>({
    type: "agency", id: "", name: "Meu Workspace",
  });

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const load = async () => {
      try {
        // Platform owner/admin: load ALL agencies and ALL clients (cascata)
        if (profile?.tenant_type === "platform") {
          setIsPlatformOwner(true);
          const { data: ag } = await supabase
            .from("agency_profiles")
            .select("id, agency_name")
            .order("agency_name");
          setAgencies((ag ?? []).map(a => ({ id: a.id, name: a.agency_name ?? "Sem nome" })));
          const { data: cl } = await supabase
            .from("agency_clients")
            .select("id, client_name, client_email, status, client_user_id, agency_id")
            .eq("status", "active")
            .order("client_name");
          const enriched: AgencyClient[] = (cl ?? []).map(c => ({
            ...c,
            agency_name: ag?.find(a => a.id === c.agency_id)?.agency_name ?? undefined,
          }));
          setClients(enriched);
          setAgencyName("Plataforma");
          setAgencyProfileId(null);
          setActiveWorkspace({ type: "agency", id: "", name: "Plataforma" });
          return;
        }

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
            .select("id, client_name, client_email, status, client_user_id")
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
    const ws: ActiveWorkspace = { type: "agency", id: agencyProfileId ?? "", name: agencyName };
    setActiveWorkspace(ws);
    localStorage.setItem(WS_ACTIVE_KEY, JSON.stringify(ws));
  }, [agencyProfileId, agencyName]);

  const switchToClient = useCallback((client: AgencyClient) => {
    const ws: ActiveWorkspace = {
      type: "client",
      id: client.id,
      name: client.client_name,
      clientUserId: client.client_user_id ?? undefined,
    };
    setActiveWorkspace(ws);
    localStorage.setItem(WS_ACTIVE_KEY, JSON.stringify(ws));
  }, []);

  const refreshClients = useCallback(async () => {
    if (!agencyProfileId) return;
    const { data } = await supabase
      .from("agency_clients")
      .select("id, client_name, client_email, status, client_user_id")
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
      agencies, isPlatformOwner,
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
