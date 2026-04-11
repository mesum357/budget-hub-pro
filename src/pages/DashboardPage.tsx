import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Users, DollarSign, CreditCard, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { monthlySpendingData, initialSpendings } from "@/data/mockData";

export default function DashboardPage() {
  const recentActivity = initialSpendings.slice(0, 5);

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Users" value="6" icon={Users} trend={{ value: "+2 this month", positive: true }} />
          <StatCard title="Money Allotted" value="$39,000" icon={DollarSign} trend={{ value: "+12% vs last month", positive: true }} />
          <StatCard title="Money Spent" value="$16,400" icon={CreditCard} trend={{ value: "-8% vs last month", positive: true }} />
          <StatCard title="Budget Utilization" value="42%" icon={Activity} trend={{ value: "Healthy", positive: true }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Monthly Spending vs Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySpendingData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                    />
                    <Legend />
                    <Bar dataKey="budget" name="Budget" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} opacity={0.3} />
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
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.userName}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.reason}</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground ml-2 whitespace-nowrap">${item.amount.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
