"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const ANDROID = path.join(ROOT, "android");
const APP = path.join(ANDROID, "app");
const SRC = path.join(APP, "src", "main");
const PKG = "com.metamovidas.huarongdao";
const APP_NAME = "Huarongdao";
const PKG_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const VERSION_NAME = PKG_JSON.version || "1.0.0";
const VERSION_CODE = Number(PKG_JSON.androidVersionCode) || 1;
const PASS = "HuarongdaoMetamovidas2026!";

function adsIdsFromConfig() {
  const paths = [
    path.join(ROOT, "public", "js", "ads-config.js"),
    path.join(ROOT, "dist", "js", "ads-config.js"),
    path.join(ROOT, "www", "js", "ads-config.js"),
    path.join(ROOT, "con-publicidad", "ads-config.js")
  ];
  let s = "";
  for (const p of paths) {
    if (fs.existsSync(p)) {
      s = fs.readFileSync(p, "utf8");
      break;
    }
  }
  const appId = ((s.match(/appId:\s*"([^"]+)"/) || [])[1] || "").trim();
  const bannerId = ((s.match(/bannerId:\s*"([^"]+)"/) || [])[1] || "").trim();
  const interstitialId = ((s.match(/interstitialId:\s*"([^"]+)"/) || [])[1] || "").trim();
  const rewardedId = ((s.match(/rewardedId:\s*"([^"]+)"/) || [])[1] || "").trim();
  const ready = appId.indexOf("~") !== -1
    && appId.indexOf("PEGA") === -1
    && bannerId.indexOf("/") !== -1
    && bannerId.indexOf("PEGA") === -1;
  return { appId, bannerId, interstitialId, rewardedId, ready };
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  console.log("patch " + path.relative(ROOT, file));
}

function patchLocalProperties() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "C:/Users/carlo/AppData/Local/Android/Sdk";
  write(path.join(ANDROID, "local.properties"), `sdk.dir=${sdk.replace(/\\/g, "/")}\n`);
}

function ensureKeystore() {
  const dir = path.join(ANDROID, "keystore");
  fs.mkdirSync(dir, { recursive: true });
  const jks = path.join(dir, "huarongdao-upload.jks");
  const props = path.join(ANDROID, "keystore.properties");
  if (fs.existsSync(jks) && fs.existsSync(props)) return;

  const javaHome = process.env.JAVA_HOME || "C:\\Program Files\\Android\\Android Studio\\jbr";
  const keytool = path.join(javaHome, "bin", "keytool.exe");
  const r = spawnSync(fs.existsSync(keytool) ? keytool : "keytool", [
    "-genkeypair", "-v",
    "-keystore", jks,
    "-storetype", "JKS",
    "-alias", "huarongdao",
    "-keyalg", "RSA",
    "-keysize", "2048",
    "-validity", "10000",
    "-storepass", PASS,
    "-keypass", PASS,
    "-dname", "CN=Huarongdao, OU=Metamovidas, O=Metamovidas, L=Madrid, C=ES"
  ], { stdio: "inherit" });
  if (r.status) throw new Error("keytool falló");
  write(props, `storeFile=keystore/huarongdao-upload.jks
storePassword=${PASS}
keyAlias=huarongdao
keyPassword=${PASS}
`);
  write(path.join(dir, "LEEEME.txt"), `GUARDA ESTE ARCHIVO Y huarongdao-upload.jks EN UN SITIO SEGURO.
Sin esta clave no podrás actualizar la app en Google Play.

Alias: huarongdao
Contraseña: ${PASS}
Paquete: ${PKG}
`);
}

function patchGradle() {
  const appGradle = path.join(APP, "build.gradle");
  let s = fs.readFileSync(appGradle, "utf8");
  if (!s.includes("keystore.properties")) {
    s = s.replace(
      "android {",
      `def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new java.io.FileInputStream(keystorePropertiesFile))
}

android {`
    );
  }
  if (!s.includes("signingConfigs")) {
    s = s.replace(
      "    buildTypes {",
      `    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties["keyAlias"]
                keyPassword keystoreProperties["keyPassword"]
                storeFile rootProject.file(keystoreProperties["storeFile"])
                storePassword keystoreProperties["storePassword"]
            }
        }
    }
    buildTypes {`
    );
  }
  if (!s.includes("signingConfig signingConfigs.release")) {
    s = s.replace(
      /release \{\s*minifyEnabled false/,
      `release {
            minifyEnabled false
            signingConfig signingConfigs.release`
    );
  }
  s = s.replace(/versionCode \d+/, "versionCode " + VERSION_CODE);
  s = s.replace(/versionName "[^"]+"/, 'versionName "' + VERSION_NAME + '"');
  s = s.replace(/namespace "[^"]+"/, `namespace "${PKG}"`);
  s = s.replace(/applicationId "[^"]+"/, `applicationId "${PKG}"`);
  fs.writeFileSync(appGradle, s);
  console.log("edit android/app/build.gradle");
}

function patchStrings() {
  const file = path.join(SRC, "res", "values", "strings.xml");
  if (!fs.existsSync(file)) return;
  let s = fs.readFileSync(file, "utf8");
  s = s.replace(/<string name="app_name">[^<]+<\/string>/, `<string name="app_name">${APP_NAME}</string>`);
  s = s.replace(/<string name="title_activity_main">[^<]+<\/string>/, `<string name="title_activity_main">${APP_NAME}</string>`);
  s = s.replace(/<string name="package_name">[^<]+<\/string>/, `<string name="package_name">${PKG}</string>`);
  s = s.replace(/<string name="custom_url_scheme">[^<]+<\/string>/, `<string name="custom_url_scheme">${PKG}</string>`);
  const ads = adsIdsFromConfig();
  const appId = ads.ready ? ads.appId : "PEGA_AQUI_EL_APP_ID_DE_ESTE_JUEGO";
  const bannerId = ads.ready ? ads.bannerId : "PEGA_AQUI_EL_BANNER_ID_DE_ESTE_JUEGO";
  const interstitialId = (ads.interstitialId && ads.interstitialId.indexOf("/") !== -1 && ads.interstitialId.indexOf("PEGA") === -1)
    ? ads.interstitialId
    : "PEGA_AQUI_EL_INTERSTITIAL_ID_DE_ESTE_JUEGO";
  const rewardedId = (ads.rewardedId && ads.rewardedId.indexOf("/") !== -1 && ads.rewardedId.indexOf("PEGA") === -1)
    ? ads.rewardedId
    : "";
  function upsert(name, value) {
    const re = new RegExp('<string name="' + name + '">[^<]*</string>');
    if (re.test(s)) {
      s = s.replace(re, '<string name="' + name + '">' + value + '</string>');
    } else {
      s = s.replace("</resources>", '    <string name="' + name + '">' + value + '</string>\n</resources>');
    }
  }
  upsert("admob_app_id", appId);
  upsert("admob_banner_id", bannerId);
  upsert("admob_interstitial_id", interstitialId);
  if (rewardedId) upsert("admob_rewarded_id", rewardedId);
  fs.writeFileSync(file, s);
  console.log("edit android/app/src/main/res/values/strings.xml (AdMob ids from ads-config)");
}

function patchManifest() {
  const file = path.join(SRC, "AndroidManifest.xml");
  if (!fs.existsSync(file)) return;
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes("android.permission.ACCESS_NETWORK_STATE")) {
    s = s.replace(
      '<uses-permission android:name="android.permission.INTERNET" />',
      '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />'
    );
  }
  if (!s.includes("com.google.android.gms.ads.APPLICATION_ID")) {
    s = s.replace(
      /(<application[\s\S]*?>)/,
      `$1\n\n        <!-- AdMob App ID. Must use "~", not "/". -->\n        <meta-data\n            android:name="com.google.android.gms.ads.APPLICATION_ID"\n            android:value="@string/admob_app_id" />`
    );
  }
  fs.writeFileSync(file, s);
  console.log("edit android/app/src/main/AndroidManifest.xml");
}

function patchStyles() {
  write(path.join(SRC, "res", "values", "styles.xml"), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@color/navBar</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
    </style>
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@color/navBar</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
    </style>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/splash_bg</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="windowSplashScreenIconBackgroundColor">@color/splash_bg</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
        <item name="android:windowSplashScreenBackground">@color/splash_bg</item>
        <item name="android:windowBackground">@color/splash_bg</item>
    </style>
</resources>
`);
  write(path.join(SRC, "res", "values", "colors.xml"), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#1a221e</color>
    <color name="colorPrimaryDark">#1a221e</color>
    <color name="colorAccent">#a83228</color>
    <color name="navBar">#1a221e</color>
    <color name="splash_bg">#1a221e</color>
</resources>
`);
}

function patchMainActivity() {
  const file = path.join(SRC, "java", "com", "metamovidas", "huarongdao", "MainActivity.java");
  if (!fs.existsSync(file)) {
    console.error("MainActivity.java missing — " + file);
    process.exit(1);
  }
  const src = fs.readFileSync(file, "utf8");
  if (src.includes("AdView") || src.includes("setPlayAds") || src.includes("AdsManager")) {
    console.log("keep MainActivity.java (already has AdView/setPlayAds)");
    return;
  }
  console.warn("MainActivity.java missing native banner — leaving as-is");
}

function main() {
  if (!fs.existsSync(ANDROID)) {
    console.error("android/ missing — run: npx cap add android");
    process.exit(1);
  }
  patchLocalProperties();
  ensureKeystore();
  patchGradle();
  patchStrings();
  patchManifest();
  patchStyles();
  patchMainActivity();
  console.log(`patched Huarongdao Android ${VERSION_NAME} (${VERSION_CODE})`);
}

main();
