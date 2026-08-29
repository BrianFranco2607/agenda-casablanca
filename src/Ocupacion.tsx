import { useEffect, useMemo, useState } from "react";
import { cargarCitasFull, aMinutos, type CitaFull } from "./db";
import { useConfig } from "./ConfigContext";
import { HORARIO } from "./config";
import Marca from "./Marca";

const hoyISO = () => new Date().toLocaleDateString("en-CA");

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

const fmt = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    Math.round(min % 60)
  ).padStart(2, "0")}`;

const btnSuave =
  "rounded-lg border border-[#E7DCC2] bg-white px-3 py-2 text-sm text-[#2E2A26] transition hover:bg-[#FBF9F4]";

const PX = 1; // px por minuto

type Bloque = { ini: number; dur: number; cliente: string; servicio: string };

export default function Ocupacion({ onVolver }: { onVolver: () => void }) {
  const { estilistas: ESTILISTAS } = useConfig();
  const [dia, setDia] = useState(hoyISO);
  const [citas, setCitas] = useState<CitaFull[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const f = await cargarCitasFull(dia, dia);
      setCitas(
        f.filter((c) => c.estado !== "cancelada" && c.estado !== "no_show")
      );
      setCargando(false);
    })();
  }, [dia]);

  const abre = aMinutos(HORARIO.abre);
  const cierra = aMinutos(HORARIO.cierra);
  const totalMin = Math.max(60, cierra - abre);
  const alto = totalMin * PX;
  const pos = (m: number) => (m - abre) * PX;

  const marcas = useMemo(() => {
    const out: number[] = [];
    for (let m = Math.ceil(abre / 60) * 60; m <= cierra; m += 60) out.push(m);
    return out;
  }, [abre, cierra]);

  const porEstilista = useMemo(() => {
    return ESTILISTAS.map((nombre) => {
      const bloques: Bloque[] = [];
      for (const c of citas) {
        const enCita =
          c.estilista === nombre || c.items.some((i) => i.estilista === nombre);
        if (!enCita) continue;
        bloques.push({
          ini: aMinutos(c.hora),
          dur: c.duracion || 60,
          cliente: c.cliente,
          servicio: c.items.length > 0 ? c.items[0].servicio : c.servicio,
        });
      }
      bloques.sort((a, b) => a.ini - b.ini);
      const ocupado = bloques.reduce((s, b) => s + b.dur, 0);
      const pct = Math.min(100, Math.round((ocupado / totalMin) * 100));
      return { nombre, bloques, ocupado, pct };
    });
  }, [citas, ESTILISTAS, totalMin]);

  const dur = (min: number) =>
    `${Math.floor(min / 60)}h ${min % 60}m`;

  return (
    <div className="min-h-screen bg-[#F3F0E9] text-[#2E2A26]">
      <div className="h-1 w-full bg-linear-to-r from-[#D8B25A] via-[#B8892E] to-[#D8B25A]" />
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Marca subtitulo={`Ocupación · ${fechaLarga(dia)}`} />
          <div className="flex flex-wrap items-center gap-2">
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
            <button onClick={onVolver} className={btnSuave}>
              ← Agenda
            </button>
          </div>
        </header>

        {cargando ? (
          <p className="py-10 text-center text-[#A89B84]">Cargando…</p>
        ) : (
          <>
            {/* resumen por estilista */}
            <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {porEstilista.map((e) => (
                <div
                  key={e.nombre}
                  className="rounded-2xl border border-[#E7DCC2] bg-white p-3.5"
                >
                  <p className="truncate font-medium">{e.nombre}</p>
                  <p className="mt-0.5 text-xs text-[#A89B84]">
                    {dur(e.ocupado)} ocupada · {e.pct}%
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#EFE7D6]">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-[#D8B25A] to-[#B8892E]"
                      style={{ width: `${e.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </section>

            {/* calendario por columnas */}
            <div className="overflow-hidden rounded-2xl border border-[#E7DCC2] bg-white">
              <div className="overflow-auto" style={{ maxHeight: "68vh" }}>
                <div className="flex min-w-max">
                  {/* eje de horas */}
                  <div className="sticky left-0 z-10 w-14 shrink-0 bg-white">
                    <div className="sticky top-0 z-20 h-9 border-b border-[#E7DCC2] bg-white" />
                    <div className="relative" style={{ height: alto }}>
                      {marcas.map((m) => (
                        <div
                          key={m}
                          className="absolute right-1.5 -translate-y-1/2 text-[10px] text-[#A89B84]"
                          style={{ top: pos(m) }}
                        >
                          {fmt(m)}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* columnas por estilista */}
                  {porEstilista.map((e) => (
                    <div
                      key={e.nombre}
                      className="w-44 shrink-0 border-l border-[#EFE7D6]"
                    >
                      <div className="sticky top-0 z-20 h-9 truncate border-b border-[#E7DCC2] bg-[#FBF9F4] px-2 text-center text-sm font-medium leading-9">
                        {e.nombre}
                      </div>
                      <div className="relative" style={{ height: alto }}>
                        {/* líneas de hora */}
                        {marcas.map((m) => (
                          <div
                            key={m}
                            className="absolute inset-x-0 border-t border-[#F1EADB]"
                            style={{ top: pos(m) }}
                          />
                        ))}
                        {/* bloques de cita */}
                        {e.bloques.map((b, i) => (
                          <div
                            key={i}
                            title={`${fmt(b.ini)}–${fmt(b.ini + b.dur)} · ${b.cliente} · ${b.servicio}`}
                            className="absolute inset-x-1 overflow-hidden rounded-md border-l-2 border-[#B8892E] bg-[#FBF3E1] px-1.5 py-1"
                            style={{
                              top: pos(b.ini),
                              height: Math.max(26, b.dur * PX),
                            }}
                          >
                            <p className="truncate text-[11px] font-semibold text-[#2E2A26]">
                              {b.cliente}
                            </p>
                            <p className="truncate text-[10px] text-[#8A7B57]">
                              {b.servicio}
                            </p>
                            <p className="text-[10px] text-[#A89B84]">
                              {fmt(b.ini)}–{fmt(b.ini + b.dur)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-3 text-center text-xs text-[#A89B84]">
              Horario {HORARIO.abre}–{HORARIO.cierra} · cámbialo en config.ts si
              es distinto
            </p>
          </>
        )}
      </div>
    </div>
  );
}
