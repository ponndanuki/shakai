/* 視聴記録（GAS＋スプレッドシート）
 * 各ページの「再生開始」「最後まで視聴」「クイズ結果」「途中で離れた」を
 * GAS Webアプリに送って、スプレッドシートに1行ずつ記録します。
 *
 * ▼設定：GASをデプロイしたときの「ウェブアプリのURL」を下に貼ってください。
 *   空のままだと何も送信しません（ページの動作には影響しません）。
 *
 * ▼自分（保護者）の視聴を記録しないようにするには：
 *   その端末で一度だけ、どれかのページを「?notrack=1」を付けて開いてください。
 *   例） https://ponndanuki.github.io/shakai/index.html?notrack=1
 *   元に戻すときは「?notrack=0」を付けて開きます。
 */
(function () {
  'use strict';
  var ENDPOINT = ''; // ← 例: 'https://script.google.com/macros/s/XXXXXXXX/exec'

  var LOG = function () { try { console.debug.apply(console, ['[track]'].concat([].slice.call(arguments))); } catch (e) {} };

  // ---- 記録しない端末の設定（?notrack=1 / 0） ----
  var store = null;
  try { store = window.localStorage; } catch (e) {}
  function sget(k) { try { return store ? store.getItem(k) : null; } catch (e) { return null; } }
  function sset(k, v) { try { store && store.setItem(k, v); } catch (e) {} }
  function sdel(k) { try { store && store.removeItem(k); } catch (e) {} }
  try {
    var q = new URLSearchParams(location.search).get('notrack');
    if (q === '1') sset('shakai_notrack', '1');
    if (q === '0') sdel('shakai_notrack');
  } catch (e) {}
  var disabled = sget('shakai_notrack') === '1';

  // ---- 端末ID（どの端末からの視聴かを見分けるため。個人情報は含みません） ----
  var device = sget('shakai_device');
  if (!device) {
    device = Math.random().toString(36).slice(2, 8);
    sset('shakai_device', device);
  }
  var ua = navigator.userAgent || '';
  var uaShort = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Macintosh/.test(ua) ? (navigator.maxTouchPoints > 1 ? 'iPad' : 'Mac') : /Windows/.test(ua) ? 'Windows' : 'その他';

  var page = (location.pathname.split('/').pop() || 'index.html');
  var title = document.title || page;
  var view = Math.random().toString(36).slice(2, 8); // このページを開いた1回ごとのID
  var t0 = null, maxScene = -1, voice = '', lastLeaveScene = null, finished = false;

  function scenes() { try { return typeof S !== 'undefined' ? S.length : ''; } catch (e) { return ''; } }
  function sec() { return t0 ? Math.round((Date.now() - t0) / 1000) : ''; }

  function send(ev, extra) {
    var d = {
      ev: ev, page: page, title: title, device: device, view: view, ua: uaShort,
      scene: maxScene >= 0 ? maxScene + 1 : '', scenes: scenes(), sec: sec(), voice: voice
    };
    if (extra) for (var k in extra) d[k] = extra[k];
    LOG(ev, d, disabled ? '(記録しない端末)' : ENDPOINT ? '' : '(URL未設定)');
    if (disabled || !ENDPOINT) return;
    var body = JSON.stringify(d);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) return;
    } catch (e) {}
    try {
      fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body });
    } catch (e) {}
  }

  // 既存の関数を包んで、元の動作はそのまま呼ぶ
  function wrap(name, before) {
    var orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      try { before.apply(this, arguments); } catch (e) {}
      return orig.apply(this, arguments);
    };
  }

  wrap('start', function (v) {
    t0 = Date.now(); maxScene = -1; finished = false; lastLeaveScene = null;
    voice = v ? '語り' : '字幕のみ';
    send('start');
  });
  wrap('restart', function () {
    t0 = Date.now(); maxScene = -1; finished = false; lastLeaveScene = null;
    send('replay');
  });
  wrap('go', function (i) {
    if (typeof i === 'number' && i > maxScene && i < (scenes() || Infinity)) maxScene = i;
  });
  wrap('showEnd', function () {
    finished = true;
    send('finish');
  });
  wrap('result', function () {
    var sc = '', tot = '';
    try { sc = score; tot = QZ.length; } catch (e) {}
    send('quiz', { score: sc, total: tot });
  });

  // 途中で閉じた・アプリを切り替えたとき（進み具合が変わったときだけ送る）
  function onLeave() {
    if (t0 === null || finished) return;
    if (lastLeaveScene === maxScene) return;
    lastLeaveScene = maxScene;
    send('leave');
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') onLeave();
  });
  window.addEventListener('pagehide', onLeave);

  send('open');
})();
