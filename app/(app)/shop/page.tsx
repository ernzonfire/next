"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

type Reward = {
  id: string;
  title: string;
  description: string | null;
  points_cost: number;
  stock: number;
  is_active: boolean;
};

export default function ShopPage() {
  const { profile, refreshProfile } = useCurrentUser();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("rewards")
      .select("id, title, description, points_cost, stock, is_active")
      .eq("is_active", true)
      .order("points_cost", { ascending: true });

    if (loadError) {
      setError(loadError.message);
    }

    setRewards(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleRedeem = async (reward: Reward) => {
    setError(null);
    setRedeeming(reward.id);

    const { error: redeemError } = await supabase.functions.invoke("redeem-reward", {
      body: {
        reward_id: reward.id,
        quantity: 1,
      },
    });

    if (redeemError) {
      setError(redeemError.message);
      setRedeeming(null);
      return;
    }

    await refreshProfile();
    await load();
    setRedeeming(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Rewards Shop</h1>
          <p className="card-muted">Redeem points for company perks.</p>
        </div>
        <div className="chip">Balance: {profile?.points_balance ?? 0} pts</div>
      </div>

      {error ? <div className="card-muted">{error}</div> : null}

      <div className="grid grid-3">
        {loading ? (
          <div className="card-muted">Loading rewards...</div>
        ) : rewards.length === 0 ? (
          <div className="card-muted">No rewards available.</div>
        ) : (
          rewards.map((reward) => {
            const canRedeem = (profile?.points_balance ?? 0) >= reward.points_cost;
            return (
              <div className="card" key={reward.id}>
                <div className="card-title">{reward.title}</div>
                {reward.description ? (
                  <div className="card-muted">{reward.description}</div>
                ) : null}
                <div className="card-muted">Stock: {reward.stock}</div>
                <div style={{ marginTop: 12 }}>
                  <span className="chip">{reward.points_cost} pts</span>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 12 }}
                  onClick={() => handleRedeem(reward)}
                  disabled={!canRedeem || reward.stock <= 0 || redeeming === reward.id}
                >
                  {redeeming === reward.id ? "Redeeming..." : "Redeem"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
