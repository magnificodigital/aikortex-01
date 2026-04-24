import { ReactNode, useCallback, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import ClientSidebar from "./ClientSidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const ClientLayout = ({ children }: { children: ReactNode }) => {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  return (
    <div className="flex min-h-screen w-full overflow-hidden">
      <ClientSidebar mobileOpen={mobileOpen} onMobileClose={close} />
      <main className="relative flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-background">
        {isMobile && (
          <div className="sticky top-0 z-30 flex items-center justify-between bg-background/80 backdrop-blur-lg px-3 py-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div />
          </div>
        )}
        <div className="relative z-10">{children}</div>
      </main>
    </div>
  );
};

export default ClientLayout;