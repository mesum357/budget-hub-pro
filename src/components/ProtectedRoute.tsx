import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) {
    return <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }
  if (me?.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function RequireSub({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) {
    return <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }
  if (me?.role !== "subadmin") return <Navigate to="/" replace />;
  return <>{children}</>;
}
