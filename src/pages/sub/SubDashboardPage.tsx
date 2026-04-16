import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Wallet, CalendarDays, TrendingUp, PiggyBank } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPkr } from "@/lib/currency";
import { apiUrl } from "@/lib/apiBase";

type SubDashboard = {
  allottedBudget: number;
  walletBalance: number;
  spentCommitted: number;
  remainingVsAllotment: number;
  spendingThisWeek: number;
  spendingThisMonth: number;
  recentActivity: { id: string; reason: string; amount: number; date: string; status: string }[];
};

export default function SubDashboardPage() {
  const [data, setData] = useState<SubDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/sub/dashboard"), { credentials: "include" });
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
            title="Total credited"
            value={formatPkr(data.allottedBudget)}
            icon={PiggyBank}
            trend={{ value: "Top-ups total", positive: true }}
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
            trend={{ value: `${util}% used`, positive: util < 80 }}
          />
        </div>

        <Card className="ui-card-interactive">
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
    </DashboardLayout>
  );
}
