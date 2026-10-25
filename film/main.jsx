import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import "@fontsource/baloo-2/500.css";
import "@fontsource/baloo-2/700.css";
import "@fontsource/baloo-2/800.css";
import "../src/styles/tokens.css";
import "../src/styles/global.css";
import Film, { FORMATS, resetLayout } from "./Film.jsx";
import { DURATION } from "./timeline.js";

const params = new URLSearchParams(location.search);
const format = FORMATS[params.get("format")] ? params.get("format") : "wide";
const root = createRoot(document.getElementById("root"));

// The renderer seeks frame by frame; every pixel is a function of t alone.
window.__duration = DURATION;
window.__seek = (t) => flushSync(() => root.render(<Film format={format} t={t} />));
// Measure only once Baloo 2 has loaded: fallback-font metrics wrap text differently.
window.__ready = (async () => {
  window.__seek(0);
  await Promise.all(["500", "700", "800"].map((w) => document.fonts.load(`${w} 20px "Baloo 2"`)));
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  resetLayout();
  window.__seek(0); // measures the layout
  window.__seek(0);
  return true;
})();

// Preview in a normal browser: ?play
if (params.has("play")) {
  window.__ready.then(() => {
    const t0 = performance.now();
    const tick = () => {
      window.__seek(((performance.now() - t0) / 1000) % DURATION);
      requestAnimationFrame(tick);
    };
    tick();
  });
}
