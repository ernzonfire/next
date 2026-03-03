"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { formatDate } from "@/lib/utils/format";
import { compressImageForUpload } from "@/lib/utils/image";

type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  created_by: string;
  image_url: string | null;
};

export default function AnnouncementsPage() {
  const { role } = useCurrentUser();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportsImages, setSupportsImages] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const load = async () => {
    setLoading(true);

    if (!supportsImages) {
      const withoutImage = await supabase
        .from("announcements")
        .select("id, title, body, created_at, created_by")
        .order("created_at", { ascending: false });

      if (withoutImage.error) {
        setError(withoutImage.error.message);
        setItems([]);
      } else {
        const normalized = ((withoutImage.data ?? []) as Omit<Announcement, "image_url">[]).map(
          (row) => ({ ...row, image_url: null })
        );
        setItems(normalized);
      }

      setLoading(false);
      return;
    }

    const withImage = await supabase
      .from("announcements")
      .select("id, title, body, created_at, created_by, image_url")
      .order("created_at", { ascending: false });

    if (!withImage.error) {
      setItems((withImage.data ?? []) as Announcement[]);
      setSupportsImages(true);
      setLoading(false);
      return;
    }

    const missingImageColumn =
      withImage.error.code === "42703" ||
      withImage.error.message.toLowerCase().includes("image_url");

    if (!missingImageColumn) {
      setError(withImage.error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setSupportsImages(false);
    const withoutImage = await supabase
      .from("announcements")
      .select("id, title, body, created_at, created_by")
      .order("created_at", { ascending: false });

    if (withoutImage.error) {
      setError(withoutImage.error.message);
      setItems([]);
    } else {
      const normalized = ((withoutImage.data ?? []) as Omit<Announcement, "image_url">[]).map(
        (row) => ({ ...row, image_url: null })
      );
      setItems(normalized);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const uploadImage = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `announcements/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("announcement-images")
      .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });

    if (uploadError) {
      const message = uploadError.message.toLowerCase();
      if (message.includes("bucket not found")) {
        setSupportsImages(false);
        throw new Error(
          "Announcement image bucket is missing. Run migration 012_announcement_images.sql."
        );
      }
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage.from("announcement-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const getImagePath = (url: string) => {
    const marker = "/storage/v1/object/public/announcement-images/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  };

  const handleCreate = async () => {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    setError(null);
    let imageUrl: string | null = null;

    try {
      if (supportsImages && imageFile) {
        const compressed = await compressImageForUpload(imageFile, {
          maxDimension: 1600,
          quality: 0.82,
        });
        imageUrl = await uploadImage(compressed);
      }
    } catch (uploadError) {
      const uploadMessage =
        uploadError instanceof Error ? uploadError.message : "Unable to upload image.";
      setError(uploadMessage);
      setSubmitting(false);
      return;
    }

    const payload: { title: string; body: string; image_url?: string } = {
      title: title.trim(),
      body: body.trim(),
    };
    if (supportsImages && imageUrl) {
      payload.image_url = imageUrl;
    }

    const { error: insertError } = await supabase.from("announcements").insert(payload);

    if (insertError) {
      setError(insertError.message);
    } else {
      setTitle("");
      setBody("");
      setImageFile(null);
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(null);
      await load();
    }

    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    setError(null);
    const target = items.find((item) => item.id === id);
    const { error: deleteError } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (target?.image_url) {
      const path = getImagePath(target.image_url);
      if (path) {
        await supabase.storage.from("announcement-images").remove([path]);
      }
    }

    await load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Announcements</h1>
          <p className="card-muted">Company-wide updates in one feed.</p>
        </div>
      </div>

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Create Announcement</div>
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
              <span>Message</span>
              <textarea
                className="textarea"
                rows={4}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
            {supportsImages ? (
              <label className="form">
                <span>Image (optional)</span>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (imagePreview) {
                      URL.revokeObjectURL(imagePreview);
                    }
                    setImageFile(file);
                    setImagePreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
                {imagePreview ? (
                  <div style={{ marginTop: 8 }}>
                    <img
                      src={imagePreview}
                      alt="Announcement preview"
                      style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)" }}
                    />
                  </div>
                ) : null}
              </label>
            ) : (
              <div className="card-muted">
                Announcement images are disabled until migration 012_announcement_images.sql is applied.
              </div>
            )}
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="card-muted">{error}</div> : null}

      <div className="list">
        {loading ? (
          <div className="card-muted">Loading announcements...</div>
        ) : items.length === 0 ? (
          <div className="card-muted">No announcements yet.</div>
        ) : (
          items.map((item) => (
            <div className="card" key={item.id}>
              {item.image_url ? (
                <div style={{ margin: "-6px -6px 12px" }}>
                  <img
                    src={item.image_url}
                    alt={item.title}
                    style={{
                      width: "100%",
                      maxHeight: 240,
                      objectFit: "cover",
                      borderRadius: 14,
                      border: "1px solid var(--border)",
                    }}
                  />
                </div>
              ) : null}
              <div className="card-title">{item.title}</div>
              <div className="card-muted" style={{ marginBottom: 10 }}>
                {item.body}
              </div>
              <div className="card-muted">{formatDate(item.created_at)}</div>
              {isAdmin ? (
                <button
                  className="btn btn-ghost"
                  style={{ marginTop: 10 }}
                  onClick={() => handleDelete(item.id)}
                >
                  Delete
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
