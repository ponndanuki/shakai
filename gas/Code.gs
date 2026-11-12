/**
 * うごく社会ノート 視聴記録（GAS Webアプリ）
 * track.js から送られた記録を、このスプレッドシートの「視聴ログ」シートに追記します。
 *
 * 使い方：
 *  1. 新しいGoogleスプレッドシートを作る
 *  2. 拡張機能 → Apps Script を開き、このコードを貼り付けて保存
 *  3. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *       次のユーザーとして実行：自分
 *       アクセスできるユーザー：全員
 *  4. 表示された「ウェブアプリのURL」（…/exec）を track.js の ENDPOINT に貼る
 */
const SHEET_NAME = '視聴ログ';
const HEADER = ['受信日時', 'イベント', 'ページ名', 'ファイル', '到達シーン', '全シーン', '進み具合',
  '開始からの秒数', '得点', '問題数', '音声', '端末', '端末ID', '閲覧ID'];
const EVENT_JA = {
  open: 'ページを開いた', start: '再生開始', replay: 'もう一度再生',
  finish: '最後まで視聴', quiz: 'クイズ結果', leave: '途中で離れた'
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const sh = getSheet_();
    const scene = num_(d.scene), scenes = num_(d.scenes);
    sh.appendRow([
      new Date(),
      EVENT_JA[d.ev] || str_(d.ev),
      str_(d.title),
      str_(d.page),
      scene,
      scenes,
      (scene !== '' && scenes) ? Math.round(scene / scenes * 100) / 100 : '',
      num_(d.sec),
      num_(d.score),
      num_(d.total),
      str_(d.voice),
      str_(d.ua),
      str_(d.device),
      str_(d.view)
    ]);
    sh.getRange(sh.getLastRow(), 7).setNumberFormat('0%');
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err);
  } finally {
    lock.releaseLock();
  }
}

// ブラウザでURLを開いたときの動作確認用
function doGet() {
  return ContentService.createTextOutput('視聴記録の受付は動いています');
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADER.length).setFontWeight('bold').setBackground('#f4ecd8');
    sh.getRange('A:A').setNumberFormat('yyyy/mm/dd hh:mm:ss');
  }
  return sh;
}

// 文字列は長さを制限し、数式として解釈されないようにする
function str_(v) {
  if (v === undefined || v === null) return '';
  let s = String(v).slice(0, 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function num_(v) {
  if (v === '' || v === undefined || v === null) return '';
  const n = Number(v);
  return isFinite(n) ? n : '';
}
