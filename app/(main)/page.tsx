import { SignedIn } from "@/components/signed-in";

export const dynamic = "force-dynamic";

export default function BoardPage() {
  return <SignedIn view="board" />;
}
