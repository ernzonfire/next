"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

export default function ClaimForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [employeeId, setEmployeeId] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!/^\d{5,7}$/.test(employeeId.trim())) {
      setError("Employee ID must be 5 to 7 digits.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      if (!lastName.trim()) {
        setError("Last name is required.");
        return;
      }

      const claimResponse = await fetch("/api/auth/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employee_id: employeeId.trim(),
          surname: lastName.trim(),
          password,
        }),
      });

      const responseText = await claimResponse.text();
      let claimPayload: {
        error?: string;
        email?: string;
      } = {};

      if (responseText.trim()) {
        try {
          claimPayload = JSON.parse(responseText) as {
            error?: string;
            email?: string;
          };
        } catch (_error) {
          claimPayload = { error: responseText };
        }
      }

      if (!claimResponse.ok) {
        setError(claimPayload.error ?? `Unable to claim account (HTTP ${claimResponse.status}).`);
        return;
      }

      if (!claimPayload.email) {
        setError("Missing login email after claim.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: claimPayload.email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      const nextPath = searchParams.get("next");
      router.push(nextPath ?? "/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to claim account.";
      setError(message);
    } finally {
      setLoading(false);
    }
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
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
          placeholder="5 to 7 digit ID"
        />
      </label>
      <label className="form">
        <span>Surname</span>
        <input
          className="input"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          placeholder="Surname"
        />
      </label>
      <label className="form">
        <span>New Password</span>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      <label className="form">
        <span>Confirm Password</span>
        <input
          className="input"
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
        />
      </label>
      {error ? <span className="helper">{error}</span> : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Claim Account"}
      </Button>
    </form>
  );
}
