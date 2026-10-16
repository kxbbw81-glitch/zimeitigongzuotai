/* 侧边栏：iframe 载入线上工作台（同 origin 数据互通，用户现有数据直接可用）。
   只做三件小事：加载失败给提示、刷新、新标签页打开；
   外加一件看不见的：把工作台广播的数据快照转交给后台——
   网页自己够不到 chrome.storage，提醒要用数据必须经这里中转。 */

(function () {
  var APP_URL = 'https://media-workbench-64130.app.workbuddy.host/';
  var APP_ORIGIN = 'https://media-workbench-64130.app.workbuddy.host';
  var frame = document.getElementById('frame');
  var mask = document.getElementById('mask');

  /* 只转发真正来自工作台 origin 的同步消息，别的页面发的不管 */
  window.addEventListener('message', function (ev) {
    if (!ev.data || ev.data.source !== 'mw-workbench' || ev.data.type !== 'mw-sync') return;
    if (ev.origin !== APP_ORIGIN) return;
    try {
      chrome.runtime.sendMessage({ type: 'mw-sync', db: ev.data.db, at: Date.now() });
    } catch (e) { /* 后台睡着了就等下一轮 */ }
  });

  var loaded = false;
  frame.addEventListener('load', function () {
    loaded = true;
    mask.classList.add('hide');
  });
  /* 10 秒还没起来，大概率是网络问题——给出路，不干等 */
  setTimeout(function () {
    if (!loaded) mask.classList.remove('hide');
  }, 10000);

  document.getElementById('btn-reload').addEventListener('click', function () {
    mask.classList.add('hide');
    frame.src = APP_URL;
  });
  document.getElementById('btn-retry').addEventListener('click', function () {
    mask.classList.add('hide');
    frame.src = APP_URL;
  });
  document.getElementById('btn-tab').addEventListener('click', function () {
    chrome.tabs.create({ url: APP_URL });
  });
})();
