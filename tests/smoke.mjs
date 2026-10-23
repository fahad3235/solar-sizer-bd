/* Headless-Chrome smoke test (raw CDP) for solar-sizer-bd.
 * Run: node tests/smoke.mjs
 * Loads file://index.html, drives the UI, counts real assertions. */
import { spawn } from 'node:child_process';

const CHROME = '/opt/meta-chromium/chrome';
const PAGE = 'file:///home/hatch/workspace/muse-project-factory/builds/solar-sizer-bd/index.html';

let pass = 0, fail = 0;
const failures = [];
function check(cond, label) {
  if (cond) { pass++; }
  else { fail++; failures.push(label); console.log('FAIL - ' + label); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=0', '--user-data-dir=/tmp/ssb-chrome-profile',
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let wsUrl = null, httpPort = null;
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('no DevTools URL in stderr')), 15000);
    chrome.stderr.on('data', d => {
      const m = String(d).match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) {
        wsUrl = m[1];
        httpPort = new URL(wsUrl.replace(/^ws:\/\//, 'http://')).port;
        clearTimeout(t); resolve();
      }
    });
    chrome.on('error', reject);
  });

  const res = await fetch(`http://127.0.0.1:${httpPort}/json/new?${encodeURIComponent(PAGE)}`, { method: 'PUT' });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res2, rej) => { ws.onopen = res2; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const consoleErrors = [], pageErrors = [];
  function onConsole(p) {
    if (p.type === 'error') {
      const txt = (p.args || []).map(a => a.value ?? a.description ?? '').join(' ');
      consoleErrors.push(txt);
    }
  }
  function onException(p) { pageErrors.push(p.exceptionDetails.text || JSON.stringify(p.exceptionDetails)); }
  function onLog(p) { if (p.entry.level === 'error') pageErrors.push(p.entry.text); }

  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.consoleAPICalled') onConsole(m.params);
    else if (m.method === 'Runtime.exceptionThrown') onException(m.params);
    else if (m.method === 'Log.entryAdded') onLog(m.params);
    else if (m.method === 'Page.loadEventFired' && loadResolve) { loadResolve(); loadResolve = null; }
  };
  function send(method, params = {}) {
    return new Promise(resolve => {
      const myId = ++id;
      pending.set(myId, resolve);
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
  }
  let loadResolve = null;
  const waitLoad = () => new Promise(r => { loadResolve = r; setTimeout(r, 8000); });

  async function ev(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: false });
    if (r.result && r.result.result) return r.result.result.value;
    return undefined;
  }
  const text = sel => ev(`(document.querySelector(${JSON.stringify(sel)})||{}).textContent`);
  const visible = sel => ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)});return e&&!e.hidden;})()`);

  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  const loaded = waitLoad();
  await send('Page.navigate', { url: PAGE });
  await loaded; await sleep(400);

  // 1. loads clean
  check(await ev('document.title') === 'Solar Sizer BD', 'title is Solar Sizer BD');
  check(consoleErrors.length === 0, 'zero console errors on load (got ' + consoleErrors.length + ')');
  check(pageErrors.length === 0, 'zero page errors on load (got ' + pageErrors.length + ')');
  check(await ev("performance.getEntriesByType('resource').length") === 0, 'zero network resource requests');
  check(await visible('#emptyLoad') === true, 'empty state visible at start');
  check(await text('#sumDaily') === '0.00 kWh/day', 'empty load shows 0.00 kWh/day');
  check(await ev('document.documentElement.scrollWidth') <= await ev('window.innerWidth'), 'no horizontal overflow on desktop load');

  // helper: add a preset by id
  async function addPreset(pid) {
    await ev(`(function(){var s=document.getElementById('presetSel');s.value=${JSON.stringify(pid)};document.getElementById('addPresetBtn').click();})()`);
    await sleep(80);
  }

  // 2. canonical household: led-bulb(4x10x5=200) + ceiling-fan(2x75x8=1200) + fridge(1x150x8=1200) + tv(1x100x4=400) = 3000Wh
  await addPreset('led-bulb');
  await addPreset('ceiling-fan');
  await addPreset('fridge');
  await addPreset('tv');
  await sleep(200);
  check(await ev("document.querySelectorAll('#appRows tr').length") === 4, '4 appliance rows after preset adds');
  check(await visible('#emptyLoad') === false, 'empty state hidden after adds');
  check(await text('#sumDaily') === '3.00 kWh/day', "summary daily '3.00 kWh/day' (got " + await text('#sumDaily') + ')');
  check(await text('#sumPeak') === '0.44 kW', "summary peak '0.44 kW'");

  // 3. hand-verified results @ defaults (4.5 sun h, 20% loss, 545W panel, 12V lead-acid 1d)
  check(await text('#vDaily') === '3.00 kWh/day', "vDaily '3.00 kWh/day'");
  check(await text('#vSolar') === '0.83 kW', "vSolar '0.83 kW' (got " + await text('#vSolar') + ')');
  check(await text('#vPanels') === '2 panels of 545 W', "vPanels '2 panels of 545 W' (got " + await text('#vPanels') + ')');
  check(await text('#vArray') === '1.09 kW', "vArray '1.09 kW'");
  check(await text('#vInverter') === '1.0 kW', "vInverter '1.0 kW'");
  check(await text('#vRoof') === '4.0 m2', "vRoof '4.0 m2'");
  check(await text('#vBattery') === '555.6 Ah @ 12V', "vBattery '555.6 Ah @ 12V' (got " + await text('#vBattery') + ')');

  // 4. assumptions change: 5 sun h + 15% loss -> 0.71 kW ; panel 400W
  await ev(`(function(){
    var s=document.getElementById('sunHours'); s.value='5'; s.dispatchEvent(new Event('input',{bubbles:true}));
    var l=document.getElementById('lossPct'); l.value='15'; l.dispatchEvent(new Event('input',{bubbles:true}));
    var p=document.getElementById('panelW'); p.value='400'; p.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await sleep(150);
  check(await text('#vSolar') === '0.71 kW', "vSolar '0.71 kW' after assumption change");
  check(await text('#vPanels') === '2 panels of 400 W', "vPanels '2 panels of 400 W'");

  // 5. battery type lithium -> 308.64 Ah
  await ev(`(function(){var b=document.getElementById('battType');b.value='lithium';b.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await sleep(150);
  check(await text('#vBattery') === '308.6 Ah @ 12V', "vBattery lithium '308.6 Ah @ 12V'");

  // 6. validation: blank name + watts 0
  await ev(`(function(){
    document.getElementById('aName').value='';
    document.getElementById('aWatts').value='0';
    document.getElementById('aQty').value='1';
    document.getElementById('aHours').value='1';
    document.getElementById('addBtn').click();
  })()`);
  await sleep(150);
  check(await visible('#formErr') === true, 'inline error visible for blank name / watts 0');
  check(String(await text('#formErr')).length > 3, 'error message is non-empty');
  check(await ev("document.querySelectorAll('#appRows tr').length") === 4, 'invalid appliance not added');

  // 7. custom appliance add: 500W x 2h = 1.0 kWh -> daily 4.00
  await ev(`(function(){
    document.getElementById('aName').value='Test Heater';
    document.getElementById('aWatts').value='500';
    document.getElementById('aQty').value='1';
    document.getElementById('aHours').value='2';
    document.getElementById('addBtn').click();
  })()`);
  await sleep(150);
  check(await ev("document.querySelectorAll('#appRows tr').length") === 5, 'custom appliance row added');
  check(await text('#sumDaily') === '4.00 kWh/day', "daily becomes '4.00 kWh/day'");

  // 8. delete one row
  await ev(`(function(){document.querySelectorAll('#appRows .del')[4].click();})()`);
  await sleep(150);
  check(await ev("document.querySelectorAll('#appRows tr').length") === 4, 'delete removes the row');
  check(await text('#sumDaily') === '3.00 kWh/day', 'daily back to 3.00 after delete');

  // 9. malformed import rejected with data intact
  await ev(`(function(){
    var f = new File(['{not json'], 'bad.json', {type:'application/json'});
    var dt = new DataTransfer(); dt.items.add(f);
    var inp = document.getElementById('importFile'); inp.files = dt.files;
    inp.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await sleep(300);
  const dm = String(await text('#dataMsg'));
  check(/Invalid|wrong|bad/i.test(dm) || dm.length > 5, 'malformed import shows rejection message (got "' + dm.slice(0, 40) + '")');
  check(await ev("document.querySelectorAll('#appRows tr').length") === 4, 'data intact after bad import');

  // 10. BN toggle: Bengali strings + digits + persistence
  await ev(`document.getElementById('langBtn').click()`);
  await sleep(200);
  check(await ev('document.documentElement.lang') === 'bn', 'html lang switches to bn');
  check(await text('#brandName') === 'সোলার সাইজার বিডি', 'BN brand name');
  const bnDaily = String(await text('#sumDaily'));
  check(/[\u09E6-\u09EF]/.test(bnDaily), 'BN mode summary uses Bengali digits (got ' + bnDaily + ')');
  const rl = waitLoad();
  await send('Page.reload');
  await rl; await sleep(500);
  check(await ev('document.documentElement.lang') === 'bn', 'BN mode restored after reload');
  check(await ev("document.querySelectorAll('#appRows tr').length") === 4, 'appliances persist after reload');

  // 11. 390px viewport: no horizontal overflow
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const rl2 = waitLoad();
  await send('Page.reload');
  await rl2; await sleep(500);
  const sw = await ev('document.documentElement.scrollWidth');
  const iw = await ev('window.innerWidth');
  check(sw <= iw, 'mobile viewport: no horizontal overflow (scrollWidth=' + sw + ' innerWidth=' + iw + ')');
  check(await ev("document.querySelectorAll('.result').length") === 8, '8 result cards render at 390px');

  // final error sweep
  check(consoleErrors.length === 0, 'zero console errors overall (got ' + consoleErrors.length + ': ' + consoleErrors.slice(0, 2).join(' | ') + ')');
  check(pageErrors.length === 0, 'zero page errors overall (got ' + pageErrors.length + ')');

  console.log(`\nsmoke: ${pass} passed, ${fail} failed`);
  if (failures.length) { console.log('FAILURES:'); failures.forEach(f => console.log(' - ' + f)); }
  ws.close(); chrome.kill();
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('smoke harness error:', e.message); process.exit(2); });
