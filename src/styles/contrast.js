// Key colours and WCAG contrast. Key backgrounds are computed here (not with
// CSS color-mix) so the colour tested for contrast is exactly the one shown.

const INK = "#16204A";
const WHITE = "#FFFFFF";

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

function mix(hex, target, amount) {
  const t = toRgb(target);
  return toHex(toRgb(hex).map((v, i) => v + (t[i] - v) * amount));
}

export function mixWithWhite(hex, amount) {
  return mix(hex, WHITE, amount);
}

function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Background of key `index` of `count`: shaded toward ink, 55% on the lowest
// note down to 25% on the highest, so low notes read darker and white labels
// keep at least 4.5:1 on every key.
export function keyColor(laneHex, index, count) {
  const t = count > 1 ? index / (count - 1) : 0;
  return mix(laneHex, INK, 0.55 - 0.3 * t);
}

export function keyTextColor(laneHex, index, count) {
  const bg = keyColor(laneHex, index, count);
  return contrastRatio(bg, WHITE) >= contrastRatio(bg, INK) ? WHITE : INK;
}
