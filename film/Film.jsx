import { useLayoutEffect, useRef } from "react";
import Lane from "../src/components/Lane.jsx";
import TopBar from "../src/components/TopBar.jsx";
import SongActions from "../src/components/SongActions.jsx";
import { CircleHelp } from "lucide-react";
import { LANES } from "../src/music/lanes.js";
import {
  DURATION, PACE, buildScript, simulate, songAt, currentSlotAt, statusAt, pointerAt,
  tempoFraction, clamp01, lerp, easeMove, easeIn, easeOut,
} from "./timeline.js";
import "../src/App.css";
import "./film.css";

export const FORMATS = {
  wide: { W: 1280, H: 720, worldW: 1100, touch: false, caption: 40, band: 0.13, title: 104, sub: 30, cta: 92, ctaSub: 46, ctaTop: 0.37, ctaBand: 0.4 },
  square: { W: 540, H: 540, worldW: 390, touch: true, caption: 27, band: 0.14, title: 62, sub: 22, cta: 56, ctaSub: 25, ctaTop: 0.29, ctaBand: 0.3 },
};

// ---------- layout, measured once from the real components ----------
const cache = {};
export function resetLayout() {
  for (const k of Object.keys(cache)) delete cache[k];
}

function measure(world, format) {
  const base = world.getBoundingClientRect();
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    const left = r.left - base.left, top = r.top - base.top;
    return { left, top, width: r.width, height: r.height, right: left + r.width, bottom: top + r.height };
  };
  const q = (sel) => world.querySelector(sel);
  const laneEl = (id) => q(`[data-lane="${id}"]`);
  const union = (rs) => {
    const left = Math.min(...rs.map((r) => r.left)), top = Math.min(...rs.map((r) => r.top));
    const right = Math.max(...rs.map((r) => r.right)), bottom = Math.max(...rs.map((r) => r.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  };
  const grow = (r, x, y = x) => ({ left: r.left - x, top: r.top - y, right: r.right + x, bottom: r.bottom + y, width: r.width + 2 * x, height: r.height + 2 * y });
  const centerOf = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

  const keys = Object.fromEntries(LANES.map((l) => [l.id, rectOf(laneEl(l.id).querySelector(".lane__keys"))]));
  const keyRects = Object.fromEntries(LANES.map((l) => [l.id, [...laneEl(l.id).querySelectorAll(".lane__key")].map(rectOf)]));
  const dots = Object.fromEntries(LANES.map((l) => [l.id, rectOf(laneEl(l.id).querySelector(".lane__dots"))]));
  const dotRects = Object.fromEntries(LANES.map((l) => [l.id, [...laneEl(l.id).querySelectorAll(".lane__dot")].map(rectOf)]));
  const lanes = Object.fromEntries(LANES.map((l) => [l.id, rectOf(laneEl(l.id))]));
  const named = {
    app: rectOf(q(".app")),
    topbar: rectOf(q(".topbar")),
    help: rectOf(q(".app__help")),
    select: rectOf(q(".topbar select")),
    share: rectOf(q(".actions__btn:nth-child(1)")),
    save: rectOf(q(".actions__btn:nth-child(2)")),
    "clear-drums": rectOf(laneEl("drums").querySelector(".lane__clear")),
    actions: rectOf(q(".actions")),
    status: rectOf(q(".topbar__status")),
    fields: [...world.querySelectorAll(".topbar__field")].map(rectOf),
    tempo: rectOf(q("#tempo")),
    volume: rectOf(q(".topbar label:last-of-type input[type=range]")),
  };
  const wide = format === "wide";

  return {
    rect: (name) => named[name],
    keysRect: (id) => keys[id],
    key: (id, i, fy = 0.5) => {
      const r = keyRects[id][i];
      return { x: r.left + r.width / 2, y: r.top + r.height * fy };
    },
    keyEdge: (id, side) => {
      const r = keys[id];
      if (wide) return { x: side === "left" ? r.left - 36 : r.right + 24, y: r.top + r.height / 2 };
      // Phone: a lifted finger rests over the lane's header row, inside the card.
      return { x: side === "left" ? r.left + 24 : r.right - 90, y: r.top - 20 };
    },
    columnX: () => keys.melody.right + 24,
    dot: (id, i) => centerOf(dotRects[id][i]),
    center: (name) => centerOf(named[name]),
    thumb: (name, v) => {
      const r = named[name];
      const frac = name === "tempo" ? tempoFraction(v) : v;
      return { x: r.left + 8 + frac * (r.width - 16), y: r.top + r.height / 2 };
    },
    keysUnion: (ids) => grow(union(ids.map((id) => keys[id])), 14),
    drumsEnd: () => {
      const k = keys.drums, l = lanes.drums;
      return grow({ left: k.left + k.width * 0.45, right: l.right, top: l.top, bottom: l.bottom, width: l.right - k.left - k.width * 0.45, height: l.height }, 14, 40);
    },
    lanes: (ids) => grow(union(ids.map((id) => lanes[id])), 10),
    controls: () => grow(union(named.fields), 12),
    dots: () => grow(union(LANES.map((l) => dots[l.id])), wide ? 90 : 60, 20),
    shareArea: () => {
      const s = named.status;
      const status = wide
        ? { left: s.right - 150, right: s.right, top: s.top, bottom: s.bottom }
        : { left: s.left, right: s.left + 150, top: s.top, bottom: s.bottom };
      // Wide: include the whole Volume field so no label is cut at the edge.
      // Phone: include the help line above the buttons for the same reason.
      const extra = wide ? named.fields[named.fields.length - 1] : named.help;
      return grow(union([named.actions, extra, { ...status, width: 0, height: 0 }]), 14);
    },
  };
}

// ---------- camera ----------
function fit(rect, f, area, band) {
  const top = area === "lower" ? f.H * f.ctaTop : 0;
  const bottom = area === "lower" ? f.H * 0.97 : band ? f.H * (1 - f.band) : f.H;
  const uw = f.W * 0.92, uh = (bottom - top) * 0.94;
  const s = Math.min(uw / rect.width, uh / rect.height, 3.2);
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  return { s, cx, cy, sx: f.W / 2, sy: (top + bottom) / 2 };
}

function cameraAt(shots, f, t, script, app) {
  let i = 0;
  while (i + 1 < shots.length && shots[i + 1].at <= t) i++;
  const frame = (j) => {
    const sh = shots[j];
    const next = shots[j + 1]?.at ?? DURATION;
    let rect = sh.rect;
    if (sh.follow) {
      const { width, bounds, lag } = sh.follow;
      // Hold until the pointer arrives (`from`), so the camera never chases its travel.
      const px = pointerAt(script, Math.max(sh.follow.from ?? sh.at, t - lag)).x;
      const cx = Math.min(bounds.right - width / 2, Math.max(bounds.left + width / 2, px));
      rect = { left: cx - width / 2, right: cx + width / 2, width, top: bounds.top, bottom: bounds.bottom, height: bounds.height };
    }
    const band = sh.band !== false;
    const c = fit(rect, f, sh.area, band);
    // A slow push keeps every hold alive.
    const s = c.s * (1 + 0.04 * clamp01((t - sh.at) / (next - sh.at)));
    // Never show empty sky beside the app when the app could fill the frame.
    let { cx, cy } = c;
    const left = cx - c.sx / s, right = cx + (f.W - c.sx) / s;
    if (right - left < app.width) {
      if (left < app.left) cx += app.left - left;
      else if (right > app.right) cx -= right - app.right;
    }
    const visBottom = band ? f.H * (1 - f.band) : f.H;
    const top = cy - c.sy / s, bottom = cy + (visBottom - c.sy) / s;
    if (bottom - top < app.height) {
      if (top < app.top) cy += app.top - top;
      else if (bottom > app.bottom) cy -= bottom - app.bottom;
    }
    return { ...c, s, cx, cy };
  };
  const cur = frame(i);
  if (i === 0) return cur;
  const k = easeMove(clamp01((t - shots[i].at) / (shots[i].dur ?? 0.65 * PACE)));
  if (k >= 1) return cur;
  const prev = frame(i - 1);
  return {
    s: Math.exp(lerp(Math.log(prev.s), Math.log(cur.s), k)),
    cx: lerp(prev.cx, cur.cx, k), cy: lerp(prev.cy, cur.cy, k),
    sx: lerp(prev.sx, cur.sx, k), sy: lerp(prev.sy, cur.sy, k),
  };
}

const toScreen = (cam, p) => ({ x: (p.x - cam.cx) * cam.s + cam.sx, y: (p.y - cam.cy) * cam.s + cam.sy });

// ---------- overlays ----------
function Pointer({ p, touch, press, opacity }) {
  if (touch) {
    const s = p.down ? 0.88 : 1;
    return (
      <div className="f-touch" style={{ left: p.x, top: p.y, opacity, transform: `translate(-50%, -50%) scale(${s})` }}>
        <span className={p.down ? "is-down" : ""} />
        {press > 0 && press < 1 && <i style={{ transform: `scale(${1 + press * 1.4})`, opacity: 1 - press }} />}
      </div>
    );
  }
  const s = press > 0 && press < 0.35 ? 0.86 : 1;
  return (
    <div className="f-cursor" style={{ left: p.x, top: p.y, opacity }}>
      {press > 0 && press < 1 && <i style={{ transform: `translate(-50%, -50%) scale(${0.4 + press * 1.6})`, opacity: 1 - press }} />}
      <svg width="30" height="30" viewBox="0 0 24 24" style={{ transform: `scale(${s})` }}>
        <path d="M4 2.5 L4 19.5 L8.6 15.2 L11.6 21.5 L14.6 20.1 L11.7 13.9 L18 13.9 Z" fill="#fff" stroke="#16204a" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// Captions live on their own strip, so they never sit on the app.
function Caption({ captions, t, f }) {
  const u = t / PACE;
  const bandIn = easeOut(clamp01((u - 1.1) / 0.35));
  const bandOut = easeIn(clamp01((u - 16.45) / 0.3));
  const shown = bandIn * (1 - bandOut);
  if (shown <= 0) return null;
  const c = captions.find((x) => t >= x.from && t < x.to + 0.2);
  const inK = c ? easeOut(clamp01((t - c.from) / 0.28)) : 0;
  const outK = c ? clamp01((t - c.to) / 0.18) : 1;
  const y = (1 - inK) * 22 - outK * 14;
  return (
    <div className="f-band" style={{ height: `${f.band * 100}%`, transform: `translateY(${(1 - shown) * 100}%)` }}>
      {c && (
        <div className="f-caption" style={{ fontSize: f.caption, opacity: inK * (1 - outK), transform: `translateY(${y}px)` }}>
          {c.text}
        </div>
      )}
    </div>
  );
}

// ---------- the film ----------
export default function Film({ format, t }) {
  const f = FORMATS[format];
  const worldRef = useRef(null);
  const layout = cache[format];

  useLayoutEffect(() => {
    if (!cache[format] && worldRef.current) {
      const L = measure(worldRef.current, format);
      const script = buildScript(L, f.touch);
      cache[format] = { L, script, sim: simulate(script, L, f.touch) };
    }
  });

  const script = layout?.script;
  const sim = layout?.sim;
  const song = script ? songAt(script, sim, t) : songAt({ tempoAt: () => 100, volumeAt: () => 0.8 }, { timeline: [] }, 0);
  const currentSlot = sim ? currentSlotAt(sim, t) : null;
  const app = layout?.L.rect("app");
  const cam = script
    ? cameraAt(script.shots, f, t, script, { ...app, top: app.top - 12, bottom: app.bottom - 16, height: app.height + 12 - 16 })
    : { s: 1, cx: 0, cy: 0, sx: 0, sy: 0 };

  // Key hits: the real app pops a key for 180ms.
  useLayoutEffect(() => {
    if (!sim || !worldRef.current) return;
    for (const lane of LANES) {
      const buttons = worldRef.current.querySelectorAll(`[data-lane="${lane.id}"] .lane__key`);
      buttons.forEach((b, i) => {
        let k = 0;
        for (const h of sim.hits) {
          if (h.lane !== lane.id || h.zone !== i) continue;
          const d = t - h.t;
          if (d < 0 || d > 0.36) continue;
          k = Math.max(k, d < 0.04 ? d / 0.04 : d < 0.18 ? 1 : 1 - easeOut((d - 0.18) / 0.18));
        }
        b.style.transform = k ? `scale(${1 + 0.06 * k})` : "";
        b.style.filter = k ? `brightness(${1 + 0.18 * k})` : "";
      });
    }
  });

  // Opening title flies through the camera; the ending returns to it so the loop is seamless.
  // Overlays are timed in storyboard seconds.
  const u = t / PACE;
  const open = clamp01((u - 0.75) / 0.5);
  // Seam: blur and veil first (CTA still on its backing), then swap headlines on the full veil.
  const close = clamp01((u - 19.0) / 0.3);
  const titleIn = clamp01((u - 19.36) / 0.22);
  const veil = Math.max(1 - easeOut(open), easeMove(close));
  const titleScale = u < 1.5 ? (1 + 0.03 * clamp01(u / 0.8)) * (1 + 5 * easeIn(open)) : 1 + 0.03 * (1 - titleIn);
  // Gone by 1.0s, before the app sharpens, so the title never ghosts over it.
  const titleOpacity = u < 1.5 ? 1 - easeOut(clamp01((u - 0.55) / 0.3)) : titleIn;

  // The backing band lands before any CTA text, so no word ever crosses the UI.
  const ctaBand = easeOut(clamp01((u - 16.5) / 0.3));
  const ctaIn = easeOut(clamp01((u - 16.85) / 0.35));
  const ctaSub = easeOut(clamp01((u - 17.1) / 0.35));
  const ctaOut = clamp01((u - 19.3) / 0.12);

  const p = script ? pointerAt(script, t) : { x: 0, y: 0, down: false };
  const ps = toScreen(cam, p);
  let press = 0;
  if (script) {
    for (const c of script.clicks) if (t >= c.t && t < c.t + 0.45) press = (t - c.t) / 0.45;
    if (f.touch) {
      // A finger landing shows a ripple too.
      const w = script.waypoints;
      for (let i = 1; i < w.length; i++) {
        if (w[i].down && !w[i - 1].down) {
          const start = w[i - 1].t + 0.001;
          if (t >= start && t < start + 0.45) press = (t - start) / 0.45;
        }
      }
    }
  }
  const pointerOpacity = clamp01((u - 1.05) / 0.25) * (1 - clamp01((u - 19.15) / 0.25));
  const touchDown = f.touch && script ? script.clicks.some((c) => t >= c.t && t < (c.until ?? c.t + 0.18)) : false;

  return (
    <div className={`f-stage f-${format}`} style={{ width: f.W, height: f.H }}>
      <div
        ref={worldRef}
        className="f-world"
        style={{
          width: f.worldW,
          transform: script ? `translate(${cam.sx - cam.cx * cam.s}px, ${cam.sy - cam.cy * cam.s}px) scale(${cam.s})` : "none",
          filter: veil > 0.01 ? `blur(${7 * veil}px)` : "none",
        }}
      >
        <main className="app">
          <header className="app__header">
            <div className="app__intro">
              <div className="app__titlerow">
                <h1 className="app__title">Beatmaker</h1>
                <button type="button" className="app__howto">
                  <CircleHelp size={18} aria-hidden="true" />
                  How to play
                </button>
              </div>
              <p className="app__help">Move across a colour to play it. Everything you play joins the loop.</p>
            </div>
            <SongActions busy={script ? t >= script.busy.from && t < script.busy.to : false} onShare={() => {}} onSaveWav={() => {}} onClearAll={() => {}} />
          </header>
          <TopBar
            song={song}
            playing
            status={script ? statusAt(script, t) : null}
            onPlay={() => {}} onStop={() => {}} onTempo={() => {}} onWaveform={() => {}} onVolume={() => {}}
          />
          <div className="app__stage">
            <div className="app__lanes">
              {LANES.map((lane) => (
                <div key={lane.id} className="f-lanewrap" data-lane={lane.id}>
                  <Lane lane={lane} slots={song.lanes[lane.id]} currentSlot={currentSlot} onZone={() => {}} onClear={() => {}} />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {veil > 0.001 && <div className="f-veil" style={{ opacity: 0.82 * veil }} />}

      {titleOpacity > 0.001 && (
        <div className="f-title" style={{ opacity: titleOpacity, transform: `translate(-50%, -50%) scale(${titleScale})` }}>
          <div className="f-title__brand" style={{ fontSize: f.sub }}>
            <span className="f-swatches"><b /><b /><b /><b /></span>Beatmaker
          </div>
          <div className="f-title__main" style={{ fontSize: f.title }}>Make a beat<br />in seconds.</div>
        </div>
      )}

      {script && u > 16.5 && (
        <div className="f-cta" style={{ opacity: 1 - ctaOut }}>
          <div className="f-cta__band" style={{ opacity: ctaBand, height: `${f.ctaBand * 100}%` }} />
          <div className="f-cta__main" style={{ fontSize: f.cta, opacity: ctaIn, transform: `translateY(${(1 - ctaIn) * 22}px)` }}>Your turn.</div>
          <div className="f-cta__sub" style={{ fontSize: f.ctaSub, opacity: ctaSub, transform: `translateY(${(1 - ctaSub) * 16}px)` }}>
            {f.touch ? "Drag across a colour to start" : "Sweep a colour to start"}
          </div>
        </div>
      )}

      {script && <Caption captions={script.captions} t={t} f={f} />}

      {script && pointerOpacity > 0 && (
        <Pointer p={{ ...ps, down: p.down || touchDown }} touch={f.touch} press={press} opacity={pointerOpacity} />
      )}
    </div>
  );
}
