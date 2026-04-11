import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { SubAppSidebar } from "@/components/SubAppSidebar";
import { Bell } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  /** Admin portal (default) or sub-admin portal sidebar. */
  mode?: "admin" | "sub";
}

function initialsFrom(name: string) {
  const p = name.trim().split(/\s+/);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return `${p[0][0]}${p[1][0]}`.toUpperCase();
}

export function DashboardLayout({ children, title, mode = "admin" }: DashboardLayoutProps) {
  const { me } = useAuth();
  const isSub = mode === "sub";
  const displayName = isSub && me?.role === "subadmin" ? me.user.name : "Admin";
  const initials = isSub && me?.role === "subadmin" ? initialsFrom(me.user.name) : "AD";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {isSub ? <SubAppSidebar /> : <AppSidebar />}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center justify-between border-b bg-card px-4 md:px-6 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h1 className="text-lg font-semibold text-foreground hidden sm:block">{title}</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-destructive rounded-full" />
              </Button>
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground hidden md:block">{displayName}</span>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
