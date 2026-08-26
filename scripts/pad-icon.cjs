"use strict";
const sharp = require("sharp");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const size = 1024;
const scale = 0.60;

async function main() {
  const raw = path.join(ROOT, "resources", "icon-raw.png");
  const out = path.join(ROOT, "resources", "icon-source.png");
  const red = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="512" cy="512" r="500" fill="#A83228"/>` +
      `</svg>`
  );
  const bg = await sharp(red).png().toBuffer();
  const inner = await sharp(raw)
    .resize(Math.round(size * scale), Math.round(size * scale), {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  await sharp(bg).composite([{ input: inner, gravity: "center" }]).png().toFile(out);
  console.log("padded icon -> resources/icon-source.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
