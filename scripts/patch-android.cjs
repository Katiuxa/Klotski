"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ANDROID = path.join(ROOT, "android");
const APP = path.join(ANDROID, "app");
const SRC = path.join(APP, "src", "main");
const PKG = "com.metamovidas.huarongdao";
const APP_NAME = "Huarongdao";
const PKG_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const VERSION_NAME = PKG_JSON.version || "1.0.0";
const VERSION_CODE = Number(PKG_JSON.androidVersionCode) || 1;

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  console.log("patch " + path.relative(ROOT, file));
}

function patchLocalProperties() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "C:/Users/carlo/AppData/Local/Android/Sdk";
  write(path.join(ANDROID, "local.properties"), `sdk.dir=${sdk.replace(/\\/g, "/")}\n`);
}

function patchGradle() {
  const appGradle = path.join(APP, "build.gradle");
  let s = fs.readFileSync(appGradle, "utf8");
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
  fs.writeFileSync(file, s);
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
  const dir = path.join(SRC, "java", "com", "metamovidas", "huarongdao");
  write(path.join(dir, "MainActivity.java"), `package com.metamovidas.huarongdao;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Edge-to-edge; status may overlay, nav bar must not cover content.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.parseColor("#1a221e"));
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

        WindowInsetsControllerCompat bars =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (bars != null) {
            bars.setAppearanceLightStatusBars(false);
            bars.setAppearanceLightNavigationBars(false);
        }

        final View root = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
            Insets cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            int bottom = Math.max(nav.bottom, cutout.bottom);
            // Native bottom padding so system nav never covers the WebView / credit.
            v.setPadding(0, 0, 0, bottom);
            return insets;
        });
        ViewCompat.requestApplyInsets(root);
    }
}
`);
}

function main() {
  if (!fs.existsSync(ANDROID)) {
    console.error("android/ missing — run: npx cap add android");
    process.exit(1);
  }
  patchLocalProperties();
  patchGradle();
  patchStrings();
  patchStyles();
  patchMainActivity();
  console.log(`patched Huarongdao Android ${VERSION_NAME} (${VERSION_CODE})`);
}

main();
