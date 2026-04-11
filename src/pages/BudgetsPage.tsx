import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { initialBudgets, BudgetRecord } from "@/data/mockData";
import { ArrowUpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetRecord[]>(initialBudgets);
  const [topUpTarget, setTopUpTarget] = useState<BudgetRecord | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleTopUp = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) { setError("Enter a valid amount"); return; }
    setBudgets(budgets.map((b) =>
      b.userId === topUpTarget!.userId
        ? { ...b, budgetAvailable: b.budgetAvailable + val, budgetAllotted: b.budgetAllotted + val }
        : b
    ));
    toast({ title: "Budget topped up", description: `$${val.toLocaleString()} added to ${topUpTarget!.userName}.` });
    setTopUpTarget(null);
    setAmount("");
    setNote("");
    setError("");
  };

  const getStatus = (b: BudgetRecord) => {
    const pct = (b.budgetAvailable / b.budgetAllotted) * 100;
    if (pct > 60) return { label: "Healthy", color: "bg-success/10 text-success" };
    if (pct > 30) return { label: "Moderate", color: "bg-warning/10 text-warning" };
    return { label: "Low", color: "bg-destructive/10 text-destructive" };
  };

  return (
    <DashboardLayout title="Budget Management">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">User Budgets</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Budget Available</TableHead>
                <TableHead>Allotted This Month</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgets.map((b) => {
                const status = getStatus(b);
                const pct = Math.round((b.budgetAvailable / b.budgetAllotted) * 100);
                return (
                  <TableRow key={b.userId} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{b.userName}</TableCell>
                    <TableCell className="font-semibold">${b.budgetAvailable.toLocaleString()}</TableCell>
                    <TableCell>${b.budgetAllotted.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={pct} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`border-0 ${status.color}`}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => { setTopUpTarget(b); setError(""); }}>
                        <ArrowUpCircle className="h-4 w-4 mr-1" />Top Up
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!topUpTarget} onOpenChange={() => { setTopUpTarget(null); setError(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Top Up Budget</DialogTitle>
          </DialogHeader>
          {topUpTarget && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">{topUpTarget.userName}</p>
                <p className="text-xs text-muted-foreground mt-1">Current balance: <span className="font-semibold text-foreground">${topUpTarget.budgetAvailable.toLocaleString()}</span></p>
              </div>
              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input type="number" placeholder="1000" value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} className={error ? "border-destructive" : ""} />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Textarea placeholder="Reason for top up..." value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
              </div>
              <Button onClick={handleTopUp} className="w-full">Confirm Top Up</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
