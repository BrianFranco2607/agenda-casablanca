import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export type Estado =
  | "pendiente"
  | "confirmada"
  | "completada"
  | "no_show"
  | "cancelada";

export type MetodoPago = "efectivo" | "transferencia";

export type Cita = {
  id: string;
  cliente: string;
  telefono: string;
  servicio: string;
  estilista: string;
  precio: number;
  producto: number;
  duracion: number;
  fecha: string;
  hora: string;
  estado: Estado;
  recordado: boolean;
  notas: string | null;
  acepta_promos: boolean;
  metodo_pago: MetodoPago;
  cumple: string | null;
};

export type EstadoLead = "nuevo" | "contactado" | "agendo" | "perdido";

export type Lead = {
  id: string;
  created_at: string;
  nombre: string;
  telefono: string;
  interes: string | null;
  origen: string;
  notas: string | null;
  estado: EstadoLead;
  acepta_promos: boolean;
};

export type TipoMovimiento = "gasto" | "vale" | "producto";

export type Movimiento = {
  id: string;
  created_at: string;
  fecha: string;
  tipo: TipoMovimiento;
  estilista: string | null;
  monto: number;
  detalle: string | null;
  metodo_pago: MetodoPago;
};

export type CitaServicio = {
  id: string;
  cita_id: string;
  tenant_id?: string;
  servicio: string;
  estilista: string;
  precio: number;
  producto: number;
};

export type CitaPago = {
  id: string;
  cita_id: string;
  tenant_id?: string;
  metodo: MetodoPago;
  monto: number;
};

export type BaseDiaria = {
  id: string;
  fecha: string;
  monto: number;
};

export type CitaFull = Cita & {
  items: CitaServicio[];
  pagos: CitaPago[];
};

export const aMinutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

export const aHora = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(
    2,
    "0"
  )}`;

export function hayConflicto(
  citas: Cita[],
  estilista: string,
  hora: string,
  duracion: number,
  idExcluir?: string
): Cita | null {
  const ini = aMinutos(hora);
  const fin = ini + duracion;

  for (const c of citas) {
    if (c.id === idExcluir) continue;
    if (c.estilista !== estilista) continue;
    if (c.estado === "cancelada" || c.estado === "no_show") continue;

    const cIni = aMinutos(c.hora);
    const cFin = cIni + (c.duracion || 60);

    if (ini < cFin && fin > cIni) return c;
  }
  return null;
}

export async function cargarCitasFull(
  desde: string,
  hasta: string
): Promise<CitaFull[]> {
  const { data: citas } = await supabase
    .from("citas")
    .select("*")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("hora");

  const base = (citas as Cita[]) ?? [];
  if (base.length === 0) return [];

  const ids = base.map((c) => c.id);

  const [{ data: servicios }, { data: pagos }] = await Promise.all([
    supabase.from("cita_servicios").select("*").in("cita_id", ids),
    supabase.from("cita_pagos").select("*").in("cita_id", ids),
  ]);

  const svc = (servicios as CitaServicio[]) ?? [];
  const pg = (pagos as CitaPago[]) ?? [];

  return base.map((c) => ({
    ...c,
    items: svc.filter((s) => s.cita_id === c.id),
    pagos: pg.filter((p) => p.cita_id === c.id),
  }));
}

export async function guardarServiciosYPagos(
  citaId: string,
  items: Omit<CitaServicio, "id" | "cita_id">[],
  pagos: Omit<CitaPago, "id" | "cita_id">[],
  tenantId: string
) {
  await supabase.from("cita_servicios").delete().eq("cita_id", citaId);
  await supabase.from("cita_pagos").delete().eq("cita_id", citaId);

  if (items.length > 0) {
    await supabase
      .from("cita_servicios")
      .insert(
        items.map((i) => ({ ...i, cita_id: citaId, tenant_id: tenantId }))
      );
  }
  if (pagos.length > 0) {
    await supabase
      .from("cita_pagos")
      .insert(
        pagos.map((p) => ({ ...p, cita_id: citaId, tenant_id: tenantId }))
      );
  }
}
