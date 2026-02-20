"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/format";

type Redemption = {
  id: string;
  points_spent: number;
  created_at: string;
  rewards: { title: string } | null;
  profiles: { full_name: string } | null;
};

type RedemptionQueryRow = {
  id: string;
  points_spent: number;
  created_at: string;
  rewards: { title: string } | { title: string }[] | null;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

export default function AdminDashboardPage() {
  const [userCount, setUserCount] = useState(0);
  const [claimedCount, setClaimedCount] = useState(0);
  const [openChats, setOpenChats] = useState(0);
  const [recentRedemptions, setRecentRedemptions] = useState<Redemption[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ count: totalUsers }, { data: claimedUsers }, { count: chatCount }, { data: redemptions }] =
        await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id, claimed").eq("claimed", true),
          supabase.from("chat_threads").select("id", { count: "exact", head: true }).eq("status", "open"),
          supabase
            .from("reward_redemptions")
            .select("id, points_spent, created_at, rewards(title), profiles(full_name)")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

      setUserCount(totalUsers ?? 0);
      setClaimedCount(claimedUsers?.length ?? 0);
      setOpenChats(chatCount ?? 0);
      const normalized =
        ((redemptions ?? []) as RedemptionQueryRow[]).map((row) => ({
          ...row,
          rewards: Array.isArray(row.rewards) ? row.rewards[0] ?? null : row.rewards,
          profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
        })) ?? [];

      setRecentRedemptions(normalized);
    };

    load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="card-muted">Monitor activity across NEXT.</p>
        </div>
        <button className="btn btn-primary">Create Event</button>
      </div>

      <div className="grid grid-3">
        <div className="card stat">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{userCount}</div>
          <div className="card-muted">
            {userCount === 0 ? "No users yet" : `${claimedCount} claimed`}
          </div>
        </div>
        <div className="card stat">
          <div className="stat-label">Open Chats</div>
          <div className="stat-value">{openChats}</div>
          <div className="card-muted">Needs response</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Redemptions</div>
          <div className="stat-value">{recentRedemptions.length}</div>
          <div className="card-muted">Last 5</div>
        </div>
      </div>

      <div className="section-title">Recent Redemptions</div>
      <div className="table">
        <div className="table-row">
          <strong>Employee</strong>
          <strong>Reward</strong>
          <strong>Points</strong>
          <strong>Date</strong>
        </div>
        {recentRedemptions.length === 0 ? (
          <div className="card-muted">No redemptions yet.</div>
        ) : (
          recentRedemptions.map((redemption) => (
            <div className="table-row" key={redemption.id}>
              <div>{redemption.profiles?.full_name ?? "Employee"}</div>
              <div>{redemption.rewards?.title ?? "Reward"}</div>
              <div>{redemption.points_spent}</div>
              <div>{formatDate(redemption.created_at)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
