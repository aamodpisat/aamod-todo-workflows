import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <section className="login">
      <div className="login-story">
        <div className="brand">Aamod<small>Personal Todo</small></div>
        <h1>One board. Every morning.</h1>
        <p>Tasks start in Todo. You move them. The morning mail tells you which one to touch first.</p>
      </div>
      <div className="login-panel">
        <LoginForm />
      </div>
    </section>
  );
}
