import LoginForm from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div>
      <div className="section-title">Sign In</div>
      <LoginForm />
    </div>
  );
}
