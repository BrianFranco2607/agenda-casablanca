import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./db";
import Login from "./Login";
import App from "./App";
import { ConfigProvider } from "./ConfigContext";

export default function Auth() {
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCargando(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F0E9]">
        <p className="text-[#8A8175]">Cargando…</p>
      </div>
    );
  }

  if (!session) return <Login />;

  return (
    <ConfigProvider>
      <App />
    </ConfigProvider>
  );
}
