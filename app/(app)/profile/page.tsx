"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UserQRCode from "@/components/qr/UserQRCode";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import LogoutButton from "@/components/auth/LogoutButton";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabase/client";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile } = useCurrentUser();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState<string | null>(null);
  const [showSessionChoice, setShowSessionChoice] = useState(false);

  const displayName =
    profile?.full_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "Employee";

  const handlePasswordChange = async () => {
    setChangeError(null);
    setChangeSuccess(null);
    setShowSessionChoice(false);

    if (newPassword.length < 8) {
      setChangeError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangeError("Passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setChangeError("Session expired. Please sign in again.");
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        10000
      );

      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ password: newPassword }),
        signal: controller.signal,
      });

      window.clearTimeout(timeoutId);

      let payload: any = null;
      try {
        payload = await response.json();
      } catch (_err) {
        payload = null;
      }

      if (!response.ok) {
        const message =
          payload?.error_description ||
          payload?.error ||
          "Unable to update password.";
        setChangeError(message);
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setChangeSuccess("Password updated.");
      setShowSessionChoice(true);
    } catch (err) {
      const message =
        err instanceof Error && err.name === "AbortError"
          ? "Request timed out. Please try again."
          : err instanceof Error
          ? err.message
          : "Failed to update password.";
      setChangeError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Profile</h1>
          <p className="card-muted">Keep your QR ready for event scans.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">{displayName}</div>
          <div className="card-muted">Employee ID: {profile?.employee_id ?? "Not set"}</div>
          <div className="card-muted">Role: {profile?.role ?? "employee"}</div>
          <div className="card-muted">Job: {profile?.job_title ?? "-"}</div>
          <div className="card-muted">Campaign: {profile?.campaign ?? "-"}</div>
          <div className="card-muted">Site: {profile?.site ?? "-"}</div>
          <div className="card-muted">
            Work Setup: {profile?.work_arrangement ?? "-"}
          </div>
          <div className="card-muted">DOB: {profile?.dob_text ?? "-"}</div>
          <div style={{ marginTop: 16 }} className="stat">
            <div className="stat-label">Points Balance</div>
            <div className="stat-value">{profile?.points_balance ?? 0}</div>
          </div>
          <div className="card-muted" style={{ marginTop: 12 }}>
            {user?.email}
          </div>
        </div>
        {user?.id ? <UserQRCode userId={user.id} /> : null}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Account</div>
        <div className="card-muted" style={{ marginTop: 6 }}>
          Update your password and manage your session.
        </div>
        <div className="form" style={{ marginTop: 12 }}>
          <label className="form">
            <span>New Password</span>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="At least 8 characters"
            />
          </label>
          <label className="form">
            <span>Confirm Password</span>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter password"
            />
          </label>
          {changeError ? <div className="helper">{changeError}</div> : null}
          {changeSuccess ? <div className="helper">{changeSuccess}</div> : null}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button onClick={handlePasswordChange} disabled={saving}>
              {saving ? "Saving..." : "Update Password"}
            </Button>
            <LogoutButton label="Sign out" variant="outline" />
          </div>
          {showSessionChoice ? (
            <div className="card-muted" style={{ marginTop: 12 }}>
              Stay logged in or sign out?
              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button variant="outline" onClick={() => setShowSessionChoice(false)}>
                  Stay Logged In
                </Button>
                <Button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    router.replace("/login?message=Password%20updated.%20Please%20sign%20in%20again.");
                  }}
                >
                  Sign Out
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
