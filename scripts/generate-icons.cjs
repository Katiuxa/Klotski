"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { Resvg } = require("@resvg/resvg-js");

const ROOT = path.join(__dirname, "..");
const MASTER = path.join(ROOT, "resources", "icon-master.png");
const FONT_CANDIDATES = [
  "C:/Windows/Fonts/msyhbd.ttc",
  "C:/Windows/Fonts/msyh.ttc",
  "C:/Windows/Fonts/simhei.ttf",
  "C:/Windows/Fonts/simsunb.ttf",
  "C:/Windows/Fonts/simsun.ttc",
  path.join(ROOT, "resources", "fonts", "NotoSansSC-Bold.otf"),
];

function write(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  console.log(path.relative(ROOT, file));
  return file;
}

function findFont() {
  for (const f of FONT_CANDIDATES) {
    if (fs.existsSync(f)) return f;
  }
  throw new Error("No CJK font found for icon rendering");
}

/** Crisp vector icon: red circle + 曹 (smaller, fully visible). */
function renderMasterIcon(size = 1024) {
  const font = findFont();
  // Character ~45% of diameter + optical vertical centering so nothing clips
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <circle cx="512" cy="512" r="500" fill="#A83228"/>
  <text
    x="512"
    y="560"
    text-anchor="middle"
    font-family="Microsoft YaHei, Segoe UI, sans-serif"
    font-size="340"
    font-weight="700"
    fill="#FAF6F0"
  >曹</text>
</svg>`;

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: {
      fontFiles: [font],
      loadSystemFonts: true,
      defaultFontFamily: "Microsoft YaHei",
    },
  });
  return Buffer.from(resvg.render().asPng());
}

/** Foreground-only glyph for adaptive icon (safe zone). */
function renderGlyphForeground(size = 1024) {
  const font = findFont();
  // Keep glyph inside Android adaptive safe zone (~66% center)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <text
    x="512"
    y="560"
    text-anchor="middle"
    font-family="Microsoft YaHei, Segoe UI, sans-serif"
    font-size="280"
    font-weight="700"
    fill="#FAF6F0"
  >曹</text>
</svg>`;
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: {
      fontFiles: [font],
      loadSystemFonts: true,
      defaultFontFamily: "Microsoft YaHei",
    },
  });
  return Buffer.from(resvg.render().asPng());
}

async function iconAt(buf, size, file) {
  await sharp(buf)
    .resize(size, size, { fit: "cover", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(write(file));
}

async function splashAt(iconBuf, w, h, file) {
  // Clean dark field + crisp centered seal — no AI art
  const iconSize = Math.round(Math.min(w, h) * 0.36);
  const icon = await sharp(iconBuf)
    .resize(iconSize, iconSize, { fit: "contain", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 26, g: 34, b: 30 },
    },
  })
    .composite([{ input: icon, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(write(file));
}

async function main() {
  console.log("font:", findFont());
  const master = renderMasterIcon(1024);
  fs.mkdirSync(path.dirname(MASTER), { recursive: true });
  fs.writeFileSync(MASTER, master);
  console.log("resources/icon-master.png");

  const glyph = renderGlyphForeground(1024);

  await iconAt(master, 16, path.join(ROOT, "public", "favicon-16.png"));
  await iconAt(master, 32, path.join(ROOT, "public", "favicon-32.png"));
  await iconAt(master, 180, path.join(ROOT, "public", "apple-touch-icon.png"));
  await iconAt(master, 512, path.join(ROOT, "public", "icon-512.png"));
  fs.copyFileSync(MASTER, path.join(ROOT, "resources", "icon-source.png"));

  const android = path.join(ROOT, "android", "app", "src", "main", "res");
  if (!fs.existsSync(android)) {
    console.log("android/ missing — skip native icons");
    return;
  }

  // Remove default Android vector foreground if present (causes robot logo)
  for (const p of [
    path.join(android, "drawable-v24", "ic_launcher_foreground.xml"),
    path.join(android, "drawable", "ic_launcher_foreground.xml"),
  ]) {
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log("removed", path.relative(ROOT, p));
    }
  }

  const dens = [
    ["mipmap-mdpi", 48, 108],
    ["mipmap-hdpi", 72, 162],
    ["mipmap-xhdpi", 96, 216],
    ["mipmap-xxhdpi", 144, 324],
    ["mipmap-xxxhdpi", 192, 432],
  ];
  for (const [folder, legacy, adaptive] of dens) {
    await iconAt(master, legacy, path.join(android, folder, "ic_launcher.png"));
    await iconAt(master, legacy, path.join(android, folder, "ic_launcher_round.png"));
    await iconAt(glyph, adaptive, path.join(android, folder, "ic_launcher_foreground.png"));
  }

  // Also place high-res foreground in xxxhdpi-ish for splash animated icon
  await iconAt(master, 288, path.join(android, "drawable", "splash_icon.png"));
  await iconAt(master, 576, path.join(android, "drawable", "splash_icon_hd.png"));

  fs.writeFileSync(
    path.join(android, "values", "ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#A83228</color>
</resources>
`
  );
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
  fs.writeFileSync(path.join(android, "mipmap-anydpi-v26", "ic_launcher.xml"), adaptive);
  fs.writeFileSync(path.join(android, "mipmap-anydpi-v26", "ic_launcher_round.xml"), adaptive);

  // Clean solid splash screens (no AI render)
  await splashAt(master, 1280, 1280, path.join(android, "drawable", "splash.png"));
  await splashAt(master, 320, 480, path.join(android, "drawable-port-mdpi", "splash.png"));
  await splashAt(master, 480, 800, path.join(android, "drawable-port-hdpi", "splash.png"));
  await splashAt(master, 720, 1280, path.join(android, "drawable-port-xhdpi", "splash.png"));
  await splashAt(master, 1080, 1920, path.join(android, "drawable-port-xxhdpi", "splash.png"));
  await splashAt(master, 1440, 2560, path.join(android, "drawable-port-xxxhdpi", "splash.png"));
  await splashAt(master, 480, 320, path.join(android, "drawable-land-mdpi", "splash.png"));
  await splashAt(master, 800, 480, path.join(android, "drawable-land-hdpi", "splash.png"));
  await splashAt(master, 1280, 720, path.join(android, "drawable-land-xhdpi", "splash.png"));
  await splashAt(master, 1920, 1080, path.join(android, "drawable-land-xxhdpi", "splash.png"));
  await splashAt(master, 2560, 1440, path.join(android, "drawable-land-xxxhdpi", "splash.png"));

  console.log("icons + splash generated (vector)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
