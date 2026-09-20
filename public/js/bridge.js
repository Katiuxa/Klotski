/**
 * Native Android bridge for Huarongdao. No-ops on the web so ads never
 * activate in the browser build.
 */
(function () {
  "use strict";

  function cap() {
    return window.Capacitor || null;
  }

  function isNative() {
    var C = cap();
    if (C) {
      try {
        if (typeof C.isNativePlatform === "function") return C.isNativePlatform();
      } catch (e) {}
      return true;
    }
    return /HuarongdaoAndroid/i.test(navigator.userAgent || "");
  }

  if (!isNative()) return;

  document.documentElement.classList.add("is-native", "android-app");

  function plugin(name) {
    var C = cap();
    if (!C || !C.Plugins) return null;
    return C.Plugins[name] || null;
  }

  async function bootNative() {
    var StatusBar = plugin("StatusBar");
    var SplashScreen = plugin("SplashScreen");
    var App = plugin("App");

    try {
      if (StatusBar) {
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: "DARK" });
        if (StatusBar.setBackgroundColor) {
          await StatusBar.setBackgroundColor({ color: "#00000000" });
        }
      }
    } catch (e) {}
    try {
      if (SplashScreen) await SplashScreen.hide({ fadeOutDuration: 220 });
    } catch (e) {}

    if (App && App.addListener) {
      App.addListener("backButton", function () {
        if (window.GameAds && window.GameAds.consumeBack && window.GameAds.consumeBack()) return;
        if (typeof window.klotskiConsumeBack === "function" && window.klotskiConsumeBack()) return;
        if (App.exitApp) App.exitApp();
      });
    }
  }

  document.addEventListener("gesturestart", function (e) {
    e.preventDefault();
  });
  document.addEventListener(
    "touchmove",
    function (e) {
      var t = e.target;
      if (t && t.closest && t.closest(".level-menu, .lang-menu")) return;
      e.preventDefault();
    },
    { passive: false }
  );
  if (cap() && cap().whenPluginReady) cap().whenPluginReady().then(bootNative).catch(bootNative);
  else window.addEventListener("DOMContentLoaded", function () {
    setTimeout(bootNative, 40);
  });
})();
