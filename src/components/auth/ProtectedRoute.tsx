import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AccessDenied from "./AccessDenied";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
  tenantTypes?: string[];
}

const ProtectedRoute = ({ children, roles, tenantTypes }: ProtectedRouteProps) => {
  const { user, profile, loading, getRedirectPath } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
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
