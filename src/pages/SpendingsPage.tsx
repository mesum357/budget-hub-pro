import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import type { SpendingReceipt } from "@/data/mockData";
import { FileText, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatPkr } from "@/lib/currency";
import { apiUrl } from "@/lib/apiBase";
import { AttachmentPreviewDialog } from "@/components/AttachmentPreviewDialog";

export default function SpendingsPage() {
  const [spendings, setSpendings] = useState<SpendingReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { toast } = useToast();
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/admin/receipts"), { credentials: "include" });
      if (!r.ok) throw new Error();
      setSpendings(await r.json());
    } catch {
      toast({ title: "Could not load receipts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const categories = Array.from(new Set(spendings.map((s) => s.category)));

  const previewUrl = useMemo(
    () => (previewAttachment ? apiUrl(`/uploads/${encodeURIComponent(previewAttachment)}`) : null),
    [previewAttachment],
  );

  const filtered = spendings.filter((s) => {
    const matchSearch =
      s.userName.toLowerCase().includes(search.toLowerCase()) || s.reason.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    const matchCategory = categoryFilter === "all" || s.category === categoryFilter;
    return matchSearch && matchStatus && matchCategory;
  });

  const statusColors: Record<string, string> = {
    approved: "bg-success/10 text-success border-0",
    pending: "bg-warning/10 text-warning border-0",
    rejected: "bg-destructive/10 text-destructive border-0",
  };

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    try {
      const r = await fetch(apiUrl(`/api/admin/receipts/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Update failed", description: data.error, variant: "destructive" });
        return;
      }
      await load();
      toast({ title: status === "approved" ? "Approved" : "Rejected" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout title="Spendings">
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

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by user or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="ui-card-interactive">
          <CardHeader>
            <CardTitle className="text-base">Spending Receipts</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground py-6">Loading…</p>
            ) : (
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attachment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">{s.userName}</TableCell>
                      <TableCell className="font-semibold">{formatPkr(s.amount)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{s.reason}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="border-0">
                          {s.category}
                        </Badge>
                      </TableCell>
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
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {s.status === "pending" ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => updateStatus(s.id, "approved")}>
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => updateStatus(s.id, "rejected")}>
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No receipts found.
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
