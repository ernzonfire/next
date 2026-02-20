"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Reward = {
  id: string;
  title: string;
  description: string | null;
  points_cost: number;
  stock: number;
  is_active: boolean;
};

export default function AdminRewardsPage() {
  const [items, setItems] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointsCost, setPointsCost] = useState(100);
  const [stock, setStock] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("rewards")
      .select("id, title, description, points_cost, stock, is_active")
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
    }

    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from("rewards").insert({
      title: title.trim(),
      description: description.trim() || null,
      points_cost: pointsCost,
      stock,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setTitle("");
      setDescription("");
      setPointsCost(100);
      setStock(10);
      await load();
    }

    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    setError(null);
    const { error: deleteError } = await supabase.from("rewards").delete().eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Rewards</h1>
          <p className="card-muted">Inventory and point costs.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Add Reward</div>
        <div className="form" style={{ marginTop: 12 }}>
          <label className="form">
            <span>Title</span>
            <input
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="form">
            <span>Description</span>
            <textarea
              className="textarea"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="form">
            <span>Points Cost</span>
            <input
              className="input"
              type="number"
              min={1}
              value={pointsCost}
              onChange={(event) => setPointsCost(Number(event.target.value))}
            />
          </label>
          <label className="form">
            <span>Stock</span>
            <input
              className="input"
              type="number"
              min={0}
              value={stock}
              onChange={(event) => setStock(Number(event.target.value))}
            />
          </label>
          <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
            {submitting ? "Adding..." : "Add Reward"}
          </button>
        </div>
      </div>

      {error ? <div className="card-muted">{error}</div> : null}

      <div className="table">
        <div className="table-row">
          <strong>Reward</strong>
          <strong>Cost</strong>
          <strong>Stock</strong>
          <strong>Actions</strong>
        </div>
        {loading ? (
          <div className="card-muted">Loading rewards...</div>
        ) : items.length === 0 ? (
          <div className="card-muted">No rewards yet.</div>
        ) : (
          items.map((reward) => (
            <div className="table-row" key={reward.id}>
              <div>{reward.title}</div>
              <div>{reward.points_cost}</div>
              <div>{reward.stock}</div>
              <div>
                <button className="btn btn-ghost" onClick={() => handleDelete(reward.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
