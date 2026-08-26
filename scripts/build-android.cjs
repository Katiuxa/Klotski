"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const VERSION = PKG.version || "1.0.0";
const ANDROID = path.join(ROOT, "android");
const OUT_DIR = path.join(ROOT, "release");
const APK_NAME = `Huarongdao-${VERSION}.apk`;

function run(cmd, args, cwd, env) {
  console.log("> " + [cmd, ...args].join(" "));
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: true, env });
  if (r.status) process.exit(r.status || 1);
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

  const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  run(gradlew, ["assembleDebug"], ANDROID, env);

  const built = path.join(ANDROID, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
  if (!fs.existsSync(built)) {
    console.error("APK not found:", built);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const dest = path.join(OUT_DIR, APK_NAME);
  fs.copyFileSync(built, dest);
  console.log("APK ready:", dest);
}

main();
