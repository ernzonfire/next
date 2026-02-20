import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export default function Input({ label, ...props }: InputProps) {
  return (
    <label className="form">
      {label ? <span>{label}</span> : null}
      <input className="input" {...props} />
    </label>
  );
}
