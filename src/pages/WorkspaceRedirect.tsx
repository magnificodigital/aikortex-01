import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const WorkspaceRedirect = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    const resolve = async () => {
      if (profile?.tenant_type === "client") {
        const { data } = await supabase
          .from("agency_clients")
          .select("workspace_slug")
          .eq("client_user_id", user.id)
          .maybeSingle();

        const slug = data?.workspace_slug;
        if (slug) {
          navigate(`/workspace/${slug}`, { replace: true });
        } else {
          navigate(`/workspace/${user.id}`, { replace: true });
        }
      } else {
        navigate("/home", { replace: true });
      }
    };

    resolve();
  }, [user, profile, navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-background text-muted-foreground gap-2">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>Redirecionando para seu workspace...</span>
    </div>
  );
};

export default WorkspaceRedirect;