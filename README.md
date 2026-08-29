# Montaje desde cero — Agenda Casablanca

Proyecto nuevo, aislado, independiente del salón de Paula.
Parte de la base probada y se le montan los archivos de Casablanca.
Nada de este proyecto queda conectado al de Paula (git, Supabase y Cloudflare son propios).

---

## 0. Antes de empezar
- Supabase de Casablanca: ya creado.
- Logo `Casablanca.png` a la mano.
- Cuenta de GitHub y de Cloudflare listas.

---

## 1. Crear el proyecto nuevo a partir de la base (PowerShell)

```powershell
cd C:\Users\franc\proyectos

# copiar la base a un proyecto nuevo y limpio
Copy-Item -Recurse -Path .\agenda-salon -Destination .\agenda-casablanca
cd .\agenda-casablanca

# borrar historial de git, dependencias y build viejos
Remove-Item -Recurse -Force .\.git, .\node_modules, .\dist -ErrorAction SilentlyContinue
```

## 2. Git e repo NUEVOS (independientes)

Crea un repo vacío nuevo en GitHub (ej: `agenda-casablanca`). Luego:

```powershell
git init
git branch -M main
git remote add origin https://github.com/TU_USUARIO/agenda-casablanca.git
```

(No hagas push todavía; primero deja los archivos y el .env.)

## 3. Reemplazar los 5 archivos de Casablanca

Sobrescribe estos en `src/` con los que te pasé (seleccionar todo, borrar, pegar, guardar):

- `config.ts`          → nombre del salón, horario, plantillas
- `Login.tsx`          → branding Casablanca (crema + oro del logo)
- `ConfigContext.tsx`  → carga porcentaje por estilista + recargar()
- `Contabilidad.tsx`   → reparto por persona (dueñas 50%) + botón Equipo
- `FormCita.tsx`       → sin campo producto

Los demás archivos (`App.tsx`, `Auth.tsx`, `main.tsx`, `db.ts`, `Clientes.tsx`,
`Seguimiento.tsx`, `PanelCumple.tsx`, `PanelManana.tsx`, `Ocupacion.tsx`,
`Leads.tsx`, `ResumenDia.tsx`, `BarraAvisos.tsx`, `index.css`) se quedan igual:
funcionan tal cual con el esquema nuevo.

## 4. Branding

- Pon `Casablanca.png` en `public/` (con esa capitalización exacta).
- Borra `public/logo-conectart.png`.
- En VS Code, busca en todo el proyecto (Ctrl+Shift+F, case-insensitive) la
  palabra `conectart` y `logo-conectart`. Si aparece en algún componente
  (header, etc.), cámbialo por `Casablanca.png` o quítalo.
- En `index.html`, cambia el `<title>` a `Casablanca Nail Spa & Lounge`.

## 5. Base de datos (Supabase de Casablanca)

1. SQL Editor → pega `casablanca_esquema.sql` (todo menos el bloque Parte B) → Run.
2. Verifica en Table Editor: `tenant_servicios` = 22 filas, `tenant_estilistas` = 2
   (Dufay y Alejandra en 0.500).
3. Authentication → Users → Add user (correo + contraseña = login de la dueña).
   Copia el UUID del usuario.
4. Descomenta la Parte B del SQL, pega el UUID donde dice `<UUID_DEL_USUARIO>` → Run.

## 6. Variables de entorno

Crea/edita `.env` en la raíz del proyecto (sin comillas):

```
VITE_SUPABASE_URL=https://eeznckiergojokmnpzia.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_AH4kD9AV_jtxFqHEtuvm8w_2L01MhST
```

Confirma la URL contra Settings → API → Project URL del proyecto de Casablanca.
Nunca pongas aquí la secret key ni la contraseña de la base de datos.

## 7. Instalar, correr y verificar en local

```powershell
npm install
npm run dev
```

Verifica:
- [ ] Login entra con el usuario que creaste.
- [ ] Crear una cita de prueba con Dufay, marcarla completada.
- [ ] Una cita de $55.000 → en Contabilidad el pago de Dufay debe dar $27.500 (50%)
      y "ganancia del salón" los otros $27.500.
- [ ] Botón Equipo → añadir persona de prueba (default 60%), aparece en los desplegables.
- [ ] `npx tsc --noEmit` sale limpio y la pestaña Problems en 0.

## 8. Subir y desplegar

```powershell
git add .
git commit -m "Proyecto Casablanca (base + config propia)"
git push -u origin main
```

En Cloudflare Pages: crear un proyecto NUEVO, conectar el repo `agenda-casablanca`,
y en Settings → Environment variables poner `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY` (los mismos del .env). Build command `npm run build`,
output `dist`.

## 9. Última verificación
- [ ] Deploy en Success.
- [ ] Probar en ventana de incógnito (descarta caché).
- [ ] Login, agenda y contabilidad funcionan en el dominio de Cloudflare.
