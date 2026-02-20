import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
};

export default function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const base = "btn";
  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "outline"
      ? "btn-outline"
      : "btn-ghost";

  return <button className={`${base} ${variantClass} ${className}`} {...props} />;
}
