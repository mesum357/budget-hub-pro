import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Users, DollarSign, CreditCard, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { MonthlyPoint } from "@/data/mockData";
import { formatPkr, formatPkrAxis } from "@/lib/currency";

type AdminDashboard = {
  totalUsers: number;
  totalAllotted: number;
  totalSpent: number;
  utilizationPct: number;
  monthlySpendingData: MonthlyPoint[];
  recentActivity: { id: string; userName: string; reason: string; amount: number }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/dashboard", { credentials: "include" });
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return (
      <DashboardLayout title="Dashboard">
        <p className="text-sm text-muted-foreground">{loading ? "Loading dashboard…" : "Could not load dashboard."}</p>
      </DashboardLayout>
    );
  }

  const { totalUsers, totalAllotted, totalSpent, utilizationPct, monthlySpendingData, recentActivity } = data;

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Sub-Admins" value={String(totalUsers)} icon={Users} trend={{ value: "Active users", positive: true }} />
          <StatCard
            title="Money Allotted"
            value={formatPkr(totalAllotted)}
            icon={DollarSign}
            trend={{ value: "Across all users", positive: true }}
          />
          <StatCard
            title="Money Spent"
            value={formatPkr(Math.round(totalSpent))}
            icon={CreditCard}
            trend={{ value: "Pending + approved", positive: utilizationPct < 80 }}
          />
          <StatCard
            title="Budget Utilization"
            value={`${utilizationPct}%`}
            icon={Activity}
            trend={{ value: utilizationPct > 90 ? "Tight" : "Healthy", positive: utilizationPct < 90 }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Monthly spending vs allocated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySpendingData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => formatPkrAxis(Number(v))}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [formatPkr(value), ""]}
                    />
                    <Legend />
                    <Bar dataKey="budget" name="Allocated in month" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="spending" name="Spending" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.length === 0 && <p className="text-sm text-muted-foreground">No receipts yet.</p>}
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.userName}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.reason}</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground ml-2 whitespace-nowrap">
                    {formatPkr(item.amount)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
