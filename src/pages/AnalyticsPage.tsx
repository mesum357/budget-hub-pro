import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { TrendingUp, DollarSign, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  Area,
  AreaChart,
} from "recharts";
import type { MonthlyPoint } from "@/data/mockData";
import { formatPkr, formatPkrAxis } from "@/lib/currency";
import { apiUrl } from "@/lib/apiBase";

type AnalyticsPayload = {
  spendingByUser: { name: string; spent: number }[];
  monthlySpendingData: MonthlyPoint[];
  totalSpent: number;
  avgSpend: number;
  topSpender: { name: string; spent: number };
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/admin/analytics"), { credentials: "include" });
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
      <DashboardLayout title="Analytics">
        <p className="text-sm text-muted-foreground">{loading ? "Loading analytics…" : "No data yet."}</p>
      </DashboardLayout>
    );
  }

  const { totalSpent, avgSpend, topSpender, spendingByUser, monthlySpendingData } = data;

  return (
    <DashboardLayout title="Analytics">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Spent"
            value={formatPkr(totalSpent)}
            icon={DollarSign}
            trend={{ value: "All sub-admins", positive: true }}
          />
          <StatCard title="Avg per User" value={formatPkr(avgSpend)} icon={Users} />
          <StatCard
            title="Top Spender"
            value={topSpender.name}
            icon={TrendingUp}
            trend={{ value: formatPkr(topSpender.spent), positive: false }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="ui-card-interactive">
            <CardHeader>
              <CardTitle className="text-base">Spending by User</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {spendingByUser.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No spending recorded yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={spendingByUser} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        type="number"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        tickFormatter={(v) => formatPkrAxis(Number(v))}
                      />
                      <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} width={80} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(v: number) => [formatPkr(v), "Spent"]}
                      />
                      <Bar dataKey="spent" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="ui-card-interactive lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Monthly spending vs allocated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlySpendingData}>
                    <defs>
                      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickFormatter={(v) => formatPkrAxis(Number(v))}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(v: number) => [formatPkr(v), ""]}
                    />
                    <Area type="monotone" dataKey="spending" name="Spending" stroke="hsl(var(--chart-1))" fill="url(#spendGrad)" strokeWidth={2} />
                    <Line
                      type="monotone"
                      dataKey="budget"
                      name="Allocated in month"
                      stroke="hsl(var(--chart-2))"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
