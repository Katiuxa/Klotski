"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const VERSION = PKG.version || "1.0.0";
const ANDROID = path.join(ROOT, "android");
const OUT_DIR = path.join(ROOT, "dist-android");

function run(cmd, args, cwd, env) {
  console.log("> " + [cmd, ...args].join(" "));
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: true, env });
  if (r.status) process.exit(r.status || 1);
}

function copyIf(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log("-> " + dest);
}

function main() {
  const studioJbr = "C:\\Program Files\\Android\\Android Studio\\jbr";
  const env = { ...process.env };
  if (fs.existsSync(studioJbr)) {
    env.JAVA_HOME = studioJbr;
    env.Path = studioJbr + "\\bin;" + (env.Path || env.PATH || "");
  }
  env.ANDROID_HOME = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || "C:\\Users\\carlo\\AppData\\Local\\Android\\Sdk";
  env.ANDROID_SDK_ROOT = env.ANDROID_SDK_ROOT || env.ANDROID_HOME;

  run("node", ["scripts/patch-android.cjs"], ROOT, env);

  const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  run(gradlew, ["assembleRelease", "bundleRelease"], ANDROID, env);

  const apkName = "Huarongdao-" + VERSION + "-con-publicidad.apk";
  const aabName = "Huarongdao-" + VERSION + ".aab";
  const apkSrc = path.join(ANDROID, "app", "build", "outputs", "apk", "release", "app-release.apk");
  const aabSrc = path.join(ANDROID, "app", "build", "outputs", "bundle", "release", "app-release.aab");

  const APKS = path.join("C:", "Users", "carlo", "Desktop", "Proyectos", "Android", "APKs");
  const PLAY = path.join("C:", "Users", "carlo", "Desktop", "Proyectos", "Android", "PlayStore", "Huarongdao");
  const PLAY_DESKTOP = path.join("C:", "Users", "carlo", "Desktop", "Play Store");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  copyIf(apkSrc, path.join(OUT_DIR, "Huarongdao-" + VERSION + ".apk"));
  copyIf(aabSrc, path.join(OUT_DIR, aabName));
  copyIf(apkSrc, path.join(APKS, apkName));
  copyIf(aabSrc, path.join(PLAY, aabName));
  copyIf(apkSrc, path.join(PLAY, apkName));
  copyIf(apkSrc, path.join(PLAY_DESKTOP, apkName));
  copyIf(aabSrc, path.join(PLAY_DESKTOP, aabName));
  console.log("APK: " + path.join(APKS, apkName));
}

main();
