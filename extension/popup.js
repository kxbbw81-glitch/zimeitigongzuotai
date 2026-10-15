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

  chrome.storage.local.get(['mw_sync', 'mw_synced_at'], function (res) {
    const r = collect(res.mw_sync, now);
    let syncedAt = '';
    if (res.mw_synced_at) {
      const d = new Date(res.mw_synced_at);
      syncedAt = (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    render(r, syncedAt);
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
