// Datos fijos del negocio. Los servicios y estilistas NO van aquí:
// viven en la base de datos (tenant_servicios / tenant_estilistas) y se
// leen con useConfig(). Aquí solo lo que no cambia por sí solo.

export const SALON = {
  nombre: "Casablanca Nail Spa & Lounge",
  codigoPais: "57",
};

// Horario de atención (24h). Se usa en la vista Ocupación.
export const HORARIO = {
  abre: "09:00",
  cierra: "19:00",
};

// ---------- Plantillas de WhatsApp ----------
// {salon} se reemplaza por el nombre del negocio; {cliente}, {fecha}, etc.
// por los datos de la cita al armar el link wa.me.

export const PLANTILLA_RECORDATORIO =
  `Hola {cliente}! Somos {salon}.\n\n` +
  `Te recordamos tu cita:\n` +
  `Fecha: {fecha}\n` +
  `Hora: {hora}\n` +
  `Servicio: {servicio} con {estilista}\n\n` +
  `Nos confirmas que vienes? Responde SI para confirmar, o escribenos para reprogramar. Gracias!`;

export const PLANTILLA_REACTIVACION =
  `Hola {cliente}! Somos {salon}.\n\n` +
  `Hace un tiempo que no te vemos por aqui. Tu ultimo servicio fue {servicio}.\n\n` +
  `Te gustaria agendar tu proxima cita? Tenemos cupos esta semana.`;

export const PLANTILLA_PROMOCION =
  `Hola {cliente}! Somos {salon}.\n\n` +
  `Tenemos una promocion especial en {servicio} esta semana.\n\n` +
  `Te interesa? Responde y te agendamos.`;

export const PLANTILLA_LEAD =
  `Hola {cliente}! Somos {salon}.\n\n` +
  `Vimos que preguntaste por {servicio}. Te contamos que tenemos cupos disponibles.\n\n` +
  `Te gustaria que te agendemos? Con gusto resolvemos cualquier duda.`;

export const PLANTILLA_SEGUIMIENTO =
  `Hola {cliente}! Somos {salon}.\n\n` +
  `Ya pasaron {dias} dias desde tu ultimo {servicio}. Es buen momento para tu mantenimiento.\n\n` +
  `Te agendamos esta semana? Tenemos cupos disponibles.`;

export const PLANTILLA_GRACIAS =
  `Hola {cliente}! Somos {salon}.\n\n` +
  `Gracias por tu visita de hoy. Este es nuestro numero de contacto donde ` +
  `puedes agendar tus proximas citas con nosotros.\n\n` +
  `Recuerda que te atendio {estilista}. Te deseamos un feliz resto del dia!`;

export const PLANTILLA_CUMPLE =
  `Hola {cliente}! Somos {salon}.\n\n` +
  `Queremos desearte un muy feliz cumpleanos! Para celebrarte, ` +
  `tenemos un detalle especial esperandote este mes.\n\n` +
  `Escribenos y con gusto te agendamos. Feliz dia!`;
