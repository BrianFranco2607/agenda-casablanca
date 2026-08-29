import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "./db";

export type Servicio = {
  nombre: string;
  precio: number;
  duracion: number;
  frecuencia: number;
  soloDueno: boolean;
};

export type TenantInfo = {
  id: string;
  nombre: string;
  tipoNegocio: string;
  rol: string;
  branding: {
    nombre?: string;
    codigoPais?: string;
    color?: string;
    logo?: string;
  };
  modulos: Record<string, boolean>;
};

export type ConfigTenant = {
  tenant: TenantInfo;
  estilistas: string[];
  servicios: Servicio[];
  esServicioPaula: (servicio: string) => boolean;
  frecuenciaDe: (servicio: string) => number;
  porcentajeEstilista: number; // valor por defecto (compatibilidad)
  porcentajeDe: (estilista: string) => number; // % real de cada persona
  recargar: () => Promise<void>; // refresca la config (p. ej. al añadir estilista)
};

const Ctx = createContext<ConfigTenant | null>(null);

// % para nuevas contrataciones / fallback si una fila no trae porcentaje
const PORCENTAJE_DEFECTO = 0.6;

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigTenant | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setError(null);
    try {
      const { data: perfil, error: e1 } = await supabase
        .from("profiles")
        .select("tenant_id, rol")
        .single();
      if (e1 || !perfil) throw new Error("No se pudo cargar el perfil.");

      const { data: tenant, error: e2 } = await supabase
        .from("tenants")
        .select("id, nombre, tipo_negocio, branding, modulos")
        .eq("id", perfil.tenant_id)
        .single();
      if (e2 || !tenant) throw new Error("No se pudo cargar el negocio.");

      const [{ data: est }, { data: svc }] = await Promise.all([
        supabase
          .from("tenant_estilistas")
          .select("nombre, porcentaje, orden")
          .eq("activo", true)
          .order("orden"),
        supabase
          .from("tenant_servicios")
          .select("nombre, precio, duracion, frecuencia, solo_dueno, orden")
          .eq("activo", true)
          .order("orden"),
      ]);

      const filas = est ?? [];
      const estilistas = filas.map((e) => e.nombre as string);
      const pctMap = new Map<string, number>(
        filas.map((e) => [
          e.nombre as string,
          Number(e.porcentaje ?? PORCENTAJE_DEFECTO),
        ])
      );

      const servicios: Servicio[] = (svc ?? []).map((s) => ({
        nombre: s.nombre as string,
        precio: s.precio as number,
        duracion: s.duracion as number,
        frecuencia: s.frecuencia as number,
        soloDueno: s.solo_dueno as boolean,
      }));

      const soloDuenoSet = new Set(
        servicios.filter((s) => s.soloDueno).map((s) => s.nombre)
      );
      const frecMap = new Map(servicios.map((s) => [s.nombre, s.frecuencia]));
      const branding =
        (tenant.branding as ConfigTenant["tenant"]["branding"]) ?? {};

      setConfig({
        tenant: {
          id: tenant.id as string,
          nombre: tenant.nombre as string,
          tipoNegocio: tenant.tipo_negocio as string,
          rol: perfil.rol as string,
          branding,
          modulos: (tenant.modulos as Record<string, boolean>) ?? {},
        },
        estilistas,
        servicios,
        esServicioPaula: (s: string) => soloDuenoSet.has(s),
        frecuenciaDe: (s: string) => frecMap.get(s) ?? 0,
        porcentajeEstilista: PORCENTAJE_DEFECTO,
        porcentajeDe: (nombre: string) =>
          pctMap.get(nombre) ?? PORCENTAJE_DEFECTO,
        recargar: cargar,
      });
    } catch (err) {
      setError((err as Error).message || "Error cargando la configuración.");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  // El Provider SIEMPRE envuelve children. El estado de carga/error se
  // muestra por encima, pero el árbol de hijos nunca queda sin provider.
  return (
    <Ctx.Provider value={config}>
      {error ? (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
          <div>
            <p className="text-slate-700">{error}</p>
            <button
              onClick={() => cargar()}
              className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
            >
              Reintentar
            </button>
          </div>
        </div>
      ) : !config ? (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-slate-400">Cargando…</p>
        </div>
      ) : (
        children
      )}
    </Ctx.Provider>
  );
}

export function useConfig(): ConfigTenant {
  const c = useContext(Ctx);
  if (!c) throw new Error("useConfig debe usarse dentro de <ConfigProvider>");
  return c;
}
