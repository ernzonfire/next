"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const idRegex = /^\d{5,7}$/;
  const domain = process.env.NEXT_PUBLIC_EMPLOYEE_EMAIL_DOMAIN ?? "next.com";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const trimmed = identifier.trim();
    if (!trimmed) {
      setError("Please enter your Employee ID.");
      setLoading(false);
      return;
    }

    if (!idRegex.test(trimmed)) {
      setError("Employee ID must be 5 to 7 digits.");
      setLoading(false);
      return;
    }

    const email = `${trimmed}@${domain}`;

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.user) {
      setError(signInError?.message ?? "Unable to sign in.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("claimed, claimed_at, disabled_at")
      .or(`id.eq.${data.user.id},auth_user_id.eq.${data.user.id}`)
      .limit(1)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    if (profile?.disabled_at) {
      await supabase.auth.signOut();
      setError("Account is disabled. Please contact an administrator.");
      setLoading(false);
      return;
    }

    const nextPath = searchParams.get("next");
    const isClaimed = Boolean(profile?.claimed || profile?.claimed_at);
    if (!isClaimed) {
      const claimPath = nextPath ? `/claim?next=${encodeURIComponent(nextPath)}` : "/claim";
      router.push(claimPath);
    } else {
      router.push(nextPath ?? "/dashboard");
    }

    setLoading(false);
  };

  return (
    <form className="form" onSubmit={onSubmit}>
      <label className="form">
        <span>Employee ID</span>
        <input
          className="input"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={7}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          required
          placeholder="5 to 7 digit ID"
        />
      </label>
      <label className="form">
        <span>Password</span>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? <span className="helper">{error}</span> : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign In"}
      </Button>
      <span className="helper">
        No password yet?{" "}
        <a href="/claim" style={{ color: "var(--brand-blue)", fontWeight: 600 }}>
          Claim your account
        </a>
      </span>
    </form>
  );
}
