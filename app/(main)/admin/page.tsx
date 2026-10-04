import { SignedIn } from "@/components/signed-in";
import { currentRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const role = await currentRole();
  if (role !== "admin") redirect("/admin/login");
  return <SignedIn view="admin" />;
}
