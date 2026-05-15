import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Dashboard from "./components/Dashboard";
import LoginPage from "./components/LoginPage";

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function getSession() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setCheckingSession(false);
    }

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (checkingSession) {
    return <div className="min-h-screen grid place-items-center">Checking access...</div>;
  }

  if (!session) {
    return <LoginPage />;
  }

  return <Dashboard session={session} />;
}