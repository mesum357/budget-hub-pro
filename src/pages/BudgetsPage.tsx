import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import type { BudgetRecord } from "@/data/mockData";
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
import { formatPkr } from "@/lib/currency";
import { apiUrl } from "@/lib/apiBase";

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpTarget, setTopUpTarget] = useState<BudgetRecord | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/admin/budgets"), { credentials: "include" });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setBudgets(data);
    } catch {
      toast({ title: "Could not load budgets", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTopUp = async () => {
    if (!topUpTarget) return;
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      setError("Enter a valid amount");
      return;
    }
    try {
      const r = await fetch(apiUrl(`/api/admin/users/${topUpTarget.userId}/topup`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: val, note }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Top up failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Budget topped up",
        description: `${formatPkr(val)} credited to ${topUpTarget.userName}'s wallet.`,
      });
      setTopUpTarget(null);
      setAmount("");
      setNote("");
      setError("");
      await load();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  const getStatus = (util: number) => {
    if (util < 40) return { label: "Healthy", color: "bg-success/10 text-success" };
    if (util < 70) return { label: "Moderate", color: "bg-warning/10 text-warning" };
    return { label: "High use", color: "bg-destructive/10 text-destructive" };
  };

  return (
    <DashboardLayout title="Budget Management">
      <Card className="ui-card-interactive">
        <CardHeader>
          <CardTitle className="text-base">User Budgets</CardTitle>
        </CardHeader>
          <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground py-6">Loading…</p>
          ) : (
            <Table className="min-w-[940px]">
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Wallet balance</TableHead>
                  <TableHead>Total credited</TableHead>
                  <TableHead>Spent (pending+approved)</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((b) => {
                  const status = getStatus(b.utilizationPct);
                  const pct = Math.min(100, b.utilizationPct);
                  return (
                    <TableRow key={b.userId} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">{b.userName}</TableCell>
                      <TableCell className="font-semibold">{formatPkr(b.budgetAvailable)}</TableCell>
                      <TableCell>{formatPkr(b.budgetAllotted)}</TableCell>
                      <TableCell>{formatPkr(b.spent)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <Progress value={pct} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-10">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`border-0 ${status.color}`}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTopUpTarget(b);
                            setError("");
                          }}
                        >
                          <ArrowUpCircle className="h-4 w-4 mr-1" />
                          Top Up
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {budgets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No sub-admins yet. Create users first.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!topUpTarget}
        onOpenChange={() => {
          setTopUpTarget(null);
          setError("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Top Up Wallet</DialogTitle>
          </DialogHeader>
          {topUpTarget && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">{topUpTarget.userName}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Current wallet:{" "}
                  <span className="font-semibold text-foreground">{formatPkr(topUpTarget.budgetAvailable)}</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Amount (PKR)</Label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError("");
                  }}
                  className={error ? "border-destructive" : ""}
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Textarea placeholder="Reason for top up..." value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
              </div>
              <Button onClick={handleTopUp} className="w-full">
                Confirm Top Up
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
