"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  preferred_name: string | null;
  department: string | null;
  employee_id: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  campaign: string | null;
  site: string | null;
  work_arrangement: string | null;
  dob_text: string | null;
  role: "admin" | "employee" | "committee" | "user";
  points_balance: number;
  claimed: boolean;
  claimed_at: string | null;
  disabled_at: string | null;
  fullName: string;
  employeeId: string | null;
  vertical: string | null;
  campaignName: string | null;
  pointsBalance: number;
};

type DbProfile = Omit<
  Profile,
  "fullName" | "employeeId" | "vertical" | "campaignName" | "pointsBalance"
>;

type CurrentUserState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: "admin" | "employee" | "committee" | "user" | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Request timed out")), ms);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
};

export function useCurrentUser(): CurrentUserState {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string | null) => {
    if (!userId) {
      setProfile(null);
      return;
    }

    try {
      const query = supabase
        .from("profiles")
        .select(
          "id, auth_user_id, full_name, preferred_name, department, employee_id, first_name, last_name, job_title, campaign, site, work_arrangement, dob_text, role, points_balance, claimed, claimed_at, disabled_at"
        )
        .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
        .limit(1)
        .maybeSingle();

      const response = (await withTimeout(
        Promise.resolve(query),
        10000
      )) as {
        data: DbProfile | null;
        error: { message: string } | null;
      };

      const { data, error } = response;

      if (error) {
        console.error("Failed to load profile", error.message);
        setProfile(null);
        return;
      }

      if (!data) {
        setProfile(null);
        return;
      }

      setProfile({
        ...data,
        fullName: data.full_name ?? "",
        employeeId: data.employee_id ?? null,
        vertical: data.department ?? null,
        campaignName: data.campaign ?? null,
        pointsBalance: Number(data.points_balance ?? 0),
      });
    } catch (error) {
      console.error("Failed to load profile", error);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    await fetchProfile(user?.id ?? null);
  }, [fetchProfile, user?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 8000);
        if (!isMounted) return;

        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        await fetchProfile(data.session?.user?.id ?? null);
      } catch (error) {
        if (!isMounted) return;
        console.error("Failed to load session", error);
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    loadSession();

    const { data } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      await fetchProfile(nextSession?.user?.id ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const roleFromJwt = user?.app_metadata?.role;
  const normalizedRole =
    roleFromJwt === "admin" || roleFromJwt === "committee"
      ? roleFromJwt
      : roleFromJwt === "employee" || roleFromJwt === "user"
      ? roleFromJwt
      : null;
  const role = (profile?.role as CurrentUserState["role"] | null) ??
    (normalizedRole as CurrentUserState["role"] | null) ??
    null;

  return {
    session,
    user,
    profile,
    role,
    loading,
    refreshProfile,
  };
}
