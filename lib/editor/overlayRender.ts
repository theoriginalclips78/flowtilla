import type { Browser } from "puppeteer";

// Renders the clip's HOOK (top) and optional BRAND BANNER (bottom) as a single transparent
// PNG using headless Chrome — which renders COLOUR EMOJI and rich CSS styling that ffmpeg
// cannot. The PNG is then overlaid onto the video (see assembleGraph's `movie` overlay).
// A shared browser instance is reused across a whole run for speed.

let _browser: Browser | null = null;
async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  const puppeteer = (await import("puppeteer")).default;
  _browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb"],
  });
  return _browser;
}

export async function closeOverlayBrowser() {
  try { await _browser?.close(); } catch { /* noop */ }
  _browser = null;
}

export type OverlayOpts = {
  hook: string;
  variant?: number;
  banner?: string;        // e.g. "SEEDANCE 2.0 ON HIGGSFIELD" — last word is highlighted green
  bannerKicker?: string;  // e.g. "CREATE VIRAL 4K AI VIDEOS"
  width?: number;
  height?: number;
  topMargin?: number;     // px from top for the hook
};

function esc(s: string) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Per-variant hook styling (mirrors TITLE_STYLES but as CSS so we get emoji + real weight).
function hookCss(variant: number): string {
  const v = ((variant % 6) + 6) % 6;
  const base = `font-weight:900;line-height:1.12;letter-spacing:-0.01em;display:inline-block;padding:6px 14px;`;
  switch (v) {
    case 1: // white pill
      return `${base}font-size:62px;color:#151515;background:#fff;border-radius:16px;box-shadow:0 6px 22px rgba(0,0,0,.35);`;
    case 2: // black pill
      return `${base}font-size:62px;color:#fff;background:#0a0a0a;border-radius:16px;box-shadow:0 6px 22px rgba(0,0,0,.4);`;
    case 3: // floating caps
      return `${base}font-size:64px;color:#fff;text-transform:uppercase;-webkit-text-stroke:5px #000;paint-order:stroke fill;text-shadow:0 4px 14px rgba(0,0,0,.55);`;
    case 4: // yellow pop
      return `${base}font-size:66px;color:#FFE94A;-webkit-text-stroke:5px #111;paint-order:stroke fill;text-shadow:0 4px 14px rgba(0,0,0,.55);`;
    case 5: // comic white (rounded)
      return `${base}font-size:66px;color:#fff;font-family:'Arial Rounded MT Bold','Helvetica Rounded',Arial Black,sans-serif;-webkit-text-stroke:6px #000;paint-order:stroke fill;`;
    default: // floating white
      return `${base}font-size:70px;color:#fff;-webkit-text-stroke:5px #000;paint-order:stroke fill;text-shadow:0 5px 16px rgba(0,0,0,.55);`;
  }
}

function buildHtml(o: OverlayOpts, W: number, H: number): string {
  const top = o.topMargin ?? 210;
  const hook = esc(o.hook).trim();

  // Banner: highlight the LAST word (usually the brand) in lime green.
  let bannerHtml = "";
  if (o.banner && o.banner.trim()) {
    const words = o.banner.trim().split(/\s+/).map(esc);
    const last = words.pop() || "";
    const lead = words.join(" ");
    const kicker = o.bannerKicker ? `<div class="kicker">${esc(o.bannerKicker)}</div>` : "";
    bannerHtml = `<div class="banner">${kicker}<div class="bannermain">${lead} <span class="hl">${last}</span></div></div>`;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body { width:${W}px; height:${H}px; background:transparent; overflow:hidden; }
    .stage { position:relative; width:${W}px; height:${H}px;
      font-family:'Arial Black','Helvetica Neue',Arial,sans-serif; }
    .hook { position:absolute; top:${top}px; left:70px; right:70px; text-align:center; }
    .hook .txt { ${hookCss(o.variant ?? 0)} }
    .banner { position:absolute; bottom:180px; left:60px; right:60px; text-align:center; }
    .kicker { display:inline-block; background:#fff; color:#111; font-size:26px; font-weight:800;
      padding:6px 16px; border-radius:18px; margin-bottom:10px; letter-spacing:0.2px; }
    .bannermain { font-size:56px; font-weight:900; color:#fff; -webkit-text-stroke:5px #000;
      paint-order:stroke fill; text-shadow:0 4px 14px rgba(0,0,0,.55); line-height:1.05; }
    .bannermain .hl { color:#B6FF3B; }
  </style></head><body><div class="stage">
    ${hook ? `<div class="hook"><span class="txt">${hook}</span></div>` : ""}
    ${bannerHtml}
  </div></body></html>`;
}

export async function renderOverlay(o: OverlayOpts, outPath: string): Promise<boolean> {
  const W = o.width ?? 1080, H = o.height ?? 1920;
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
      await page.setContent(buildHtml(o, W, H), { waitUntil: "domcontentloaded", timeout: 15000 });
      await new Promise(r => setTimeout(r, 60));   // let fonts/emoji paint
      await page.screenshot({ path: outPath, omitBackground: true, type: "png" });
    } finally {
      await page.close();
    }
    return true;
  } catch {
    return false;   // caller falls back to the libass title
  }
}
