'use strict';
/* Solar sizing math for solar-sizer-bd. Pure functions, no DOM.
 * All formulas are documented in README.md. Assumptions (default 4.5 peak
 * sun hours, 20% system loss, inverter efficiency 90%, ~2 m^2 per panel)
 * are planning estimates, not engineering guarantees. */
const Solar = (() => {
  function toNum(v, fb) {
    const n = Number(v);
    return Number.isFinite(n) ? n : (fb === undefined ? 0 : fb);
  }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function r2(x) { return Math.round(toNum(x) * 100) / 100; }

  // Preset appliances typical of a Bangladeshi household.
  // name = English label (translated via i18n PRESET_NAMES by id in the UI).
  const PRESETS = [
    { id: 'led-bulb',      name: 'LED Bulb',      watts: 10,   qty: 4, hours: 5   },
    { id: 'ceiling-fan',   name: 'Ceiling Fan',   watts: 75,   qty: 2, hours: 8   },
    { id: 'led-tube',      name: 'LED Tube Light',watts: 20,   qty: 2, hours: 5   },
    { id: 'fridge',        name: 'Refrigerator',  watts: 150,  qty: 1, hours: 8   },
    { id: 'tv',            name: 'TV (LED)',      watts: 100,  qty: 1, hours: 4   },
    { id: 'laptop',        name: 'Laptop',        watts: 65,   qty: 1, hours: 6   },
    { id: 'charger',       name: 'Phone Charger', watts: 15,   qty: 2, hours: 3   },
    { id: 'router',        name: 'WiFi Router',   watts: 10,   qty: 1, hours: 24  },
    { id: 'pump',          name: 'Water Pump',    watts: 750,  qty: 1, hours: 1   },
    { id: 'ac',            name: 'Air Conditioner',watts: 1500,qty: 1, hours: 6   },
    { id: 'iron',          name: 'Electric Iron', watts: 1000, qty: 1, hours: 0.5 },
    { id: 'freezer',       name: 'Deep Freezer',  watts: 200,  qty: 1, hours: 10  }
  ];

  const PANEL_OPTIONS = [200, 300, 400, 450, 545]; // watts per panel
  const VOLT_OPTIONS = [12, 24, 48];
  const BATT_TYPES = { 'lead-acid': 0.5, 'lithium': 0.9 }; // depth of discharge
  const INVERTER_EFF = 0.9;      // battery-side round losses
  const INVERTER_MARGIN = 1.25;  // peak-load safety margin
  const PANEL_AREA_M2 = 2.0;     // approx m^2 per panel, labeled assumption

  // list: [{watts, qty, hours}] -> kWh per day
  function dailyKwh(list) {
    let wh = 0;
    for (const a of list) wh += toNum(a.watts) * toNum(a.qty) * toNum(a.hours);
    return r2(wh / 1000);
  }

  // peak simultaneous load in kW (worst case: everything on at once)
  function peakKw(list) {
    let w = 0;
    for (const a of list) w += toNum(a.watts) * toNum(a.qty);
    return r2(w / 1000);
  }

  // required array capacity: dailyKwh / (peakSunHours * (1 - loss))
  function solarKw(dailyKwhVal, sunHours, lossPct) {
    const eff = 1 - clamp(toNum(lossPct, 20), 0, 90) / 100;
    const sh = clamp(toNum(sunHours, 4.5), 0.5, 12);
    if (eff <= 0 || sh <= 0) return 0;
    return r2(toNum(dailyKwhVal) / (sh * eff));
  }

  // number of panels of a given wattage to cover capacityKw
  function panelCount(capacityKw, panelW) {
    const w = toNum(panelW, 545);
    if (w <= 0 || capacityKw <= 0) return 0;
    return Math.ceil((capacityKw * 1000) / w);
  }

  function actualArrayKw(count, panelW) {
    return r2(count * toNum(panelW, 545) / 1000);
  }

  // inverter kW: peak * 1.25 margin, rounded UP to nearest 0.5 kW
  function inverterKw(peakKwVal) {
    const p = toNum(peakKwVal);
    if (p <= 0) return 0;
    return Math.ceil(p * INVERTER_MARGIN * 2) / 2;
  }

  // battery capacity in Ah
  function batteryAh(dailyWh, autonomyDays, battType, volts) {
    const wh = toNum(dailyWh);
    const days = clamp(toNum(autonomyDays, 1), 0.5, 7);
    const dod = BATT_TYPES[battType] !== undefined ? BATT_TYPES[battType] : 0.5;
    const v = toNum(volts, 12);
    if (wh <= 0 || v <= 0) return 0;
    return r2((wh * days) / (dod * v * INVERTER_EFF));
  }

  function roofAreaM2(count) { return r2(count * PANEL_AREA_M2); }

  // cost estimate; every price is user-entered (never fabricated)
  function costEstimate(opts) {
    const panels = toNum(opts.panelCount) * toNum(opts.panelPrice);
    const inverter = toNum(opts.inverterPrice);
    const battery = toNum(opts.batteryPrice);
    const install = r2((panels + inverter + battery) * clamp(toNum(opts.installPct), 0, 100) / 100);
    return {
      panels: r2(panels), inverter: r2(inverter), battery: r2(battery),
      install, total: r2(panels + inverter + battery + install)
    };
  }

  // ---- validation ----
  // returns array of error codes; [] = valid
  function validateAppliance(a) {
    const errs = [];
    if (!a || String(a.name || '').trim().length === 0) errs.push('name-required');
    else if (String(a.name).trim().length > 60) errs.push('name-too-long');
    const w = toNum(a && a.watts, NaN);
    if (!Number.isFinite(w) || w < 0.5 || w > 10000) errs.push('watts-range');
    const q = Number(a && a.qty);
    if (!Number.isInteger(q) || q < 1 || q > 99) errs.push('qty-range');
    const h = toNum(a && a.hours, NaN);
    if (!Number.isFinite(h) || h < 0 || h > 24) errs.push('hours-range');
    return errs;
  }

  // strict import validation; returns {ok:true,data} or {ok:false,errors:[...]}
  function validateImport(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: ['not-object'] };
    if (obj.app !== 'solar-sizer-bd' || obj.version !== 1) return { ok: false, errors: ['bad-header'] };
    if (!Array.isArray(obj.appliances)) return { ok: false, errors: ['bad-appliances'] };
    const clean = [];
    for (const a of obj.appliances) {
      if (validateAppliance(a).length) return { ok: false, errors: ['bad-appliance-row'] };
      clean.push({ name: String(a.name).trim().slice(0, 60), watts: toNum(a.watts), qty: Number(a.qty), hours: toNum(a.hours) });
    }
    const s = obj.settings && typeof obj.settings === 'object' ? obj.settings : {};
    return {
      ok: true,
      data: {
        appliances: clean,
        settings: {
          sunHours: clamp(toNum(s.sunHours, 4.5), 0.5, 12),
          lossPct: clamp(toNum(s.lossPct, 20), 0, 90),
          panelW: PANEL_OPTIONS.includes(Number(s.panelW)) ? Number(s.panelW) : 545,
          battType: BATT_TYPES[s.battType] !== undefined ? s.battType : 'lead-acid',
          volts: VOLT_OPTIONS.includes(Number(s.volts)) ? Number(s.volts) : 12,
          autonomyDays: clamp(toNum(s.autonomyDays, 1), 0.5, 7)
        }
      }
    };
  }

  return {
    PRESETS, PANEL_OPTIONS, VOLT_OPTIONS, BATT_TYPES,
    dailyKwh, peakKw, solarKw, panelCount, actualArrayKw, inverterKw,
    batteryAh, roofAreaM2, costEstimate, validateAppliance, validateImport,
    toNum, r2
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Solar;
