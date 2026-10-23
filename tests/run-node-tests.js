'use strict';
/* Node unit tests for solar-sizer-bd sizing math. Run: node tests/run-node-tests.js
 * All expected values are hand-computed; see TEST_RESULTS.md for the arithmetic. */
const Solar = require('../js/logic.js');

let pass = 0, fail = 0;
const bad = [];
function check(cond, label) {
  if (cond) { pass++; }
  else { fail++; bad.push(label); console.log('FAIL - ' + label); }
}
const eq = (a, b) => Math.abs(a - b) < 1e-9;

// The canonical household scenario (hand-verified):
// 4x10W bulb x5h=200Wh, 2x75W fan x8h=1200Wh, 150W fridge x8h=1200Wh, 100W TV x4h=400Wh
const HH = [
  { name: 'LED Bulb', watts: 10, qty: 4, hours: 5 },
  { name: 'Ceiling Fan', watts: 75, qty: 2, hours: 8 },
  { name: 'Refrigerator', watts: 150, qty: 1, hours: 8 },
  { name: 'TV (LED)', watts: 100, qty: 1, hours: 4 }
];

// 1. daily energy
check(eq(Solar.dailyKwh(HH), 3.0), 'dailyKwh(HH) === 3.0 kWh');
check(eq(Solar.dailyKwh([]), 0), 'dailyKwh([]) === 0');
check(eq(Solar.dailyKwh([{ watts: 100, qty: 1, hours: 1.5 }]), 0.15), '1.5h x 100W = 0.15 kWh');
check(eq(Solar.dailyKwh([{ watts: 10, qty: 1, hours: 24 }]), 0.24), 'router 24h = 0.24 kWh');

// 2. peak load: 40+150+150+100 = 440 W = 0.44 kW
check(eq(Solar.peakKw(HH), 0.44), 'peakKw(HH) === 0.44 kW');
check(eq(Solar.peakKw([]), 0), 'peakKw([]) === 0');

// 3. solar capacity: 3.0 / (4.5 * 0.8) = 3.0/3.6 = 0.8333 -> 0.83
check(eq(Solar.solarKw(3.0, 4.5, 20), 0.83), 'solarKw(3, 4.5, 20%) === 0.83');
// 3.0 / (5 * 0.85) = 3.0/4.25 = 0.70588 -> 0.71
check(eq(Solar.solarKw(3.0, 5, 15), 0.71), 'solarKw(3, 5, 15%) === 0.71');
check(eq(Solar.solarKw(0, 4.5, 20), 0), 'solarKw(0,...) === 0');
check(eq(Solar.solarKw(3.0, 0.1, 20), 7.5), 'sunHours 0.1 clamped to 0.5: 3/(0.5*0.8) = 7.5');
check(eq(Solar.solarKw(1.2, 6, 10), 0.22), 'solarKw(1.2, 6, 10%) = 1.2/5.4 = 0.2222 -> 0.22');

// 4. panels: ceil(830/545) = 2 ; ceil(705.88/400) = 2
check(Solar.panelCount(0.83, 545) === 2, 'panelCount(0.83kW, 545W) === 2');
check(Solar.panelCount(0.71, 400) === 2, 'panelCount(0.71kW, 400W) === 2');
check(Solar.panelCount(1.09, 545) === 2, 'panelCount(1.09kW, 545W) === 2');
check(Solar.panelCount(0, 545) === 0, 'panelCount(0) === 0');
check(eq(Solar.actualArrayKw(2, 545), 1.09), 'actualArrayKw(2, 545W) === 1.09 kW');

// 5. inverter: 0.44*1.25 = 0.55 -> ceil(1.1)/2 = 1.0
check(eq(Solar.inverterKw(0.44), 1.0), 'inverterKw(0.44) === 1.0 kW');
check(eq(Solar.inverterKw(2.0), 2.5), 'inverterKw(2.0) = 2.5 -> 2.5');
check(eq(Solar.inverterKw(1.6), 2.0), 'inverterKw(1.6) = 2.0 -> 2.0');
check(eq(Solar.inverterKw(0), 0), 'inverterKw(0) === 0');

// 6. battery: 3000Wh / (0.5*12*0.9) = 3000/5.4 = 555.555 -> 555.56
check(eq(Solar.batteryAh(3000, 1, 'lead-acid', 12), 555.56), 'batteryAh lead-acid 12V 1d === 555.56');
// lithium: 3000 / (0.9*12*0.9) = 3000/9.72 = 308.6419 -> 308.64
check(eq(Solar.batteryAh(3000, 1, 'lithium', 12), 308.64), 'batteryAh lithium 12V 1d === 308.64');
// 24V lead-acid 2 days: 6000/5.4... no: 3000*2/(0.5*24*0.9)=6000/10.8=555.555 -> 555.56
check(eq(Solar.batteryAh(3000, 2, 'lead-acid', 24), 555.56), 'batteryAh 24V 2d lead-acid === 555.56');
check(eq(Solar.batteryAh(0, 1, 'lead-acid', 12), 0), 'batteryAh(0 Wh) === 0');

// 7. roof area: 2 panels -> 4.0 m^2
check(eq(Solar.roofAreaM2(2), 4.0), 'roofAreaM2(2) === 4.0');

// 8. cost: 2x18000 + 12000 + 25000 = 73000; install 10% = 7300; total 80300
const c = Solar.costEstimate({ panelCount: 2, panelPrice: 18000, inverterPrice: 12000, batteryPrice: 25000, installPct: 10 });
check(eq(c.panels, 36000), 'cost panels 36000');
check(eq(c.install, 7300), 'cost install 7300');
check(eq(c.total, 80300), 'cost total 80300');
const c2 = Solar.costEstimate({ panelCount: 0, panelPrice: '', inverterPrice: '', batteryPrice: '', installPct: 10 });
check(eq(c2.total, 0), 'cost all-blank === 0');

// 9. appliance validation
check(Solar.validateAppliance({ name: 'Fan', watts: 75, qty: 2, hours: 8 }).length === 0, 'valid appliance passes');
check(Solar.validateAppliance({ name: '   ', watts: 75, qty: 2, hours: 8 }).includes('name-required'), 'blank name rejected');
check(Solar.validateAppliance({ name: 'Fan', watts: 0, qty: 2, hours: 8 }).includes('watts-range'), 'watts 0 rejected');
check(Solar.validateAppliance({ name: 'Fan', watts: 75, qty: 0, hours: 8 }).includes('qty-range'), 'qty 0 rejected');
check(Solar.validateAppliance({ name: 'Fan', watts: 75, qty: 2.5, hours: 8 }).includes('qty-range'), 'qty 2.5 rejected');
check(Solar.validateAppliance({ name: 'Fan', watts: 75, qty: 2, hours: 25 }).includes('hours-range'), 'hours 25 rejected');
check(Solar.validateAppliance({ name: 'x'.repeat(61), watts: 75, qty: 2, hours: 8 }).includes('name-too-long'), 'name >60 rejected');

// 10. import validation
const good = {
  app: 'solar-sizer-bd', version: 1,
  appliances: [{ name: 'Fan', watts: 75, qty: 2, hours: 8 }],
  settings: { sunHours: 5, lossPct: 15, panelW: 400, battType: 'lithium', volts: 24, autonomyDays: 2 }
};
const gi = Solar.validateImport(good);
check(gi.ok && gi.data.settings.panelW === 400 && gi.data.settings.volts === 24, 'valid import accepted, settings kept');
check(!Solar.validateImport({ app: 'nope', version: 1, appliances: [] }).ok, 'wrong app rejected');
check(!Solar.validateImport({ app: 'solar-sizer-bd', version: 2, appliances: [] }).ok, 'wrong version rejected');
check(!Solar.validateImport({ app: 'solar-sizer-bd', version: 1, appliances: [{ name: '', watts: 1, qty: 1, hours: 1 }] }).ok, 'bad row rejected');
check(!Solar.validateImport('string').ok, 'non-object rejected');
const gi2 = Solar.validateImport({ app: 'solar-sizer-bd', version: 1, appliances: [], settings: { panelW: 999, volts: 99, battType: 'zzz' } });
check(gi2.ok && gi2.data.settings.panelW === 545 && gi2.data.settings.volts === 12 && gi2.data.settings.battType === 'lead-acid', 'bad settings fall back to defaults');

// 11. preset sanity: all presets have positive watts/qty, hours in [0,24]
check(Solar.PRESETS.length === 12, '12 presets');
check(Solar.PRESETS.every(p => p.watts > 0 && p.qty >= 1 && p.hours >= 0 && p.hours <= 24), 'all presets sane');

console.log(`\n${pass}/${pass + fail} node unit tests passed`);
if (fail) process.exit(1);
