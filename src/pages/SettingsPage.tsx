import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/apiBase";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim()) {
      toast({ title: "Current password required", variant: "destructive" });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Invalid new password", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", description: "Re-enter the new password in both fields.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(apiUrl("/api/admin/password"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({
          title: "Could not update password",
          description: typeof data.error === "string" ? data.error : "Try again.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Password updated", description: "Use your new password next time you sign in." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Settings">
      <div className="mx-auto max-w-lg space-y-6">
        <Card className="ui-card-interactive">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Account</CardTitle>
            </div>
            <CardDescription>Change your admin sign-in password. You must enter your current password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">At least 6 characters.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={saving}
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Updating…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
