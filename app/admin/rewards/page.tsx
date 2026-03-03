"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils/format";
import { compressImageForUpload } from "@/lib/utils/image";

type Reward = {
  id: string;
  title: string;
  description: string | null;
  points_cost: number;
  stock: number;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
};

const IMAGE_BUCKET = "reward-images";

export default function AdminRewardsPage() {
  const [items, setItems] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportsRewardImages, setSupportsRewardImages] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointsCost, setPointsCost] = useState(100);
  const [stock, setStock] = useState(10);
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [compressionNote, setCompressionNote] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const revokeIfBlob = (value: string | null) => {
    if (value && value.startsWith("blob:")) {
      URL.revokeObjectURL(value);
    }
  };

  const resetForm = () => {
    revokeIfBlob(imagePreview);
    setEditingId(null);
    setTitle("");
    setDescription("");
    setPointsCost(100);
    setStock(10);
    setIsActive(true);
    setImageFile(null);
    setImagePreview(null);
    setCurrentImageUrl(null);
    setCompressionNote(null);
  };

  useEffect(() => {
    load();
    return () => {
      revokeIfBlob(imagePreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);

    const fetchWithoutImage = async () => {
      const response = await supabase
        .from("rewards")
        .select("id, title, description, points_cost, stock, is_active, created_at")
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
          })) as Reward[]
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
      .order("created_at", { ascending: false });

    if (!withImage.error) {
      setSupportsRewardImages(true);
      setItems((withImage.data ?? []) as Reward[]);
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

    setError(withImage.error.message);
    setItems([]);
    setLoading(false);
  };

  const getImagePath = (url: string) => {
    const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  };

  const uploadImage = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `rewards/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });

    if (uploadError) {
      const message = uploadError.message.toLowerCase();
      if (message.includes("bucket not found")) {
        setSupportsRewardImages(false);
        throw new Error("Reward image bucket is missing. Run migration 013_rewards_images.sql.");
      }
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCreateOrUpdate = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    if (!Number.isFinite(pointsCost) || pointsCost < 1) {
      setError("Points cost must be at least 1.");
      return;
    }

    if (!Number.isFinite(stock) || stock < 0) {
      setError("Stock must be 0 or greater.");
      return;
    }

    setSubmitting(true);
    setError(null);

    let nextImageUrl: string | null = currentImageUrl;

    try {
      if (supportsRewardImages && imageFile) {
        const compressed = await compressImageForUpload(imageFile, {
          maxDimension: 1400,
          quality: 0.82,
        });

        if (compressed.size < imageFile.size) {
          const beforeKb = Math.round(imageFile.size / 1024);
          const afterKb = Math.round(compressed.size / 1024);
          setCompressionNote(`Image compressed: ${beforeKb}KB → ${afterKb}KB`);
        } else {
          setCompressionNote(null);
        }

        nextImageUrl = await uploadImage(compressed);
      }

      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        points_cost: pointsCost,
        stock,
        is_active: isActive,
      };

      if (supportsRewardImages) {
        payload.image_url = nextImageUrl;
      }

      if (editingId) {
        const { error: updateError } = await supabase
          .from("rewards")
          .update(payload)
          .eq("id", editingId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        if (supportsRewardImages && currentImageUrl && nextImageUrl && currentImageUrl !== nextImageUrl) {
          const oldPath = getImagePath(currentImageUrl);
          if (oldPath) {
            await supabase.storage.from(IMAGE_BUCKET).remove([oldPath]);
          }
        }
      } else {
        const { error: insertError } = await supabase.from("rewards").insert(payload);
        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      resetForm();
      await load();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to save reward.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (reward: Reward) => {
    revokeIfBlob(imagePreview);
    setEditingId(reward.id);
    setTitle(reward.title);
    setDescription(reward.description ?? "");
    setPointsCost(reward.points_cost);
    setStock(reward.stock);
    setIsActive(reward.is_active);
    setCurrentImageUrl(reward.image_url);
    setImagePreview(reward.image_url);
    setImageFile(null);
    setCompressionNote(null);
    setError(null);
  };

  const handleDelete = async (reward: Reward) => {
    if (!window.confirm(`Delete "${reward.title}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(reward.id);
    setError(null);

    try {
      const { error: deleteError } = await supabase.from("rewards").delete().eq("id", reward.id);
      if (deleteError) {
        throw new Error(deleteError.message);
      }

      if (reward.image_url) {
        const path = getImagePath(reward.image_url);
        if (path) {
          await supabase.storage.from(IMAGE_BUCKET).remove([path]);
        }
      }

      await load();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete reward.";
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Rewards</h1>
          <p className="card-muted">Inventory, images, and point costs.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">{editingId ? "Edit Reward" : "Add Reward"}</div>
        <div className="form" style={{ marginTop: 12 }}>
          <label className="form">
            <span>Title</span>
            <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
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

          <label className="form" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <span>Reward is active</span>
          </label>

          {supportsRewardImages ? (
            <label className="form">
              <span>Reward Image (optional)</span>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  revokeIfBlob(imagePreview);
                  setImageFile(file);
                  setCompressionNote(null);
                  setImagePreview(file ? URL.createObjectURL(file) : currentImageUrl);
                }}
              />

              {imagePreview ? (
                <div style={{ marginTop: 8 }}>
                  <img
                    src={imagePreview}
                    alt="Reward preview"
                    style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 12, border: "1px solid var(--border)" }}
                  />
                  {compressionNote ? (
                    <div className="card-muted" style={{ marginTop: 8 }}>
                      {compressionNote}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </label>
          ) : (
            <div className="card-muted">Reward images are disabled until migration 013 is applied.</div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary" type="button" onClick={handleCreateOrUpdate} disabled={submitting}>
              {submitting ? "Saving..." : editingId ? "Save Changes" : "Add Reward"}
            </button>
            {editingId ? (
              <button className="btn btn-outline" type="button" onClick={resetForm} disabled={submitting}>
                Cancel Edit
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <div className="card-muted">{error}</div> : null}

      <div className="table">
        <div className="table-row">
          <strong>Reward</strong>
          <strong>Cost</strong>
          <strong>Stock</strong>
          <strong>Status</strong>
          <strong>Updated</strong>
          <strong>Actions</strong>
        </div>

        {loading ? (
          <div className="card-muted">Loading rewards...</div>
        ) : items.length === 0 ? (
          <div className="card-muted">No rewards yet.</div>
        ) : (
          items.map((reward) => (
            <div className="table-row" key={reward.id}>
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {reward.image_url ? (
                    <img
                      src={reward.image_url}
                      alt={reward.title}
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: "cover",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                      }}
                    />
                  ) : null}
                  <div>
                    <div style={{ fontWeight: 600 }}>{reward.title}</div>
                    {reward.description ? (
                      <div className="card-muted" style={{ marginTop: 2 }}>
                        {reward.description}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div>{reward.points_cost} pts</div>
              <div>{reward.stock}</div>
              <div>
                <span className="chip" style={{ background: reward.is_active ? undefined : "rgba(77, 88, 88, 0.12)" }}>
                  {reward.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div>{formatDateTime(reward.created_at)}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-outline" type="button" onClick={() => handleEdit(reward)}>
                  Edit
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => handleDelete(reward)}
                  disabled={deletingId === reward.id}
                >
                  {deletingId === reward.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
