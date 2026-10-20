/* 今日速览弹窗：读桥接快照 → 规则引擎 → 渲染。
   只读不写——要改数据去工作台里改，这里保持轻快。 */

import { collect, todayStr } from './mw-rules.js';

const APP_URL = 'https://media-workbench-64130.app.workbuddy.host/';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function row(item, dot, tagText, tagCls, sub) {
  return '<div class="row">' +
    '<span class="dot ' + dot + '"></span>' +
    '<div class="main"><b>' + esc(item.title) + '</b><span>' + esc(sub) + '</span></div>' +
    (tagText ? '<span class="tag ' + tagCls + '">' + esc(tagText) + '</span>' : '') +
    '</div>';
}

function render(r, syncedAt) {
  const total = r.late.length + r.dueToday.length + r.overdueTodos.length;
  let html = '';

  /* 统计卡 */
  html += '<div class="stats">' +
    '<div class="stat hot"><b>' + r.dueToday.length + '</b><span>今日待发</span></div>' +
    '<div class="stat warm"><b>' + r.late.length + '</b><span>逾期未发</span></div>' +
    '<div class="stat calm"><b>' + r.overdueTodos.length + '</b><span>逾期待办</span></div>' +
    '</div>';

  if (!total) {
    html += '<div class="empty"><div class="big">✓</div>今天没有待发布内容，也没有逾期待办</div>';
  }

  /* 到点该发的（最优先） */
  if (r.dueNow.length) {
    html += '<div class="sec"><b>该发了</b>' + r.dueNow.map(function (c) {
      return row(c, 'red', '已到 ' + c.time, 'red', c.pf + ' · 原定 ' + c.time);
    }).join('') + '</div>';
  }

  /* 今日待发（还没到点的） */
  const later = r.dueToday.filter(function (c) { return !(c.time && c.time <= nowHM()); });
  if (later.length) {
    html += '<div class="sec"><b>今日待发</b>' + later.map(function (c) {
      return row(c, 'blue', c.time || '待定', 'amber', c.pf);
    }).join('') + '</div>';
  }

  /* 逾期内容 */
  if (r.late.length) {
    html += '<div class="sec"><b>逾期未发（' + r.late.length + '）</b>' + r.late.map(function (c) {
      return row(c, 'red', '逾期 ' + c.days + ' 天', 'red', c.pf + ' · 原定 ' + c.date.slice(5));
    }).join('') + '</div>';
  }

  /* 逾期待办 */
  if (r.overdueTodos.length) {
    html += '<div class="sec"><b>逾期待办（' + r.overdueTodos.length + '）</b>' + r.overdueTodos.map(function (t) {
      return row(t, 'amber', '逾期 ' + t.days + ' 天', 'red', '原定 ' + t.date.slice(5));
    }).join('') + '</div>';
  }

  document.getElementById('body').innerHTML = html;
  document.getElementById('sync').textContent = syncedAt
    ? '数据同步于 ' + syncedAt
    : '尚未同步数据——打开一次工作台即可';
}

function nowHM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/* ---------- 启动 ---------- */
(function init() {
  const now = new Date();
  document.getElementById('today').textContent =
    (now.getMonth() + 1) + '月' + now.getDate() + '日 周' + WEEK[now.getDay()];

  chrome.storage.local.get(['mw_sync', 'mw_synced_at', 'mw_capture_pending'], function (res) {
    const r = collect(res.mw_sync, now);
    let syncedAt = '';
    if (res.mw_synced_at) {
      const d = new Date(res.mw_synced_at);
      syncedAt = (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    render(r, syncedAt);
    initCapture(res.mw_sync, res.mw_capture_pending || []);
  });

  document.getElementById('btn-open').addEventListener('click', function () {
    chrome.tabs.create({ url: APP_URL });
  });
  document.getElementById('btn-side').addEventListener('click', function () {
    chrome.windows.getCurrent(function (w) {
      chrome.sidePanel.open({ windowId: w.id }).catch(function () { window.close(); });
    });
  });
})();

/* ---------- 公众号文章捕获：在文章页读当前文章 → 存进捕获箱 ---------- */
function initCapture(db, pending) {
  const box = document.getElementById('capture');
  const hint = document.getElementById('cap-hint');
  if (pending.length) {
    hint.textContent = '捕获箱里已有 ' + pending.length + ' 条，打开工作台可一并收录';
  }
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs && tabs[0];
    if (!tab || !/^https?:\/\/mp\.weixin\.qq\.com\//.test(tab.url || '')) return;
    chrome.tabs.sendMessage(tab.id, { type: 'mw-capture-grab' }, function (res) {
      /* 页面在插件装入前就开着时没有注入脚本，lastError 里有提示，安静跳过即可 */
      if (chrome.runtime.lastError || !res || !res.ok) return;
      renderCapture(res, db || {}, pending);
      box.style.display = 'block';
    });
  });
}

function parseDate(s) {
  s = String(s || '');
  let m = /(\d{4})[-年/](\d{1,2})[-月/](\d{1,2})/.exec(s);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = /(\d{1,2})月(\d{1,2})日/.exec(s);
  if (m) {
    const y = new Date().getFullYear();
    return y + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
  }
  return '';
}

function renderCapture(info, db, pending) {
  const date = parseDate(info.date);
  document.getElementById('cap-title').textContent = info.title;
  document.getElementById('cap-acc').textContent = info.account || '（未识别到账号名）';
  document.getElementById('cap-date').textContent = date || '（未识别，收录时按今天）';

  const sources = (db && db.sources) || [];
  const sel = document.getElementById('cap-src');
  sel.innerHTML = sources.map(function (s) {
      return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>';
    }).join('') +
    '<option value="__new__">＋ 新建来源（' + esc(info.account || '未命名') + '）</option>';
  const hit = sources.find(function (s) { return s.name === info.account; });
  sel.value = hit ? hit.id : '__new__';

  document.getElementById('cap-save').onclick = function () { saveCapture(info, date, sel.value); };
  document.getElementById('cap-copy').onclick = function () { copyCapture(info, date); };
}

function flash(text) {
  const btn = document.getElementById('cap-save');
  btn.textContent = text;
  setTimeout(function () { btn.textContent = '捕获到工作台'; }, 2500);
}

function saveCapture(info, date, sourceId) {
  const isNew = sourceId === '__new__';
  const item = {
    sourceId: isNew ? null : sourceId,
    sourceName: info.account || '未命名来源',
    newSource: isNew ? { name: info.account || '未命名来源', platform: 'gzh', accountId: '' } : null,
    title: info.title,
    link: info.url,
    publishedAt: date || '',
    capturedAt: Date.now()
  };
  chrome.storage.local.get(['mw_capture_pending'], function (res) {
    const list = res.mw_capture_pending || [];
    if (list.some(function (x) { return x.link === item.link; })) { flash('已在捕获箱里'); return; }
    list.push(item);
    chrome.storage.local.set({ mw_capture_pending: list }, function () {
      flash('已捕获，去工作台收录');
    });
  });
}

function copyCapture(info, date) {
  const text = '【转载候选】' + info.title + '\n来源：' + (info.account || '未知账号') +
    '\n发布：' + (date || '未知') + '\n链接：' + info.url;
  function done() { flash('已复制，可粘贴到记更新'); }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text); done(); });
  } else { fallbackCopy(text); done(); }
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
  ta.remove();
}
