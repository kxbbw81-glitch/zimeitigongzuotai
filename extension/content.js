/* 工作台标签页场景的数据中转：用户直接开标签页用线上版（不走侧边栏 iframe）时，
   由这里把页面广播的数据快照转交给后台。侧边栏 iframe 场景用不上这份——
   那种情况由 sidepanel.js 自己转发。 */

(function () {
  var APP_ORIGIN = 'https://media-workbench-64130.app.workbuddy.host';

  window.addEventListener('message', function (ev) {
    if (!ev.data || ev.data.source !== 'mw-workbench' || ev.data.type !== 'mw-sync') return;
    if (ev.origin !== APP_ORIGIN) return;
    try {
      chrome.runtime.sendMessage({ type: 'mw-sync', db: ev.data.db, at: Date.now() });
    } catch (e) { /* 后台休眠时消息自然丢弃，下次保存再来 */ }
  });
})();
