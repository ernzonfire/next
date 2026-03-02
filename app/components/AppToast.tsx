"use client";

type ToastTone = "success" | "error" | "info";

type AppToastProps = {
  message: string;
  tone?: ToastTone;
};

export default function AppToast({ message, tone = "info" }: AppToastProps) {
  return <div className={`toast toast-${tone}`}>{message}</div>;
}
