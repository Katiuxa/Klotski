"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const PHOTO = path.join(ROOT, "resources", "icon-photo.jpg");
const MASTER = path.join(ROOT, "resources", "icon-master.png");
const LAUNCHER_BG = "#2c1814";

function write(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  console.log(path.relative(ROOT, file));
  return file;
}

function circleMask(size) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/>` +
      `</svg>`
  );
}

/** Cut the circular seal out of the studio photo (drop the grey field). */
async function extractSeal(inputPath, size = 1024) {
  const { data, info } = await sharp(inputPath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const at = (x, y) => (y * w + x) * c;
  const corners = [
    [2, 2],
    [w - 3, 2],
    [2, h - 3],
    [w - 3, h - 3],
  ].map(([x, y]) => {
    const i = at(x, y);
    return [data[i], data[i + 1], data[i + 2]];
  });
  const bg = [0, 1, 2].map((k) => corners.reduce((s, p) => s + p[k], 0) / corners.length);
  const dist = (i) => {
    const dr = data[i] - bg[0];
    const dg = data[i + 1] - bg[1];
    const db = data[i + 2] - bg[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  let maxR = 0;
  const thresh = 26;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (dist(at(x, y)) > thresh) {
        const r = Math.hypot(x - cx, y - cy);
        if (r > maxR) maxR = r;
      }
    }
  }
  const r = Math.min(maxR + 1, Math.min(cx, cy));
  const left = Math.max(0, Math.floor(cx - r));
  const top = Math.max(0, Math.floor(cy - r));
  const side = Math.max(2, Math.min(w - left, h - top, Math.ceil(r * 2)));

  return sharp(inputPath)
    .extract({ left, top, width: side, height: side })
    .resize(size, size, { fit: "cover", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .composite([{ input: circleMask(size), blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function padded(buf, size, scale) {
  const inner = Math.max(2, Math.round(size * scale));
  const icon = await sharp(buf)
    .resize(inner, inner, { fit: "contain", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: icon, gravity: "center" }])
    .png()
    .toBuffer();
}

async function iconAt(buf, size, file) {
  try {
    await sharp(buf)
      .resize(size, size, { fit: "cover", kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 9 })
      .toFile(write(file));
  } catch (e) {
    console.warn("skip", path.relative(ROOT, file), e.message);
  }
}

/** Opaque square: Android 12 always circle-masks the splash icon. */
async function splashIconSquare(sealBuf, size, scale, file) {
  const inner = Math.max(2, Math.round(size * scale));
  const icon = await sharp(sealBuf)
    .resize(inner, inner, { fit: "contain", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  try {
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 3,
        background: { r: 26, g: 34, b: 30 },
      },
    })
      .composite([{ input: icon, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toFile(write(file));
  } catch (e) {
    console.warn("skip", path.relative(ROOT, file), e.message);
  }
}

async function splashAt(iconBuf, w, h, file) {
  const iconSize = Math.round(Math.min(w, h) * 0.32);
  const icon = await sharp(iconBuf)
    .resize(iconSize, iconSize, { fit: "contain", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  try {
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
  } catch (e) {
    console.warn("skip", path.relative(ROOT, file), e.message);
  }
}

async function main() {
  if (!fs.existsSync(PHOTO)) {
    throw new Error("Missing " + path.relative(ROOT, PHOTO));
  }

  const master = await extractSeal(PHOTO, 1024);
  fs.mkdirSync(path.dirname(MASTER), { recursive: true });
  fs.writeFileSync(MASTER, master);
  console.log("resources/icon-master.png");
  fs.copyFileSync(MASTER, path.join(ROOT, "resources", "icon-source.png"));

  const android = path.join(ROOT, "android", "app", "src", "main", "res");
  if (!fs.existsSync(android)) {
    console.log("android/ missing — skip native icons");
    return;
  }

  for (const p of [
    path.join(android, "drawable-v24", "ic_launcher_foreground.xml"),
    path.join(android, "drawable", "ic_launcher_foreground.xml"),
  ]) {
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log("removed", path.relative(ROOT, p));
    }
  }

  // Adaptive safe zone is the inner ~66%; keep the gold rim visible.
  const glyph = await padded(master, 1024, 0.72);

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

  // Keep the full gold rim inside Android's 2/3 splash mask.
  await splashIconSquare(master, 288, 0.5, path.join(android, "drawable", "splash_icon.png"));
  await splashIconSquare(master, 576, 0.5, path.join(android, "drawable", "splash_icon_hd.png"));

  fs.writeFileSync(
    path.join(android, "values", "ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${LAUNCHER_BG}</color>
</resources>
`
  );
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
  fs.mkdirSync(path.join(android, "mipmap-anydpi-v26"), { recursive: true });
  fs.writeFileSync(path.join(android, "mipmap-anydpi-v26", "ic_launcher.xml"), adaptiveXml);
  fs.writeFileSync(path.join(android, "mipmap-anydpi-v26", "ic_launcher_round.xml"), adaptiveXml);

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

  console.log("android launcher + splash generated from photo (web/game UI unchanged)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
