import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import type { UserListItem } from "@/data/mockData";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatPkr } from "@/lib/currency";
import { apiUrl } from "@/lib/apiBase";
import { AttachmentPreviewDialog } from "@/components/AttachmentPreviewDialog";

type ProfilePayload = {
  user: UserListItem & { allottedBudget: number; walletBalance: number };
  spendingHistory: {
    id: string;
    amount: number;
    reason: string;
    date: string;
    status: string;
    attachment?: string;
  }[];
};

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);

  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const previewUrl = useMemo(
    () => (previewAttachment ? apiUrl(`/uploads/${encodeURIComponent(previewAttachment)}`) : null),
    [previewAttachment],
  );

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const r = await fetch(apiUrl(`/api/admin/users/${userId}/profile`), { credentials: "include" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Could not load profile", description: data.error, variant: "destructive" });
        setProfile(null);
        return;
      }
      setProfile(data as ProfilePayload);
    } catch {
      toast({ title: "Could not load profile", variant: "destructive" });
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [toast, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const spendingHistoryWithRemaining = useMemo(() => {
    if (!profile) return [];

    const rows = [...profile.spendingHistory].sort((a, b) => {
      const ad = new Date(a.date).getTime();
      const bd = new Date(b.date).getTime();
      if (Number.isNaN(ad) && Number.isNaN(bd)) return 0;
      if (Number.isNaN(ad)) return 1;
      if (Number.isNaN(bd)) return -1;
      return ad - bd;
    });

    const totalApproved = rows.reduce((sum, r) => (r.status === "approved" ? sum + (Number(r.amount) || 0) : sum), 0);
    const startingBalance = (Number(profile.user.walletBalance) || 0) + totalApproved;

    let runningApproved = 0;
    return rows.map((r) => {
      if (r.status === "approved") runningApproved += Number(r.amount) || 0;
      const remainingBalance = startingBalance - runningApproved;
      return { ...r, remainingBalance };
    });
  }, [profile]);

  const statusColors: Record<string, string> = {
    approved: "bg-success/10 text-success border-0",
    pending: "bg-warning/10 text-warning border-0",
    rejected: "bg-destructive/10 text-destructive border-0",
  };

  if (!userId) {
    return (
      <DashboardLayout title="User profile">
        <div className="space-y-3">
          <Button variant="outline" onClick={() => navigate("/users")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <p className="text-sm text-muted-foreground">Missing user id.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="User profile">
      <AttachmentPreviewDialog
        open={previewOpen}
        onOpenChange={(o) => {
          setPreviewOpen(o);
          if (!o) setPreviewAttachment(null);
        }}
        url={previewUrl}
        filename={previewAttachment}
      />

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" onClick={() => navigate("/users")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6">Loading profile…</p>
        ) : !profile ? (
          <p className="text-sm text-muted-foreground py-6">No profile data.</p>
        ) : (
          <div className="space-y-6">
            <Card className="ui-card-interactive p-5 sm:p-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <Avatar className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl">
                  {profile.user.avatar ? <AvatarImage src={profile.user.avatar} alt="" /> : null}
                  <AvatarFallback className="rounded-2xl bg-primary/10 text-primary text-lg sm:text-xl font-semibold">
                    {profile.user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-2xl font-semibold tracking-tight text-foreground truncate">{profile.user.name}</h2>
                      <p className="text-sm text-muted-foreground truncate">{profile.user.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{profile.user.role}</Badge>
                      <Badge
                        variant={profile.user.status === "active" ? "default" : "secondary"}
                        className={profile.user.status === "active" ? "bg-success/10 text-success border-0" : ""}
                      >
                        {profile.user.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-card p-4 ui-card-interactive">
                      <p className="text-xs text-muted-foreground">Wallet balance</p>
                      <p className="text-2xl font-semibold tracking-tight mt-1">{formatPkr(profile.user.walletBalance)}</p>
                    </div>
                    <div className="rounded-xl border bg-card p-4 ui-card-interactive">
                      <p className="text-xs text-muted-foreground">Total credited</p>
                      <p className="text-2xl font-semibold tracking-tight mt-1">{formatPkr(profile.user.allottedBudget)}</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">Joined {profile.user.createdAt}</p>
                </div>
              </div>
            </Card>

            <Separator />

            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Spending history</h3>
              <div className="rounded-lg border bg-card overflow-hidden">
                <div className="max-h-[min(520px,60vh)] overflow-y-auto">
                  <Table className="min-w-[920px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Date</TableHead>
                        <TableHead className="whitespace-nowrap">Amount</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="whitespace-nowrap">Remaining balance</TableHead>
                        <TableHead className="whitespace-nowrap">Status</TableHead>
                        <TableHead className="whitespace-nowrap">Attachment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {spendingHistoryWithRemaining.map((row) => (
                        <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{row.date}</TableCell>
                          <TableCell className="font-semibold whitespace-nowrap">{formatPkr(row.amount)}</TableCell>
                          <TableCell className="max-w-[260px] truncate">{row.reason}</TableCell>
                          <TableCell className="font-medium whitespace-nowrap">{formatPkr(row.remainingBalance)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant="secondary" className={`border-0 ${statusColors[row.status] ?? ""}`}>
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {row.attachment ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-primary text-xs underline-offset-4 hover:underline transition-colors"
                                onClick={() => {
                                  setPreviewAttachment(row.attachment ?? null);
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
                        </TableRow>
                      ))}
                      {spendingHistoryWithRemaining.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                            No receipts yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

