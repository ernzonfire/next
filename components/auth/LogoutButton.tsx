"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

export default function LogoutButton({
  label = "Logout",
  className = "",
  variant = "ghost",
}: {
  label?: string;
  className?: string;
  variant?: "primary" | "outline" | "ghost";
}) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      router.replace("/login");
      window.location.href = "/login";
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      onClick={handleLogout}
    >
      {label}
    </Button>
  );
}
