"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/format";
import { compressImageForUpload } from "@/lib/utils/image";

type Announcement = {
  id: string;
  title: string;
  created_at: string;
  created_by: string;
  body: string;
  image_url: string | null;
};

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportsImages, setSupportsImages] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressionNote, setCompressionNote] = useState<string | null>(null);
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

        if (compressed.size < imageFile.size) {
          const beforeKb = Math.round(imageFile.size / 1024);
          const afterKb = Math.round(compressed.size / 1024);
          setCompressionNote(`Image compressed: ${beforeKb}KB -> ${afterKb}KB`);
        } else {
          setCompressionNote(null);
        }

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
      setCompressionNote(null);
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
          <p className="card-muted">Role-based editing with RLS enforced.</p>
        </div>
      </div>

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
              <span>Announcement Image (optional)</span>
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
                  setCompressionNote(null);
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
                  {compressionNote ? (
                    <div className="card-muted" style={{ marginTop: 8 }}>
                      {compressionNote}
                    </div>
                  ) : null}
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

      {error ? <div className="card-muted">{error}</div> : null}

      <div className="table">
        <div className="table-row" style={{ "--columns": 5 } as CSSProperties}>
          <strong>Image</strong>
          <strong>Title</strong>
          <strong>Date</strong>
          <strong>Body</strong>
          <strong>Actions</strong>
        </div>
        {loading ? (
          <div className="card-muted">Loading announcements...</div>
        ) : items.length === 0 ? (
          <div className="card-muted">No announcements yet.</div>
        ) : (
          items.map((item) => (
            <div className="table-row" style={{ "--columns": 5 } as CSSProperties} key={item.id}>
              <div>
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    style={{
                      width: 82,
                      height: 54,
                      objectFit: "cover",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  />
                ) : (
                  <span className="card-muted">-</span>
                )}
              </div>
              <div>{item.title}</div>
              <div>{formatDate(item.created_at)}</div>
              <div>{item.body}</div>
              <div>
                <button className="btn btn-ghost" onClick={() => handleDelete(item.id)}>
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
