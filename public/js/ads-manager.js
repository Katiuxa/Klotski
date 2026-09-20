/**
 * GameAds — freemium AdMob (Capacitor WebView). APP ONLY.
 * Klotski / Huarongdao interstitial policy:
 *  1. Never on menu navigation, pause, reset, or replay of a cleared level.
 *  2. First successful clear of a NEW level ≥ 3 only.
 *  3. Levels 1–2: no interstitials at all.
 *  4. 4-minute stuck timer only on an active unsolved NEW level ≥ 3;
 *     paused while the level picker is open. Resets when the ad closes.
 *  5. Banner stays native (gap below WebView). Purchase disables all ads.
 */
(function (global) {
  "use strict";

  var CFG = Object.assign({
    gameId: "game",
    purchaseKey: "game_remove_ads",
    legacyPurchaseKeys: [],
    appId: "ca-app-pub-8973581015975783~3628113148",
    bannerId: "ca-app-pub-8973581015975783/5815292784",
    interstitialId: "ca-app-pub-8973581015975783/2261341955",
    rewardedId: "ca-app-pub-8973581015975783/8403973276",
    brand: "SPONSOR",
    priceEur: "2",
    developerForceAds: false,
    interstitialCooldownMs: 0,
    interstitialMinLevel: 3,
    stuckInterstitialMs: 4 * 60 * 1000,
    levelSkipCooldownMs: 24 * 60 * 60 * 1000,
    completedKey: "klotski_completed_v1",
    adsFirstClearKey: "klotski_ads_first_clear_v3",
    levelSkipAtKey: "klotski_ad_skip_at_v1",
    restartSpamCount: 4
  }, global.GAME_ADS_CONFIG || {});

  var PURCHASE_KEY = CFG.purchaseKey;
  var PRICE_EUR = String(CFG.priceEur || "2");
  var BANNER_H = "50px";
  var BANNER_SLOT_ID = "lat-ad-slot";
  var LAST_INTERSTITIAL_KEY = String(CFG.gameId || "game") + "_last_interstitial_at";
  var LEVEL_SKIP_AT_KEY = CFG.levelSkipAtKey || String(CFG.gameId || "game") + "_ad_skip_at_v1";
  var LOG = "[" + (CFG.gameId || "GameAds") + "]";

  var USE_GOOGLE_TEST_UNITS = false;
  var TEST = {
    banner: "ca-app-pub-3940256099942544/6300978111",
    interstitial: "ca-app-pub-3940256099942544/1033173712",
    rewarded: "ca-app-pub-3940256099942544/5224354917"
  };

  var state = {
    ready: false,
    purchased: false,
    admobReady: false,
    bannerEl: null,
    buyFab: null,
    metamoEl: null,
    interstitialEl: null,
    interstitialOpen: false,
    interstitialPrepared: false,
    countdownId: null,
    matchEndedPendingAd: false,
    matchEndTimer: null,
    matchInProgress: false,
    consecutiveRestarts: 0,
    matchesStarted: 0,
    lastInterstitialAt: 0,
    bannerShowing: false,
    bannerShowInFlight: false,
    bannerRetryId: null,
    bannerRetryCount: 0,
    listenersBound: false,
    rewardListenersBound: false,
    rewardedPrepared: false,
    rewardedOpen: false,
    rewardedEarned: false,
    rewardedWaitResolve: null,
    skipInFlight: false,
    devLaunchEl: null,
    currentLevel: 1,
    alreadyCleared: false,
    menuPaused: false,
    stuckTimerId: null,
    stuckStartedAt: 0,
    stuckElapsed: 0,
    nativeShowWatchId: null,
    pendingFirstClearLevel: 0
  };

  function restartSpamNeed() {
    var n = Number(CFG.restartSpamCount);
    if (!isFinite(n) || n < 1) return 4;
    return Math.floor(n);
  }

  function cooldownMs() {
    var n = Number(CFG.interstitialCooldownMs);
    if (!isFinite(n) || n < 0) return 3 * 60 * 1000;
    return n;
  }

  function readLastInterstitialAt() {
    try {
      var v = parseInt(global.localStorage.getItem(LAST_INTERSTITIAL_KEY), 10);
      return isFinite(v) && v > 0 ? v : 0;
    } catch (e) {
      return 0;
    }
  }

  function markInterstitialShown() {
    var now = Date.now();
    state.lastInterstitialAt = now;
    try {
      global.localStorage.setItem(LAST_INTERSTITIAL_KEY, String(now));
    } catch (e) {}
  }

  function cooldownReady() {
    var last = state.lastInterstitialAt || readLastInterstitialAt();
    state.lastInterstitialAt = last;
    if (!last) return true;
    return Date.now() - last >= cooldownMs();
  }

  function minInterstitialLevel() {
    var n = Number(CFG.interstitialMinLevel);
    if (!isFinite(n) || n < 1) return 3;
    return Math.floor(n);
  }

  function stuckMs() {
    var n = Number(CFG.stuckInterstitialMs);
    if (!isFinite(n) || n < 1) return 4 * 60 * 1000;
    return n;
  }

  function completedStorageKey() {
    return CFG.completedKey || "klotski_completed_v1";
  }

  function adsFirstClearKey() {
    return CFG.adsFirstClearKey || "klotski_ads_first_clear_v3";
  }

  function readIndexSet(key) {
    try {
      var raw = global.localStorage.getItem(key);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return {};
      var out = {};
      for (var i = 0; i < arr.length; i++) {
        var n = Number(arr[i]);
        if (isFinite(n)) out[n] = true;
      }
      return out;
    } catch (e) {
      return {};
    }
  }

  function writeIndexSet(key, map) {
    try {
      var arr = [];
      for (var k in map) {
        if (map[k]) arr.push(Number(k));
      }
      global.localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {}
  }

  function persistCompletedIndex(idx) {
    var map = readIndexSet(completedStorageKey());
    map[idx] = true;
    writeIndexSet(completedStorageKey(), map);
  }

  function persistFirstClearAd(level1) {
    var map = readIndexSet(adsFirstClearKey());
    map[level1] = true;
    writeIndexSet(adsFirstClearKey(), map);
  }

  function hasFirstClearAd(level1) {
    return !!readIndexSet(adsFirstClearKey())[level1];
  }

  function isPersistedCleared(level1) {
    var idx = level1 - 1;
    return !!readIndexSet(completedStorageKey())[idx];
  }

  function parseMatchArg(arg) {
    var out = { level: state.currentLevel || 1, alreadyCleared: false, firstClear: false };
    if (typeof arg === "number" && isFinite(arg)) {
      out.level = Math.floor(arg);
      return out;
    }
    if (arg && typeof arg === "object") {
      var n = Number(arg.level);
      if (isFinite(n) && n >= 1) out.level = Math.floor(n);
      if (arg.alreadyCleared === true) out.alreadyCleared = true;
      if (arg.firstClear === true) out.firstClear = true;
    }
    return out;
  }

  function levelAllowsInterstitial(level1) {
    return (level1 || 1) >= minInterstitialLevel();
  }

  function isReplayOrCleared(level1) {
    if (state.alreadyCleared) return true;
    if (hasFirstClearAd(level1)) return true;
    return isPersistedCleared(level1);
  }

  function shouldRunStuckTimer() {
    if (adsOff() || !adsSurfaceActive()) return false;
    if (!state.matchInProgress) return false;
    if (state.menuPaused) return false;
    if (state.interstitialOpen) return false;
    if (!levelAllowsInterstitial(state.currentLevel)) return false;
    if (isReplayOrCleared(state.currentLevel)) return false;
    return true;
  }

  function clearStuckTimer() {
    if (state.stuckTimerId) {
      clearTimeout(state.stuckTimerId);
      state.stuckTimerId = null;
    }
    if (state.stuckStartedAt) {
      state.stuckElapsed += Date.now() - state.stuckStartedAt;
      state.stuckStartedAt = 0;
    }
  }

  function resetStuckClock() {
    clearStuckTimer();
    state.stuckElapsed = 0;
    state.stuckStartedAt = 0;
  }

  function armStuckTimer() {
    clearStuckTimer();
    if (!shouldRunStuckTimer()) return;
    var remaining = stuckMs() - state.stuckElapsed;
    if (remaining < 250) remaining = 250;
    state.stuckStartedAt = Date.now();
    state.stuckTimerId = setTimeout(function () {
      state.stuckTimerId = null;
      state.stuckStartedAt = 0;
      state.stuckElapsed = 0;
      if (!shouldRunStuckTimer()) return;
      requestInterstitial({ reason: "stuck" }).then(function (shown) {
        if (!shown && shouldRunStuckTimer()) {
          state.stuckElapsed = 0;
          armStuckTimer();
        }
      });
    }, remaining);
  }

  function setPaused(paused) {
    state.menuPaused = !!paused;
    if (state.menuPaused) {
      clearStuckTimer();
    } else if (state.matchInProgress) {
      armStuckTimer();
    }
  }

  function onInterstitialClosed() {
    state.interstitialOpen = false;
    muteGameAudio(false);
    if (state.matchInProgress && !state.alreadyCleared) {
      state.stuckElapsed = 0;
      armStuckTimer();
    }
  }

  function idsFilled() {
    var b = String(CFG.bannerId || "");
    var i = String(CFG.interstitialId || "");
    return b.indexOf("PEGA_AQUÍ") === -1 && i.indexOf("PEGA_AQUÍ") === -1 && b.indexOf("xxxx") === -1;
  }

    function nativeAds() {
    return global.GameAdsNative
      || global.OchoDamasNative
      || global.TriTrickNative
      || global.HuarongNative
      || global.PetteiaNative
      || global.LatrunculiNative
      || null;
  }
  function units() {
    if (USE_GOOGLE_TEST_UNITS) {
      return { banner: TEST.banner, interstitial: TEST.interstitial, rewarded: TEST.rewarded };
    }
    return {
      banner: CFG.bannerId,
      interstitial: CFG.interstitialId,
      rewarded: CFG.rewardedId || ""
    };
  }

  function levelSkipCooldownMs() {
    var n = Number(CFG.levelSkipCooldownMs);
    if (!isFinite(n) || n < 1) return 24 * 60 * 60 * 1000;
    return n;
  }

  function readLevelSkipAt() {
    try {
      var v = parseInt(global.localStorage.getItem(LEVEL_SKIP_AT_KEY), 10);
      return isFinite(v) && v > 0 ? v : 0;
    } catch (e) {
      return 0;
    }
  }

  function markLevelSkipUsed() {
    try {
      global.localStorage.setItem(LEVEL_SKIP_AT_KEY, String(Date.now()));
    } catch (e) {}
  }

  function canSkipLevel() {
    var last = readLevelSkipAt();
    if (!last) return true;
    return Date.now() - last >= levelSkipCooldownMs();
  }

  function skipCooldownRemainingMs() {
    var last = readLevelSkipAt();
    if (!last) return 0;
    var left = levelSkipCooldownMs() - (Date.now() - last);
    return left > 0 ? left : 0;
  }

  function finishRewardedWait(result) {
    var resolve = state.rewardedWaitResolve;
    state.rewardedWaitResolve = null;
    state.skipInFlight = false;
    state.rewardedOpen = false;
    muteGameAudio(false);
    if (typeof resolve === "function") resolve(result);
  }

  function prepareRewarded() {
    if (!state.admobReady) return Promise.resolve(false);
    var id = String(units().rewarded || "");
    if (!id || id.indexOf("/") === -1) return Promise.resolve(false);
    var AdMob = getAdMob();
    if (!AdMob || typeof AdMob.prepareRewardVideoAd !== "function") return Promise.resolve(false);
    return AdMob.prepareRewardVideoAd({
      adId: id,
      isTesting: false
    })
      .then(function () {
        state.rewardedPrepared = true;
        return true;
      })
      .catch(function (err) {
        console.warn(LOG, "prepareRewardVideoAd", err);
        state.rewardedPrepared = false;
        return false;
      });
  }

  /**
   * Show a rewarded video to unlock the next level (does not mark completed).
   * Once every 24h. Resolves { ok, reason? }.
   */
  function showRewardedSkip() {
    if (state.skipInFlight || state.rewardedOpen || state.interstitialOpen) {
      return Promise.resolve({ ok: false, reason: "busy" });
    }
    if (!canSkipLevel()) {
      return Promise.resolve({ ok: false, reason: "cooldown", remainingMs: skipCooldownRemainingMs() });
    }

    /* Purchased / ads off: grant skip without video, still once per 24h. */
    if (adsOff()) {
      markLevelSkipUsed();
      return Promise.resolve({ ok: true, free: true });
    }

    if (!adsSurfaceActive() || !isRealNative() || !state.admobReady) {
      return Promise.resolve({ ok: false, reason: "unavailable" });
    }

    var AdMob = getAdMob();
    if (!AdMob || typeof AdMob.showRewardVideoAd !== "function") {
      return Promise.resolve({ ok: false, reason: "unavailable" });
    }

    state.skipInFlight = true;
    state.rewardedEarned = false;

    var runShow = function () {
      return new Promise(function (resolve) {
        state.rewardedWaitResolve = resolve;
        state.rewardedOpen = true;
        muteGameAudio(true);
        AdMob.showRewardVideoAd()
          .then(function () {
            state.rewardedEarned = true;
            markLevelSkipUsed();
            finishRewardedWait({ ok: true });
          })
          .catch(function (err) {
            console.warn(LOG, "showRewardVideoAd", err);
            state.rewardedPrepared = false;
            finishRewardedWait({ ok: false, reason: "failed" });
            prepareRewarded();
          });
      });
    };

    if (state.rewardedPrepared) return runShow();
    return prepareRewarded().then(function (ok) {
      if (!ok) {
        state.skipInFlight = false;
        return { ok: false, reason: "no-fill" };
      }
      return runShow();
    });
  }

  function whenAdMobReady(done) {
    var tries = 0;
    var tick = function () {
      try {
        var C = global.Capacitor;
        var nativeOk = !!(C && C.isNativePlatform && C.isNativePlatform());
        var pluginOk = !!(C && typeof C.isPluginAvailable === "function" && C.isPluginAvailable("AdMob"));
        var AdMob = getAdMob();
        if (nativeOk && (pluginOk || (AdMob && typeof AdMob.initialize === "function" && typeof AdMob.showBanner === "function"))) {
          if (AdMob && typeof AdMob.initialize === "function") {
            done();
            return;
          }
        }
      } catch (e) {}
      tries += 1;
      if (tries >= 50) {
        done();
        return;
      }
      setTimeout(tick, 120);
    };
    tick();
  }

  function isNativeApp() {
    try {
      return (
        document.documentElement.classList.contains("android-app") ||
        document.documentElement.classList.contains("is-native") ||
        !!(global.Capacitor && global.Capacitor.isNativePlatform && global.Capacitor.isNativePlatform())
      );
    } catch (e) {
      return false;
    }
  }

  function isRealNative() {
    try {
      return !!(global.Capacitor && global.Capacitor.isNativePlatform && global.Capacitor.isNativePlatform());
    } catch (e) {
      return false;
    }
  }

  function getAdMob() {
    try {
      var C = global.Capacitor;
      if (!C) return null;
      if (typeof C.registerPlugin === "function") {
        return C.registerPlugin("AdMob");
      }
      if (C.Plugins && C.Plugins.AdMob) return C.Plugins.AdMob;
    } catch (e) {}
    return null;
  }

  function adsSurfaceActive() {
    return isNativeApp();
  }

  function developerForceAds() {
    if (CFG.developerForceAds === true) return true;
    try {
      return global.localStorage.getItem("metamovidas_dev_force_ads") === "1";
    } catch (e) {
      return false;
    }
  }

  function adsOff() {
    return !!state.purchased && !developerForceAds();
  }

  function readPurchased() {
    var keys = [PURCHASE_KEY].concat(CFG.legacyPurchaseKeys || []);
    try {
      for (var i = 0; i < keys.length; i++) {
        var v = global.localStorage.getItem(keys[i]);
        if (v === "true" || v === "1") return true;
      }
    } catch (e) {}
    return false;
  }

  function writePurchased(on) {
    try {
      if (on) global.localStorage.setItem(PURCHASE_KEY, "true");
      else global.localStorage.removeItem(PURCHASE_KEY);
    } catch (e) {}
    state.purchased = !!on;
  }

  function measureBannerRow() {
    try {
      var row = document.getElementById("lat-ad-row");
      if (!row || (state.bannerEl && (state.bannerEl.hidden || state.bannerEl.classList.contains("is-credit-only")))) {
        return null;
      }
      var h = row.getBoundingClientRect().height;
      return h > 0 ? Math.ceil(h) : null;
    } catch (e) {
      return null;
    }
  }

  function setBannerHeight(on, px) {
    if (adsSurfaceActive()) buildMetamo();
    if (state.bannerEl) {
      /* Native AdMob lives in a gap below the WebView. HTML only keeps the credit. */
      state.bannerEl.classList.add("is-credit-only");
      state.bannerEl.hidden = !adsSurfaceActive();
    }
    document.documentElement.classList.add("ads-chrome");
    document.documentElement.classList.toggle("has-ad-banner", !!on && adsSurfaceActive());
    document.documentElement.style.setProperty("--ad-row-h", "0px");
    document.documentElement.style.setProperty("--ad-banner-h", "0px");
    setMetamoVisible(adsSurfaceActive());
  }

  function navMarginDp() {
    /* Native MainActivity already pads the content view by the nav-bar inset
       and hides the bar until the user swipes. Extra AdMob margin would lift
       the banner over the board / counts. */
    return 0;
  }

  function t(key) {
    var lang = (document.documentElement.lang || "es").slice(0, 2).toLowerCase();
    var dict = {
      es: {
        sponsor: "Espacio publicitario",
        buy: "Quitar anuncios por " + PRICE_EUR + " €",
        buyShort: "2 €",
        noAds: "No<br>ads",
        noAdsAria: "Quitar anuncios por " + PRICE_EUR + " €",
        confirm:
          "¿Quitar anuncios por " +
          PRICE_EUR +
          " €?\n\n(Simulación de pago: se guardará en este dispositivo.)",
        thanks: "Compra registrada. Los anuncios quedan desactivados de forma permanente en este dispositivo.",
        thanksDev: "Compra guardada en este dispositivo. Como desarrollador los anuncios siguen activos.",
        devLaunch: "Probar anuncio",
        adTitle: "Anuncio",
        wait: "Podrás cerrar en",
        close: "Cerrar anuncio",
        simLabel: "Anuncio simulado"
      },
      en: {
        sponsor: "Ad space",
        buy: "Remove ads for €" + PRICE_EUR,
        buyShort: "€" + PRICE_EUR,
        noAds: "No<br>ads",
        noAdsAria: "Remove ads for €" + PRICE_EUR,
        confirm: "Remove ads for €" + PRICE_EUR + "?\n\n(Simulated purchase — saved on this device.)",
        thanks: "Purchase saved. Ads are permanently disabled on this device.",
        thanksDev: "Purchase saved. Developer mode keeps ads on.",
        devLaunch: "Test ad",
        adTitle: "Advertisement",
        wait: "You can close in",
        close: "Close ad",
        simLabel: "Simulated ad"
      }
    };
    return (dict[lang] || dict.es)[key] || dict.es[key] || key;
  }

  function muteGameAudio(mute) {
    try {
      var fn = global.klotskiMuteForAd || global.latrunculiMuteForAd;
      if (typeof fn === "function") fn(!!mute);
    } catch (e) {}
  }

  function setMetamoVisible(on) {
    if (!adsSurfaceActive()) {
      document.documentElement.classList.remove("has-metamo");
      document.documentElement.style.setProperty("--metamo-h", "0px");
      if (state.metamoEl) state.metamoEl.hidden = true;
      return;
    }
    buildMetamo();
    var show = on !== false;
    if (state.metamoEl) state.metamoEl.hidden = !show;
    document.documentElement.classList.toggle("has-metamo", show);
    document.documentElement.style.setProperty("--metamo-h", show ? "1.25rem" : "0px");
  }

  function syncMetamo() {
    setMetamoVisible(adsSurfaceActive());
  }

  function watchBootForMetamo() {
    syncMetamo();
  }

  function buildMetamo() {
    var banner = buildBanner();
    if (state.metamoEl && state.metamoEl.parentNode) return state.metamoEl;
    var el = document.createElement("p");
    el.className = "lat-metamo";
    el.setAttribute("aria-label", "Made with love by Metamovidas");
    el.innerHTML =
      "<span>Made with</span><span class=\"heart\" aria-hidden=\"true\">❤️</span><span>by Metamovidas</span>";
    banner.insertBefore(el, banner.firstChild);
    state.metamoEl = el;
    return el;
  }

  function showDevTools() {
    try {
      return global.localStorage.getItem("metamovidas_dev_force_ads") === "1";
    } catch (e) {
      return false;
    }
  }

  function buildDevLauncher() {
    if (!showDevTools()) return null;
    if (state.devLaunchEl) return state.devLaunchEl;
    buildBanner();
    return state.devLaunchEl;
  }

  function syncDevLauncher() {
    if (!showDevTools()) {
      if (state.devLaunchEl) state.devLaunchEl.hidden = true;
      return;
    }
    var btn = buildDevLauncher();
    if (btn) btn.hidden = !adsSurfaceActive() || adsOff();
  }

  function buildBuyFab() {
    if (state.buyFab) return state.buyFab;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "lat-ad-buy-fab";
    btn.className = "lat-ad-buy-fab";
    btn.textContent = t("buyShort");
    btn.setAttribute("aria-label", t("buy"));
    btn.addEventListener("click", simulatePurchase);
    document.body.appendChild(btn);
    state.buyFab = btn;
    return btn;
  }

  function injectNoAdsFab() {
    if (!adsSurfaceActive()) return;
    var hosts = document.querySelectorAll(".hero-end, .topbar-end, .boot-sounds");
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      if (!host || host.querySelector(".lat-ad-noads-fab")) continue;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mute-fab lat-ad-noads-fab";
      btn.setAttribute("aria-label", t("noAdsAria"));
      btn.title = t("noAdsAria");
      btn.innerHTML = '<span class="lat-ad-noads-fab__txt">' + t("noAds") + "</span>";
      btn.addEventListener("click", simulatePurchase);
      host.insertBefore(btn, host.firstChild);
    }
  }

  function syncNoAdsFab() {
    injectNoAdsFab();
    var show = adsSurfaceActive() && !adsOff();
    var nodes = document.querySelectorAll(".lat-ad-noads-fab");
    for (var i = 0; i < nodes.length; i++) nodes[i].hidden = !show;
  }

  function buildBanner() {
    if (state.bannerEl) return state.bannerEl;
    var el = document.createElement("aside");
    el.id = "lat-ad-banner";
    el.className = "lat-ad-banner";
    el.setAttribute("role", "complementary");
    el.setAttribute("aria-label", t("sponsor"));
    var extraDev = showDevTools()
      ? '<button type="button" class="lat-ad-dev-launch" id="lat-ad-dev-launch">' +
        t("devLaunch") +
        "</button>"
      : "";
    el.innerHTML =
      '<div class="lat-ad-banner__row" id="lat-ad-row">' +
      extraDev +
      '<div class="lat-ad-banner__slot" id="' +
      BANNER_SLOT_ID +
      '"></div>' +
      '<button type="button" class="lat-ad-banner__buy" id="lat-ad-buy">' +
      t("buyShort") +
      "</button>" +
      "</div>";
    document.body.appendChild(el);
    el.querySelector("#lat-ad-buy").addEventListener("click", simulatePurchase);
    var devBtn = el.querySelector("#lat-ad-dev-launch");
    if (devBtn) {
      devBtn.addEventListener("click", function (ev) {
        ev.preventDefault();
        requestInterstitial(true);
      });
      state.devLaunchEl = devBtn;
    }
    state.bannerEl = el;
    return el;
  }

  function buildInterstitial() {
    return null;
  }

  function bindAdMobListeners(AdMob) {
    if (state.listenersBound || !AdMob || typeof AdMob.addListener !== "function") return;
    state.listenersBound = true;
    try {
      AdMob.addListener("bannerAdSizeChanged", function (info) {
        if (!info) return;
        var h = info.height || info.adHeight;
        if (h) setBannerHeight(true, h);
      });
      AdMob.addListener("bannerAdLoaded", function () {
        state.bannerShowing = true;
        document.documentElement.classList.add("has-admob-native");
        setBannerHeight(true);
      });
      AdMob.addListener("bannerAdFailedToLoad", function (err) {
        console.warn(LOG, "banner failed code=" + (err && (err.code || err.errorCode)), err);
        state.bannerShowing = false;
        state.bannerShowInFlight = false;
        scheduleBannerRetry();
      });
      AdMob.addListener("interstitialAdLoaded", function () {
        state.interstitialPrepared = true;
      });
      AdMob.addListener("interstitialAdFailedToLoad", function (err) {
        console.warn(LOG, "interstitial failed to load code=" + (err && (err.code || err.errorCode)), err);
        state.interstitialPrepared = false;
      });
      AdMob.addListener("interstitialAdShowed", function () {
        state.interstitialOpen = true;
        if (state.nativeShowWatchId) {
          clearTimeout(state.nativeShowWatchId);
          state.nativeShowWatchId = null;
        }
        clearStuckTimer();
        muteGameAudio(true);
        if (state.pendingFirstClearLevel) {
          persistFirstClearAd(state.pendingFirstClearLevel);
          state.pendingFirstClearLevel = 0;
        }
      });
      AdMob.addListener("interstitialAdDismissed", function () {
        state.interstitialPrepared = false;
        prepareInterstitial();
        onInterstitialClosed();
      });
      AdMob.addListener("interstitialAdFailedToShow", function (err) {
        console.warn(LOG, "interstitial failed to show", err);
        state.interstitialPrepared = false;
        state.interstitialOpen = false;
        muteGameAudio(false);
        prepareInterstitial();
      });
      AdMob.addListener("onRewardedVideoAdLoaded", function () {
        state.rewardedPrepared = true;
      });
      AdMob.addListener("onRewardedVideoAdFailedToLoad", function (err) {
        console.warn(LOG, "rewarded failed to load", err);
        state.rewardedPrepared = false;
      });
      AdMob.addListener("onRewardedVideoAdShowed", function () {
        state.rewardedOpen = true;
        muteGameAudio(true);
      });
      AdMob.addListener("onRewardedVideoAdReward", function () {
        state.rewardedEarned = true;
      });
      AdMob.addListener("onRewardedVideoAdDismissed", function () {
        state.rewardedPrepared = false;
        var earned = state.rewardedEarned;
        state.rewardedEarned = false;
        if (earned) {
          markLevelSkipUsed();
          finishRewardedWait({ ok: true });
        } else if (state.rewardedWaitResolve) {
          finishRewardedWait({ ok: false, reason: "dismissed" });
        } else {
          state.rewardedOpen = false;
          muteGameAudio(false);
        }
        prepareRewarded();
      });
      AdMob.addListener("onRewardedVideoAdFailedToShow", function (err) {
        console.warn(LOG, "rewarded failed to show", err);
        state.rewardedPrepared = false;
        finishRewardedWait({ ok: false, reason: "failed" });
        prepareRewarded();
      });
    } catch (e) {
      console.warn(LOG, "listeners", e);
    }
  }

  function prepareInterstitial() {
    if (adsOff()) return Promise.resolve(false);
    var AdMob = getAdMob();
        var native = nativeAds();
    if (native && typeof native.preloadInterstitial === "function") {
      try { native.preloadInterstitial(); } catch (e) {}
      state.interstitialPrepared = true;
      return Promise.resolve(true);
    }
    if (!AdMob || typeof AdMob.prepareInterstitial !== "function") return Promise.resolve(false);
    return AdMob.prepareInterstitial({
      adId: units().interstitial,
      isTesting: false
    })
      .then(function () {
        state.interstitialPrepared = true;
        return true;
      })
      .catch(function (err) {
        var code = err && (err.code || err.errorCode);
        console.warn(LOG, "prepareInterstitial code=" + code, err);
        state.interstitialPrepared = false;
        setTimeout(function () {
          if (!adsOff()) prepareInterstitial();
        }, 4000);
        return false;
      });
  }

  function notifyNativeBanner(on) {
    try {
      if (global.HuarongNative && typeof global.HuarongNative.setPlayAds === "function") {
        if (!on && !adsOff()) return true;
        global.HuarongNative.setPlayAds(!!on && !adsOff());
        return true;
      }
    } catch (e) {}
    return false;
  }

  function assertNativeBannerOn() {
    if (adsOff() || !adsSurfaceActive()) return;
    notifyNativeBanner(true);
    setTimeout(function () {
      if (!adsOff() && adsSurfaceActive()) notifyNativeBanner(true);
    }, 600);
    setTimeout(function () {
      if (!adsOff() && adsSurfaceActive()) notifyNativeBanner(true);
    }, 1800);
  }

  function scheduleBannerRetry() {
    if (state.bannerRetryId) return;
    if (state.bannerRetryCount >= 12) return;
    state.bannerRetryCount += 1;
    state.bannerRetryId = setTimeout(function () {
      state.bannerRetryId = null;
      if (adsOff() || !adsSurfaceActive()) return;
      state.bannerShowing = false;
      state.bannerShowInFlight = false;
      showNativeBanner();
    }, 4000);
  }

  function showNativeBanner() {
    /* Bottom banner is a native AdView below the WebView (MainActivity).
       Capacitor AdMob.showBanner sits under the WebView and never appears. */
    buildMetamo();
    document.documentElement.classList.add("has-admob-native");
    if (state.bannerEl) state.bannerEl.hidden = false;
    setBannerHeight(true);
    if (state.buyFab) state.buyFab.hidden = true;
    state.bannerShowing = true;
    state.bannerShowInFlight = false;
    notifyNativeBanner(true);
    assertNativeBannerOn();
    return Promise.resolve(true);
  }

  function hideNativeBanner() {
    state.bannerShowing = false;
    state.bannerShowInFlight = false;
    document.documentElement.classList.remove("has-admob-native");
    notifyNativeBanner(false);
    return Promise.resolve();
  }

  function showSimBannerChrome() {
    /* Never paint the HTML placeholder slot. Native AdMob only. */
    buildMetamo();
    if (state.bannerEl) {
      state.bannerEl.classList.add("is-credit-only");
      state.bannerEl.hidden = !adsSurfaceActive();
    }
    setBannerHeight(true);
    syncMetamo();
    syncNoAdsFab();
  }

  function showBannerChrome() {
    if (adsOff() || !adsSurfaceActive()) {
      hideBannerChrome();
      return Promise.resolve(false);
    }
    buildMetamo();
    syncMetamo();
    syncDevLauncher();
    syncNoAdsFab();
    if (state.admobReady && isRealNative()) {
      return showNativeBanner();
    }
    if (isRealNative()) {
      assertNativeBannerOn();
      return initAdMob().then(function () {
        return showNativeBanner();
      });
    }
    assertNativeBannerOn();
    setBannerHeight(true);
    return Promise.resolve(true);
  }

  function hideBannerChrome() {
    if (state.buyFab) state.buyFab.hidden = true;
    if (state.devLaunchEl && !showDevTools()) state.devLaunchEl.hidden = true;
    setBannerHeight(false);
    syncMetamo();
    syncDevLauncher();
    syncNoAdsFab();
    return hideNativeBanner();
  }

  function destroyAds() {
    writePurchased(true);
    try { var n = nativeAds(); if (n && n.setAdsOff) n.setAdsOff(); } catch (e) {}
    state.matchInProgress = false;
    resetStuckClock();
    if (state.matchEndTimer) {
      clearTimeout(state.matchEndTimer);
      state.matchEndTimer = null;
    }
    hideBannerChrome();
    syncMetamo();
    syncNoAdsFab();
  }

  function applyPurchaseUnlocked() {
    writePurchased(true);
    try { var n = nativeAds(); if (n && n.setAdsOff) n.setAdsOff(); } catch (e) {}
    if (developerForceAds()) return;
    destroyAds();
    try { global.dispatchEvent(new Event("gameads-change")); } catch (e) {}
  }

  function simulatePurchase() {
    try {
      var n = nativeAds();
      if (n && typeof n.buyRemoveAds === "function") {
        n.buyRemoveAds();
        return;
      }
    } catch (e) {}
    if (!global.confirm(t("confirm"))) return;
    applyPurchaseUnlocked();
  }

  function closeSimInterstitial() {
    document.body.classList.remove("lat-ad-locked");
    if (state.interstitialEl) state.interstitialEl.hidden = true;
  }

  function showNativeInterstitial() {
    var nativeShow = nativeAds();
    if (nativeShow && typeof nativeShow.showInterstitial === "function") {
      try { nativeShow.showInterstitial(); } catch (e) {}
      return Promise.resolve(true);
    }
    var AdMob = getAdMob();
    if (!AdMob || typeof AdMob.showInterstitial !== "function") return Promise.resolve(false);
    markInterstitialShown();
    return AdMob.showInterstitial()
      .then(function () {
        return true;
      })
      .catch(function (err) {
        console.warn(LOG, "showInterstitial", err);
        state.interstitialPrepared = false;
        prepareInterstitial();
        return false;
      });
  }

  function waitForPreparedInterstitial(ms) {
    if (state.interstitialPrepared) return Promise.resolve(true);
    var started = Date.now();
    return new Promise(function (resolve) {
      var tick = function () {
        if (state.interstitialPrepared) {
          resolve(true);
          return;
        }
        if (Date.now() - started >= ms) {
          resolve(false);
          return;
        }
        setTimeout(tick, 200);
      };
      tick();
    });
  }

  /**
   * Native AdMob only. Never a fake/test HTML interstitial.
   */
  function requestInterstitial(opts) {
    if (adsOff() || !adsSurfaceActive()) return Promise.resolve(false);
    if (state.interstitialOpen) return Promise.resolve(false);

    var bypass = false;
    var reason = "";
    var lvl = state.currentLevel;
    if (opts === true) bypass = true;
    else if (opts && typeof opts === "object") {
      if (opts.bypassCooldown === true) bypass = true;
      reason = String(opts.reason || "");
      var n = Number(opts.level);
      if (isFinite(n) && n >= 1) {
        lvl = Math.floor(n);
        state.currentLevel = lvl;
      }
    }

    if (!bypass) {
      if (reason !== "first-clear" && reason !== "stuck") {
        console.info(LOG, "interstitial skipped (not a Klotski progression trigger)", reason);
        return Promise.resolve(false);
      }
      if (!levelAllowsInterstitial(lvl)) {
        console.info(LOG, "interstitial skipped (below min level)", lvl);
        return Promise.resolve(false);
      }
      if (reason === "first-clear" && hasFirstClearAd(lvl)) {
        console.info(LOG, "interstitial skipped (already shown for first clear)", lvl);
        return Promise.resolve(false);
      }
      if (reason === "stuck" && isReplayOrCleared(lvl)) {
        console.info(LOG, "interstitial skipped (stuck on replay)", lvl);
        return Promise.resolve(false);
      }
      if (cooldownMs() > 0 && !cooldownReady()) {
        console.info(LOG, "interstitial skipped (cooldown)");
        return Promise.resolve(false);
      }
    }

    if (reason === "first-clear") state.pendingFirstClearLevel = lvl;
    clearStuckTimer();

    var AdMob = getAdMob();
    if (!state.admobReady || !AdMob || typeof AdMob.showInterstitial !== "function") {
      console.info(LOG, "interstitial skipped (AdMob not ready)");
      return Promise.resolve(false);
    }

    var go = function () {
      if (!state.interstitialPrepared) {
        console.info(LOG, "interstitial skipped (no fill)");
        prepareInterstitial();
        return Promise.resolve(false);
      }
      return showNativeInterstitial();
    };

    if (state.interstitialPrepared) return go();
    return prepareInterstitial().then(function (ok) {
      if (ok) return go();
      console.info(LOG, "interstitial skipped (no AdMob fill)");
      return false;
    });
  }

  function onMatchStart(arg) {
    var info = parseMatchArg(arg);
    state.currentLevel = info.level;
    state.alreadyCleared = !!(info.alreadyCleared || isPersistedCleared(info.level) || hasFirstClearAd(info.level));
    resetStuckClock();
    state.consecutiveRestarts = 0;
    state.matchInProgress = true;
    state.matchesStarted += 1;
    if (adsOff()) return;
    syncMetamo();
    armStuckTimer();
    prepareInterstitial();
  }

  function onMatchEnd(arg) {
    var info = parseMatchArg(arg);
    state.currentLevel = info.level;
    resetStuckClock();
    state.matchInProgress = false;
    state.consecutiveRestarts = 0;

    var firstClear = info.firstClear === true;
    if (firstClear) persistCompletedIndex(info.level - 1);

    if (adsOff()) return;
    if (!levelAllowsInterstitial(info.level)) {
      console.info(LOG, "level-complete interstitial skipped (below min level)", info.level);
      return;
    }
    if (hasFirstClearAd(info.level)) {
      console.info(LOG, "level-complete interstitial skipped (already shown)", info.level);
      return;
    }

    var adLevel = info.level;
    state.matchEndedPendingAd = true;
    if (state.matchEndTimer) clearTimeout(state.matchEndTimer);
    state.matchEndTimer = setTimeout(function () {
      state.matchEndTimer = null;
      requestInterstitial({ reason: "first-clear", level: adLevel });
    }, 600);
  }

  function consumeBack() {
    return !!state.interstitialOpen || !!state.rewardedOpen;
  }

  function ensureConsent(AdMob) {
    if (!AdMob || typeof AdMob.requestConsentInfo !== "function") return Promise.resolve();
    return AdMob.requestConsentInfo({})
      .then(function (info) {
        var status = info && info.status;
        var needForm = status === "REQUIRED" || status === "UNKNOWN";
        if (info && info.isConsentFormAvailable && needForm && typeof AdMob.showConsentForm === "function") {
          return AdMob.showConsentForm().catch(function (err) {
            console.warn(LOG, "showConsentForm", err);
          });
        }
      })
      .catch(function (err) {
        console.warn(LOG, "consent", err);
      });
  }

  function initAdMob(attempt) {
    attempt = attempt || 0;
    if (!idsFilled()) return Promise.resolve(false);
    if (!isRealNative() || !getAdMob() || typeof getAdMob().initialize !== "function") {
      if (attempt < 10) {
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve(initAdMob(attempt + 1));
          }, 280);
        });
      }
      return Promise.resolve(false);
    }
    var AdMob = getAdMob();
    return AdMob.initialize({
      initializeForTesting: false
    })
      .then(function () {
        state.admobReady = true;
        bindAdMobListeners(AdMob);
        ensureConsent(AdMob);
        prepareInterstitial();
        prepareRewarded();
        return true;
      })
      .catch(function (err) {
        console.warn(LOG, "AdMob.initialize failed", err);
        if (attempt < 10) {
          return new Promise(function (resolve) {
            setTimeout(function () {
              resolve(initAdMob(attempt + 1));
            }, 400);
          });
        }
        state.admobReady = false;
        return false;
      });
  }

  function init() {
    try {
      var n = nativeAds();
      if (n && typeof n.restorePurchases === "function") n.restorePurchases();
    } catch (eRest) {}
    state.purchased = readPurchased();
    state.lastInterstitialAt = readLastInterstitialAt();
    if (adsSurfaceActive()) {
      document.documentElement.classList.add("ads-chrome");
      buildMetamo();
      setMetamoVisible(true);
      syncNoAdsFab();
    }
    if (adsOff()) {
      if (adsSurfaceActive()) {
        buildMetamo();
        setBannerHeight(false);
        setMetamoVisible(true);
      } else {
        setBannerHeight(false);
        syncMetamo();
      }
      syncNoAdsFab();
      state.ready = true;
      return Promise.resolve(false);
    }
    if (!adsSurfaceActive()) {
      state.ready = true;
      return Promise.resolve(false);
    }

    assertNativeBannerOn();

    return new Promise(function (resolve) {
      whenAdMobReady(function () {
        initAdMob().then(function () {
          buildMetamo();
          watchBootForMetamo();
          syncDevLauncher();
          syncNoAdsFab();
          assertNativeBannerOn();
          setTimeout(syncNoAdsFab, 700);
          setTimeout(function () {
            showBannerChrome().then(function () {
              assertNativeBannerOn();
              state.ready = true;
              resolve(true);
            });
          }, 450);
        });
      });
    });
  }

  var api = {
    enabled: true,
    PURCHASE_KEY: PURCHASE_KEY,
    APP_ID: CFG.appId,
    BANNER_ID: CFG.bannerId,
    INTERSTITIAL_ID: CFG.interstitialId,
    REWARDED_ID: CFG.rewardedId,
    useProductionUnits: function () {
      USE_GOOGLE_TEST_UNITS = false;
      return true;
    },
    useTestUnits: function () {
      console.warn(LOG, "Google test ad units are disabled");
      USE_GOOGLE_TEST_UNITS = false;
      return false;
    },
    init: function () {
      return init();
    },
    onMatchStart: onMatchStart,
    onMatchEnd: onMatchEnd,
    onGameEnd: onMatchEnd,
    setPaused: setPaused,
    syncNoAdsFab: syncNoAdsFab,
    _onNativeInterstitialDone: function () {
      state.interstitialOpen = false;
      muteGameAudio(false);
      state.interstitialPrepared = false;
      prepareInterstitial();
    },
    showBanner: function () {
      return showBannerChrome();
    },
    hideBanner: function () {
      return hideBannerChrome();
    },
    showInterstitial: function () {
      return requestInterstitial();
    },
    forceInterstitial: function () {
      state.matchEndedPendingAd = false;
      return requestInterstitial({ bypassCooldown: true });
    },
    canSkipLevel: canSkipLevel,
    skipCooldownRemainingMs: skipCooldownRemainingMs,
    showRewardedSkip: showRewardedSkip,
    cooldownReady: cooldownReady,
    cooldownMs: cooldownMs,
    resetPurchase: function () {
      writePurchased(false);
      return showBannerChrome();
    },
    isPurchased: function () {
      return state.purchased;
    },
    consumeBack: consumeBack,
    onNativePurchase: function (ok) {
      if (ok) applyPurchaseUnlocked();
    }
  };

  global.LatrunculiAds = api;
  global.PetteiaAds = api;
  global.OchoDamasAds = api;
  global.AdsManager = api;
  global.GameAds = api;
  global.KlotskiAds = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      api.init();
    });
  } else {
    api.init();
  }
})(typeof window !== "undefined" ? window : globalThis);
