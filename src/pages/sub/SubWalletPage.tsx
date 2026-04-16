import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatPkr } from "@/lib/currency";
import { apiUrl } from "@/lib/apiBase";
import { format } from "date-fns";

type TopRow = { id: string; amount: number; note: string; createdAt: string };

export default function SubWalletPage() {
  const [balance, setBalance] = useState(0);
  const [allotted, setAllotted] = useState(0);
  const [history, setHistory] = useState<TopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/sub/wallet"), { credentials: "include" });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setBalance(data.balance);
      setAllotted(data.allottedBudget);
      setHistory(data.history || []);
    } catch {
      toast({ title: "Could not load wallet", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout title="Wallet" mode="sub">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="ui-card-interactive">
          <CardHeader>
            <CardTitle className="text-base">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-2">
                <p className="text-3xl font-bold tracking-tight">{formatPkr(balance)}</p>
                <p className="text-sm text-muted-foreground">
                  Allotted spending cap: <span className="font-medium text-foreground">{formatPkr(allotted)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Receipts deduct from your wallet. Admins credit your wallet via top-ups (shown below).
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="ui-card-interactive md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Top-up history</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground py-4">Loading…</p>
            ) : (
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {format(new Date(h.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-semibold text-success">+{formatPkr(h.amount)}</TableCell>
                      <TableCell className="max-w-md truncate">{h.note || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No top-ups yet. Ask your admin to add funds.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
