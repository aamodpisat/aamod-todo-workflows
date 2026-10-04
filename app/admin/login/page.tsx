import { AdminLoginForm } from "@/components/admin-login-form";
import { currentRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const role = await currentRole();
  return (
    <section className="login">
      <div className="login-story">
        <div className="brand">Aamod<small>Personal Todo</small></div>
        <h1>Admin stays separate.</h1>
        <p>The board sign-in cannot change workflows or the morning mail. This key can.</p>
      </div>
      <div className="login-panel">
        <AdminLoginForm signedIn={role === "operator"} />
      </div>
    </section>
  );
}
