import { useEffect, useMemo, useState } from "react";
import Dashboard from "./components/Dashboard.jsx";
import LoginPage from "./components/LoginPage.jsx";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient.js";

function getAllowedEmails() {
  const single = import.meta.env.VITE_ALLOWED_EMAIL || "";
  const multiple = import.meta.env.VITE_ALLOWED_EMAILS || "";

  return [single, ...multiple.split(",")]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [accessMessage, setAccessMessage] = useState("");

  const allowedEmails = useMemo(getAllowedEmails, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCheckingSession(false);
      return;
    }

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setAccessMessage(error.message);
      }

      const currentSession = data?.session || null;
      const email = currentSession?.user?.email?.toLowerCase();

      if (currentSession && allowedEmails.length > 0 && !allowedEmails.includes(email)) {
        await supabase.auth.signOut();
        setAccessMessage("This account is not included in the allowed email list.");
        setSession(null);
      } else {
        setSession(currentSession);
      }

      setCheckingSession(false);
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      const email = nextSession?.user?.email?.toLowerCase();

      if (nextSession && allowedEmails.length > 0 && !allowedEmails.includes(email)) {
        await supabase.auth.signOut();
        setAccessMessage("This account is not included in the allowed email list.");
        setSession(null);
        return;
      }

      setAccessMessage("");
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [allowedEmails]);

  if (!isSupabaseConfigured) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Setup Required</p>
          <h1>Supabase is not configured</h1>
          <p>
            Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file,
            then restart the development server.
          </p>
        </section>
      </main>
    );
  }

  if (checkingSession) {
    return (
      <main className="loading-screen">
        <div className="loader-card">Checking dashboard access...</div>
      </main>
    );
  }

  if (!session) {
    return <LoginPage accessMessage={accessMessage} />;
  }

  return <Dashboard session={session} />;
}
