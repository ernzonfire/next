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

export default function AdminRedemptionsPage() {
  const [items, setItems] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from("reward_redemptions")
        .select("id, points_spent, created_at, rewards(title), profiles(full_name)")
        .order("created_at", { ascending: false });

      if (loadError) {
        setError(loadError.message);
      }

      const normalized =
        ((data ?? []) as RedemptionQueryRow[]).map((row) => ({
          ...row,
          rewards: Array.isArray(row.rewards) ? row.rewards[0] ?? null : row.rewards,
          profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
        })) ?? [];

      setItems(normalized);
      setLoading(false);
    };

    load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Redemptions</h1>
          <p className="card-muted">Track reward fulfillment.</p>
        </div>
      </div>

      {error ? <div className="card-muted">{error}</div> : null}

      <div className="table">
        <div className="table-row">
          <strong>Employee</strong>
          <strong>Reward</strong>
          <strong>Points</strong>
          <strong>Date</strong>
        </div>
        {loading ? (
          <div className="card-muted">Loading redemptions...</div>
        ) : items.length === 0 ? (
          <div className="card-muted">No redemptions yet.</div>
        ) : (
          items.map((redemption) => (
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
