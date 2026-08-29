import { useConfig } from "./ConfigContext";

// Cabecera de marca reutilizable: logo (recortado a círculo) + nombre del negocio.
export default function Marca({ subtitulo }: { subtitulo?: string }) {
  const { tenant } = useConfig();
  return (
    <div className="flex items-center gap-3">
      <img
        src="/Casablanca.png"
        alt="Casablanca"
        className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-[#E7DCC2]"
      />
      <div className="min-w-0 leading-tight">
        <h1 className="truncate text-lg font-semibold tracking-tight text-[#2E2A26]">
          {tenant.nombre}
        </h1>
        {subtitulo && (
          <p className="truncate text-xs capitalize text-[#A89B84]">
            {subtitulo}
          </p>
        )}
      </div>
    </div>
  );
}
