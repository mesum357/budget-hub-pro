import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import type { SpendingReceipt } from "@/data/mockData";
import { Plus, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatPkr } from "@/lib/currency";
import { apiUrl } from "@/lib/apiBase";
import { AttachmentPreviewDialog } from "@/components/AttachmentPreviewDialog";

export default function SubSpendingPage() {
  const [rows, setRows] = useState<SpendingReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/sub/receipts"), { credentials: "include" });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setRows(
        data.map((x: { id: string; amount: number; reason: string; date: string; status: string; attachment?: string }) => ({
          id: x.id,
          userId: "",
          userName: "Me",
          amount: x.amount,
          reason: x.reason,
          date: x.date,
          status: x.status as SpendingReceipt["status"],
          attachment: x.attachment,
        })),
      );
    } catch {
      toast({ title: "Could not load receipts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const previewUrl = useMemo(
    () => (previewAttachment ? apiUrl(`/uploads/${encodeURIComponent(previewAttachment)}`) : null),
    [previewAttachment],
  );

  const statusColors: Record<string, string> = {
    approved: "bg-success/10 text-success border-0",
    pending: "bg-warning/10 text-warning border-0",
    rejected: "bg-destructive/10 text-destructive border-0",
  };

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: "Reason required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("amount", String(amt));
      fd.append("reason", reason.trim());
      fd.append("date", date);
      if (file) fd.append("attachment", file);
      const r = await fetch(apiUrl("/api/sub/receipts"), { method: "POST", body: fd, credentials: "include" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Could not submit", description: data.error || "Try again", variant: "destructive" });
        return;
      }
      toast({ title: "Receipt submitted", description: "Your admin can review it under Spendings." });
      setOpen(false);
      setAmount("");
      setReason("");
      setDate(new Date().toISOString().split("T")[0]);
      setFile(null);
      await load();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Spending" mode="sub">
      <div className="space-y-4">
        <AttachmentPreviewDialog
          open={previewOpen}
          onOpenChange={(o) => {
            setPreviewOpen(o);
            if (!o) setPreviewAttachment(null);
          }}
          url={previewUrl}
          filename={previewAttachment}
        />

        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create receipt
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New receipt</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Amount (PKR)</Label>
                  <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What was this expense for?" rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Attachment</Label>
                  <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
                <p className="text-xs text-muted-foreground">
                  You cannot exceed your allotted budget (including pending receipts) or your wallet balance.
                </p>
                <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit receipt"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="ui-card-interactive">
          <CardHeader>
            <CardTitle className="text-base">Your receipts</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground py-6">Loading…</p>
            ) : (
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attachment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-semibold">{formatPkr(s.amount)}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{s.reason}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{s.date}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[s.status]}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.attachment ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-primary text-sm underline-offset-4 hover:underline transition-colors"
                            onClick={() => {
                              setPreviewAttachment(s.attachment ?? null);
                              setPreviewOpen(true);
                            }}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            View
                          </button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No receipts yet.
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
