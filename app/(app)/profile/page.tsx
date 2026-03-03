"use client";

import { useEffect, useState } from "react";
import LogoutButton from "@/components/auth/LogoutButton";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase/client";
import AppFooter from "@/app/components/AppFooter";

export default function ProfilePage() {
  const { profile, refreshProfile } = useCurrentUser();
  const [preferredName, setPreferredName] = useState("");
  const [savingPreferredName, setSavingPreferredName] = useState(false);
  const [preferredNameMessage, setPreferredNameMessage] = useState<string | null>(null);

  const fullName =
    profile?.fullName?.trim() ||
    profile?.full_name?.trim() ||
    [profile?.first_name?.trim(), profile?.last_name?.trim()].filter(Boolean).join(" ") ||
    "Team Member";

  const employeeId = profile?.employeeId?.trim() || profile?.employee_id?.trim() || "Not set";
  const vertical = profile?.vertical?.trim() || profile?.department?.trim() || "Not set";
  const campaign = profile?.campaignName?.trim() || profile?.campaign?.trim() || "Not set";
  const position = profile?.job_title?.trim() || "Not set";
  const pointsBalance = profile?.pointsBalance ?? profile?.points_balance ?? 0;

  useEffect(() => {
    setPreferredName(profile?.preferred_name ?? "");
  }, [profile?.preferred_name]);

  const handleSavePreferredName = async () => {
    setPreferredNameMessage(null);

    if (!profile?.id) {
      setPreferredNameMessage("Profile not found.");
      return;
    }

    setSavingPreferredName(true);

    const value = preferredName.trim();
    const { error } = await supabase
      .from("profiles")
      .update({ preferred_name: value || null })
      .eq("id", profile.id);

    if (error) {
      setPreferredNameMessage(error.message);
      setSavingPreferredName(false);
      return;
    }

    await refreshProfile();
    setPreferredNameMessage(value ? "Preferred name updated." : "Preferred name cleared.");
    setSavingPreferredName(false);
  };

  return (
    <div className="profile-page">
      <header className="page-header">
        <div>
          <h1>Profile</h1>
          <p className="card-muted">View your account details and preferences.</p>
        </div>
      </header>

      <section className="card" style={{ marginTop: 14 }}>
        <div className="card-title" style={{ fontSize: 24 }}>
          {fullName}
        </div>
        <p className="card-muted">Employee ID: {employeeId}</p>
        <p className="card-muted">Vertical: {vertical}</p>
        <p className="card-muted">Campaign: {campaign}</p>
        <p className="card-muted">Position: {position}</p>

        <div className="stat" style={{ marginTop: 14 }}>
          <span className="stat-label">Points Balance</span>
          <span className="stat-value">{pointsBalance}</span>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title">Preferred Name</div>
        <p className="card-muted" style={{ marginTop: 6 }}>
          This is used for your dashboard greeting.
        </p>
        <div className="form" style={{ marginTop: 12 }}>
          <label className="form">
            <span>Preferred Name</span>
            <input
              className="input"
              value={preferredName}
              onChange={(event) => setPreferredName(event.target.value)}
              placeholder={fullName}
              maxLength={40}
            />
          </label>
          {preferredNameMessage ? <span className="helper">{preferredNameMessage}</span> : null}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSavePreferredName}
            disabled={savingPreferredName}
          >
            {savingPreferredName ? "Saving..." : "Save Preferred Name"}
          </button>
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        <h2 className="section-title">Settings</h2>
        <div className="list">
          <div className="list-item">
            <span>Notification Preferences</span>
            <span className="card-muted">Enabled</span>
          </div>
          <div className="list-item">
            <span>Privacy</span>
            <span className="card-muted">Standard</span>
          </div>
          <div className="list-item">
            <span>Language</span>
            <span className="card-muted">English</span>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title">Session</div>
        <p className="card-muted" style={{ marginTop: 6 }}>
          Sign out from this device.
        </p>
        <div style={{ marginTop: 12 }}>
          <LogoutButton label="Sign Out" variant="outline" />
        </div>
      </section>

      <div style={{ marginTop: 18 }}>
        <AppFooter />
      </div>
    </div>
  );
}
