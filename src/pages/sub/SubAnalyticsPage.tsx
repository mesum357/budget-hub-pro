import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { DollarSign, PieChart as PieIcon, TrendingUp } from "lucide-react";
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

type Payload = {
  totalSpent: number;
  allottedBudget: number;
  monthlySpendingData: MonthlyPoint[];
  spendingByUser: { name: string; spent: number }[];
};

export default function SubAnalyticsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/sub/analytics"), { credentials: "include" });
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
      <DashboardLayout title="Analytics" mode="sub">
        <p className="text-sm text-muted-foreground">{loading ? "Loading…" : "No data."}</p>
      </DashboardLayout>
    );
  }

  const remaining = Math.max(0, data.allottedBudget - data.totalSpent);
  const util =
    data.allottedBudget > 0 ? Math.min(100, Math.round((data.totalSpent / data.allottedBudget) * 100)) : 0;

  return (
    <DashboardLayout title="Analytics" mode="sub">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="Total spent" value={formatPkr(data.totalSpent)} icon={DollarSign} />
          <StatCard title="Credited used" value={`${util}%`} icon={TrendingUp} trend={{ value: "Of total credited", positive: util < 90 }} />
          <StatCard title="Headroom" value={formatPkr(remaining)} icon={PieIcon} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="ui-card-interactive">
            <CardHeader>
              <CardTitle className="text-base">Your spending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.spendingByUser} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      type="number"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickFormatter={(v) => formatPkrAxis(Number(v))}
                    />
                    <YAxis type="category" dataKey="name" width={60} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
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
              </div>
            </CardContent>
          </Card>

          <Card className="ui-card-interactive lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Monthly trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.monthlySpendingData}>
                    <defs>
                      <linearGradient id="subSpendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => formatPkrAxis(Number(v))} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(v: number) => [formatPkr(v), ""]}
                    />
                    <Area type="monotone" dataKey="spending" stroke="hsl(var(--chart-1))" fill="url(#subSpendGrad)" strokeWidth={2} />
                    <Line type="monotone" dataKey="budget" stroke="hsl(var(--chart-2))" strokeDasharray="5 5" dot={false} />
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
