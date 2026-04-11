import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Wallet, CalendarDays, TrendingUp, PiggyBank } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { MonthlyPoint } from "@/data/mockData";
import { formatPkr, formatPkrAxis } from "@/lib/currency";

type SubDashboard = {
  allottedBudget: number;
  walletBalance: number;
  spentCommitted: number;
  remainingVsAllotment: number;
  spendingThisWeek: number;
  spendingThisMonth: number;
  monthlySpendingData: MonthlyPoint[];
  recentActivity: { id: string; reason: string; amount: number; date: string; status: string }[];
};

export default function SubDashboardPage() {
  const [data, setData] = useState<SubDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/sub/dashboard", { credentials: "include" });
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
      <DashboardLayout title="Dashboard" mode="sub">
        <p className="text-sm text-muted-foreground">{loading ? "Loading…" : "Could not load dashboard."}</p>
      </DashboardLayout>
    );
  }

  const util =
    data.allottedBudget > 0 ? Math.min(100, Math.round((data.spentCommitted / data.allottedBudget) * 100)) : 0;

  return (
    <DashboardLayout title="Dashboard" mode="sub">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Allotted budget"
            value={formatPkr(data.allottedBudget)}
            icon={PiggyBank}
            trend={{ value: "Spending cap", positive: true }}
          />
          <StatCard
            title="Wallet balance"
            value={formatPkr(data.walletBalance)}
            icon={Wallet}
            trend={{ value: "Available funds", positive: data.walletBalance > 0 }}
          />
          <StatCard
            title="This week"
            value={formatPkr(Math.round(data.spendingThisWeek))}
            icon={CalendarDays}
            trend={{ value: "Spending", positive: true }}
          />
          <StatCard
            title="This month"
            value={formatPkr(Math.round(data.spendingThisMonth))}
            icon={TrendingUp}
            trend={{ value: `${util}% of allotment used`, positive: util < 80 }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Spending vs allotment (6 months)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlySpendingData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
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
                    <Bar dataKey="budget" name="Your allotment" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} opacity={0.25} />
                    <Bar dataKey="spending" name="Your spending" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Recent receipts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.recentActivity.length === 0 && <p className="text-sm text-muted-foreground">No receipts yet.</p>}
              {data.recentActivity.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.date} · {item.status}
                    </p>
                  </div>
                  <span className="text-sm font-semibold ml-2 whitespace-nowrap">{formatPkr(item.amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
