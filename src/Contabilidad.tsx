import { useEffect, useMemo, useState } from "react";
import {
  supabase,
  cargarCitasFull,
  type CitaFull,
  type Movimiento,
  type TipoMovimiento,
  type MetodoPago,
  type BaseDiaria,
} from "./db";
import { useConfig } from "./ConfigContext";
import Marca from "./Marca";

const hoyISO = () => new Date().toLocaleDateString("en-CA");

const plata = (n: number) =>
  n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const nombreMes = (ym: string) =>
  new Date(ym + "-01T12:00:00").toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
  });

const fechaLarga = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

// clases de marca reutilizadas
const INPUT = "w-full rounded-lg border border-[#E7DCC2] bg-white px-3 py-2 text-sm";
const BTN_SUAVE =
  "rounded-lg border border-[#E7DCC2] bg-white px-3 py-2 text-sm text-[#2E2A26] transition hover:bg-[#FBF9F4]";
const BTN_ORO =
  "rounded-full bg-linear-to-r from-[#D8B25A] to-[#B8892E] px-4 py-2 text-sm font-semibold text-[#2E2A26] shadow-[0_8px_20px_-10px_rgba(184,137,46,0.75)] transition hover:brightness-[1.04] active:scale-[0.99]";
const BTN_ORO_FULL =
  "w-full rounded-full bg-linear-to-r from-[#D8B25A] to-[#B8892E] py-2.5 text-sm font-semibold text-[#2E2A26] transition hover:brightness-[1.04] disabled:opacity-50";

type Modo = "dia" | "mes";

type DetalleServicio = {
  servicio: string;
  precio: number;
  producto: number;
  comision: number;
  cliente: string;
  fecha: string;
};

type CuentaEstilista = {
  nombre: string;
  porcentaje: number;
  servicios: number;
  cobrado: number;
  producto: number;
  parteEstilista: number;
  parteSalon: number;
  vales: number;
  aporte: number;
  pagoFinal: number;
  detalle: DetalleServicio[];
};

export default function Contabilidad({ onVolver }: { onVolver: () => void }) {
  const { estilistas: ESTILISTAS, esServicioPaula, porcentajeDe, recargar } =
    useConfig();

  const [modo, setModo] = useState<Modo>("dia");
  const [dia, setDia] = useState(hoyISO);
  const [mes, setMes] = useState(() => hoyISO().slice(0, 7));
  const [citas, setCitas] = useState<CitaFull[]>([]);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [base, setBase] = useState<BaseDiaria | null>(null);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState(false);
  const [editBase, setEditBase] = useState(false);
  const [equipo, setEquipo] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  const rango = useMemo(() => {
    if (modo === "dia") return { inicio: dia, fin: dia };
    const inicio = mes + "-01";
    const fin = new Date(
      Number(mes.slice(0, 4)),
      Number(mes.slice(5, 7)),
      0
    ).toLocaleDateString("en-CA");
    return { inicio, fin };
  }, [modo, dia, mes]);

  async function cargar() {
    setCargando(true);
    const full = await cargarCitasFull(rango.inicio, rango.fin);
    const soloAtendidas = full.filter((c) => c.estado === "completada");

    const { data: mv } = await supabase
      .from("movimientos")
      .select("*")
      .gte("fecha", rango.inicio)
      .lte("fecha", rango.fin)
      .order("fecha", { ascending: false });

    let baseDia: BaseDiaria | null = null;
    if (modo === "dia") {
      const { data: bd } = await supabase
        .from("base_diaria")
        .select("*")
        .eq("fecha", dia)
        .maybeSingle();
      baseDia = (bd as BaseDiaria) ?? null;
    }

    setCitas(soloAtendidas);
    setMovs((mv as Movimiento[]) ?? []);
    setBase(baseDia);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, dia, mes]);

  const calc = useMemo(() => {
    const items = citas.flatMap((c) =>
      c.items.map((i) => ({ ...i, cliente: c.cliente, fecha: c.fecha }))
    );
    const delSalon = items.filter((i) => !esServicioPaula(i.servicio));
    const dePaula = items.filter((i) => esServicioPaula(i.servicio));

    const valesPorEst: Record<string, number> = {};
    const aportePorEst: Record<string, number> = {};
    let gastos = 0;

    for (const m of movs) {
      if (m.tipo === "gasto") gastos += m.monto;
      else if (m.tipo === "vale" && m.estilista)
        valesPorEst[m.estilista] = (valesPorEst[m.estilista] ?? 0) + m.monto;
      else if (m.tipo === "producto" && m.estilista)
        aportePorEst[m.estilista] = (aportePorEst[m.estilista] ?? 0) + m.monto;
    }

    const cuentas: CuentaEstilista[] = ESTILISTAS.map((nombre) => {
      const suyos = delSalon.filter((i) => i.estilista === nombre);
      const cobrado = suyos.reduce((s, i) => s + i.precio, 0);
      const producto = suyos.reduce((s, i) => s + (i.producto || 0), 0);
      const pct = porcentajeDe(nombre);
      const parteEstilista = Math.round(cobrado * pct);
      const parteSalon = cobrado - parteEstilista;
      const vales = valesPorEst[nombre] ?? 0;
      const aporte = aportePorEst[nombre] ?? 0;
      const detalle: DetalleServicio[] = suyos.map((i) => ({
        servicio: i.servicio,
        precio: i.precio,
        producto: i.producto || 0,
        comision: Math.round(i.precio * pct),
        cliente: i.cliente,
        fecha: i.fecha,
      }));
      return {
        nombre,
        porcentaje: pct,
        servicios: suyos.length,
        cobrado,
        producto,
        parteEstilista,
        parteSalon,
        vales,
        aporte,
        pagoFinal: parteEstilista - vales + aporte,
        detalle,
      };
    }).filter((c) => c.servicios > 0 || c.vales > 0 || c.aporte > 0);

    const productoSalon = cuentas.reduce((s, c) => s + c.producto, 0);
    const parteSalonReparto = cuentas.reduce((s, c) => s + c.parteSalon, 0);
    const pagoEstilistas = cuentas.reduce((s, c) => s + c.parteEstilista, 0);
    const gananciaSalon = parteSalonReparto + productoSalon - gastos;

    const paulaTotal = dePaula.reduce(
      (s, i) => s + i.precio + (i.producto || 0),
      0
    );
    const paulaServicios = dePaula.length;

    const porMetodo = (metodo: MetodoPago) => {
      let ingresos = 0;
      for (const c of citas) {
        const totalCita = c.items.reduce(
          (s, i) => s + i.precio + (i.producto || 0),
          0
        );
        const totalPaula = c.items
          .filter((i) => esServicioPaula(i.servicio))
          .reduce((s, i) => s + i.precio + (i.producto || 0), 0);
        if (totalCita <= 0) continue;

        const fraccionSalon = (totalCita - totalPaula) / totalCita;

        const pagoMetodo = c.pagos
          .filter((p) => p.metodo === metodo)
          .reduce((s, p) => s + p.monto, 0);

        ingresos += Math.round(pagoMetodo * fraccionSalon);
      }

      let salidas = 0;
      let entradasMov = 0;
      for (const mv of movs) {
        if ((mv.metodo_pago || "efectivo") !== metodo) continue;
        if (mv.tipo === "gasto") salidas += mv.monto;
        else if (mv.tipo === "vale") salidas += mv.monto;
        else if (mv.tipo === "producto") entradasMov += mv.monto;
      }
      return { ingresos, salidas, entradasMov };
    };

    const ef = porMetodo("efectivo");
    const tr = porMetodo("transferencia");

    const baseMonto = base?.monto ?? 0;
    const efectivoNeto = baseMonto + ef.ingresos + ef.entradasMov - ef.salidas;
    const transferNeto = tr.ingresos + tr.entradasMov - tr.salidas;
    const totalCobrado = ef.ingresos + tr.ingresos;

    return {
      cuentas,
      productoSalon,
      pagoEstilistas,
      gastos,
      gananciaSalon,
      paulaTotal,
      paulaServicios,
      ef,
      tr,
      efectivoNeto,
      transferNeto,
      baseMonto,
      totalCobrado,
    };
  }, [citas, movs, base]);

  async function borrarMov(id: string) {
    if (!confirm("¿Eliminar este movimiento?")) return;
    await supabase.from("movimientos").delete().eq("id", id);
    cargar();
  }

  async function cerrarEquipo() {
    setEquipo(false);
    await recargar();
    cargar();
  }

  const meses = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      out.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      );
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  }, []);

  const tabBtn = (mo: Modo, txt: string) => (
    <button
      onClick={() => setModo(mo)}
      className={`rounded-lg px-3 py-2 text-sm transition ${
        modo === mo
          ? "bg-[#B8892E] text-white"
          : "border border-[#E7DCC2] bg-white hover:bg-[#FBF9F4]"
      }`}
    >
      {txt}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F3F0E9] text-[#2E2A26]">
      <div className="h-1 w-full bg-linear-to-r from-[#D8B25A] via-[#B8892E] to-[#D8B25A]" />
      <div className="mx-auto max-w-4xl px-4 py-5">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Marca
            subtitulo={`Contabilidad · ${
              modo === "dia" ? fechaLarga(dia) : nombreMes(mes)
            }`}
          />
          <button onClick={onVolver} className={BTN_SUAVE}>
            ← Agenda
          </button>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {tabBtn("dia", "Diario")}
          {tabBtn("mes", "Mensual")}

          {modo === "dia" ? (
            <input
              type="date"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              className="rounded-lg border border-[#E7DCC2] bg-white px-3 py-2 text-sm"
            />
          ) : (
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="rounded-lg border border-[#E7DCC2] bg-white px-3 py-2 text-sm capitalize"
            >
              {meses.map((m) => (
                <option key={m} value={m}>
                  {nombreMes(m)}
                </option>
              ))}
            </select>
          )}

          <button onClick={() => setEquipo(true)} className={BTN_SUAVE + " ml-auto"}>
            Equipo
          </button>
          <button onClick={() => setForm(true)} className={BTN_ORO}>
            + Movimiento
          </button>
        </div>

        {cargando && (
          <p className="py-10 text-center text-[#A89B84]">Cargando…</p>
        )}

        {!cargando && (
          <>
            {/* CAJA */}
            <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#E7DCC2] bg-[#FBF9F4] p-4">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-xs text-[#8A8175]">
                    <span className="h-2 w-2 rounded-full bg-[#4A7A57]" />
                    Efectivo en caja
                  </p>
                  {modo === "dia" && (
                    <button
                      onClick={() => setEditBase(true)}
                      className="text-xs text-[#B8892E] hover:underline"
                    >
                      Base: {plata(calc.baseMonto)}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-[#2E2A26]">
                  {plata(calc.efectivoNeto)}
                </p>
                <p className="mt-1 text-xs text-[#A89B84]">
                  {modo === "dia" &&
                    calc.baseMonto > 0 &&
                    `Base ${plata(calc.baseMonto)} + `}
                  Ingresos {plata(calc.ef.ingresos)}
                  {calc.ef.salidas > 0 && ` − salidas ${plata(calc.ef.salidas)}`}
                  {calc.ef.entradasMov > 0 && ` + ${plata(calc.ef.entradasMov)}`}
                </p>
              </div>
              <div className="rounded-2xl border border-[#E7DCC2] bg-[#FBF9F4] p-4">
                <p className="flex items-center gap-2 text-xs text-[#8A8175]">
                  <span className="h-2 w-2 rounded-full bg-[#4F7686]" />
                  Transferencias
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-[#2E2A26]">
                  {plata(calc.transferNeto)}
                </p>
                <p className="mt-1 text-xs text-[#A89B84]">
                  Ingresos {plata(calc.tr.ingresos)}
                  {calc.tr.salidas > 0 && ` − salidas ${plata(calc.tr.salidas)}`}
                  {calc.tr.entradasMov > 0 && ` + ${plata(calc.tr.entradasMov)}`}
                </p>
              </div>
            </section>

            {/* resumen negocio */}
            <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card t="Total cobrado" v={plata(calc.totalCobrado)} />
              <Card t="Ganancia del salón" v={plata(calc.gananciaSalon)} oro />
              <Card t="Pago a estilistas" v={plata(calc.pagoEstilistas)} />
              <Card t="Gastos" v={plata(calc.gastos)} alerta={calc.gastos > 0} />
            </section>

            {/* por estilista */}
            <h2 className="mb-2 text-sm font-medium text-[#8A8175]">
              Pago por estilista
            </h2>
            <section className="mb-6 space-y-2">
              {calc.cuentas.length === 0 && (
                <p className="rounded-2xl border border-dashed border-[#E7DCC2] bg-[#FBF9F4] py-8 text-center text-sm text-[#A89B84]">
                  Sin servicios registrados en este periodo.
                </p>
              )}
              {calc.cuentas.map((c) => {
                const exp = abierto === c.nombre;
                return (
                  <article
                    key={c.nombre}
                    className="overflow-hidden rounded-2xl border border-[#E7DCC2] bg-white"
                  >
                    <button
                      onClick={() => setAbierto(exp ? null : c.nombre)}
                      className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left transition hover:bg-[#FBF9F4]"
                    >
                      <div>
                        <p className="font-medium">
                          {c.nombre}
                          <span className="ml-2 text-xs text-[#A89B84]">
                            {exp ? "▲" : "▼"}
                          </span>
                        </p>
                        <p className="text-xs text-[#8A8175]">
                          {c.servicios} servicio
                          {c.servicios === 1 ? "" : "s"} · cobrado{" "}
                          {plata(c.cobrado)}
                          {c.producto > 0 && ` · producto ${plata(c.producto)}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold tabular-nums text-[#B8892E]">
                          {plata(c.pagoFinal)}
                        </p>
                        <p className="text-xs text-[#A89B84]">
                          {Math.round(c.porcentaje * 100)}%{" "}
                          {plata(c.parteEstilista)}
                          {c.vales > 0 && ` − vale ${plata(c.vales)}`}
                          {c.aporte > 0 && ` + ${plata(c.aporte)}`}
                        </p>
                      </div>
                    </button>

                    {exp && (
                      <div className="border-t border-[#EFE7D6] bg-[#FBF9F4] px-4 py-3">
                        {c.detalle.length === 0 ? (
                          <p className="text-xs text-[#A89B84]">
                            Sin servicios en este periodo.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {c.detalle.map((d, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between gap-2 text-sm"
                              >
                                <div className="min-w-0">
                                  <p className="truncate">{d.servicio}</p>
                                  <p className="truncate text-xs text-[#A89B84]">
                                    {d.cliente} · {d.fecha}
                                    {d.producto > 0 &&
                                      ` · producto ${plata(d.producto)}`}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="tabular-nums">
                                    {plata(d.comision)}
                                  </p>
                                  <p className="text-xs text-[#A89B84] tabular-nums">
                                    de {plata(d.precio)}
                                  </p>
                                </div>
                              </div>
                            ))}
                            {(c.vales > 0 || c.aporte > 0) && (
                              <div className="mt-2 border-t border-[#EFE7D6] pt-2 text-xs text-[#8A8175]">
                                {c.vales > 0 && (
                                  <p>Vale (préstamo): − {plata(c.vales)}</p>
                                )}
                                {c.aporte > 0 && (
                                  <p>Aporte / propina: + {plata(c.aporte)}</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>

            {calc.paulaServicios > 0 && (
              <section className="mb-6 rounded-2xl border border-[#D8B25A]/50 bg-[#FBF6EA] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#8A6A1E]">
                      Servicios propios de la dueña
                    </p>
                    <p className="text-xs text-[#A89B84]">
                      {calc.paulaServicios} servicio
                      {calc.paulaServicios === 1 ? "" : "s"} · 100% para ella
                    </p>
                  </div>
                  <p className="text-lg font-semibold tabular-nums text-[#B8892E]">
                    {plata(calc.paulaTotal)}
                  </p>
                </div>
              </section>
            )}

            {/* movimientos */}
            <h2 className="mb-2 text-sm font-medium text-[#8A8175]">
              Movimientos
            </h2>
            <section className="space-y-1.5">
              {movs.length === 0 && (
                <p className="rounded-2xl border border-dashed border-[#E7DCC2] bg-[#FBF9F4] py-8 text-center text-sm text-[#A89B84]">
                  Sin gastos, vales ni aportes en este periodo.
                </p>
              )}
              {movs.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#E7DCC2] bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <span
                        className={`mr-2 rounded-full px-2 py-0.5 text-xs ${
                          m.tipo === "gasto"
                            ? "bg-[#F3DEE3] text-[#8E2B44]"
                            : m.tipo === "vale"
                            ? "bg-[#F3E7CC] text-[#8A6A1E]"
                            : "bg-[#DCEBE0] text-[#4A7A57]"
                        }`}
                      >
                        {m.tipo}
                      </span>
                      {m.detalle || "(sin detalle)"}
                      {m.estilista && (
                        <span className="text-[#A89B84]"> · {m.estilista}</span>
                      )}
                    </p>
                    <p className="text-xs text-[#A89B84]">
                      {m.fecha} · {m.metodo_pago || "efectivo"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-sm font-medium">
                      {plata(m.monto)}
                    </span>
                    <button
                      onClick={() => borrarMov(m.id)}
                      className="rounded-lg border border-[#E7DCC2] px-2 py-1 text-xs transition hover:bg-[#FBF9F4]"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>

      {form && (
        <FormMovimiento
          fechaInicial={modo === "dia" ? dia : hoyISO()}
          onCerrar={() => setForm(false)}
          onGuardado={() => {
            setForm(false);
            cargar();
          }}
        />
      )}

      {editBase && (
        <FormBase
          fecha={dia}
          actual={base?.monto ?? 0}
          onCerrar={() => setEditBase(false)}
          onGuardado={() => {
            setEditBase(false);
            cargar();
          }}
        />
      )}

      {equipo && <FormEquipo onCerrar={cerrarEquipo} />}
    </div>
  );
}

function Card({
  t,
  v,
  oro,
  alerta,
}: {
  t: string;
  v: string;
  oro?: boolean;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        oro ? "border-[#D8B25A]/50 bg-[#FBF6EA]" : "border-[#E7DCC2] bg-white"
      }`}
    >
      <p className="text-xs text-[#A89B84]">{t}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          alerta ? "text-[#8E2B44]" : oro ? "text-[#B8892E]" : "text-[#2E2A26]"
        }`}
      >
        {v}
      </p>
    </div>
  );
}

// ---------- Gestión del equipo ----------
type FilaEquipo = {
  id: string;
  nombre: string;
  porcentaje: number;
  activo: boolean;
  orden: number;
};

function FormEquipo({ onCerrar }: { onCerrar: () => void }) {
  const { tenant } = useConfig();
  const [lista, setLista] = useState<FilaEquipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPct, setNuevoPct] = useState(60);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase
      .from("tenant_estilistas")
      .select("id, nombre, porcentaje, activo, orden")
      .order("orden");
    setLista(
      ((data as any[]) ?? []).map((e) => ({
        id: e.id as string,
        nombre: e.nombre as string,
        porcentaje: Math.round(Number(e.porcentaje) * 100),
        activo: e.activo as boolean,
        orden: e.orden as number,
      }))
    );
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function agregar() {
    const nombre = nuevoNombre.trim();
    if (!nombre) return alert("Escribe el nombre.");
    if (nuevoPct < 0 || nuevoPct > 100)
      return alert("El porcentaje debe estar entre 0 y 100.");
    setGuardando(true);
    const orden = lista.reduce((m, e) => Math.max(m, e.orden), 0) + 1;
    const { error } = await supabase.from("tenant_estilistas").insert({
      tenant_id: tenant.id,
      nombre,
      porcentaje: nuevoPct / 100,
      activo: true,
      orden,
    });
    setGuardando(false);
    if (error) return alert("Error: " + error.message);
    setNuevoNombre("");
    setNuevoPct(60);
    await cargar();
  }

  async function guardarFila(f: FilaEquipo) {
    if (f.porcentaje < 0 || f.porcentaje > 100)
      return alert("El porcentaje debe estar entre 0 y 100.");
    const { error } = await supabase
      .from("tenant_estilistas")
      .update({ porcentaje: f.porcentaje / 100, activo: f.activo })
      .eq("id", f.id);
    if (error) return alert("Error: " + error.message);
    await cargar();
  }

  async function eliminar(f: FilaEquipo) {
    if (!confirm(`¿Eliminar a ${f.nombre} del equipo?`)) return;
    const { error } = await supabase
      .from("tenant_estilistas")
      .delete()
      .eq("id", f.id);
    if (error) return alert("Error: " + error.message);
    await cargar();
  }

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
          <h2 className="mb-1 text-lg font-semibold">Equipo</h2>
          <p className="mb-4 text-xs text-[#8A8175]">
            El porcentaje es lo que se lleva cada persona de la mano de obra.
            Dueñas 50%, contrataciones nuevas 60%.
          </p>

          {cargando ? (
            <p className="py-6 text-center text-sm text-[#A89B84]">Cargando…</p>
          ) : (
            <div className="space-y-2">
              {lista.map((e, idx) => (
                <div
                  key={e.id}
                  className="rounded-xl border border-[#E7DCC2] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-medium ${
                        e.activo ? "" : "text-[#A89B84] line-through"
                      }`}
                    >
                      {e.nombre}
                    </span>
                    <label className="flex items-center gap-1 text-xs text-[#8A8175]">
                      <input
                        type="checkbox"
                        checked={e.activo}
                        onChange={(ev) => {
                          const activo = ev.target.checked;
                          setLista((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, activo } : x
                            )
                          );
                        }}
                      />
                      Activa
                    </label>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs text-[#8A8175]">%</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className={INPUT + " w-24"}
                      value={e.porcentaje}
                      onChange={(ev) => {
                        const porcentaje =
                          ev.target.value === "" ? 0 : Number(ev.target.value);
                        setLista((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, porcentaje } : x
                          )
                        );
                      }}
                      onFocus={(ev) => ev.target.select()}
                    />
                    <button
                      onClick={() => guardarFila(lista[idx])}
                      className="ml-auto rounded-lg bg-[#B8892E] px-3 py-1.5 text-xs text-white transition hover:brightness-[1.05]"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => eliminar(lista[idx])}
                      className="rounded-lg border border-[#E7DCC2] px-2.5 py-1.5 text-xs text-[#8E2B44] transition hover:bg-[#FBF9F4]"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}

              <div className="mt-3 rounded-xl border border-dashed border-[#E7DCC2] p-3">
                <p className="mb-2 text-xs font-medium text-[#8A8175]">
                  Añadir persona
                </p>
                <input
                  className={INPUT + " mb-2"}
                  placeholder="Nombre"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#8A8175]">%</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={INPUT + " w-24"}
                    value={nuevoPct}
                    onChange={(e) =>
                      setNuevoPct(
                        e.target.value === "" ? 0 : Number(e.target.value)
                      )
                    }
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={agregar}
                    disabled={guardando}
                    className="ml-auto rounded-lg bg-[#B8892E] px-3 py-1.5 text-xs text-white transition hover:brightness-[1.05] disabled:opacity-50"
                  >
                    {guardando ? "Añadiendo…" : "Añadir"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5">
            <button onClick={onCerrar} className={BTN_ORO_FULL}>
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormBase({
  fecha,
  actual,
  onCerrar,
  onGuardado,
}: {
  fecha: string;
  actual: number;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { tenant } = useConfig();
  const [monto, setMonto] = useState(actual);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    const { error } = await supabase
      .from("base_diaria")
      .upsert(
        { fecha, monto, tenant_id: tenant.id },
        { onConflict: "tenant_id,fecha" }
      );
    setGuardando(false);
    if (error) return alert("Error: " + error.message);
    onGuardado();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full bg-linear-to-r from-[#D8B25A] via-[#B8892E] to-[#D8B25A]" />
        <div className="p-5">
          <h2 className="mb-1 text-lg font-semibold">Base de caja</h2>
          <p className="mb-4 text-xs text-[#8A8175]">
            Efectivo con el que se abre la caja hoy. Suma al efectivo pero no es
            un ingreso por ventas.
          </p>

          <label className="mb-1 block text-xs text-[#8A8175]">Monto (COP)</label>
          <input
            type="number"
            step={1000}
            min={0}
            className={INPUT}
            value={monto === 0 ? "" : monto}
            onChange={(e) =>
              setMonto(e.target.value === "" ? 0 : Number(e.target.value))
            }
            onFocus={(e) => e.target.select()}
            autoFocus
            placeholder="0"
          />

          <div className="mt-5 flex gap-2">
            <button
              onClick={onCerrar}
              className="flex-1 rounded-lg border border-[#E7DCC2] py-2.5 text-sm"
            >
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando} className={BTN_ORO_FULL + " flex-1"}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormMovimiento({
  fechaInicial,
  onCerrar,
  onGuardado,
}: {
  fechaInicial: string;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { estilistas: ESTILISTAS, tenant } = useConfig();

  const [tipo, setTipo] = useState<TipoMovimiento>("gasto");
  const [estilista, setEstilista] = useState(ESTILISTAS[0] ?? "");
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [monto, setMonto] = useState(0);
  const [detalle, setDetalle] = useState("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [guardando, setGuardando] = useState(false);

  const necesitaEstilista = tipo === "vale" || tipo === "producto";

  async function guardar() {
    if (monto <= 0) {
      alert("El monto debe ser mayor a 0.");
      return;
    }
    setGuardando(true);
    const { error } = await supabase.from("movimientos").insert({
      tenant_id: tenant.id,
      tipo,
      estilista: necesitaEstilista ? estilista : null,
      metodo_pago: metodo,
      monto,
      detalle: detalle.trim() || null,
      fecha,
    });
    setGuardando(false);
    if (error) return alert("Error: " + error.message);
    onGuardado();
  }

  const ayuda: Record<TipoMovimiento, string> = {
    gasto: "Dinero que sale de caja (necesidad del salón).",
    vale: "Préstamo al estilista. Se le descuenta de su pago.",
    producto: "El estilista aporta dinero o propina. Se le suma a su pago.",
  };

  const chip = (activo: boolean) =>
    `rounded-lg border px-2 py-2 text-sm capitalize transition ${
      activo
        ? "border-[#B8892E] bg-[#B8892E] text-white"
        : "border-[#E7DCC2] bg-white hover:bg-[#FBF9F4]"
    }`;

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
          <h2 className="mb-4 text-lg font-semibold">Nuevo movimiento</h2>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(["gasto", "vale", "producto"] as TipoMovimiento[]).map((t) => (
                <button key={t} onClick={() => setTipo(t)} className={chip(tipo === t)}>
                  {t}
                </button>
              ))}
            </div>

            <p className="rounded-lg bg-[#FBF6EA] px-3 py-2 text-xs text-[#8A7B57]">
              {ayuda[tipo]}
            </p>

            {necesitaEstilista && (
              <select
                className={INPUT}
                value={estilista}
                onChange={(e) => setEstilista(e.target.value)}
              >
                {ESTILISTAS.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            )}

            <div>
              <label className="mb-1 block text-xs text-[#8A8175]">Método</label>
              <div className="grid grid-cols-2 gap-2">
                {(["efectivo", "transferencia"] as MetodoPago[]).map((mt) => (
                  <button key={mt} onClick={() => setMetodo(mt)} className={chip(metodo === mt)}>
                    {mt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#8A8175]">
                Monto (COP)
              </label>
              <input
                type="number"
                step={1000}
                min={0}
                className={INPUT}
                value={monto === 0 ? "" : monto}
                onChange={(e) =>
                  setMonto(e.target.value === "" ? 0 : Number(e.target.value))
                }
                onFocus={(e) => e.target.select()}
                autoFocus
              />
            </div>

            <input
              className={INPUT}
              placeholder="Detalle (ej: compra de esmalte, adelanto)"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
            />

            <input
              type="date"
              className={INPUT}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={onCerrar}
              className="flex-1 rounded-lg border border-[#E7DCC2] py-2.5 text-sm"
            >
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando} className={BTN_ORO_FULL + " flex-1"}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
