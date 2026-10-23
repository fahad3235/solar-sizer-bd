# TEST RESULTS — solar-sizer-bd (factory run #119, 2026-10-23 18:00 slot)

## Node unit tests — 44/44 PASS (`node tests/run-node-tests.js`)

Hand-verified canonical household:
4×10W bulb×5h = 200Wh; 2×75W fan×8h = 1200Wh; 150W fridge×8h = 1200Wh; 100W TV×4h = 400Wh.
Total = 3000Wh = **3.0 kWh/day**. Peak = 40+150+150+100 = 440W = **0.44 kW**.

- dailyKwh: 3.0 exact; [] → 0; 100W×1.5h = 0.15; 10W×24h = 0.24
- peakKw: 0.44 exact; [] → 0
- solarKw: 3.0/(4.5×0.8) = 0.8333 → **0.83**; 3.0/(5×0.85) = 0.7059 → **0.71**;
  1.2/(6×0.9) = 0.2222 → **0.22**; 0 → 0; sunHours 0.1 clamps to 0.5 → 7.5
- panelCount: (0.83kW,545W) → 2; (0.71kW,400W) → 2; (1.09kW,545W) → 2; 0 → 0
- actualArrayKw(2,545) = **1.09**
- inverterKw: 0.44 → 1.0 (0.44×1.25=0.55 → ceil(1.1)/2); 2.0 → 2.5; 1.6 → 2.0; 0 → 0
- batteryAh: 3000Wh lead-acid 12V 1d = 3000/5.4 = **555.56**;
  lithium = 3000/9.72 = **308.64**; 24V 2d lead-acid = **555.56**; 0Wh → 0
- roofAreaM2(2) = 4.0
- costEstimate: 2×18000+12000+25000 = 73000; install 10% = 7300; total **80300**;
  all-blank → 0
- validateAppliance: blank name, watts 0, qty 0, qty 2.5, hours 25, name >60 all rejected
- validateImport: good file accepted w/ settings kept; wrong app/version/bad row/
  non-object rejected; bad settings fall back to defaults (panelW 545, volts 12,
  lead-acid)
- PRESETS: 12 entries, all watts>0, qty≥1, hours 0–24

## Headless-Chrome smoke — 39/39 PASS (`node tests/smoke.mjs`, raw CDP, /opt/meta-chromium/chrome)

- Loads: title "Solar Sizer BD", 0 console errors, 0 page errors, 0 network requests,
  empty state visible, "0.00 kWh/day", no horizontal overflow at desktop
- 4 preset adds → 4 rows; summary "3.00 kWh/day" / "0.44 kW"
- Results hand-verified in UI: 0.83 kW array, "2 panels of 545 W", 1.09 kW actual,
  "1.0 kW" inverter, 4.0 m2 roof, "555.6 Ah @ 12V" battery
- Assumptions change (5 sun-h, 15% loss, 400W panel) → 0.71 kW, "2 panels of 400 W"
- Lithium battery → "308.6 Ah @ 12V"
- Validation: blank name + watts 0 → inline error, row not added
- Custom appliance (500W×1×2h) → 5 rows, daily 4.00; delete → 4 rows, 3.00
- Malformed import (bad JSON file) → rejection message, data intact
- BN toggle: html lang=bn, brand "সোলার সাইজার বিডি", Bengali digits in summary,
  persisted across reload (appliances + language)
- Mobile viewport: no horizontal overflow (scrollWidth ≤ innerWidth), 8 result cards
- Final sweep: 0 console errors, 0 page errors overall

## Repairs during this run

1. **Real bug — i18n double-escaping**: the Bengali escape generator ran the
   escaped string through JSON.stringify, producing literal `\\uXXXX` text in
   the UI. Fixed by decoding then re-encoding escapes exactly once; verified
   `I18N.bn.title === 'সোলার সাইজার বিডি'` and 0 non-ASCII chars in shipped sources.
2. **Real bug — desktop horizontal overflow**: wide appliance table forced page
   width at ~780px viewport. Fixed with unconditional `.table-scroll` wrappers.
3. **Real bug — grid blowout**: `.form-grid` tracks overflowed (257px tracks in a
   691px grid) due to grid-item automatic minimums. Fixed with
   `.form-grid > * { min-width: 0; }`.
4. Test-side expectation fixes only: "0.00 kWh/day" (2-decimal display),
   "1.0 kW" inverter (1-decimal display), "555.6"/"308.6 Ah" battery (1-decimal
   display), mobile overflow asserted as scrollWidth ≤ innerWidth.
