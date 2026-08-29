import { useEffect, useMemo, useState } from "react";
import { supabase, type Cita } from "./db";
import {
  PLANTILLA_REACTIVACION,
  PLANTILLA_GRACIAS,
  PLANTILLA_CUMPLE,
} from "./config";
import { llenar, linkWhatsApp } from "./whatsapp";
import Marca from "./Marca";

const plata = (n: number) =>
  n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const fechaCorta = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const diasDesde = (iso: string) =>
  Math.floor((Date.now() - new Date(iso + "T12:00:00").getTime()) / 86400000);

// días hasta el próximo cumpleaños (cumple en formato 'MM-DD'); null si no aplica
function diasHastaCumple(mmdd: string | null): number | null {
  if (!mmdd || !/^\d{2}-\d{2}$/.test(mmdd)) return null;
  const [mm, dd] = mmdd.split("-").map(Number);
  const now = new Date();
  const hoy0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let prox = new Date(now.getFullYear(), mm - 1, dd);
  if (prox < hoy0) prox = new Date(now.getFullYear() + 1, mm - 1, dd);
  return Math.round((prox.getTime() - hoy0.getTime()) / 86400000);
}

type Filtro = "todos" | "frecuentes" | "dormidos" | "promos";

type Cli = {
  telefono: string;
  nombre: string;
  cumple: string | null;
  visitas: number;
  totalGastado: number;
  ultima: string | null;
  aceptaPromos: boolean;
  citas: Cita[];
};

const btnSuave =
  "rounded-lg border border-[#E7DCC2] bg-white px-3 py-2 text-sm text-[#2E2A26] transition hover:bg-[#FBF9F4]";
const btnWa =
  "rounded-lg bg-[#4A7A57] px-3 py-1.5 text-xs font-medium text-white transition hover:brightness-[1.05]";

export default function Clientes({ onVolver }: { onVolver: () => void }) {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [abierto, setAbierto] = useState<Cli | null>(null);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const { data } = await supabase
        .from("citas")
        .select("*")
        .order("fecha", { ascending: false });
      setCitas((data as Cita[]) ?? []);
      setCargando(false);
    })();
  }, []);

  const clientes = useMemo<Cli[]>(() => {
    const map = new Map<string, Cli>();
    for (const c of citas) {
      const tel = (c.telefono || "").trim();
      if (!tel) continue;
      let cli = map.get(tel);
      if (!cli) {
        cli = {
          telefono: tel,
          nombre: c.cliente || "Cliente",
          cumple: null,
          visitas: 0,
          totalGastado: 0,
          ultima: null,
          aceptaPromos: false,
          citas: [],
        };
        map.set(tel, cli);
      }
      // las citas llegan de más reciente a más antigua
      if (cli.citas.length === 0) {
        if (c.cliente) cli.nombre = c.cliente;
        if (c.cumple) cli.cumple = c.cumple;
      }
      cli.citas.push(c);
      if (c.acepta_promos) cli.aceptaPromos = true;
      if (c.estado === "completada") {
        cli.visitas += 1;
        cli.totalGastado += c.precio || 0;
        if (!cli.ultima || c.fecha > cli.ultima) cli.ultima = c.fecha;
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (b.ultima ?? "").localeCompare(a.ultima ?? "")
    );
  }, [citas]);

  const visibles = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clientes.filter((c) => {
      if (
        term &&
        !(c.nombre.toLowerCase().includes(term) || c.telefono.includes(term))
      )
        return false;
      if (filtro === "frecuentes" && c.visitas < 3) return false;
      if (filtro === "dormidos" && !(c.ultima && diasDesde(c.ultima) > 45))
        return false;
      if (filtro === "promos" && !c.aceptaPromos) return false;
      return true;
    });
  }, [clientes, q, filtro]);

  const filtros: [Filtro, string][] = [
    ["todos", "Todos"],
    ["frecuentes", "Frecuentes"],
    ["dormidos", "Dormidos"],
    ["promos", "Promos"],
  ];

  return (
    <div className="min-h-screen bg-[#F3F0E9] text-[#2E2A26]">
      <div className="h-1 w-full bg-linear-to-r from-[#D8B25A] via-[#B8892E] to-[#D8B25A]" />
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Marca subtitulo={`Clientes · ${clientes.length}`} />
          <button onClick={onVolver} className={btnSuave}>
            ← Agenda
          </button>
        </header>

        <input
          className="mb-3 w-full rounded-xl border border-[#E7DCC2] bg-white px-4 py-2.5 text-sm"
          placeholder="Buscar por nombre o teléfono…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="mb-4 flex flex-wrap gap-2">
          {filtros.map(([f, txt]) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-full px-3 py-1.5 text-xs transition ${
                filtro === f
                  ? "bg-[#B8892E] text-white"
                  : "border border-[#E7DCC2] bg-white hover:bg-[#FBF9F4]"
              }`}
            >
              {txt}
            </button>
          ))}
        </div>

        {cargando ? (
          <p className="py-10 text-center text-[#A89B84]">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#E7DCC2] bg-[#FBF9F4] py-12 text-center text-sm text-[#A89B84]">
            {clientes.length === 0
              ? "Todavía no hay clientes. Aparecerán aquí a medida que agendes citas con teléfono."
              : "Ningún cliente coincide con la búsqueda."}
          </p>
        ) : (
          <div className="space-y-2">
            {visibles.map((c) => (
              <button
                key={c.telefono}
                onClick={() => setAbierto(c)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#E7DCC2] bg-white p-3.5 text-left transition hover:bg-[#FBF9F4]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.nombre}</p>
                  <p className="truncate text-xs text-[#8A8175]">
                    {c.telefono} · {c.visitas} visita
                    {c.visitas === 1 ? "" : "s"}
                    {c.ultima ? ` · última ${fechaCorta(c.ultima)}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-[#B8892E]">
                    {plata(c.totalGastado)}
                  </p>
                  {c.aceptaPromos && (
                    <p className="text-[10px] text-[#4A7A57]">promos ✓</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {abierto && (
        <DetalleCliente cli={abierto} onCerrar={() => setAbierto(null)} />
      )}
    </div>
  );
}

function DetalleCliente({ cli, onCerrar }: { cli: Cli; onCerrar: () => void }) {
  // último servicio / estilista atendidos, para rellenar los mensajes
  const ultCompletada = cli.citas.find((c) => c.estado === "completada");
  const ultimoServicio = ultCompletada?.servicio ?? cli.citas[0]?.servicio ?? "";
  const ultimoEstilista =
    ultCompletada?.estilista ?? cli.citas[0]?.estilista ?? "";

  const diasCumple = diasHastaCumple(cli.cumple);

  const linkRecordar = linkWhatsApp(
    cli.telefono,
    llenar(PLANTILLA_REACTIVACION, {
      cliente: cli.nombre,
      servicio: ultimoServicio,
    })
  );
  const linkGracias = linkWhatsApp(
    cli.telefono,
    llenar(PLANTILLA_GRACIAS, {
      cliente: cli.nombre,
      estilista: ultimoEstilista,
    })
  );
  const linkCumple = linkWhatsApp(
    cli.telefono,
    llenar(PLANTILLA_CUMPLE, { cliente: cli.nombre })
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onCerrar}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full bg-linear-to-r from-[#D8B25A] via-[#B8892E] to-[#D8B25A]" />
        <div className="max-h-[calc(90vh-4px)] overflow-y-auto p-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{cli.nombre}</h2>
            <p className="text-xs text-[#8A8175]">{cli.telefono}</p>
          </div>

          {/* acciones de WhatsApp con mensaje ya cargado */}
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={linkRecordar} target="_blank" rel="noreferrer" className={btnWa}>
              Recordar cita
            </a>
            <a href={linkGracias} target="_blank" rel="noreferrer" className={btnWa}>
              Agradecer
            </a>
            {diasCumple !== null && diasCumple <= 7 && (
              <a href={linkCumple} target="_blank" rel="noreferrer" className={btnWa}>
                🎂 Felicitar{diasCumple === 0 ? " (hoy)" : ` (${diasCumple}d)`}
              </a>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[#E7DCC2] bg-[#FBF9F4] p-3 text-center">
              <p className="text-xs text-[#A89B84]">Visitas</p>
              <p className="text-lg font-semibold">{cli.visitas}</p>
            </div>
            <div className="rounded-xl border border-[#D8B25A]/50 bg-[#FBF6EA] p-3 text-center">
              <p className="text-xs text-[#A89B84]">Total gastado</p>
              <p className="text-lg font-semibold text-[#B8892E]">
                {plata(cli.totalGastado)}
              </p>
            </div>
          </div>

          <h3 className="mb-2 mt-4 text-sm font-medium text-[#8A8175]">
            Historial
          </h3>
          <div className="space-y-1.5">
            {cli.citas.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[#E7DCC2] bg-white px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate">{c.servicio}</p>
                  <p className="truncate text-xs text-[#A89B84]">
                    {fechaCorta(c.fecha)} · {c.estilista}
                    {c.estado !== "completada" ? ` · ${c.estado}` : ""}
                  </p>
                </div>
                <p className="shrink-0 tabular-nums">{plata(c.precio)}</p>
              </div>
            ))}
          </div>

          <button
            onClick={onCerrar}
            className="mt-5 w-full rounded-full bg-linear-to-r from-[#D8B25A] to-[#B8892E] py-2.5 text-sm font-semibold text-[#2E2A26]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
