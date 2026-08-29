import { useState } from "react";
import { supabase } from "./db";

function IconMail() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar() {
    setError("");
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    setCargando(false);
    if (error) setError("Usuario o contraseña incorrectos.");
  }

  const campo =
    "w-full rounded-xl border border-[#E7DCC2] bg-white py-3 pl-11 pr-4 text-sm text-[#2E2A26] placeholder:text-[#B4A98F] focus:border-[#C9A24E] focus:outline-none focus:ring-2 focus:ring-[#C9A24E]/25 transition";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F1ECE1] px-4">
      {/* fondo: degradado cálido + acentos muy tenues del mandala */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-[#F5F1EA] to-[#EBE3D4]" />
      <div className="pointer-events-none absolute -left-40 -top-32 h-[26rem] w-[26rem] rounded-full bg-[#E3A7A9]/18 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-[#5B8CA0]/12 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[20rem] w-[20rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D8B25A]/12 blur-3xl" />

      {/* tarjeta */}
      <div className="relative z-10 w-full max-w-[380px] overflow-hidden rounded-[26px] border border-[#E7DCC2] bg-[#FBF9F4] shadow-[0_28px_70px_-28px_rgba(150,110,40,0.35)]">
        {/* filo dorado superior */}
        <div className="h-1 w-full bg-linear-to-r from-[#D8B25A] via-[#B8892E] to-[#D8B25A]" />

        <div className="px-8 pb-8 pt-7">
          {/* logo */}
          <div className="flex flex-col items-center">
            <img
              src="/Casablanca.png"
              alt="Casablanca Nail Spa & Lounge"
              className="h-40 w-40 rounded-full object-cover"
            />
            <p className="mt-1 text-xs tracking-[0.18em] text-[#A89B84]">
              CASABLANCA · Nail Spa
            </p>
            <div className="mx-auto mt-4 h-px w-16 bg-linear-to-r from-transparent via-[#C9A24E]/60 to-transparent" />
          </div>

          {/* formulario */}
          <div className="mt-6 space-y-3">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B8892E]/70">
                <IconMail />
              </span>
              <input
                className={campo}
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && entrar()}
                autoFocus
              />
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B8892E]/70">
                <IconLock />
              </span>
              <input
                className={campo}
                type="password"
                placeholder="Contraseña"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && entrar()}
              />
            </div>

            {error && (
              <p className="rounded-xl bg-[#8E2B44]/10 px-3 py-2 text-sm text-[#8E2B44] ring-1 ring-[#8E2B44]/20">
                {error}
              </p>
            )}

            <button
              onClick={entrar}
              disabled={cargando}
              className="mt-1 w-full rounded-full bg-linear-to-r from-[#D8B25A] via-[#C79B3F] to-[#B8892E] py-3.5 text-sm font-semibold tracking-wide text-[#2E2A26] shadow-[0_10px_24px_-10px_rgba(184,137,46,0.7)] transition hover:brightness-[1.04] active:scale-[0.99] disabled:opacity-50"
            >
              {cargando ? "Entrando…" : "Iniciar sesión"}
            </button>
          </div>
        </div>
      </div>

      <p className="absolute bottom-6 left-0 right-0 z-10 text-center text-[11px] tracking-[0.15em] text-[#A89B84]">
        CASABLANCA NAIL SPA &amp; LOUNGE
      </p>
    </div>
  );
}
