"use client";

import { useState } from "react";
import { signInAdmin } from "@/lib/actions";

export function AdminLoginForm({ signedIn }: { signedIn: boolean }) {
  const [error, setError] = useState("");

  return (
    <form
      className="login-card"
      action={async (formData) => {
        const result = await signInAdmin(formData);
        if (result && !result.ok) setError(result.error);
      }}
    >
      <h2>Admin</h2>
      <p className="hint">Workflows and email templates open with the admin key. The system id does not.</p>
      <label htmlFor="adminId">Admin key</label>
      <input id="adminId" name="adminId" type="password" autoComplete="current-password" />
      <button className="btn full" type="submit">Open admin</button>
      <p className="error">{error}</p>
      <p className="login-switch"><a href={signedIn ? "/" : "/login"}>{signedIn ? "Back to the board" : "Board sign in"}</a></p>
    </form>
  );
}
