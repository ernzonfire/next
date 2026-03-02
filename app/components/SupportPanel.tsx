"use client";

import { FormEvent, useState } from "react";

type SupportPanelProps = {
  open: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
};

export default function SupportPanel({ open, onClose, onSubmitSuccess }: SupportPanelProps) {
  const [topic, setTopic] = useState("Support");
  const [message, setMessage] = useState("");

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    onSubmitSuccess();
    setMessage("");
    setTopic("Support");
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Support panel"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 10, 30, 0.45)",
        zIndex: 45,
        display: "flex",
        alignItems: "flex-end",
      }}
      onClick={onClose}
    >
      <section
        className="card"
        style={{
          width: "100%",
          borderRadius: "22px 22px 0 0",
          margin: 0,
          boxShadow: "0 -10px 32px rgba(0,0,0,0.22)",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="page-header" style={{ marginBottom: 10 }}>
          <div>
            <h3>Support & Feedback</h3>
            <p className="card-muted">Send issue reports or suggestions.</p>
          </div>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </header>

        <form className="form" onSubmit={handleSubmit}>
          <label className="form" htmlFor="topic-select">
            <span>Type</span>
            <select
              id="topic-select"
              className="select"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            >
              <option>Support</option>
              <option>Feedback</option>
              <option>Suggestion</option>
            </select>
          </label>

          <label className="form" htmlFor="support-message">
            <span>Message</span>
            <textarea
              id="support-message"
              className="textarea"
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Type details here"
              required
            />
          </label>

          <button type="submit" className="btn btn-primary">
            Submit
          </button>
        </form>
      </section>
    </div>
  );
}
