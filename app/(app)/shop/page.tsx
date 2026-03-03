"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { invokeEdge } from "@/lib/supabase/edge";

type RewardItem = {
  id: string;
  title: string;
  description: string | null;
  points_cost: number;
  stock: number;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
};

type FilterType = "All" | "Available" | "Low Stock" | "Out of Stock";

const filters: FilterType[] = ["All", "Available", "Low Stock", "Out of Stock"];

function pushToast(message: string, tone: "success" | "error" | "info" = "info") {
  window.dispatchEvent(new CustomEvent("next-toast", { detail: { message, tone } }));
}

export default function ShopPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [selected, setSelected] = useState<RewardItem | null>(null);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [supportsRewardImages, setSupportsRewardImages] = useState(true);

  const loadRewards = useCallback(async () => {
    setLoading(true);
    setError(null);

    const fetchWithoutImage = async () => {
      const response = await supabase
        .from("rewards")
        .select("id, title, description, points_cost, stock, is_active, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (response.error) {
        setError(response.error.message);
        setItems([]);
      } else {
        setSupportsRewardImages(false);
        setItems(
          (response.data ?? []).map((row) => ({
            ...row,
            image_url: null,
          })) as RewardItem[]
        );
      }

      setLoading(false);
    };

    if (!supportsRewardImages) {
      await fetchWithoutImage();
      return;
    }

    const withImage = await supabase
      .from("rewards")
      .select("id, title, description, points_cost, stock, is_active, image_url, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (!withImage.error) {
      setSupportsRewardImages(true);
      setItems((withImage.data ?? []) as RewardItem[]);
      setLoading(false);
      return;
    }

    const missingImageColumn =
      withImage.error.code === "42703" ||
      withImage.error.message.toLowerCase().includes("image_url");

    if (missingImageColumn) {
      await fetchWithoutImage();
      return;
    }

    setItems([]);
    setError(withImage.error.message);
    setLoading(false);
  }, [supportsRewardImages]);

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      const matchesFilter =
        activeFilter === "All" ||
        (activeFilter === "Available" && item.stock > 10) ||
        (activeFilter === "Low Stock" && item.stock > 0 && item.stock <= 10) ||
        (activeFilter === "Out of Stock" && item.stock <= 0);

      const matchesSearch =
        !normalizedSearch ||
        item.title.toLowerCase().includes(normalizedSearch) ||
        (item.description ?? "").toLowerCase().includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, items, searchTerm]);

  const handleRedeem = async (item: RewardItem) => {
    if (item.stock <= 0) {
      pushToast("This reward is out of stock.", "error");
      return;
    }

    setRedeemingId(item.id);

    try {
      await invokeEdge<{ new_balance: number | null; redemption_id: string | null }>("redeem-reward", {
        reward_id: item.id,
        quantity: 1,
      });
      pushToast(`${item.title} redeemed successfully.`, "success");
      await loadRewards();
      setSelected(null);
    } catch (redeemError) {
      const message =
        redeemError instanceof Error ? redeemError.message : "Unable to redeem reward right now.";
      pushToast(message, "error");
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Shop</h1>
          <p className="card-muted">Redeem rewards and perks with your points.</p>
        </div>
      </header>

      <section className="card" style={{ marginTop: 14 }}>
        <label className="form" htmlFor="shop-search">
          <span>Search rewards</span>
          <input
            id="shop-search"
            className="input"
            placeholder="Search by reward name"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <div style={{ marginTop: 12, display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {filters.map((filter) => {
            const active = activeFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                className={active ? "btn btn-primary" : "btn btn-outline"}
                onClick={() => setActiveFilter(filter)}
                style={{ whiteSpace: "nowrap", minHeight: 36 }}
              >
                {filter}
              </button>
            );
          })}
        </div>
      </section>

      {error ? (
        <div className="card-muted" style={{ marginTop: 10 }}>
          {error}
        </div>
      ) : null}

      <section
        className="grid"
        style={{
          marginTop: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          gap: 12,
        }}
      >
        {loading ? (
          <div className="card-muted">Loading rewards...</div>
        ) : filteredItems.length === 0 ? (
          <div className="card-muted">No rewards available right now.</div>
        ) : (
          filteredItems.map((item) => {
            const stockLabel = item.stock <= 0 ? "Out of stock" : item.stock <= 10 ? "Low stock" : "Available";
            return (
              <article className="card" key={item.id}>
                {item.image_url ? (
                  <div style={{ margin: "-6px -6px 10px" }}>
                    <img
                      src={item.image_url}
                      alt={item.title}
                      style={{
                        width: "100%",
                        height: 120,
                        objectFit: "cover",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                      }}
                    />
                  </div>
                ) : null}
                <div className="chip" style={{ marginBottom: 8 }}>
                  {stockLabel}
                </div>
                <h2 className="card-title" style={{ fontSize: 20 }}>
                  {item.title}
                </h2>
                <div style={{ marginTop: 8, fontWeight: 700, color: "var(--brand-navy)" }}>
                  {item.points_cost} pts
                </div>
                <p className="card-muted" style={{ marginTop: 6 }}>
                  Stock: {item.stock}
                </p>
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setSelected(item)}>
                    View
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={item.stock <= 0 || redeemingId === item.id}
                    onClick={() => handleRedeem(item)}
                  >
                    {redeemingId === item.id ? "Redeeming..." : "Redeem"}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>

      {selected ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.title} details`}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 46,
            background: "rgba(8, 16, 32, 0.52)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={() => setSelected(null)}
        >
          <article className="card" style={{ width: "min(520px, 100%)" }} onClick={(event) => event.stopPropagation()}>
            <div className="page-header">
              <div>
                <h2>{selected.title}</h2>
                <p className="card-muted">{selected.stock} in stock</p>
              </div>
              <button type="button" className="btn btn-outline" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>

            {selected.image_url ? (
              <div style={{ marginTop: 12 }}>
                <img
                  src={selected.image_url}
                  alt={selected.title}
                  style={{ width: "100%", borderRadius: 14, border: "1px solid var(--border)" }}
                />
              </div>
            ) : null}

            <p style={{ marginTop: 14 }}>{selected.description || "No description available."}</p>

            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="chip">{selected.stock > 0 ? "Available" : "Out of stock"}</span>
              <strong style={{ color: "var(--brand-navy)" }}>{selected.points_cost} pts</strong>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              disabled={selected.stock <= 0 || redeemingId === selected.id}
              onClick={() => handleRedeem(selected)}
            >
              {redeemingId === selected.id ? "Redeeming..." : "Confirm Redeem"}
            </button>
          </article>
        </div>
      ) : null}
    </div>
  );
}
