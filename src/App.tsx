import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  supabase,
  cargarCitasFull,
  aMinutos,
  type CitaFull,
  type Estado,
} from "./db";
import { useConfig } from "./ConfigContext";
import FormCita from "./FormCita";
import Contabilidad from "./Contabilidad";
import Clientes from "./Clientes";
import Ocupacion from "./Ocupacion";
import Marca from "./Marca";
import { llenar, linkWhatsApp } from "./whatsapp";
import { PLANTILLA_GRACIAS, PLANTILLA_RECORDATORIO } from "./config";

const hoyISO = () => new Date().toLocaleDateString("en-CA");

const plata = (n: number) =>
  n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const fechaLarga = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const sumaDia = (d: string, delta: number) => {
  const x = new Date(d + "T12:00:00");
  x.setDate(x.getDate() + delta);
  return x.toLocaleDateString("en-CA");
};

const ESTADOS: Record<Estado, { txt: string; clase: string }> = {
  pendiente: { txt: "Pendiente", clase: "bg-[#EFE7D6] text-[#8A7B57]" },
  confirmada: { txt: "Confirmada", clase: "bg-[#DCE7EC] text-[#4F7686]" },
  completada: { txt: "Atendida", clase: "bg-[#DCEBE0] text-[#4A7A57]" },
  no_show: { txt: "No vino", clase: "bg-[#F3DEE3] text-[#8E2B44]" },
  cancelada: {
    txt: "Cancelada",
    clase: "bg-[#ECE7DE] text-[#A89B84] line-through",
  },
};

const btnSuave =
  "rounded-lg border border-[#E7DCC2] bg-white px-3 py-2 text-sm text-[#2E2A26] transition hover:bg-[#FBF9F4]";
const btnOro =
  "rounded-full bg-linear-to-r from-[#D8B25A] to-[#B8892E] px-4 py-2 text-sm font-semibold text-[#2E2A26] shadow-[0_8px_20px_-10px_rgba(184,137,46,0.75)] transition hover:brightness-[1.04] active:scale-[0.99]";

type Vista = "agenda" | "contabilidad" | "clientes" | "ocupacion";

export default function App() {
  const { estilistas: ESTILISTAS } = useConfig();

  const [vista, setVista] = useState<Vista>("agenda");
  const [dia, setDia] = useState(hoyISO);
  const [citas, setCitas] = useState<CitaFull[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<string>("");
  const [form, setForm] = useState(false);
  const [editando, setEditando] = useState<CitaFull | null>(null);

  async function cargar() {
    setCargando(true);
    const full = await cargarCitasFull(dia, dia);
    setCitas(full.sort((a, b) => (a.hora < b.hora ? -1 : 1)));
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia]);

  const visibles = useMemo(
    () =>
      filtro
        ? citas.filter(
            (c) =>
              c.estilista === filtro ||
              c.items.some((i) => i.estilista === filtro)
          )
        : citas,
    [citas, filtro]
  );

  const resumen = useMemo(() => {
    const activas = citas.filter((c) => c.estado !== "cancelada");
    const atendidas = citas.filter((c) => c.estado === "completada");
    const porAtender = activas.filter(
      (c) => c.estado === "pendiente" || c.estado === "confirmada"
    ).length;
    const facturado = atendidas.reduce(
      (s, c) => s + c.pagos.reduce((x, p) => x + p.monto, 0),
      0
    );

    const esHoy = dia === hoyISO();
    const ahora = new Date();
    const nowMin = ahora.getHours() * 60 + ahora.getMinutes();
    const proxima =
      activas
        .filter((c) => c.estado === "pendiente" || c.estado === "confirmada")
        .filter((c) => !esHoy || aMinutos(c.hora) >= nowMin)
        .sort((a, b) => (a.hora < b.hora ? -1 : 1))[0] ?? null;

    return {
      total: activas.length,
      atendidas: atendidas.length,
      porAtender,
      facturado,
      proxima,
    };
  }, [citas, dia]);

  const idsEnConflicto = useMemo(() => {
    const set = new Set<string>();
    const act = citas.filter(
      (c) => c.estado !== "cancelada" && c.estado !== "no_show"
    );
    for (let i = 0; i < act.length; i++) {
      for (let j = i + 1; j < act.length; j++) {
        const a = act[i];
        const b = act[j];
        if (a.estilista !== b.estilista) continue;
        const aIni = aMinutos(a.hora);
        const aFin = aIni + (a.duracion || 60);
        const bIni = aMinutos(b.hora);
        const bFin = bIni + (b.duracion || 60);
        if (aIni < bFin && aFin > bIni) {
          set.add(a.id);
          set.add(b.id);
        }
      }
    }
    return set;
  }, [citas]);

  async function cambiarEstado(id: string, estado: Estado) {
    await supabase.from("citas").update({ estado }).eq("id", id);
    cargar();
  }

  function nueva() {
    setEditando(null);
    setForm(true);
  }
  function editar(c: CitaFull) {
    setEditando(c);
    setForm(true);
  }

  if (vista === "clientes")
    return <Clientes onVolver={() => setVista("agenda")} />;
  if (vista === "ocupacion")
    return <Ocupacion onVolver={() => setVista("agenda")} />;
  if (vista === "contabilidad")
    return <Contabilidad onVolver={() => setVista("agenda")} />;

  return (
    <div className="min-h-screen bg-[#F3F0E9] text-[#2E2A26]">
      <div className="h-1 w-full bg-linear-to-r from-[#D8B25A] via-[#B8892E] to-[#D8B25A]" />
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        {/* header con marca */}
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Marca subtitulo={fechaLarga(dia)} />
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setVista("clientes")} className={btnSuave}>
              Clientes
            </button>
            <button onClick={() => setVista("ocupacion")} className={btnSuave}>
              Ocupación
            </button>
            <button onClick={() => setVista("contabilidad")} className={btnSuave}>
              Contabilidad
            </button>
            <button onClick={() => supabase.auth.signOut()} className={btnSuave}>
              Salir
            </button>
          </div>
        </header>

        {/* día + nueva cita */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button onClick={() => setDia(sumaDia(dia, -1))} className={btnSuave}>
            ←
          </button>
          <button onClick={() => setDia(hoyISO())} className={btnSuave}>
            Hoy
          </button>
          <button onClick={() => setDia(sumaDia(dia, 1))} className={btnSuave}>
            →
          </button>
          <input
            type="date"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            className="rounded-lg border border-[#E7DCC2] bg-white px-3 py-2 text-sm"
          />
          <button onClick={nueva} className={btnOro + " ml-auto"}>
            + Nueva cita
          </button>
        </div>

        {/* Resumen del día */}
        <section className="mb-6 rounded-2xl border border-[#E7DCC2] bg-white p-4 sm:p-5">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#8A8175]">
              Resumen de hoy
            </h2>
            <span className="text-xs text-[#A89B84]">
              {resumen.atendidas} de {resumen.total} atendidas
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile t="Citas del día" v={String(resumen.total)} />
            <Tile t="Por atender" v={String(resumen.porAtender)} />
            <Tile t="Facturado hoy" v={plata(resumen.facturado)} oro />
            <Tile
              t="Próxima cita"
              v={
                resumen.proxima
                  ? `${resumen.proxima.hora.slice(0, 5)} · ${resumen.proxima.cliente}`
                  : "—"
              }
            />
          </div>
        </section>

        {/* filtro por estilista */}
        <div className="mb-4 flex flex-wrap gap-2">
          <FilBtn activo={filtro === ""} onClick={() => setFiltro("")}>
            Todas
          </FilBtn>
          {ESTILISTAS.map((e) => (
            <FilBtn key={e} activo={filtro === e} onClick={() => setFiltro(e)}>
              {e}
            </FilBtn>
          ))}
        </div>

        {/* lista de citas en cuadrícula */}
        {cargando ? (
          <p className="py-10 text-center text-[#A89B84]">Cargando…</p>
        ) : visibles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E7DCC2] bg-[#FBF9F4] py-14 text-center">
            <p className="text-sm text-[#A89B84]">Sin citas para este día.</p>
            <button onClick={nueva} className={btnOro + " mt-3"}>
              + Agendar la primera
            </button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibles.map((c) => {
              const total =
                c.items.reduce((s, i) => s + i.precio, 0) || c.precio;
              const enConflicto = idsEnConflicto.has(c.id);
              const est = ESTADOS[c.estado];
              return (
                <article
                  key={c.id}
                  className={`flex flex-col rounded-2xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(120,90,30,0.04)] ${
                    enConflicto ? "border-[#E7A6A6]" : "border-[#E7DCC2]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-[#B8892E]">
                          {c.hora.slice(0, 5)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${est.clase}`}
                        >
                          {est.txt}
                        </span>
                        {enConflicto && (
                          <span className="rounded-full bg-[#F3DEE3] px-2 py-0.5 text-xs text-[#8E2B44]">
                            Choque
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate font-medium">{c.cliente}</p>
                      <p className="truncate text-xs text-[#8A8175]">
                        {c.items.length > 0
                          ? c.items
                              .map((i) => `${i.servicio} · ${i.estilista}`)
                              .join("   |   ")
                          : `${c.servicio} · ${c.estilista}`}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {plata(total)}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Accion onClick={() => editar(c)}>Editar</Accion>
                    {c.estado === "completada" && c.telefono && (
                      <a
                        href={linkWhatsApp(
                          c.telefono,
                          llenar(PLANTILLA_GRACIAS, {
                            cliente: c.cliente,
                            estilista: c.estilista,
                          })
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-[#4A7A57] px-2.5 py-1 text-xs font-medium text-white transition hover:brightness-[1.05]"
                      >
                        Gracias
                      </a>
                    )}
                    {(c.estado === "pendiente" ||
                      c.estado === "confirmada") &&
                      c.telefono && (
                      <a
                        href={linkWhatsApp(
                          c.telefono,
                          llenar(PLANTILLA_RECORDATORIO, {
                            cliente: c.cliente,
                            servicio: c.servicio,
                            estilista: c.estilista,
                            fecha: fechaLarga(c.fecha),
                            hora: c.hora.slice(0, 5),
                          })
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-[#4A7A57] px-2.5 py-1 text-xs font-medium text-white transition hover:brightness-[1.05]"
                      >
                        Recordar
                      </a>
                    )}
                    {c.estado !== "completada" && (
                      <Accion onClick={() => cambiarEstado(c.id, "completada")}>
                        ✓ Atendida
                      </Accion>
                    )}
                    {c.estado !== "no_show" && (
                      <Accion onClick={() => cambiarEstado(c.id, "no_show")}>
                        No vino
                      </Accion>
                    )}
                    {c.estado !== "cancelada" && (
                      <Accion onClick={() => cambiarEstado(c.id, "cancelada")}>
                        Cancelar
                      </Accion>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {form && (
        <FormCita
          fecha={dia}
          cita={editando}
          onCerrar={() => setForm(false)}
          onGuardado={() => {
            setForm(false);
            cargar();
          }}
        />
      )}
    </div>
  );
}

function Tile({ t, v, oro }: { t: string; v: string; oro?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        oro ? "border-[#D8B25A]/50 bg-[#FBF6EA]" : "border-[#E7DCC2] bg-[#FBF9F4]"
      }`}
    >
      <p className="text-xs text-[#A89B84]">{t}</p>
      <p
        className={`mt-0.5 truncate text-lg font-semibold tabular-nums ${
          oro ? "text-[#B8892E]" : "text-[#2E2A26]"
        }`}
      >
        {v}
      </p>
    </div>
  );
}

function FilBtn({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs transition ${
        activo
          ? "bg-[#B8892E] text-white"
          : "border border-[#E7DCC2] bg-white text-[#2E2A26] hover:bg-[#FBF9F4]"
      }`}
    >
      {children}
    </button>
  );
}

function Accion({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-[#E7DCC2] bg-white px-2.5 py-1 text-xs text-[#2E2A26] transition hover:bg-[#FBF9F4]"
    >
      {children}
    </button>
  );
}
