"use client";

import { useState } from "react";
import { login } from "@/lib/actions";

export function LoginForm() {
  const [error, setError] = useState("");

  return (
    <form
      className="login-card"
      action={async (formData) => {
        const result = await login(formData);
        if (result && !result.ok) setError(result.error);
      }}
    >
      <h2>Sign in</h2>
      <p className="hint">One operator. The system id stays in the server environment.</p>
      <label htmlFor="systemId">System id</label>
      <input id="systemId" name="systemId" type="password" autoComplete="current-password" />
      <button className="btn full" type="submit">Enter the board</button>
      <p className="error">{error}</p>
      <p className="login-switch"><a href="/admin/login">Admin sign in</a></p>
    </form>
  );
}
