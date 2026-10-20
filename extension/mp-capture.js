/* 公众号文章页捕获脚本：把当前文章的信息读出来，等弹窗来取。
   只读页面、不注入任何样式，对阅读体验零影响。 */
(function () {
  function txt(sel) {
    var el = document.querySelector(sel);
    return el ? (el.textContent || '').trim() : '';
  }
  function meta(name) {
    var el = document.querySelector('meta[property="' + name + '"], meta[name="' + name + '"]');
    return el ? (el.getAttribute('content') || '').trim() : '';
  }

  function grab() {
    /* 标题：优先 og:title（干净），退化到 #activity-name，再退化到 document.title */
    var title = meta('og:title') || txt('#activity-name') || (document.title || '');
    /* document.title 常带「_公众号名」尾巴，去掉 */
    title = title.replace(/[_\-\s]*$/, '').trim();
    /* 账号名：#js_name 是文章页的公众号名 */
    var account = txt('#js_name') || txt('.rich_media_meta_nickname') || meta('og:article:author') || '';
    /* 发布日期：#publish_time（文章页） */
    var date = txt('#publish_time') || '';
    var url = location.href.split('#')[0];
    return { title: title, account: account, url: url, date: date, ok: !!(title && url) };
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === 'mw-capture-grab') {
      try { sendResponse(grab()); } catch (e) { sendResponse({ ok: false }); }
    }
    return false;
  });
})();
