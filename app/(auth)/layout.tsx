import Logo from "@/components/brand/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page auth-page">
      <main className="page-content auth-content">
        <div className="card auth-card">
          <div className="auth-brand">
            <Logo href="/login" />
          </div>
          <div className="card-title" style={{ fontSize: 22, marginBottom: 6 }}>
            Welcome to NEXT
          </div>
          <div className="card-muted" style={{ marginBottom: 18 }}>
            Your one-stop hub for announcements, events, engagement, and rewards.
          </div>
          <div style={{ textAlign: "left" }}>{children}</div>
        </div>
      </main>
    </div>
  );
}
