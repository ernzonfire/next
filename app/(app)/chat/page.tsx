"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { formatDateTime } from "@/lib/utils/format";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export default function ChatPage() {
  const { user } = useCurrentUser();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id ?? null;
  const isReady = useMemo(() => Boolean(userId), [userId]);

  useEffect(() => {
    if (!isReady || !userId) return;

    const loadThread = async () => {
      const { data: existing, error: threadError } = await supabase
        .from("chat_threads")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (threadError) {
        setError(threadError.message);
        setLoading(false);
        return;
      }

      if (existing?.id) {
        setThreadId(existing.id);
        return;
      }

      const { data: created, error: createError } = await supabase
        .from("chat_threads")
        .insert({ user_id: userId })
        .select("id")
        .single();

      if (createError) {
        setError(createError.message);
        setLoading(false);
        return;
      }

      setThreadId(created.id);
    };

    loadThread();
  }, [isReady, userId]);

  useEffect(() => {
    if (!threadId) return;

    let isMounted = true;

    const loadMessages = async () => {
      const { data, error: messageError } = await supabase
        .from("chat_messages")
        .select("id, sender_id, body, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (!isMounted) return;

      if (messageError) {
        setError(messageError.message);
      }

      setMessages(data ?? []);
      setLoading(false);
    };

    loadMessages();

    const channel = supabase
      .channel(`chat:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  const sendMessage = async () => {
    if (!threadId || !userId || !text.trim()) return;
    setError(null);

    const { error: sendError } = await supabase.from("chat_messages").insert({
      thread_id: threadId,
      sender_id: userId,
      body: text.trim(),
    });

    if (sendError) {
      setError(sendError.message);
      return;
    }

    setText("");
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Chat & Concerns</h1>
          <p className="card-muted">Messages route to Admin and VP Admin.</p>
        </div>
      </div>

      {error ? <div className="card-muted">{error}</div> : null}

      <div className="list">
        {loading ? (
          <div className="card-muted">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="card-muted">No messages yet.</div>
        ) : (
          messages.map((message) => (
            <div className="card" key={message.id}>
              <div className="card-title">
                {message.sender_id === userId ? "You" : "Admin"}
              </div>
              <div className="card-muted">{message.body}</div>
              <div className="card-muted" style={{ marginTop: 6 }}>
                {formatDateTime(message.created_at)}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Send a message</div>
        <textarea
          className="textarea"
          rows={4}
          placeholder="Type your message..."
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
}
