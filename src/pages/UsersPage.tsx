import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import type { UserListItem } from "@/data/mockData";
import { Plus, Search, Upload, X, FileText, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function UsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "",
    allottedBudget: "5000",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();

  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "",
    status: "active" as "active" | "inactive",
    allottedBudget: "",
    password: "",
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editClearAvatar, setEditClearAvatar] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserListItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/admin/users"), { credentials: "include" });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setUsers(data);
    } catch {
      toast({ title: "Could not load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openProfile = async (userId: string) => {
    setProfileOpen(true);
    setProfile(null);
    setProfileLoading(true);
    try {
      const r = await fetch(apiUrl(`/api/admin/users/${userId}/profile`), { credentials: "include" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Could not load profile", description: data.error, variant: "destructive" });
        setProfileOpen(false);
        return;
      }
      setProfile(data as ProfilePayload);
    } catch {
      toast({ title: "Could not load profile", variant: "destructive" });
      setProfileOpen(false);
    } finally {
      setProfileLoading(false);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) || u.role.toLowerCase().includes(search.toLowerCase()),
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    if (!form.password || form.password.length < 6) e.password = "Password (min 6 characters) is required";
    if (!form.role.trim()) e.role = "Role is required";
    const allot = Number(form.allottedBudget);
    if (!Number.isFinite(allot) || allot < 0) e.allottedBudget = "Enter a valid allotted budget";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    try {
      const r = await fetch(apiUrl("/api/admin/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role.trim(),
          allottedBudget: Number(form.allottedBudget),
          avatar: imagePreview || undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Create failed", description: data.error || "Try again", variant: "destructive" });
        return;
      }
      setForm({ name: "", email: "", password: "", role: "", allottedBudget: "5000" });
      setImagePreview(null);
      setErrors({});
      setOpen(false);
      await load();
      toast({ title: "User created", description: `${data.name} can sign in to the sub-admin portal.` });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const openEdit = (user: UserListItem) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      allottedBudget: String(user.allottedBudget ?? 0),
      password: "",
    });
    setEditImagePreview(null);
    setEditClearAvatar(false);
    setEditErrors({});
    setEditOpen(true);
  };

  const handleEditImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditImagePreview(reader.result as string);
        setEditClearAvatar(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateEdit = () => {
    const e: Record<string, string> = {};
    if (!editForm.name.trim()) e.name = "Name is required";
    if (!editForm.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(editForm.email)) e.email = "Invalid email";
    if (!editForm.role.trim()) e.role = "Role is required";
    const allot = Number(editForm.allottedBudget);
    if (!Number.isFinite(allot) || allot < 0) e.allottedBudget = "Enter a valid allotted budget";
    if (editForm.password && editForm.password.length < 6) e.password = "Min 6 characters if changing password";
    setEditErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleEditSave = async () => {
    if (!editingUser || !validateEdit()) return;
    const userId = editingUser.id;
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role.trim(),
        status: editForm.status,
        allottedBudget: Number(editForm.allottedBudget),
      };
      if (editForm.password.trim()) body.password = editForm.password;
      if (editImagePreview) body.avatar = editImagePreview;
      else if (editClearAvatar) body.avatar = null;

      const r = await fetch(apiUrl(`/api/admin/users/${userId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Update failed", description: data.error || "Try again", variant: "destructive" });
        return;
      }
      setEditOpen(false);
      setEditingUser(null);
      await load();
      toast({ title: "User updated", description: `${data.name} was saved.` });
      if (profileOpen && profile?.user.id === userId) {
        await openProfile(userId);
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setDeleteBusy(true);
    try {
      const r = await fetch(apiUrl(`/api/admin/users/${userToDelete.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Delete failed", description: data.error || "Try again", variant: "destructive" });
        return;
      }
      if (profileOpen && profile?.user.id === userToDelete.id) {
        setProfileOpen(false);
        setProfile(null);
      }
      setDeleteOpen(false);
      setUserToDelete(null);
      await load();
      toast({ title: "User deleted", description: `${userToDelete.name} was removed.` });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setDeleteBusy(false);
    }
  };

  const statusColors: Record<string, string> = {
    approved: "bg-success/10 text-success border-0",
    pending: "bg-warning/10 text-warning border-0",
    rejected: "bg-destructive/10 text-destructive border-0",
  };

  const previewUrl = useMemo(
    () => (previewAttachment ? apiUrl(`/uploads/${encodeURIComponent(previewAttachment)}`) : null),
    [previewAttachment],
  );

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

  return (
    <DashboardLayout title="Users">
      <div className="space-y-6">
        <AttachmentPreviewDialog
          open={previewOpen}
          onOpenChange={(o) => {
            setPreviewOpen(o);
            if (!o) setPreviewAttachment(null);
          }}
          url={previewUrl}
          filename={previewAttachment}
        />

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Sub-Admin</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="flex justify-center">
                  <label className="cursor-pointer group">
                    <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
                    {imagePreview ? (
                      <div className="relative">
                        <img src={imagePreview} alt="Preview" className="h-20 w-20 rounded-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setImagePreview(null);
                          }}
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive flex items-center justify-center"
                        >
                          <X className="h-3 w-3 text-destructive-foreground" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center group-hover:bg-muted/70 transition-colors">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="John Doe"
                    className={errors.name ? "border-destructive" : ""}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Email (login)</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="john@company.com"
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="At least 6 characters"
                    className={errors.password ? "border-destructive" : ""}
                  />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="e.g. Manager, Analyst"
                    className={errors.role ? "border-destructive" : ""}
                  />
                  {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Allotted budget (PKR)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.allottedBudget}
                    onChange={(e) => setForm({ ...form, allottedBudget: e.target.value })}
                    className={errors.allottedBudget ? "border-destructive" : ""}
                  />
                  {errors.allottedBudget && <p className="text-xs text-destructive">{errors.allottedBudget}</p>}
                </div>
                <Button onClick={handleCreate} className="w-full">
                  Create User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog
          open={editOpen}
          onOpenChange={(o) => {
            setEditOpen(o);
            if (!o) setEditingUser(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit sub-admin</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-col items-center gap-2">
                  <label className="cursor-pointer group">
                    <input type="file" accept="image/*" className="hidden" onChange={handleEditImage} />
                    {editImagePreview ? (
                      <div className="relative">
                        <img src={editImagePreview} alt="" className="h-20 w-20 rounded-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setEditImagePreview(null);
                          }}
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive flex items-center justify-center"
                        >
                          <X className="h-3 w-3 text-destructive-foreground" />
                        </button>
                      </div>
                    ) : editClearAvatar || !editingUser.avatar ? (
                      <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center group-hover:bg-muted/70 transition-colors">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="relative">
                        <img src={editingUser.avatar} alt="" className="h-20 w-20 rounded-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setEditClearAvatar(true);
                          }}
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive flex items-center justify-center"
                          title="Remove photo"
                        >
                          <X className="h-3 w-3 text-destructive-foreground" />
                        </button>
                      </div>
                    )}
                  </label>
                  {editClearAvatar && !editImagePreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => setEditClearAvatar(false)}
                    >
                      Undo remove photo
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className={editErrors.name ? "border-destructive" : ""}
                  />
                  {editErrors.name && <p className="text-xs text-destructive">{editErrors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Email (login)</Label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className={editErrors.email ? "border-destructive" : ""}
                  />
                  {editErrors.email && <p className="text-xs text-destructive">{editErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label>New password</Label>
                  <Input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Leave blank to keep current"
                    className={editErrors.password ? "border-destructive" : ""}
                  />
                  {editErrors.password && <p className="text-xs text-destructive">{editErrors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className={editErrors.role ? "border-destructive" : ""}
                  />
                  {editErrors.role && <p className="text-xs text-destructive">{editErrors.role}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(v) => setEditForm({ ...editForm, status: v as "active" | "inactive" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Allotted budget (PKR)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editForm.allottedBudget}
                    onChange={(e) => setEditForm({ ...editForm, allottedBudget: e.target.value })}
                    className={editErrors.allottedBudget ? "border-destructive" : ""}
                  />
                  {editErrors.allottedBudget && <p className="text-xs text-destructive">{editErrors.allottedBudget}</p>}
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleEditSave} disabled={editSaving}>
                    {editSaving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete user?</AlertDialogTitle>
              <AlertDialogDescription>
                {userToDelete ? (
                  <>
                    This will permanently remove <span className="font-medium text-foreground">{userToDelete.name}</span> and all of
                    their receipts, wallet top-ups, and allotment history. This cannot be undone.
                  </>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
              <Button variant="destructive" disabled={deleteBusy} onClick={handleConfirmDelete}>
                {deleteBusy ? "Deleting…" : "Delete"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog
          open={profileOpen}
          onOpenChange={(o) => {
            setProfileOpen(o);
            if (!o) setProfile(null);
          }}
        >
          <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 w-screen h-[100svh] max-w-none rounded-none p-0 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="border-b bg-background/95 supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur px-4 sm:px-6 py-4 pr-14 sm:pr-16">
                <DialogHeader className="space-y-0">
                  <DialogTitle>User profile</DialogTitle>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6">
                {profileLoading && <p className="text-sm text-muted-foreground py-6">Loading profile…</p>}
                {!profileLoading && profile && (
                  <div className="space-y-6">
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
                            <h2 className="text-2xl font-semibold tracking-tight text-foreground truncate">
                              {profile.user.name}
                            </h2>
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
                            <p className="text-xs text-muted-foreground">Allotted (cap)</p>
                            <p className="text-2xl font-semibold tracking-tight mt-1">{formatPkr(profile.user.allottedBudget)}</p>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground mt-3">Joined {profile.user.createdAt}</p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-sm font-medium text-foreground mb-2">Spending history</h3>
                      <div className="h-[min(420px,58vh)] sm:h-[min(520px,55vh)] rounded-lg border bg-card overflow-y-auto">
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
                                      onClick={(e) => {
                                        e.stopPropagation();
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
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading users…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((user) => (
              <Card
                key={user.id}
                role="button"
                tabIndex={0}
                className="ui-card-interactive animate-fade-in cursor-pointer ui-focus-ring hover:border-primary/30 overflow-hidden"
                onClick={() => openProfile(user.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openProfile(user.id);
                  }
                }}
              >
                <div className="h-1 w-full bg-gradient-to-r from-primary/70 via-primary/20 to-accent/60" />
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11">
                      {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground leading-5 truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <Badge
                          variant={user.status === "active" ? "default" : "secondary"}
                          className={user.status === "active" ? "bg-success/10 text-success border-0" : ""}
                        >
                          {user.status}
                        </Badge>
                      </div>

                      <div className="mt-3 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[11px] text-muted-foreground">Wallet balance</p>
                          <p className="text-lg font-semibold tracking-tight">{formatPkr(user.walletBalance ?? 0)}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground whitespace-nowrap">Joined {user.createdAt}</p>
                      </div>
                    </div>
                  </div>

                  <div
                    className="mt-4 flex items-center justify-end gap-1 border-t pt-3"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-foreground ui-icon-button"
                      aria-label="Edit user"
                      onClick={() => openEdit(user)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive ui-icon-button"
                      aria-label="Delete user"
                      onClick={() => {
                        setUserToDelete(user);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">No users found.</div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
