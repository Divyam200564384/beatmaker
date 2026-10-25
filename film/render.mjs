// Renders the film frame by frame from the deterministic timeline.
// Usage: node film/render.mjs <wide|square> <out.mp4> [fps=60]
//        node film/render.mjs <wide|square> --stills <dir> t1 t2 ...
// Needs the dev server: npx vite --port 5190, and ffmpeg (FFMPEG env or on PATH).
import { spawn } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright-core";

const [format, out, ...rest] = process.argv.slice(2);
const SIZES = { wide: { width: 1280, height: 720, scale: 1.5 }, square: { width: 540, height: 540, scale: 2 } };
const size = SIZES[format];
if (!size || !out) throw new Error("usage: render.mjs <wide|square> <out.mp4|--stills dir t...> [fps]");

const browsers = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];
const browser = await chromium.launch({ executablePath: browsers.find((p) => fs.existsSync(p)) });
const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.scale });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`http://127.0.0.1:5190/film/index.html?format=${format}`);
await page.evaluate(() => window.__ready);
const duration = await page.evaluate(() => window.__duration);

async function frame(t) {
  await page.evaluate((t) => window.__seek(t), t);
  return page.screenshot({ type: "png" });
}

if (out === "--stills") {
  const [dir, ...times] = rest;
  fs.mkdirSync(dir, { recursive: true });
  for (const t of times) fs.writeFileSync(`${dir}/${format}-${Number(t).toFixed(2)}.png`, await frame(Number(t)));
} else {
  const fps = Number(rest[0] ?? 60);
  const frames = Math.round(duration * fps);
  const ff = spawn(process.env.FFMPEG ?? "ffmpeg", [
    "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < frames; i++) {
    const png = await frame(i / fps);
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % fps === 0) process.stdout.write(`${(i / fps).toFixed(0)}s `);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log(`\n${out}: ${frames} frames`);
}
await browser.close();
