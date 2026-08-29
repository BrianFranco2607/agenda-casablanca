import { useEffect, useMemo, useState } from "react";
import {
  supabase,
  guardarServiciosYPagos,
  type CitaFull,
  type MetodoPago,
} from "./db";
import { useConfig } from "./ConfigContext";

const plata = (n: number) =>
  n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const telLimpio = (t: string) => t.replace(/\D/g, "");

type LineaServicio = {
  servicio: string;
  estilista: string;
  precio: number;
};

type ItemHistorial = {
  fecha: string;
  servicio: string;
  precio: number;
};

function lineaNueva(primerServicio?: {
  nombre: string;
  precio: number;
}): LineaServicio {
  return {
    servicio: primerServicio?.nombre ?? "",
    estilista: "",
    precio: primerServicio?.precio ?? 0,
  };
}

export default function FormCita({
  fecha,
  cita,
  onCerrar,
  onGuardado,
}: {
  fecha: string;
  cita: CitaFull | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { servicios: SERVICIOS, estilistas: ESTILISTAS, tenant } = useConfig();

  const editar = cita !== null;

  const [cliente, setCliente] = useState(cita?.cliente ?? "");
  const [telefono, setTelefono] = useState(cita?.telefono ?? "");
  const [fechaCita, setFechaCita] = useState(cita?.fecha ?? fecha);
  const [hora, setHora] = useState(cita ? cita.hora.slice(0, 5) : "09:00");
  const [notas, setNotas] = useState(cita?.notas ?? "");
  const [cumple, setCumple] = useState(cita?.cumple ?? "");
  const [acepta, setAcepta] = useState(cita?.acepta_promos ?? false);

  const [historial, setHistorial] = useState<ItemHistorial[]>([]);
  const [totalHistorial, setTotalHistorial] = useState(0);
  const [nombreReconocido, setNombreReconocido] = useState("");
  const [buscandoHistorial, setBuscandoHistorial] = useState(false);

  // Auto-cargar cliente por teléfono: al escribir 10 dígitos, busca sus citas
  // pasadas y precarga nombre, cumpleaños y consentimiento de promos.
  useEffect(() => {
    const tel = telLimpio(telefono);

    if (tel.length < 10) {
      setHistorial([]);
      setTotalHistorial(0);
      setNombreReconocido("");
      setBuscandoHistorial(false);
      return;
    }

    let cancelado = false;
    setBuscandoHistorial(true);

    const timer = setTimeout(async () => {
      const { data: citasCliente } = await supabase
        .from("citas")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("telefono", tel)
        .eq("estado", "completada")
        .order("fecha", { ascending: false });

      if (cancelado) return;

      const base = (citasCliente as any[]) ?? [];

      if (base.length === 0) {
        setHistorial([]);
        setTotalHistorial(0);
        setNombreReconocido("");
        setBuscandoHistorial(false);
        return;
      }

      const ids = base.map((c) => c.id);
      const { data: servicios } = await supabase
        .from("cita_servicios")
        .select("*")
        .in("cita_id", ids);

      if (cancelado) return;

      const svc = (servicios as any[]) ?? [];
      const fechaPorCita = new Map(base.map((c) => [c.id, c.fecha as string]));

      const items: ItemHistorial[] = svc
        .map((s) => ({
          fecha: fechaPorCita.get(s.cita_id) ?? "",
          servicio: s.servicio as string,
          precio: s.precio as number,
        }))
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

      const total = items.reduce((s, i) => s + i.precio, 0);
      const masReciente = base[0];

      setHistorial(items);
      setTotalHistorial(total);
      setNombreReconocido(masReciente.cliente || "");
      setBuscandoHistorial(false);

      // precargar datos SOLO en cita nueva (no pisar lo escrito a mano)
      if (!editar) {
        if (!cliente.trim() && masReciente.cliente)
          setCliente(masReciente.cliente);
        if (!cumple && masReciente.cumple) setCumple(masReciente.cumple);
        if (masReciente.acepta_promos) setAcepta(true);
      }
    }, 500);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telefono]);

  const [lineas, setLineas] = useState<LineaServicio[]>(() => {
    if (cita && cita.items.length > 0) {
      return cita.items.map((i) => ({
        servicio: i.servicio,
        estilista: i.estilista,
        precio: i.precio,
      }));
    }
    return [lineaNueva(SERVICIOS[0])];
  });

  const [efectivo, setEfectivo] = useState(() => {
    const p = cita?.pagos.find((x) => x.metodo === "efectivo");
    return p?.monto ?? 0;
  });
  const [transferencia, setTransferencia] = useState(() => {
    const p = cita?.pagos.find((x) => x.metodo === "transferencia");
    return p?.monto ?? 0;
  });

  const [guardando, setGuardando] = useState(false);

  const total = useMemo(
    () => lineas.reduce((s, l) => s + l.precio, 0),
    [lineas]
  );
  const totalPagos = efectivo + transferencia;
  const pagoCuadra = totalPagos === total;

  function cambiarServicio(idx: number, nombre: string) {
    const s = SERVICIOS.find((x) => x.nombre === nombre)!;
    setLineas((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, servicio: nombre, precio: s.precio } : l
      )
    );
  }

  function cambiarLinea(idx: number, campo: keyof LineaServicio, valor: any) {
    setLineas((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l))
    );
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, lineaNueva(SERVICIOS[0])]);
  }

  function quitarLinea(idx: number) {
    setLineas((prev) => prev.filter((_, i) => i !== idx));
  }

  function todoEfectivo() {
    setEfectivo(total);
    setTransferencia(0);
  }

  const duracionTotal = useMemo(() => {
    return lineas.reduce((s, l) => {
      const svc = SERVICIOS.find((x) => x.nombre === l.servicio);
      return s + (svc?.duracion ?? 60);
    }, 0);
  }, [lineas]);

  async function guardar() {
    if (lineas.length === 0) {
      alert("Agrega al menos un servicio.");
      return;
    }
    if (lineas.some((l) => l.precio < 0)) {
      alert("Hay un precio inválido.");
      return;
    }
    if (lineas.some((l) => !l.estilista)) {
      alert("Falta elegir el estilista en algún servicio.");
      return;
    }
    if (!pagoCuadra) {
      const falta = total - totalPagos;
      alert(
        falta > 0
          ? `Falta asignar ${plata(falta)} en el pago. El pago debe sumar ${plata(
              total
            )}.`
          : `El pago se pasó por ${plata(-falta)}. Debe sumar ${plata(total)}.`
      );
      return;
    }

    setGuardando(true);

    const principal = lineas[0];

    const payload = {
      tenant_id: tenant.id,
      cliente: cliente.trim() || "Cliente ocasional",
      telefono: telLimpio(telefono) || "",
      servicio: principal.servicio,
      estilista: principal.estilista,
      precio: total,
      metodo_pago: efectivo >= transferencia ? "efectivo" : "transferencia",
      duracion: duracionTotal,
      fecha: fechaCita,
      hora,
      notas: notas.trim() || null,
      acepta_promos: acepta,
      cumple: cumple || null,
    };

    let citaId = cita?.id;

    if (editar) {
      const { error } = await supabase
        .from("citas")
        .update(payload)
        .eq("id", cita!.id);
      if (error) {
        setGuardando(false);
        return alert("Error: " + error.message);
      }
    } else {
      const { data, error } = await supabase
        .from("citas")
        .insert(payload)
        .select()
        .single();
      if (error) {
        setGuardando(false);
        return alert("Error: " + error.message);
      }
      citaId = (data as { id: string }).id;
    }

    const pagos: { metodo: MetodoPago; monto: number }[] = [];
    if (efectivo > 0) pagos.push({ metodo: "efectivo", monto: efectivo });
    if (transferencia > 0)
      pagos.push({ metodo: "transferencia", monto: transferencia });

    await guardarServiciosYPagos(
      citaId!,
      lineas.map((l) => ({ ...l, producto: 0 })),
      pagos,
      tenant.id
    );

    setGuardando(false);
    onGuardado();
  }

  const input =
    "w-full rounded-lg border border-[#E7DCC2] bg-white px-3 py-2 text-sm text-[#2E2A26]";
  const varios = lineas.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onCerrar}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full bg-linear-to-r from-[#D8B25A] via-[#B8892E] to-[#D8B25A]" />
        <div className="max-h-[calc(92vh-4px)] overflow-y-auto p-5">
          <h2 className="mb-4 text-lg font-semibold text-[#2E2A26]">
            {editar ? "Editar cita" : "Nueva cita"}
          </h2>

          <div className="space-y-3">
            <input
              className={input}
              placeholder="Nombre del cliente (opcional)"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              autoFocus
            />
            <input
              className={input}
              placeholder="Teléfono (opcional)"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />

            {buscandoHistorial && (
              <p className="text-xs text-[#A89B84]">Buscando cliente…</p>
            )}

            {!buscandoHistorial && historial.length > 0 && (
              <div className="rounded-xl border border-[#D8B25A]/50 bg-[#FBF6EA] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#8A6A1E]">
                    ✓ Cliente reconocido
                    {nombreReconocido ? `: ${nombreReconocido}` : ""} ·{" "}
                    {historial.length} servicio
                    {historial.length === 1 ? "" : "s"}
                  </p>
                  <p className="shrink-0 text-xs font-semibold text-[#8A6A1E]">
                    {plata(totalHistorial)} gastado
                  </p>
                </div>
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {historial.slice(0, 6).map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 text-xs text-[#8A7B57]"
                    >
                      <span className="truncate">{h.servicio}</span>
                      <span className="shrink-0 text-[#A89B84]">{h.fecha}</span>
                    </div>
                  ))}
                </div>
                {historial.length > 6 && (
                  <p className="mt-1 text-xs text-[#A89B84]">
                    + {historial.length - 6} más
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs text-[#8A8175]">
                Cumpleaños (opcional) — solo día y mes
              </label>
              <input
                type="date"
                className={input}
                value={cumple ? `2000-${cumple}` : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setCumple(v ? v.slice(5) : "");
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                className={input}
                value={fechaCita}
                onChange={(e) => setFechaCita(e.target.value)}
              />
              <input
                type="time"
                className={input}
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>

            {/* SERVICIOS */}
            <div className="rounded-xl border border-[#E7DCC2] bg-[#FBF9F4] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-[#8A8175]">
                  Servicio{varios ? "s" : ""}
                </p>
                {varios && (
                  <p className="text-xs text-[#A89B84]">
                    Total: {plata(total)}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {lineas.map((l, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-[#E7DCC2] bg-white p-3"
                  >
                    {varios && (
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-[#A89B84]">
                          #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => quitarLinea(idx)}
                          className="text-xs text-[#8E2B44] hover:underline"
                        >
                          Quitar
                        </button>
                      </div>
                    )}

                    <select
                      className={input + " mb-2"}
                      value={l.servicio}
                      onChange={(e) => cambiarServicio(idx, e.target.value)}
                    >
                      {SERVICIOS.map((s) => (
                        <option key={s.nombre} value={s.nombre}>
                          {s.nombre} — {plata(s.precio)}
                        </option>
                      ))}
                    </select>

                    <select
                      className={
                        input +
                        " mb-2 " +
                        (l.estilista
                          ? ""
                          : "text-[#A89B84] ring-1 ring-[#D8B25A]")
                      }
                      value={l.estilista}
                      onChange={(e) =>
                        cambiarLinea(idx, "estilista", e.target.value)
                      }
                    >
                      <option value="" disabled>
                        Elegir estilista…
                      </option>
                      {ESTILISTAS.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>

                    <div>
                      <label className="mb-1 block text-xs text-[#8A8175]">
                        Precio
                      </label>
                      <input
                        type="number"
                        step={1000}
                        min={0}
                        className={input}
                        value={l.precio === 0 ? "" : l.precio}
                        onChange={(e) =>
                          cambiarLinea(
                            idx,
                            "precio",
                            e.target.value === "" ? 0 : Number(e.target.value)
                          )
                        }
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={agregarLinea}
                className="mt-3 w-full rounded-lg border border-dashed border-[#E7DCC2] py-2 text-xs font-medium text-[#8A8175] transition hover:bg-white"
              >
                + Agregar otro servicio (otro estilista)
              </button>
            </div>

            {/* PAGO */}
            <div className="rounded-xl border border-[#E7DCC2] bg-[#FBF9F4] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-[#8A8175]">Pago</p>
                <button
                  type="button"
                  onClick={todoEfectivo}
                  className="text-xs text-[#B8892E] hover:underline"
                >
                  Todo en efectivo
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-[#8A8175]">
                    Efectivo
                  </label>
                  <input
                    type="number"
                    step={1000}
                    min={0}
                    className={input}
                    value={efectivo === 0 ? "" : efectivo}
                    onChange={(e) =>
                      setEfectivo(
                        e.target.value === "" ? 0 : Number(e.target.value)
                      )
                    }
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#8A8175]">
                    Transferencia
                  </label>
                  <input
                    type="number"
                    step={1000}
                    min={0}
                    className={input}
                    value={transferencia === 0 ? "" : transferencia}
                    onChange={(e) =>
                      setTransferencia(
                        e.target.value === "" ? 0 : Number(e.target.value)
                      )
                    }
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                  />
                </div>
              </div>

              <div
                className={`mt-2 rounded-lg px-3 py-2 text-xs ${
                  pagoCuadra
                    ? "bg-[#DCEBE0] text-[#4A7A57]"
                    : "bg-[#FBF6EA] text-[#8A7B57]"
                }`}
              >
                {pagoCuadra ? (
                  <>Pago completo: {plata(total)} ✓</>
                ) : (
                  <>
                    Pago {plata(totalPagos)} de {plata(total)}.{" "}
                    {totalPagos < total
                      ? `Falta ${plata(total - totalPagos)}.`
                      : `Sobra ${plata(totalPagos - total)}.`}
                  </>
                )}
              </div>
            </div>

            <input
              className={input}
              placeholder="Notas (opcional)"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />

            <label className="flex items-start gap-2 text-sm text-[#8A8175]">
              <input
                type="checkbox"
                checked={acepta}
                onChange={(e) => setAcepta(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Acepta recibir promociones por WhatsApp
                <span className="block text-xs text-[#A89B84]">
                  Preguntarle al cliente. Sin esto no se le puede enviar
                  publicidad.
                </span>
              </span>
            </label>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={onCerrar}
              className="flex-1 rounded-lg border border-[#E7DCC2] py-2.5 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="flex-1 rounded-full bg-linear-to-r from-[#D8B25A] to-[#B8892E] py-2.5 text-sm font-semibold text-[#2E2A26] transition hover:brightness-[1.04] disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
