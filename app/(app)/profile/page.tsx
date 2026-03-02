"use client";

import LogoutButton from "@/components/auth/LogoutButton";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

export default function ProfilePage() {
  const { user, profile } = useCurrentUser();

  const displayName =
    profile?.preferred_name?.trim() ||
    profile?.first_name?.trim() ||
    profile?.full_name?.trim() ||
    "Team Member";

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Profile</h1>
          <p className="card-muted">View your account details and preferences.</p>
        </div>
      </header>

      <section className="card" style={{ marginTop: 14 }}>
        <div className="card-title" style={{ fontSize: 24 }}>
          {displayName}
        </div>
        <p className="card-muted">Employee ID: {profile?.employee_id ?? "Not assigned"}</p>
        <p className="card-muted">Department: {profile?.department ?? "Not set"}</p>
        <p className="card-muted">Role: {profile?.role ?? "employee"}</p>

        <div className="stat" style={{ marginTop: 14 }}>
          <span className="stat-label">Points Balance</span>
          <span className="stat-value">{profile?.points_balance ?? 0}</span>
        </div>

        <p className="card-muted" style={{ marginTop: 12 }}>
          {user?.email ?? "No email available"}
        </p>
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
          <div className="list-item">
            <span>Support Email</span>
            <span className="card-muted">help@next.com</span>
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
    </div>
  );
}
