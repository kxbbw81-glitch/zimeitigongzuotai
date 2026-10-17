/* 社媒工作台 · 后台服务（MV3 service worker）
   职责：① 每 30 分钟按规则引擎检查一遍；② 该发的/逾期的发系统通知（去重）；
         ③ 工具栏图标角标显示今日待处理数。
   数据不在这里产生——网页版每次保存会桥接一份快照到 chrome.storage.mw_sync，
   这里只读快照，不碰页面数据，双老死不相往来。 */

import { collect, badgeCount, notifications } from './mw-rules.js';

const ALARM_NAME = 'mw-periodic-check';
const CHECK_MINUTES = 30;
const APP_URL = 'https://media-workbench-64130.app.workbuddy.host/';
const NOTIFIED_KEY = 'mw_notified';   /* { dedupeKey: 'YYYY-MM-DD' } 同一天同一条只响一次 */

chrome.runtime.onInstalled.addListener(function () {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_MINUTES });
  /* 侧栏不抢 action 的点击——点图标照旧弹「今日速览」，侧栏从速览里开 */
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(function () {});
  }
  check();
});

chrome.runtime.onStartup.addListener(function () {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_MINUTES });
});

chrome.alarms.onAlarm.addListener(function (a) {
  if (a.name === ALARM_NAME) check();
});

/* 速览页改完数据（或手动刷新）后要立刻重算角标 */
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === 'local' && (changes.mw_sync || changes.mw_force)) check();
});

/* ---------- 主检查 ---------- */

/* 页面经 sidepanel / content script 转发来的数据快照——后台的唯一数据来源 */
chrome.runtime.onMessage.addListener(function (msg, sender) {
  if (!msg || msg.type !== 'mw-sync' || !msg.db) return;
  chrome.storage.local.set({
    mw_sync: msg.db,
    mw_synced_at: msg.at || Date.now()
  }, function () { check(); });
});

function check() {
  chrome.storage.local.get([NOTIFIED_KEY, 'mw_sync'], function (res) {
    const db = res.mw_sync;
    if (!db) { setBadge(''); return; }   /* 从没在插件环境下用过工作台 → 不打扰 */
    const r = collect(db, new Date());
    setBadge(badgeCount(r) ? String(badgeCount(r)) : '');
    fire(r, res[NOTIFIED_KEY] || {});
  });
}

function setBadge(text) {
  chrome.action.setBadgeBackgroundColor({ color: '#e5484d' }, function () {});
  chrome.action.setBadgeText({ text: text }, function () {});
}

function fire(r, notified) {
  const list = notifications(r);
  if (!list.length) return;
  /* 过期的去重记录清掉（只留今天的），避免 storage 无限增长 */
  const fresh = {};
  Object.keys(notified).forEach(function (k) {
    if (notified[k] === r.today) fresh[k] = r.today;
  });
  const pending = [];
  list.forEach(function (n) {
    if (fresh[n.dedupeKey]) return;
    fresh[n.dedupeKey] = r.today;
    pending.push(n);
  });
  if (!pending.length) return;
  chrome.storage.local.set({ mw_notified: fresh });
  pending.forEach(function (n, i) {
    chrome.notifications.create('mw-' + n.dedupeKey + '-' + i, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: n.title,
      message: n.message,
      priority: 2
    }, function () {});
  });
}

/* 点通知 → 直接把工作台带到前台（已有标签就聚焦，没有就开新的） */
chrome.notifications.onClicked.addListener(function () {
  chrome.tabs.query({ url: APP_URL + '*' }, function (tabs) {
    if (tabs && tabs.length) {
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: APP_URL });
    }
  });
});
