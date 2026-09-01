// ============================================
// ÚNICO ARCHIVO QUE DEBES EDITAR CON LOS DATOS REALES DEL SALÓN
// Casablanca Nail Spa & Lounge
// ============================================

export const SALON = {
  nombre: "Casablanca Nail Spa & Lounge",
  codigoPais: "57",
};

// Horario de atención (24h). Define la grilla de la vista Ocupación.
// TODO: confirmar el horario real de Casablanca; dejé un default.
export const HORARIO = {
  abre: "09:00",
  cierra: "19:00",
};

export const ESTILISTAS = [
  "Dufay Linares",
  "Alejandra Agudelo",
];

// frecuencia = cada cuántos DÍAS el cliente debería volver por ese servicio.
// frecuencia: 0  ->  servicio de una sola vez, NO genera recordatorio.
// duracion (min): solo afecta la detección de choques en la agenda.
// NOTA: las frecuencias y duraciones son mi propuesta — ajústalas al criterio del salón.
export const SERVICIOS = [
  // Manos
  { nombre: "Manicure tradicional",                   duracion: 30,  precio: 30000,  frecuencia: 15 },
  { nombre: "Manicure semipermanente",                duracion: 45,  precio: 55000,  frecuencia: 21 },
  { nombre: "Manicure semipermanente caballero",      duracion: 45,  precio: 45000,  frecuencia: 21 },
  { nombre: "Base Rubber",                            duracion: 60,  precio: 60000,  frecuencia: 21 },

  // Pies
  { nombre: "Pedicure tradicional",                   duracion: 45,  precio: 45000,  frecuencia: 30 },
  { nombre: "Pedicure semipermanente",                duracion: 50,  precio: 65000,  frecuencia: 30 },
  { nombre: "Pedicure clínico",                       duracion: 60,  precio: 60000,  frecuencia: 45 },

  // Sistemas
  { nombre: "Soft gel",                               duracion: 90,  precio: 90000,  frecuencia: 21 },
  { nombre: "Acrílico con tips",                      duracion: 120, precio: 105000, frecuencia: 21 },
  { nombre: "Acrílico esculpido",                     duracion: 150, precio: 140000, frecuencia: 21 },
  { nombre: "Polygel con tips",                       duracion: 120, precio: 105000, frecuencia: 21 },
  { nombre: "Baño acrílico",                          duracion: 90,  precio: 90000,  frecuencia: 21 },
  { nombre: "Baño Polygel",                           duracion: 90,  precio: 90000,  frecuencia: 21 },
  { nombre: "Técnica mixta (recubrimiento y ext.)",   duracion: 120, precio: 90000,  frecuencia: 21 },
  { nombre: "Capping",                                duracion: 60,  precio: 70000,  frecuencia: 21 },
  { nombre: "Retoque acrílico",                       duracion: 90,  precio: 80000,  frecuencia: 21 },

  // Adicionales (no recurrentes)
  { nombre: "Uña acrílica adicional",                 duracion: 10,  precio: 12000,  frecuencia: 0 },
  { nombre: "Uña soft gel adicional",                 duracion: 10,  precio: 8000,   frecuencia: 0 },
  { nombre: "Remiendo de uña",                        duracion: 15,  precio: 8000,   frecuencia: 0 },
  { nombre: "Retiro de semipermanente",               duracion: 20,  precio: 12000,  frecuencia: 0 },
  { nombre: "Retiro de sistemas artificiales",        duracion: 30,  precio: 18000,  frecuencia: 0 },
  { nombre: "Piedras y dijes",                        duracion: 10,  precio: 5000,   frecuencia: 0 },
];

// ------------------------------------------------------------
// REPARTO / DUEÑAS
// En Casablanca ambas estilistas son dueñas: NO hay reparto 60/40 ni
// servicios excluidos de la caja. Toda la facturación entra a una sola
// bolsa del negocio (contabilidad normal).
//
// Mantengo estos exports para no romper los componentes que aún los
// importan (Contabilidad, etc.). Su efecto aquí es neutro:
//   - SERVICIOS_PAULA vacío  -> esServicioPaula() siempre false -> nada se excluye
//   - PORCENTAJE_ESTILISTA 1  -> el desglose atribuye el 100% del servicio a quien lo hizo
//     (vista "generado por estilista"), sin cortar comisión al salón.
// Cuando ajustemos Contabilidad.tsx quitamos el reparto de la UI y estos
// exports dejan de usarse.
// ------------------------------------------------------------
export const SERVICIOS_PAULA: string[] = [];

export const esServicioPaula = (servicio: string) =>
  SERVICIOS_PAULA.includes(servicio);

export const PORCENTAJE_ESTILISTA = 1; // sin reparto: 100% a la bolsa del negocio

/** Busca la frecuencia de un servicio por su nombre. 0 = no recurrente. */
export const frecuenciaDe = (servicio: string) =>
  SERVICIOS.find((s) => s.nombre === servicio)?.frecuencia ?? 0;

// ---------- Plantillas de WhatsApp (sin emojis) ----------
// {salon} = SALON.nombre. {cliente} {estilista} {servicio} {fecha} {hora} {dias}

export const PLANTILLA_RECORDATORIO =
  `Hola {cliente}, te recordamos tu cita en {salon}: {servicio} con {estilista} el {fecha} a las {hora}. Te esperamos.`;

export const PLANTILLA_CONFIRMACION =
  `Hola {cliente}, confirmamos tu cita en {salon}: {servicio} con {estilista} el {fecha} a las {hora}. Cualquier cambio, escribenos por aqui. Te esperamos.`;

export const PLANTILLA_GRACIAS =
  `Hola {cliente}, gracias por visitar {salon}. Fue un gusto atenderte, {estilista}. Esperamos verte pronto.`;

export const PLANTILLA_CUMPLE =
  `Hola {cliente}, en {salon} queremos desearte un feliz cumpleanos. Te esperamos para consentirte en tu dia especial.`;

export const PLANTILLA_REACTIVACION =
  `Hola {cliente}, ha pasado un tiempo desde tu ultima visita a {salon}. Nos encantaria verte de nuevo, tu ultimo servicio fue {servicio}. Agenda cuando gustes.`;

// (se conservan por compatibilidad; se pueden ajustar luego)
export const PLANTILLA_PROMOCION =
  `Hola {cliente}, en {salon} tenemos una promocion especial en {servicio} esta semana. Te interesa? Responde y te agendamos.`;

export const PLANTILLA_LEAD =
  `Hola {cliente}, vimos que preguntaste por {servicio} en {salon}. Tenemos cupos disponibles. Te agendamos?`;

export const PLANTILLA_SEGUIMIENTO =
  `Hola {cliente}, ya pasaron {dias} dias desde tu ultimo {servicio} en {salon}. Es buen momento para tu mantenimiento. Te agendamos esta semana?`;
