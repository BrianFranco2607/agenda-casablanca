import { SALON } from "./config";

// Rellena una plantilla ({salon}, {cliente}, {estilista}, {servicio}, {dias}...)
export function llenar(
  tpl: string,
  v: {
    cliente?: string;
    estilista?: string;
    servicio?: string;
    fecha?: string;
    hora?: string;
    dias?: number;
  } = {}
) {
  return tpl
    .replaceAll("{salon}", SALON.nombre)
    .replaceAll("{cliente}", v.cliente ?? "")
    .replaceAll("{estilista}", v.estilista ?? "")
    .replaceAll("{servicio}", v.servicio ?? "")
    .replaceAll("{fecha}", v.fecha ?? "")
    .replaceAll("{hora}", v.hora ?? "")
    .replaceAll("{dias}", v.dias != null ? String(v.dias) : "");
}

// Arma el link wa.me con el mensaje ya cargado (listo para enviar).
export function linkWhatsApp(telefono: string, mensaje: string) {
  const tel = (telefono || "").replace(/\D/g, "");
  const num = tel.startsWith(SALON.codigoPais) ? tel : SALON.codigoPais + tel;
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
}
