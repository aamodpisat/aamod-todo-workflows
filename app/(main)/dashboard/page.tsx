import { SignedIn } from "@/components/signed-in";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return <SignedIn view="dashboard" />;
}
