# Casablanca — Agenda para Casablanca Nail Spa & Lounge

Sistema de agenda y contabilidad para un salón de belleza (manicure/pedicure/uñas)
en Colombia. Proyecto propio y aislado: no comparte git, Supabase ni Cloudflare
con ningún otro salón.

## Stack

- **Vite 6 + React 19 + TypeScript 5** (`strict: true`, `moduleResolution: bundler`).
- **Tailwind CSS v4** vía `@tailwindcss/vite` (plugin en `vite.config.ts`).
  No hay `tailwind.config.js`: todo entra por `@import "tailwindcss";` en
  `src/index.css`. Los colores de marca se escriben inline como arbitrary
  values (`bg-[#F3F0E9]`), no como tokens de theme.
- **Supabase** (`@supabase/supabase-js`): Postgres + Auth + RLS. Cliente en
  `src/db.ts`, credenciales en `.env` (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, gitignored).
- **Cloudflare Pages** para el deploy (`npm run build` → carpeta `dist`).

### Scripts

```
npm run dev       # servidor local
npm run build     # build de producción
npm run preview   # preview del build
npm run check     # tsc --noEmit
```

## Arquitectura: single-tenant, SIEMPRE

El esquema de Supabase (`supabase/casablanca_esquema.sql`) viene de una base de
código multi-tenant (tablas `tenants`, `profiles`, columnas `tenant_id`,
función `public.tenant_id()` usada en las políticas RLS), pero esta instancia
de Supabase es **exclusiva de Casablanca** y solo existe una fila en `tenants`
(id fijo `ca5b1a0c-0000-4000-8000-000000000001`).

**Reglas para trabajar aquí:**
- Este proyecto es y será **single-tenant**. Nunca lo conviertas en multi-tenant
  real ni agregues lógica para soportar varios negocios en la misma base.
- **Nunca agregues columnas tipo `negocio_id`** ni ningún otro identificador de
  negocio nuevo. Si necesitas tocar el esquema, usa `tenant_id` (ya existente)
  solo si es estrictamente necesario para que el código heredado siga
  funcionando — no lo trates como una feature a expandir.
- No dupliques ni resiembres la tabla `tenants`/`profiles` para "otro negocio".
  Si algún día se necesita eso, es una decisión explícita del usuario, no algo
  que se infiere del código.

## Modelo de datos (Supabase)

- `tenants`, `profiles` — vestigio multi-tenant, una sola fila real cada una.
- `tenant_estilistas` — estilistas del salón y su `porcentaje` de comisión
  (ambas dueñas actuales al 0.500 = 50%, nuevas contrataciones default 0.600).
- `tenant_servicios` — catálogo de servicios (precio, duración, frecuencia de
  recompra, `solo_dueno`).
- `citas` — cita agendada (cliente, teléfono, estado, fecha/hora, etc.).
- `cita_servicios` — ítems de servicio dentro de una cita (soporta
  multi-servicio por cita).
- `cita_pagos` — pagos asociados a una cita (efectivo/transferencia, puede
  haber varios métodos por cita).
- `leads`, `movimientos`, `base_diaria` — CRM básico, gastos/vales, base de
  caja diaria.
- RLS en todas las tablas de negocio, acotado por `tenant_id = public.tenant_id()`.

`src/config.ts` tiene además copias locales de servicios/estilistas/plantillas
de WhatsApp (usadas como fallback/semilla); la fuente de verdad en runtime es
`ConfigContext.tsx`, que carga `tenant_estilistas` y `tenant_servicios` desde
Supabase.

## Estructura de `src/`

- `main.tsx` — entrypoint; rutea por `pathname`: `/reservar*` → `Reserva.tsx`
  (página pública de autoagendamiento, sin login), cualquier otra ruta → `Auth.tsx`.
- `Auth.tsx` — login/gate de sesión Supabase.
- `App.tsx` — vista principal (agenda del día), navega a Contabilidad/Clientes/Ocupación.
- `ConfigContext.tsx` — carga tenant/estilistas/servicios/porcentajes desde
  Supabase y los expone vía `useConfig()`.
- `db.ts` — cliente Supabase, tipos (`Cita`, `CitaFull`, `Lead`, `Movimiento`,
  etc.) y helpers de agenda (`cargarCitasFull`, `hayConflicto`, `aMinutos`/`aHora`).
- `config.ts` — datos "de fábrica" del salón (nombre, horario, servicios,
  plantillas de WhatsApp). Es el único archivo pensado para editarse a mano
  con datos reales.
- `Contabilidad.tsx` — reparto de caja por estilista según `porcentajeDe()`.
- `Clientes.tsx`, `Ocupacion.tsx`, `FormCita.tsx`, `Reserva.tsx`, `Marca.tsx` —
  vistas y componentes de apoyo.
- `whatsapp.ts` — arma links `wa.me` rellenando las plantillas de `config.ts`.

## Paleta (crema/dorado)

Los colores viven como valores hex inline en className (no hay theme de
Tailwind config). Los principales, tal como aparecen en `App.tsx`/`Marca.tsx`:

- Fondo general: `#F3F0E9` (crema)
- Dorado (acento, gradiente): `#D8B25A` → `#B8892E`
- Texto principal: `#2E2A26`
- Texto secundario/tenue: `#8A8175`, `#A89B84`
- Bordes: `#E7DCC2`
- Fondo suave/hover: `#FBF9F4`, `#FBF6EA`
- Estados: confirmada `#DCE7EC`/`#4F7686`, completada `#DCEBE0`/`#4A7A57`,
  no-show `#F3DEE3`/`#8E2B44`, pendiente `#EFE7D6`/`#8A7B57`

Al agregar UI nueva, reutiliza estos tonos en vez de introducir una paleta
distinta (evitar azules/grises genéricos de Tailwind por defecto).

## Entorno de trabajo del usuario

- **Windows con PowerShell.** No uses `&&` para encadenar comandos — no
  funciona en PowerShell 5.1. Da comandos separados o encadenados con `;`.
- El usuario prefiere recibir **archivos completos y pegables** en vez de
  parches/diffs cuando comparte código para pegar manualmente — sé explícito
  con el contenido final del archivo, no solo con el fragmento cambiado.
