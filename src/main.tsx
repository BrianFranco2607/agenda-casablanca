import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Auth from "./Auth";
import Reserva from "./Reserva";

// Ruta pública de reservas: cualquier URL que empiece por /reservar
// muestra la página del cliente (sin login). El resto, la app privada.
const publica = window.location.pathname.startsWith("/reservar");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{publica ? <Reserva /> : <Auth />}</StrictMode>
);
