/* 工作台标签页场景的数据中转：用户直接开标签页用线上版（不走侧边栏 iframe）时，
   由这里把页面广播的数据快照转交给后台。侧边栏 iframe 场景用不上这份——
   那种情况由 sidepanel.js 自己转发。 */

(function () {
  var APP_ORIGIN = 'https://media-workbench-64130.app.workbuddy.host';

  window.addEventListener('message', function (ev) {
    if (!ev.data || ev.data.source !== 'mw-workbench') return;
    if (ev.origin !== APP_ORIGIN) return;
    /* ① 工作台 → 插件：数据快照 */
    if (ev.data.type === 'mw-sync') {
      try {
        chrome.runtime.sendMessage({ type: 'mw-sync', db: ev.data.db, at: Date.now() });
      } catch (e) { /* 后台休眠时消息自然丢弃，下次保存再来 */ }
    }
    /* ② 工作台 → 插件：转载捕获已收录，清空捕获箱 */
    if (ev.data.type === 'mw-capture-clear') {
      try {
        chrome.storage.local.set({ mw_capture_pending: [] });
      } catch (e) { /* 忽略 */ }
    }
  });

  /* ③ 插件 → 工作台：有新的转载捕获就递给页面，让用户一键收录 */
  function flushCaptures() {
    try {
      chrome.storage.local.get(['mw_capture_pending'], function (res) {
        var items = res.mw_capture_pending || [];
        if (!items.length) return;
        window.postMessage({ source: 'mw-extension', type: 'mw-capture', items: items }, APP_ORIGIN);
      });
    } catch (e) { /* 非插件环境（桌面版 file://）静默跳过 */ }
  }
  flushCaptures();
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local' && changes.mw_capture_pending) flushCaptures();
    });
  } catch (e) { /* 忽略 */ }
})();
