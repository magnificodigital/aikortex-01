import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AccessDenied from "./AccessDenied";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
  tenantTypes?: string[];
}

const ProtectedRoute = ({ children, roles, tenantTypes }: ProtectedRouteProps) => {
  const { user, profile, loading, getRedirectPath } = useAuth();
  const location = useLocation();
  const [clientSlug, setClientSlug] = useState<string | null>(null);
  const [resolvingSlug, setResolvingSlug] = useState(false);

  // For direct clients, resolve their workspace slug so we can route them properly.
  useEffect(() => {
    if (profile?.tenant_type !== "client" || !user) return;
    if (location.pathname.startsWith("/workspace/")) return;
    setResolvingSlug(true);
    supabase
      .from("agency_clients")
      .select("workspace_slug, id")
      .eq("client_user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setClientSlug(data?.workspace_slug ?? data?.id ?? user.id);
        setResolvingSlug(false);
      });
  }, [profile, user, location.pathname]);

  if (loading || resolvingSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Direct clients always go to their workspace, regardless of which route they tried.
  if (
    profile?.tenant_type === "client" &&
    !location.pathname.startsWith("/workspace/") &&
    clientSlug
  ) {
    return <Navigate to={`/workspace/${clientSlug}`} replace />;
  }

  // Deny access when role/tenant constraints are required but the profile
  // hasn't been confirmed (or is missing a real id from the database).
  // This prevents privilege escalation if the in-memory default profile
  // is ever applied before the real one loads.
  const requiresRole = roles && roles.length > 0;
  const requiresTenant = tenantTypes && tenantTypes.length > 0;

  if ((requiresRole || requiresTenant) && (!profile || !profile.id)) {
    return <AccessDenied />;
  }

  if (requiresRole && profile && !roles!.includes(profile.role)) {
    return <Navigate to={getRedirectPath()} replace />;
  }

  if (requiresTenant && profile && !tenantTypes!.includes(profile.tenant_type)) {
    return <Navigate to={getRedirectPath()} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
