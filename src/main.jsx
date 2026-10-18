import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/baloo-2/500.css";
import "@fontsource/baloo-2/700.css";
import "@fontsource/baloo-2/800.css";
import "./styles/tokens.css";
import "./styles/global.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
