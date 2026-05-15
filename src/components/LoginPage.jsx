import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

export default function LoginPage({ accessMessage = "" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin");
  const [message, setMessage] = useState(accessMessage);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const payload = { email, password };
    const response =
      mode === "signin"
        ? await supabase.auth.signInWithPassword(payload)
        : await supabase.auth.signUp(payload);

    if (response.error) {
      setMessage(response.error.message);
    } else if (mode === "signup") {
      setMessage("Account created. Check your email if confirmation is enabled, then sign in.");
      setMode("signin");
    }

    setLoading(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Protected Manager Workspace</p>
        <h1>Advertising Workload Daily Monitoring</h1>
        <p className="muted">
          Sign in before opening the dashboard. This protects the manager view and saved reports.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
            />
          </label>

          {message && <p className="form-message">{message}</p>}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <button
          type="button"
          className="text-button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMessage("");
          }}
        >
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}
