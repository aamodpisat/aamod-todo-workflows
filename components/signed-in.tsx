import { AppFrame, type AppView } from "@/components/app-frame";
import { currentRole } from "@/lib/auth";
import { loadBoard } from "@/lib/load-board";

export async function SignedIn({ view }: { view: AppView }) {
  const role = await currentRole();
  return <AppFrame data={await loadBoard()} view={view} admin={role === "admin"} />;
}
