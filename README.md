# Klotski / Huarongdao

The sliding-block puzzle. One red piece has to leave through the bottom gate. The other blocks only move aside to open that path. Web and Android.

## Web

https://huarongdaoklotski.vercel.app

Source is in `src/`.

```bash
npm ci
npm run dev
```

## Android

Capacitor, in `android/`. Version **1.0.33**. Package `com.metamovidas.huarongdao`.

```bash
npm ci
npm run apk
```

The Play Store keystore stays outside git.

The Android navigation bar is kept clear with native insets in `MainActivity`.
