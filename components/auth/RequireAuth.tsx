"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import LoadingState from "@/components/ui/LoadingState";
import { supabase } from "@/lib/supabase/client";

export default function RequireAuth({
  children,
  requireAdmin = false,
  requireClaimed = true,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireClaimed?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, role, loading, refreshProfile } = useCurrentUser();
  const attemptedProfileRefreshRef = useRef(false);
  const isAdminUser =
    role === "admin" ||
    profile?.role === "admin" ||
    user?.app_metadata?.role === "admin" ||
    user?.user_metadata?.role === "admin";

  useEffect(() => {
    if (loading) return;

    if (user && !profile && !attemptedProfileRefreshRef.current) {
      attemptedProfileRefreshRef.current = true;
      refreshProfile();
      return;
    }

    if (!user) {
      attemptedProfileRefreshRef.current = false;
      router.replace(`/login?next=${encodeURIComponent(pathname ?? "/")}`);
      return;
    }

    if (profile?.disabled_at) {
      supabase.auth.signOut();
      attemptedProfileRefreshRef.current = false;
      router.replace("/login?message=Account%20disabled.%20Please%20contact%20an%20administrator.");
      return;
    }

    if (requireClaimed && profile && !profile.claimed && !profile.claimed_at) {
      router.replace("/claim");
      return;
    }

    if (requireClaimed && user && !profile) {
      router.replace("/login?message=Unable%20to%20load%20account.%20Please%20try%20again.");
      return;
    }

    if (requireAdmin && !isAdminUser) return;
  }, [
    loading,
    user,
    profile,
    role,
    isAdminUser,
    refreshProfile,
    requireAdmin,
    requireClaimed,
    pathname,
    router,
  ]);

  if (loading) {
    return <LoadingState />;
  }

  if (!user) {
    return <LoadingState message="Redirecting to login..." />;
  }

  if (requireClaimed && !profile) {
    return <LoadingState message="Checking account..." />;
  }

  if (profile?.disabled_at) {
    return <LoadingState message="Account disabled..." />;
  }

  if (requireClaimed && profile && !profile.claimed && !profile.claimed_at) {
    return <LoadingState message="Redirecting to claim..." />;
  }

  if (requireAdmin && !isAdminUser) {
    return (
      <div className="page">
        <main className="page-content">
          <section className="card" style={{ maxWidth: 520, margin: "60px auto 0" }}>
            <h2 style={{ marginBottom: 8 }}>Admin access required</h2>
            <p className="card-muted">Your account does not have admin privileges for this section.</p>
            <div style={{ marginTop: 16 }}>
              <Link href="/" className="btn btn-primary">
                Back to user mode
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}
