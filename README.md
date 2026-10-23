# Solar Sizer BD ☀️

Offline, bilingual (EN/বাংলা) rooftop solar sizing calculator for Bangladesh.
Add your home appliances, and it sizes the solar array, panel count, inverter,
battery bank, roof area, and cost estimate — in minutes, with zero network requests.

Live demo: https://fahad3235.github.io/solar-sizer-bd/

## Problem

Rooftop solar quotes in Bangladesh are confusing: oversized systems waste money,
undersized ones die on cloudy weeks. This tool turns your appliance list into
transparent, checkable numbers — every formula is documented below and every
assumption is adjustable in the UI.

## Features

1. **Load builder** — 12 typical Bangladeshi household presets (LED bulb, ceiling
   fan, fridge, water pump, AC…) with editable watts/qty/hours, plus custom
   appliances. Inline validation (blank name, watts 0.5–10000, qty 1–99, hours 0–24).
2. **Adjustable assumptions** — peak sun hours (default 4.5, Bangladesh average),
   system loss % (default 20%), panel wattage (200–545 W), battery type
   (lead-acid 50% DoD / lithium 90% DoD), system voltage (12/24/48 V), backup days.
3. **Sizing results** — daily kWh, peak kW, recommended array kW, panel count +
   actual array size, inverter kW (peak × 1.25, rounded up to 0.5 kW), roof area,
   battery Ah for off-grid/hybrid use.
4. **Cost estimator (optional)** — enter *your* local prices per panel, inverter,
   battery + installation %; nothing is pre-filled, so no fabricated prices.
5. **Data & backup** — localStorage persistence, JSON export, strict JSON import
   validation (malformed files rejected with data intact), typed-confirm clear-all.
6. **Bilingual + mobile** — EN/বাংলা toggle persisted across reloads, Bengali
   digits in BN mode, responsive down to 390 px.

## The math (all in `js/logic.js`, unit-tested)

| Quantity | Formula |
|---|---|
| Daily energy | Σ(watts × qty × hours) / 1000 → kWh/day |
| Peak load | Σ(watts × qty) / 1000 → kW (worst case: everything on) |
| Array capacity | dailyKWh ÷ (peakSunHours × (1 − loss%)) → kW |
| Panel count | ceil(arrayW ÷ panelW) |
| Inverter | ceil(peak × 1.25 × 2) ÷ 2 → kW (nearest 0.5 up) |
| Battery | dailyWh × days ÷ (DoD × volts × 0.9) → Ah |
| Roof area | panels × 2.0 m² (approx, 545 W-class panels) |

Worked example (in tests): 4×10 W bulbs ×5 h + 2×75 W fans ×8 h + 150 W fridge ×8 h
+ 100 W TV ×4 h = **3.00 kWh/day**, peak **0.44 kW** → array **0.83 kW** at
4.5 sun-hours/20% loss → **2 × 545 W** panels (1.09 kW actual) → **1.0 kW**
inverter → **555.6 Ah @ 12 V** lead-acid for 1 backup day.

## Stack

Vanilla HTML/CSS/JS. No frameworks, no build step, no network requests.
Bengali strings ship as `\uXXXX` escapes (pure-ASCII sources).

## Prerequisites

Any modern browser. For tests: Node.js ≥ 18 and Chromium
(`/opt/meta-chromium/chrome` on the factory VM; any Chromium works for smoke tests).

## Install & run

No install. Open `index.html` in a browser, or serve the folder:

```bash
cd solar-sizer-bd
python3 -m http.server 8000
# → http://localhost:8000/
```

## Testing

```bash
node tests/run-node-tests.js   # 44 sizing-math + validation unit tests
node tests/smoke.mjs           # 39 headless-Chrome UI checks (raw CDP)
```

Latest run: **44/44 + 39/39 green, 0 console/page errors** — see `tests/TEST_RESULTS.md`.

## Deployment

Static site — any static host works. GitHub Pages: push to `main`, enable
Pages (Deploy from branch → main → / (root)).

## Limitations

- **Planning estimates only.** Real output varies with weather, shading, panel
  orientation, dust, and panel quality. This is not engineering advice — get a
  professional survey before buying.
- Default 4.5 peak sun hours is a Bangladesh-wide average; rooftops in shaded
  urban areas get less.
- Battery sizing assumes one efficiency factor (0.9) and nameplate DoD; real
  usable capacity degrades with age and temperature.
- Cost estimator has no price data — you enter your own.
- Personal planning tool; no accounts, no cloud, data never leaves the device.

## Status

v1.0 — complete MVP, tested, published.
