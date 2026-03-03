import { redirect } from "next/navigation";

export default function AdminRosterRedirectPage() {
  redirect("/admin/users");
}
