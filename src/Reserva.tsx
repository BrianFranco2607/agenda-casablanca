import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, aMinutos, aHora } from "./db";
import { SALON, HORARIO } from "./config";

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
type Linea = { servicio: string; estilista: string };

// Combo especial: "Manos y pies" se reparte solo entre las dos estilistas.
// Si algún día es al revés, invierte estas dos líneas.
const COMBO = "Manos y pies";
const COMBO_PARTES: Linea[] = [
  { servicio: "Manicure", estilista: "Alejandra Agudelo" },
  { servicio: "Pedicure", estilista: "Dufay Linares" },
];

// convierte las líneas elegidas en pares (servicio, estilista) reales
function expandir(ls: Linea[]): Linea[] {
  const out: Linea[] = [];
  for (const l of ls) {
    if (l.servicio === COMBO) {
      for (const parte of COMBO_PARTES) out.push({ ...parte });
    } else if (l.servicio && l.estilista) {
      out.push({ servicio: l.servicio, estilista: l.estilista });
    }
  }
  return out;
}

export default function Reserva() {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [estilistas, setEstilistas] = useState<string[]>([]);
  const [cargandoCfg, setCargandoCfg] = useState(true);
  const [errorCfg, setErrorCfg] = useState("");

  const [lineas, setLineas] = useState<Linea[]>([
    { servicio: "", estilista: "" },
  ]);
  const [dia, setDia] = useState(hoyISO);
  const [hora, setHora] = useState<string>("");
  const [notas, setNotas] = useState("");
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");

  const [ocupados, setOcupados] = useState<Ocupado[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<null | {
    lineas: Linea[];
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

  // horarios ocupados del día (todas las estilistas)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("horarios_ocupados", {
        p_dia: dia,
      });
      setOcupados(error ? [] : ((data as Ocupado[]) ?? []));
    })();
  }, [dia]);

  const validas = useMemo(() => expandir(lineas), [lineas]);

  // línea a medias: servicio elegido (no combo) pero sin estilista
  const hayIncompleta = useMemo(
    () =>
      lineas.some((l) => l.servicio && l.servicio !== COMBO && !l.estilista),
    [lineas]
  );

  // opciones del desplegable: servicios de la base + el combo tras "Pedicure semipermanente"
  const opciones = useMemo(() => {
    const out: { nombre: string; combo?: boolean }[] = [];
    for (const sv of servicios) {
      out.push({ nombre: sv.nombre });
      if (sv.nombre === "Pedicure semipermanente")
        out.push({ nombre: COMBO, combo: true });
    }
    if (!out.some((o) => o.combo)) out.unshift({ nombre: COMBO, combo: true });
    return out;
  }, [servicios]);

  const horarios = useMemo(() => {
    if (validas.length === 0) return [];
    const abre = aMinutos(HORARIO.abre);
    const cierra = aMinutos(HORARIO.cierra);

    // minutos totales que necesita cada estilista (servicios en secuencia)
    const totalPorEst: Record<string, number> = {};
    for (const l of validas) {
      const sv = servicios.find((s) => s.nombre === l.servicio);
      totalPorEst[l.estilista] =
        (totalPorEst[l.estilista] || 0) + (sv?.duracion || 60);
    }

    // bloques ocupados por estilista
    const busyPorEst: Record<string, { ini: number; fin: number }[]> = {};
    for (const o of ocupados) {
      const ini = aMinutos(o.hora.slice(0, 5));
      (busyPorEst[o.estilista] ||= []).push({
        ini,
        fin: ini + (o.duracion || 60),
      });
    }

    const esHoy = dia === hoyISO();
    const ahora = new Date();
    const nowMin = ahora.getHours() * 60 + ahora.getMinutes();

    const out: string[] = [];
    for (let s = abre; s <= cierra; s += SLOT) {
      if (esHoy && s <= nowMin) continue;
      let ok = true;
      for (const est of Object.keys(totalPorEst)) {
        const total = totalPorEst[est];
        if (s + total > cierra) {
          ok = false;
          break;
        }
        const busy = busyPorEst[est] || [];
        if (busy.some((b) => s < b.fin && s + total > b.ini)) {
          ok = false;
          break;
        }
      }
      if (ok) out.push(aHora(s));
    }
    return out;
  }, [validas, servicios, ocupados, dia]);

  // si cambian servicios/día y la hora elegida ya no sirve, la limpiamos
  useEffect(() => {
    if (hora && !horarios.includes(hora)) setHora("");
  }, [horarios, hora]);

  const completo =
    validas.length > 0 &&
    !hayIncompleta &&
    dia &&
    hora &&
    cliente.trim() &&
    telefono.trim();

  function setLinea(idx: number, campo: keyof Linea, valor: string) {
    setLineas((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l))
    );
  }
  function agregarLinea() {
    setLineas((prev) => [...prev, { servicio: "", estilista: "" }]);
  }
  function quitarLinea(idx: number) {
    setLineas((prev) => prev.filter((_, i) => i !== idx));
  }

  async function reservar() {
    if (!completo) return;
    setEnviando(true);
    setError("");
    const { error } = await supabase.rpc("crear_reserva_multi", {
      p_cliente: cliente.trim(),
      p_telefono: telefono.trim(),
      p_fecha: dia,
      p_hora: hora,
      p_notas: notas.trim(),
      p_servicios: validas.map((l) => l.servicio),
      p_estilistas: validas.map((l) => l.estilista),
    });
    setEnviando(false);
    if (error) {
      setError(error.message || "No se pudo agendar. Intenta con otro horario.");
      return;
    }
    setListo({ lineas: validas, dia, hora, nombre: cliente.trim() });
  }

  const SEL =
    "min-w-0 flex-1 rounded-xl border border-[#E7DCC2] bg-white px-3 py-2.5 text-sm";

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
            <div className="mt-4 space-y-2 rounded-xl border border-[#E7DCC2] bg-white p-4 text-left text-sm">
              {listo.lineas.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[#2E2A26]">{l.servicio}</span>
                  <span className="text-[#A89B84]">{l.estilista}</span>
                </div>
              ))}
              <div className="mt-1 border-t border-[#EFE7D6] pt-2">
                <Dato k="Día" v={fechaLarga(listo.dia)} />
                <Dato k="Hora" v={listo.hora} />
              </div>
            </div>
            <button
              onClick={() => {
                setListo(null);
                setLineas([{ servicio: "", estilista: "" }]);
                setHora("");
                setNotas("");
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
              SALÓN PRIVADO · CIUDAD MONTES
            </p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-[#2E2A26]">
              {SALON.nombre}
            </h1>
            <p className="mt-1 text-sm italic text-[#8A6A1E]">
              «{CONTACTO.tagline}»
            </p>
            <div className="mx-auto mt-4 h-px w-16 bg-linear-to-r from-transparent via-[#C9A24E]/60 to-transparent lg:mx-0" />

            <p className="mt-4 text-sm leading-relaxed text-[#6f6552]">
              Un espacio privado y exclusivo en Ciudad Montes, donde te
              atendemos de forma personalizada para consentirte con calma.
            </p>

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
                <Paso n={1} titulo="Tus servicios">
                  <div className="space-y-2">
                    {lineas.map((l, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2">
                        <select
                          value={l.servicio}
                          onChange={(e) =>
                            setLinea(idx, "servicio", e.target.value)
                          }
                          className={SEL}
                        >
                          <option value="">Servicio…</option>
                          {opciones.map((o) => (
                            <option key={o.nombre} value={o.nombre}>
                              {o.combo
                                ? "Manos y pies (mani + pedi)"
                                : o.nombre}
                            </option>
                          ))}
                        </select>
                        {l.servicio === COMBO ? (
                          <div className="flex min-w-0 flex-1 items-center rounded-xl border border-[#D8B25A]/50 bg-[#FBF6EA] px-3 py-2.5 text-xs text-[#8A6A1E]">
                            Manicure · Alejandra + Pedicure · Dufay
                          </div>
                        ) : (
                          <select
                            value={l.estilista}
                            onChange={(e) =>
                              setLinea(idx, "estilista", e.target.value)
                            }
                            className={SEL}
                          >
                            <option value="">¿Con quién?…</option>
                            {estilistas.map((e) => (
                              <option key={e} value={e}>
                                {e}
                              </option>
                            ))}
                          </select>
                        )}
                        {lineas.length > 1 && (
                          <button
                            onClick={() => quitarLinea(idx)}
                            className="rounded-lg px-2 py-1 text-xs text-[#8E2B44] hover:underline"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={agregarLinea}
                    className="mt-2 text-sm font-medium text-[#B8892E] hover:underline"
                  >
                    + Agregar otro servicio
                  </button>
                </Paso>

                <Paso n={2} titulo="Día y hora">
                  <input
                    type="date"
                    min={hoyISO()}
                    value={dia}
                    onChange={(e) => setDia(e.target.value)}
                    className="mb-3 w-full rounded-xl border border-[#E7DCC2] bg-white px-4 py-2.5 text-sm"
                  />
                  {validas.length === 0 ? (
                    <p className="text-xs text-[#A89B84]">
                      Elige al menos un servicio y su profesional para ver los
                      horarios.
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

                <Paso n={3} titulo="Notas (opcional)">
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    rows={2}
                    placeholder="¿Algo que debamos saber? Ej: el diseño que quieres, alguna alergia, etc."
                    className="w-full resize-none rounded-xl border border-[#E7DCC2] bg-white px-4 py-2.5 text-sm"
                  />
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

function probar(src: string): Promise<boolean> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = src;
  });
}

function useFuente(bases: string[]) {
  const [i, setI] = useState(0);
  return {
    src: i < bases.length ? bases[i] : null,
    siguiente: () => setI((x) => x + 1),
  };
}

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

function Carrusel() {
  const [fotos, setFotos] = useState<string[]>([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const enc: string[] = [];
      for (let n = 1; n <= 8; n++) {
        if (await probar(`/galeria/${n}.png`)) enc.push(`/galeria/${n}.png`);
        else if (await probar(`/galeria/${n}.jpg`)) enc.push(`/galeria/${n}.jpg`);
      }
      if (vivo) setFotos(enc);
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
