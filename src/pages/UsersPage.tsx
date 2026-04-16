import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import type { UserListItem } from "@/data/mockData";
import { Plus, Search, Upload, X, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { formatPkr } from "@/lib/currency";
import { apiUrl } from "@/lib/apiBase";
import { useNavigate } from "react-router-dom";

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
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "",
    status: "active" as "active" | "inactive",
    password: "",
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editClearAvatar, setEditClearAvatar] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserListItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [pendingAction, setPendingAction] = useState<null | { type: "edit"; user: UserListItem } | { type: "delete"; user: UserListItem }>(
    null,
  );

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
          avatar: imagePreview || undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Create failed", description: data.error || "Try again", variant: "destructive" });
        return;
      }
      setForm({ name: "", email: "", password: "", role: "" });
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
      password: "",
    });
    setEditImagePreview(null);
    setEditClearAvatar(false);
    setEditErrors({});
    setEditOpen(true);
  };

  const requestVerify = (action: { type: "edit"; user: UserListItem } | { type: "delete"; user: UserListItem }) => {
    setPendingAction(action);
    setVerifyPassword("");
    setVerifyError("");
    setVerifyOpen(true);
  };

  const handleVerify = async () => {
    if (!pendingAction) return;
    if (!verifyPassword.trim()) {
      setVerifyError("Password is required");
      return;
    }
    setVerifyBusy(true);
    setVerifyError("");
    try {
      const r = await fetch(apiUrl("/api/admin/verify-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: verifyPassword }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setVerifyError(data.error || "Invalid password");
        return;
      }
      setVerifyOpen(false);
      const action = pendingAction;
      setPendingAction(null);
      setVerifyPassword("");
      if (action.type === "edit") {
        openEdit(action.user);
      } else {
        setUserToDelete(action.user);
        setDeleteOpen(true);
      }
    } catch {
      setVerifyError("Network error. Try again.");
    } finally {
      setVerifyBusy(false);
    }
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

  return (
    <DashboardLayout title="Users">
      <div className="space-y-6">
        <Dialog
          open={verifyOpen}
          onOpenChange={(o) => {
            setVerifyOpen(o);
            if (!o) {
              setVerifyPassword("");
              setVerifyError("");
              setVerifyBusy(false);
              setPendingAction(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enter password</DialogTitle>
              <DialogDescription>To continue, confirm your admin password.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={verifyPassword}
                  onChange={(e) => {
                    setVerifyPassword(e.target.value);
                    setVerifyError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleVerify();
                    }
                  }}
                  className={verifyError ? "border-destructive" : ""}
                  autoFocus
                />
                {verifyError ? <p className="text-xs text-destructive">{verifyError}</p> : null}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setVerifyOpen(false)} disabled={verifyBusy}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleVerify} disabled={verifyBusy}>
                  {verifyBusy ? "Verifying…" : "Verify"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
                <DialogDescription>Add a new sub-admin account. They start with a zero wallet until you apply a top-up.</DialogDescription>
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
                <p className="text-xs text-muted-foreground">
                  Users start with a zero wallet. Use <span className="font-medium text-foreground">Budget Management → Top Up</span> to credit funds.
                </p>
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
              <DialogDescription>Update profile, login email, password, role, or account status.</DialogDescription>
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
                    This will remove <span className="font-medium text-foreground">{userToDelete.name}</span> from the app. Their
                    account record, receipts, and top-ups stay in the database for audit purposes, but they can no longer sign in.
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
                onClick={() => navigate(`/users/${user.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/users/${user.id}`);
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
                      onClick={() => requestVerify({ type: "edit", user })}
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
                        requestVerify({ type: "delete", user });
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
