"use client";

import { useEffect, useRef } from "react";
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

    if (requireAdmin && role !== "admin") {
      router.replace("/");
    }
  }, [
    loading,
    user,
    profile,
    role,
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

  if (requireAdmin && role !== "admin") {
    return <LoadingState message="Redirecting..." />;
  }

  return <>{children}</>;
}
