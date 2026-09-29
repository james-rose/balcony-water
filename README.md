# Balcony Water

A small offline-capable web app (PWA) for tracking self-watering balcony planters. No backend, no build step: plain HTML/CSS/JS in [`site/`](site), deployed to GitHub Pages.

- Add, edit and remove planters under Settings → Planters.
- Planters live in the browser's `localStorage` (key `balconera-app-v1`), on your device only.
- Weather comes from [Open-Meteo](https://open-meteo.com) (forecast and city search, no API key). Offline, it falls back to a sample forecast.
- Today shows *Water now*, *Check gauge* and *Dry phase* lists plus a 5-day plan. Each planter has a detail page with history, and every change can be undone from the toast.

## The dry-phase rule

Each planter has a reservoir with a gauge. When the gauge first reads **min**, the soil still holds water, so you wait a number of days (the *dry phase*) before refilling. That gives the roots air and stops the reservoir going stagnant.

1. **Base days** come from the average daily high of the next 3 days:

   | 3-day avg high | Base days |
   |---|---|
   | ≥ 28° | 0 (skip) |
   | 23–27° | 1 |
   | 16–22° | 2 |
   | below 16° | 3 |

2. **Adjust** the base for the planter:

   | Factor | Adjustment |
   |---|---|
   | Plant: thirsty / average / drought-tolerant | −1 / 0 / +1 |
   | Sun: full / part / shade | −0.5 / 0 / +0.5 |
   | Planter: Balconera 50 / 80 / 100 cm | −0.5 / 0 / +0.5 |
   | Planter: Canto Stone Low 40 | 0 (starting value, tune from observation) |

3. **Result** = round(base + adjustments), clamped to 1–4 days. In a hot spell (base 0) there is no dry phase (0 days), except drought-tolerant plants, which still get 1 day.

The water date is the day the gauge hit min plus the dry phase. Until then the planter is in *Dry phase*; after it, *Water now*. Planters not at min are *Check gauge*: tap **At min** when the gauge reads min and say when it happened.

## Add it to your iPhone home screen

1. Open the app's URL in **Safari** (it must be Safari, not Chrome).
2. Tap the **Share** button.
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Launch it from the new icon. It opens full-screen and works offline after the first load.

Data is stored per browser. The home-screen app and Safari keep separate storage, so set up your planters in the home-screen app.

## Run locally

```sh
cd site && python3 -m http.server 8000
```

Then open <http://localhost:8000>. The service worker only registers over HTTPS or on `localhost`.

## Deploy

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which publishes `site/` to GitHub Pages. If you bump the cached files, change `CACHE` in `site/sw.js` so installed copies refresh.
