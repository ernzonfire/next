import ClaimForm from "@/components/auth/ClaimForm";

export const dynamic = "force-dynamic";

export default function ClaimPage() {
  return (
    <div>
      <div className="section-title">Claim Your Account</div>
      <div className="card-muted" style={{ marginBottom: 12 }}>
        Confirm your identity with your surname, then set a new password.
      </div>
      <ClaimForm />
    </div>
  );
}
