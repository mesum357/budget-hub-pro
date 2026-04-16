import { LayoutDashboard, Users, Wallet, Receipt, BarChart3, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { apiUrl } from "@/lib/apiBase";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Users", url: "/users", icon: Users },
  { title: "Budgets", url: "/budgets", icon: Wallet },
  { title: "Spendings", url: "/spendings", icon: Receipt },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [pendingReceipts, setPendingReceipts] = useState<number>(0);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await logout();
    navigate("/");
  };

  const loadSidebarCounts = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/admin/receipts"), { credentials: "include" });
      if (!r.ok) return;
      const data = (await r.json()) as { status?: string }[];
      const pending = data.reduce((acc, row) => acc + (row.status === "pending" ? 1 : 0), 0);
      setPendingReceipts(pending);
    } catch {
      // ignore sidebar counts failures
    }
  }, []);

  useEffect(() => {
    void loadSidebarCounts();
    const t = window.setInterval(() => void loadSidebarCounts(), 30_000);
    return () => window.clearInterval(t);
  }, [loadSidebarCounts]);

  const badgesByUrl = useMemo(() => {
    return {
      "/spendings": pendingReceipts,
    } satisfies Record<string, number>;
  }, [pendingReceipts]);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-6">
            {!collapsed ? (
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-bold text-base text-foreground">BudgetMS</span>
              </div>
            ) : (
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
                <Wallet className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                    size="lg"
                  >
                    <NavLink
                      to={item.url}
                      end
                      className="relative rounded-md ui-focus-ring hover:bg-sidebar-accent/60 transition-[background-color,color,transform] duration-200 ease-out hover:translate-x-[2px]"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:rounded-r before:bg-sidebar-primary"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                  {badgesByUrl[item.url] ? <SidebarMenuBadge>{badgesByUrl[item.url]}</SidebarMenuBadge> : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              onClick={handleLogout}
              tooltip="Logout"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Logout</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
