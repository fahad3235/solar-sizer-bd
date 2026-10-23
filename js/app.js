'use strict';
/* solar-sizer-bd UI. Depends on: js/logic.js (Solar), js/i18n.js (I18N). */
(function () {
  const $ = id => document.getElementById(id);
  const BN_DIGITS = { '0': '\u09e6', '1': '\u09e7', '2': '\u09e8', '3': '\u09e9', '4': '\u09ea', '5': '\u09eb', '6': '\u09ec', '7': '\u09ed', '8': '\u09ee', '9': '\u09ef' };
  const LS_KEY = 'solar-sizer-bd-v1';

  const state = {
    lang: 'en',
    appliances: [],
    settings: { sunHours: 4.5, lossPct: 20, panelW: 545, battType: 'lead-acid', volts: 12, autonomyDays: 1 }
  };

  function t(k) {
    const d = I18N[state.lang] || I18N.en;
    return d[k] !== undefined ? d[k] : (I18N.en[k] !== undefined ? I18N.en[k] : k);
  }
  function presetName(id) {
    const p = I18N.presets[state.lang] || I18N.presets.en;
    return p[id] || id;
  }
  function locNum(x, dec) {
    const n = Solar.toNum(x);
    const s = dec === undefined ? String(n) : n.toFixed(dec);
    if (state.lang !== 'bn') return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',').replace(/[0-9]/g, d => BN_DIGITS[d]);
  }
  function locInt(x) { return locNum(Math.round(Solar.toNum(x)), 0); }

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ lang: state.lang, appliances: state.appliances, settings: state.settings })); } catch (e) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (o.lang === 'bn' || o.lang === 'en') state.lang = o.lang;
      if (Array.isArray(o.appliances)) {
        state.appliances = o.appliances.filter(a => Solar.validateAppliance(a).length === 0)
          .map(a => ({ name: String(a.name).trim(), watts: Solar.toNum(a.watts), qty: Number(a.qty), hours: Solar.toNum(a.hours) }));
      }
      if (o.settings && typeof o.settings === 'object') {
        const r = Solar.validateImport({ app: 'solar-sizer-bd', version: 1, appliances: state.appliances, settings: o.settings });
        if (r.ok) state.settings = r.data.settings;
      }
    } catch (e) {}
  }

  function compute() {
    const list = state.appliances;
    const s = state.settings;
    const daily = Solar.dailyKwh(list);
    const peak = Solar.peakKw(list);
    const cap = Solar.solarKw(daily, s.sunHours, s.lossPct);
    const n = Solar.panelCount(cap, s.panelW);
    return {
      daily, peak, cap, n,
      arrayKw: Solar.actualArrayKw(n, s.panelW),
      inv: Solar.inverterKw(peak),
      roof: Solar.roofAreaM2(n),
      battAh: Solar.batteryAh(daily * 1000, s.autonomyDays, s.battType, s.volts)
    };
  }

  function renderText() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    document.title = t('title');
    $('brandName').textContent = t('title');
    const ids = ['tagline', 'secLoad', 'presetLabel', 'addPresetBtn', 'nameLabel', 'wattsLabel', 'qtyLabel',
      'hoursLabel', 'addBtn', 'emptyLoad', 'totalDailyLabel', 'peakLabel', 'secSettings', 'settingsNote',
      'sunHoursLabel', 'sunHoursNote', 'lossLabel', 'panelWLabel', 'battTypeLabel', 'voltLabel',
      'autonomyLabel', 'secResults', 'rDaily', 'rPeak', 'rSolar', 'rPanels', 'rArrayActual',
      'rInverter', 'rRoof', 'rBattery', 'battFor', 'gridTieNote', 'secCost', 'costNote',
      'panelPriceLabel', 'inverterPriceLabel', 'batteryPriceLabel', 'installLabel', 'costTotal',
      'secData', 'exportBtn', 'importBtn', 'clearBtn', 'disclaimer'];
    for (const id of ids) { const e = $(id); if (e) e.textContent = t(id); }
    // table headers
    const heads = document.querySelectorAll('#appTable thead th[data-th]');
    heads.forEach(th => { th.textContent = t(th.getAttribute('data-th')); });
    $('aName').placeholder = t('namePh');
    $('langBtn').textContent = state.lang === 'bn' ? 'EN' : '\u09ac\u09be\u0982\u09b2\u09be';
    // preset select options
    const sel = $('presetSel');
    const cur = sel.value;
    sel.innerHTML = '';
    for (const p of Solar.PRESETS) {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = presetName(p.id) + ' - ' + locInt(p.watts) + ' ' + t('unitW');
      sel.appendChild(o);
    }
    const oc = document.createElement('option');
    oc.value = '__custom__'; oc.textContent = t('customOption');
    sel.appendChild(oc);
    sel.value = cur && (Solar.PRESETS.some(p => p.id === cur) || cur === '__custom__') ? cur : Solar.PRESETS[0].id;
    // battery type options
    const bt = $('battType');
    bt.innerHTML = '';
    [['lead-acid', 'battLead'], ['lithium', 'battLithium']].forEach(([v, k]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = t(k); bt.appendChild(o);
    });
    bt.value = state.settings.battType;
    // panel wattage options
    const pw = $('panelW');
    pw.innerHTML = '';
    Solar.PANEL_OPTIONS.forEach(w => {
      const o = document.createElement('option'); o.value = w; o.textContent = locInt(w) + ' ' + t('unitW'); pw.appendChild(o);
    });
    pw.value = String(state.settings.panelW);
    // volts options
    const vv = $('volts');
    vv.innerHTML = '';
    Solar.VOLT_OPTIONS.forEach(v => {
      const o = document.createElement('option'); o.value = v; o.textContent = locInt(v) + ' V'; vv.appendChild(o);
    });
    vv.value = String(state.settings.volts);
  }

  function renderTable() {
    const tb = $('appRows');
    tb.innerHTML = '';
    if (!state.appliances.length) {
      $('emptyLoad').hidden = false;
      $('appTable').hidden = true;
      return;
    }
    $('emptyLoad').hidden = true;
    $('appTable').hidden = false;
    state.appliances.forEach((a, i) => {
      const tr = document.createElement('tr');
      const wh = a.watts * a.qty * a.hours;
      tr.innerHTML =
        '<td></td><td class="num"></td><td class="num"></td><td class="num"></td><td class="num"></td><td></td>';
      tr.children[0].textContent = a.name;
      tr.children[1].textContent = locNum(a.watts, a.watts % 1 ? 1 : 0);
      tr.children[2].textContent = locInt(a.qty);
      tr.children[3].textContent = locNum(a.hours, a.hours % 1 ? 1 : 0);
      tr.children[4].textContent = locNum(wh, wh % 1 ? 1 : 0);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'del'; b.textContent = '\u00d7'; b.title = t('delTitle');
      b.setAttribute('aria-label', t('delTitle') + ': ' + a.name);
      b.addEventListener('click', () => { state.appliances.splice(i, 1); save(); render(); });
      tr.children[5].appendChild(b);
      tb.appendChild(tr);
    });
  }

  function renderResults() {
    const c = compute();
    const s = state.settings;
    $('vDaily').textContent = locNum(c.daily, 2) + ' ' + t('unitKwhDay');
    $('vPeak').textContent = locNum(c.peak, 2) + ' ' + t('unitKw');
    $('vSolar').textContent = locNum(c.cap, 2) + ' ' + t('unitKw');
    $('vPanels').textContent = c.n === 0 ? '-' : locInt(c.n) + ' ' + t('panelsOf') + ' ' + locInt(s.panelW) + ' ' + t('unitW');
    $('vArray').textContent = locNum(c.arrayKw, 2) + ' ' + t('unitKw');
    $('vInverter').textContent = c.inv === 0 ? '-' : locNum(c.inv, 1) + ' ' + t('unitKw');
    $('vRoof').textContent = c.n === 0 ? '-' : locNum(c.roof, 1) + ' ' + t('unitM2');
    $('vBattery').textContent = c.battAh === 0 ? '-' : locNum(c.battAh, 1) + ' ' + t('unitAh') + ' @ ' + locInt(s.volts) + 'V';
    $('vAutonomy').textContent = locNum(s.autonomyDays, s.autonomyDays % 1 ? 1 : 0) + ' ' + t('unitDay');
    // summary under load section
    $('sumDaily').textContent = locNum(c.daily, 2) + ' ' + t('unitKwhDay');
    $('sumPeak').textContent = locNum(c.peak, 2) + ' ' + t('unitKw');
    renderCost(c);
  }

  function renderCost(c) {
    const p = Solar.toNum($('cPanel').value), iv = Solar.toNum($('cInverter').value),
      b = Solar.toNum($('cBattery').value), ip = Solar.toNum($('cInstall').value);
    const e = Solar.costEstimate({ panelCount: c.n, panelPrice: p, inverterPrice: iv, batteryPrice: b, installPct: ip });
    const rows = [
      [t('rPanels'), e.panels], [t('rInverter'), e.inverter], [t('rBattery'), e.battery],
      [t('installLabel'), e.install], [t('costTotal'), e.total]
    ];
    const tb = $('costRows');
    tb.innerHTML = '';
    rows.forEach(([label, val], i) => {
      const tr = document.createElement('tr');
      if (i === rows.length - 1) tr.className = 'total';
      const td1 = document.createElement('td'); td1.textContent = label;
      const td2 = document.createElement('td'); td2.className = 'num';
      td2.textContent = '\u09f3' + locInt(val);
      tr.appendChild(td1); tr.appendChild(td2); tb.appendChild(tr);
    });
  }

  function render() { renderText(); renderTable(); renderResults(); }

  function showFormErr(codes) {
    const map = { 'name-required': 'errName', 'name-too-long': 'errName', 'watts-range': 'errWatts', 'qty-range': 'errQty', 'hours-range': 'errHours' };
    $('formErr').textContent = codes.length ? t(map[codes[0]] || 'errName') : '';
    $('formErr').hidden = codes.length === 0;
  }

  function addCustom() {
    const a = {
      name: $('aName').value.trim(),
      watts: Solar.toNum($('aWatts').value, NaN),
      qty: Number($('aQty').value),
      hours: Solar.toNum($('aHours').value, NaN)
    };
    const errs = Solar.validateAppliance(a);
    showFormErr(errs);
    if (errs.length) return;
    state.appliances.push({ name: a.name, watts: a.watts, qty: a.qty, hours: a.hours });
    $('aName').value = ''; $('aWatts').value = ''; $('aQty').value = ''; $('aHours').value = '';
    save(); render();
  }

  function addPreset() {
    const p = Solar.PRESETS.find(x => x.id === $('presetSel').value);
    if (!p) return;
    state.appliances.push({ name: p.name, watts: p.watts, qty: p.qty, hours: p.hours });
    save(); render();
  }

  function exportJSON() {
    const payload = JSON.stringify({ app: 'solar-sizer-bd', version: 1, appliances: state.appliances, settings: state.settings }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'solar-sizer-bd-backup.json';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function importJSON(file) {
    const msg = $('dataMsg');
    const rd = new FileReader();
    rd.onload = () => {
      let obj = null;
      try { obj = JSON.parse(rd.result); } catch (e) {}
      const r = Solar.validateImport(obj);
      if (!r.ok) { msg.textContent = t('importBadMsg'); msg.className = 'msg bad'; return; }
      state.appliances = r.data.appliances;
      state.settings = r.data.settings;
      save(); syncSettingsInputs(); render();
      msg.textContent = t('importOkMsg'); msg.className = 'msg ok';
    };
    rd.readAsText(file);
  }

  function syncSettingsInputs() {
    $('sunHours').value = state.settings.sunHours;
    $('lossPct').value = state.settings.lossPct;
    $('autonomy').value = state.settings.autonomyDays;
    $('cInstall').value = 10;
  }

  function bind() {
    $('langBtn').addEventListener('click', () => {
      state.lang = state.lang === 'bn' ? 'en' : 'bn';
      save(); render();
    });
    $('addBtn').addEventListener('click', addCustom);
    $('addPresetBtn').addEventListener('click', addPreset);
    ['aName', 'aWatts', 'aQty', 'aHours'].forEach(id => {
      $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } });
    });
    $('sunHours').addEventListener('input', () => { state.settings.sunHours = Solar.toNum($('sunHours').value, 4.5); save(); renderResults(); });
    $('lossPct').addEventListener('input', () => { state.settings.lossPct = Solar.toNum($('lossPct').value, 20); save(); renderResults(); });
    $('panelW').addEventListener('change', () => { state.settings.panelW = Number($('panelW').value); save(); renderResults(); });
    $('battType').addEventListener('change', () => { state.settings.battType = $('battType').value; save(); renderResults(); });
    $('volts').addEventListener('change', () => { state.settings.volts = Number($('volts').value); save(); renderResults(); });
    $('autonomy').addEventListener('input', () => { state.settings.autonomyDays = Solar.toNum($('autonomy').value, 1); save(); renderResults(); });
    ['cPanel', 'cInverter', 'cBattery', 'cInstall'].forEach(id => {
      $(id).addEventListener('input', () => renderResults());
    });
    $('exportBtn').addEventListener('click', exportJSON);
    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', e => {
      if (e.target.files[0]) importJSON(e.target.files[0]);
      e.target.value = '';
    });
    $('clearBtn').addEventListener('click', () => {
      if (window.confirm(t('clearConfirmMsg'))) {
        state.appliances = [];
        save(); render();
      }
    });
  }

  load();
  bind();
  syncSettingsInputs();
  render();
})();
