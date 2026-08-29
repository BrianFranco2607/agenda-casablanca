import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, aMinutos, aHora } from "./db";
import { SALON, HORARIO } from "./config";

// Datos de contacto / marca (sacados de su Instagram — ajústalos aquí)
const CONTACTO = {
  instagram: "casablanca_nailspa",
  whatsapp: "3232223256",
  direccion: "Ciudad Montes · Bogotá",
  tagline: "La elegancia está en los detalles",
};

const hoyISO = () => new Date().toLocaleDateString("en-CA");

const fechaLarga = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const SLOT = 30;

type Servicio = { nombre: string; precio: number; duracion: number };
type Ocupado = { estilista: string; hora: string; duracion: number };

const CUALIDADES = [
  "Atención personalizada",
  "Productos de alta calidad",
  "Ambiente moderno y relajante",
  "Higiene y bioseguridad certificada",
];

export default function Reserva() {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [estilistas, setEstilistas] = useState<string[]>([]);
  const [cargandoCfg, setCargandoCfg] = useState(true);
  const [errorCfg, setErrorCfg] = useState("");

  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [estilista, setEstilista] = useState<string>("");
  const [dia, setDia] = useState(hoyISO);
  const [hora, setHora] = useState<string>("");
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");

  const [ocupados, setOcupados] = useState<Ocupado[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<null | {
    servicio: string;
    estilista: string;
    dia: string;
    hora: string;
    nombre: string;
  }>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setCargandoCfg(true);
      const [svc, est] = await Promise.all([
        supabase.rpc("servicios_publicos"),
        supabase.rpc("estilistas_publicos"),
      ]);
      if (svc.error || est.error) {
        setErrorCfg(
          "No pudimos cargar los servicios. Intenta de nuevo en un momento."
        );
        setCargandoCfg(false);
        return;
      }
      setServicios((svc.data as Servicio[]) ?? []);
      setEstilistas(
        ((est.data as { nombre: string }[]) ?? []).map((e) => e.nombre)
      );
      setCargandoCfg(false);
    })();
  }, []);

  useEffect(() => {
    setHora("");
    if (!estilista || !dia) {
      setOcupados([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("horarios_ocupados", {
        p_dia: dia,
      });
      if (error) {
        setOcupados([]);
        return;
      }
      setOcupados((data as Ocupado[]) ?? []);
    })();
  }, [estilista, dia]);

  const horarios = useMemo(() => {
    if (!servicio || !estilista) return [];
    const abre = aMinutos(HORARIO.abre);
    const cierra = aMinutos(HORARIO.cierra);
    const dur = servicio.duracion || 60;

    const ocupadosEst = ocupados
      .filter((o) => o.estilista === estilista)
      .map((o) => {
        const ini = aMinutos(o.hora.slice(0, 5));
        return { ini, fin: ini + (o.duracion || 60) };
      });

    const esHoy = dia === hoyISO();
    const ahora = new Date();
    const nowMin = ahora.getHours() * 60 + ahora.getMinutes();

    const out: string[] = [];
    for (let s = abre; s + dur <= cierra; s += SLOT) {
      if (esHoy && s <= nowMin) continue;
      const choca = ocupadosEst.some((o) => s < o.fin && s + dur > o.ini);
      if (!choca) out.push(aHora(s));
    }
    return out;
  }, [servicio, estilista, dia, ocupados]);

  const completo =
    servicio && estilista && dia && hora && cliente.trim() && telefono.trim();

  async function reservar() {
    if (!completo || !servicio) return;
    setEnviando(true);
    setError("");
    const { error } = await supabase.rpc("crear_reserva", {
      p_cliente: cliente.trim(),
      p_telefono: telefono.trim(),
      p_servicio: servicio.nombre,
      p_estilista: estilista,
      p_fecha: dia,
      p_hora: hora,
    });
    setEnviando(false);
    if (error) {
      setError(error.message || "No se pudo agendar. Intenta con otro horario.");
      return;
    }
    setListo({
      servicio: servicio.nombre,
      estilista,
      dia,
      hora,
      nombre: cliente.trim(),
    });
  }

  // ---------- confirmación ----------
  if (listo) {
    return (
      <Fondo>
        <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[26px] border border-[#E7DCC2] bg-[#FBF9F4] shadow-[0_28px_70px_-28px_rgba(150,110,40,0.35)]">
          <div className="h-1 w-full bg-linear-to-r from-[#D8B25A] via-[#B8892E] to-[#D8B25A]" />
          <div className="px-6 pb-8 pt-7 text-center sm:px-8">
            <img
              src="/Casablanca.png"
              alt="Casablanca"
              className="mx-auto h-20 w-20 rounded-full object-cover ring-1 ring-[#E7DCC2]"
            />
            <div className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#DCEBE0] text-2xl text-[#4A7A57]">
              ✓
            </div>
            <h2 className="mt-3 text-lg font-semibold text-[#2E2A26]">
              ¡Listo, {listo.nombre.split(" ")[0]}!
            </h2>
            <p className="mt-1 text-sm text-[#8A8175]">
              Tu solicitud quedó registrada. {SALON.nombre} te confirmará por
              WhatsApp.
            </p>
            <div className="mt-4 space-y-1 rounded-xl border border-[#E7DCC2] bg-white p-4 text-left text-sm">
              <Dato k="Servicio" v={listo.servicio} />
              <Dato k="Con" v={listo.estilista} />
              <Dato k="Día" v={fechaLarga(listo.dia)} />
              <Dato k="Hora" v={listo.hora} />
            </div>
            <button
              onClick={() => {
                setListo(null);
                setServicio(null);
                setEstilista("");
                setHora("");
                setCliente("");
                setTelefono("");
              }}
              className="mt-5 w-full rounded-full border border-[#E7DCC2] py-2.5 text-sm font-medium text-[#2E2A26]"
            >
              Agendar otra cita
            </button>
          </div>
        </div>
      </Fondo>
    );
  }

  // ---------- formulario ----------
  return (
    <Fondo>
      <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-[26px] border border-[#E7DCC2] bg-[#FBF9F4] shadow-[0_28px_70px_-28px_rgba(150,110,40,0.35)]">
        <div className="h-1 w-full bg-linear-to-r from-[#D8B25A] via-[#B8892E] to-[#D8B25A]" />

        {/* banner de portada opcional: public/portada.png (o .jpg) */}
        <Banner />

        <div className="flex flex-col lg:flex-row">
          {/* panel de marca */}
          <aside className="border-b border-[#E7DCC2] bg-linear-to-b from-[#FBF6EA] to-[#F4EAD6] p-6 text-center sm:p-8 lg:w-2/5 lg:border-b-0 lg:border-r lg:text-left">
            <img
              src="/Casablanca.png"
              alt="Casablanca"
              className="mx-auto h-24 w-24 rounded-full object-cover ring-1 ring-[#E7DCC2] lg:mx-0"
            />
            <p className="mt-3 text-xs tracking-[0.18em] text-[#A89B84]">
              RESERVA TU CITA EN LÍNEA
            </p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-[#2E2A26]">
              {SALON.nombre}
            </h1>
            <p className="mt-1 text-sm italic text-[#8A6A1E]">
              «{CONTACTO.tagline}»
            </p>
            <div className="mx-auto mt-4 h-px w-16 bg-linear-to-r from-transparent via-[#C9A24E]/60 to-transparent lg:mx-0" />

            <ul className="mt-4 space-y-2 text-left text-sm text-[#6f6552]">
              {CUALIDADES.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#B8892E]">✓</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs text-[#8A8175]">📍 {CONTACTO.direccion}</p>
            <p className="text-xs text-[#A89B84]">
              Horario {HORARIO.abre} – {HORARIO.cierra}
            </p>

            <div className="mt-4 flex justify-center gap-2 lg:justify-start">
              <a
                href={`https://wa.me/${SALON.codigoPais}${CONTACTO.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-[#4A7A57] px-3 py-1.5 text-xs font-medium text-white transition hover:brightness-[1.05]"
              >
                Escríbenos
              </a>
              <a
                href={`https://instagram.com/${CONTACTO.instagram}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7DCC2] bg-white px-3 py-1.5 text-xs font-medium text-[#2E2A26] transition hover:bg-[#FBF9F4]"
              >
                <IgIcon /> @{CONTACTO.instagram}
              </a>
            </div>

            <Carrusel />
          </aside>

          {/* formulario */}
          <section className="p-6 sm:p-8 lg:w-3/5">
            {cargandoCfg ? (
              <p className="py-10 text-center text-[#A89B84]">Cargando…</p>
            ) : errorCfg ? (
              <p className="py-10 text-center text-sm text-[#8E2B44]">
                {errorCfg}
              </p>
            ) : (
              <div className="space-y-6">
                <Paso n={1} titulo="Elige tu servicio">
                  <div className="grid max-h-[300px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {servicios.map((s) => {
                      const sel = servicio?.nombre === s.nombre;
                      return (
                        <button
                          key={s.nombre}
                          onClick={() => setServicio(s)}
                          className={`rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition ${
                            sel
                              ? "border-[#B8892E] bg-[#FBF6EA] text-[#2E2A26]"
                              : "border-[#E7DCC2] bg-white text-[#2E2A26] hover:bg-[#FBF9F4]"
                          }`}
                        >
                          {s.nombre}
                        </button>
                      );
                    })}
                  </div>
                </Paso>

                <Paso n={2} titulo="¿Con quién?">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {estilistas.map((e) => (
                      <button
                        key={e}
                        onClick={() => setEstilista(e)}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                          estilista === e
                            ? "border-[#B8892E] bg-[#FBF6EA]"
                            : "border-[#E7DCC2] bg-white hover:bg-[#FBF9F4]"
                        }`}
                      >
                        <Avatar nombre={e} />
                        <span className="font-medium text-[#2E2A26]">{e}</span>
                      </button>
                    ))}
                  </div>
                </Paso>

                <Paso n={3} titulo="Día y hora">
                  <input
                    type="date"
                    min={hoyISO()}
                    value={dia}
                    onChange={(e) => setDia(e.target.value)}
                    className="mb-3 w-full rounded-xl border border-[#E7DCC2] bg-white px-4 py-2.5 text-sm"
                  />
                  {!servicio || !estilista ? (
                    <p className="text-xs text-[#A89B84]">
                      Elige servicio y profesional para ver los horarios.
                    </p>
                  ) : horarios.length === 0 ? (
                    <p className="text-xs text-[#A89B84]">
                      No hay horarios libres ese día. Prueba con otra fecha.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {horarios.map((h) => (
                        <button
                          key={h}
                          onClick={() => setHora(h)}
                          className={`rounded-lg px-3 py-1.5 text-sm tabular-nums transition ${
                            hora === h
                              ? "bg-[#B8892E] text-white"
                              : "border border-[#E7DCC2] bg-white text-[#2E2A26] hover:bg-[#FBF9F4]"
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  )}
                </Paso>

                <Paso n={4} titulo="Tus datos">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="w-full rounded-xl border border-[#E7DCC2] bg-white px-4 py-2.5 text-sm"
                      placeholder="Tu nombre"
                      value={cliente}
                      onChange={(e) => setCliente(e.target.value)}
                    />
                    <input
                      className="w-full rounded-xl border border-[#E7DCC2] bg-white px-4 py-2.5 text-sm"
                      placeholder="Tu WhatsApp"
                      inputMode="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                    />
                  </div>
                </Paso>

                {error && (
                  <p className="rounded-xl bg-[#8E2B44]/10 px-3 py-2 text-sm text-[#8E2B44] ring-1 ring-[#8E2B44]/20">
                    {error}
                  </p>
                )}

                <button
                  onClick={reservar}
                  disabled={!completo || enviando}
                  className="w-full rounded-full bg-linear-to-r from-[#D8B25A] via-[#C79B3F] to-[#B8892E] py-3.5 text-sm font-semibold text-[#2E2A26] shadow-[0_10px_24px_-10px_rgba(184,137,46,0.7)] transition hover:brightness-[1.04] disabled:opacity-50"
                >
                  {enviando ? "Agendando…" : "Reservar cita"}
                </button>
                <p className="text-center text-[11px] text-[#A89B84]">
                  Tu cita queda como solicitud. {SALON.nombre} te confirma por
                  WhatsApp.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </Fondo>
  );
}

// prueba si una imagen existe (carga sin error)
function probar(src: string): Promise<boolean> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = src;
  });
}

// intenta una lista de rutas en orden; si todas fallan, avisa
function useFuente(bases: string[]) {
  const [i, setI] = useState(0);
  return {
    src: i < bases.length ? bases[i] : null,
    siguiente: () => setI((x) => x + 1),
  };
}

// banner de portada: public/portada.png o .jpg. Si no existe, no muestra nada.
function Banner() {
  const { src, siguiente } = useFuente(["/portada.png", "/portada.jpg"]);
  if (!src) return null;
  return (
    <div className="relative h-36 w-full sm:h-44">
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        onError={siguiente}
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/25 to-transparent" />
    </div>
  );
}

// avatar de estilista: /equipo/<nombre>.png|.jpg; si no, iniciales
function Avatar({ nombre }: { nombre: string }) {
  const slug = nombre
    .trim()
    .split(" ")[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const { src, siguiente } = useFuente([
    `/equipo/${slug}.png`,
    `/equipo/${slug}.jpg`,
  ]);
  const ini = nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (!src)
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EFE7D6] text-xs font-semibold text-[#8A6A1E]">
        {ini}
      </span>
    );
  return (
    <img
      src={src}
      alt={nombre}
      className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[#E7DCC2]"
      onError={siguiente}
    />
  );
}

// carrusel "Nuestro trabajo": detecta /galeria/1..8 (.png o .jpg) y las rota
function Carrusel() {
  const [fotos, setFotos] = useState<string[]>([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const encontradas: string[] = [];
      for (let n = 1; n <= 8; n++) {
        if (await probar(`/galeria/${n}.png`)) encontradas.push(`/galeria/${n}.png`);
        else if (await probar(`/galeria/${n}.jpg`)) encontradas.push(`/galeria/${n}.jpg`);
      }
      if (vivo) setFotos(encontradas);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (fotos.length <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % fotos.length), 3500);
    return () => clearInterval(t);
  }, [fotos.length]);

  if (fotos.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="mb-2 text-xs tracking-[0.18em] text-[#A89B84]">
        NUESTRO TRABAJO
      </p>
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl ring-1 ring-[#E7DCC2]">
        {fotos.map((f, idx) => (
          <img
            key={f}
            src={f}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              idx === i ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        {fotos.length > 1 && (
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {fotos.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                aria-label={`Foto ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === i ? "w-4 bg-white" : "w-1.5 bg-white/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IgIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-3.5 w-3.5"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

function Fondo({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F1ECE1] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-[#F5F1EA] to-[#EBE3D4]" />
      <div className="pointer-events-none absolute -left-40 -top-32 h-[26rem] w-[26rem] rounded-full bg-[#E3A7A9]/18 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-[#5B8CA0]/12 blur-3xl" />
      {children}
    </div>
  );
}

function Paso({
  n,
  titulo,
  children,
}: {
  n: number;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#B8892E] text-xs font-semibold text-white">
          {n}
        </span>
        <h3 className="text-sm font-semibold text-[#2E2A26]">{titulo}</h3>
      </div>
      {children}
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[#A89B84]">{k}</span>
      <span className="font-medium capitalize text-[#2E2A26]">{v}</span>
    </div>
  );
}
