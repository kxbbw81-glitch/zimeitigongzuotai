/* ============================================================
   视图 · 首页（分发版）
   定位：打开就看两件事——今天该发什么、最近母稿分到哪了。
   深度操作去 AI 文案台（写母稿）和发布管理（检查与标记）。
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  MW.views['home'] = {
    id: 'home', name: '工作台', icon: 'bolt',
    sub: '今天该发的、最近在分的，一眼看全',
    render: function (root) {
      const db = MW.getDB();
      const t = MW.dateStr();
      const buckets = MW.pubBuckets(MW.curAcc());
      const cur = MW.curAcc();

      /* ---------- 问候 ---------- */
      const h = new Date().getHours();
      const greet = h < 6 ? '夜深了' : (h < 11 ? '早上好' : (h < 14 ? '中午好' : (h < 18 ? '下午好' : '晚上好')));
      const dueN = buckets.today.length + buckets.overdue.length;

      let html = '<div class="page-head"><div class="page-title">' + greet + '，今天有 ' + dueN + ' 条待发</div>' +
        '<div class="page-sub">' + t + ' ' + MW.weekdayCN(t) + (cur !== 'all' ? ' · 当前视角：' + MW.esc(MW.accName(cur)) : ' · 全部账号') + '</div>' +
        '<div class="page-head-actions">' +
        '<button class="btn" onclick="MW.goto(\'#/calendar\')">' + MW.icon('calendar', 14) + ' 内容日历</button>' +
        '<button class="btn primary" onclick="MW.goto(\'#/ai\')">' + MW.icon('sparkles', 14) + ' 写母稿</button>' +
        '</div></div>';

      /* ---------- 今日待发 ---------- */
      html += '<div class="card"><div class="card-head"><div class="card-title">' +
        MW.icon('clock', 15) + ' 今日待发</div>' +
        '<div class="card-extra"><a href="javascript:MW.goto(\'#/publish\')">去发布管理 →</a></div></div>';
      if (!dueN) {
        html += MW.ui.empty('今天没有待发内容', '去 AI 文案台写一篇母稿，一稿分发到各平台');
      } else {
        const all = buckets.overdue.concat(buckets.today);
        html += all.map(function (c) {
          const acc = MW.accOf(c.accountId);
          const pf = acc ? MW.pfOf(acc) : { name: '未指定', color: '#9aa0b4' };
          const ck = MW.checksOf(c);
          const late = c.date < t;
          const mm = MW.masterOf(c);
          return '<div class="hm-row' + (late ? ' late' : '') + '">' +
            '<span class="hm-time">' + MW.esc(c.time || '—') + '</span>' +
            '<span class="pf-chip sm" style="--pc:' + pf.color + '">' + MW.esc(pf.name) + '</span>' +
            '<span class="hm-title" title="' + MW.esc(c.title) + '">' + MW.esc(c.title) + '</span>' +
            (mm ? '<span class="pub-master adpt" title="适配自母稿：' + MW.esc(mm.title) + '">' + MW.icon('layers', 11) + ' 适配版</span>' : '') +
            (c.master ? '<span class="pub-master" title="多平台分发的原始素材">' + MW.icon('layers', 11) + ' 母稿</span>' : '') +
            '<span class="hm-checks">' + (ck.ready ? '<em class="mp-st ready">就绪</em>' : '<em class="mp-st">差 ' + (ck.total - ck.done) + ' 项</em>') + '</span>' +
            '<span class="hm-ops">' +
            '<button class="btn sm" onclick="MW.act.aiFromContent(\'' + c.id + '\')" title="带入这条内容写文案">' + MW.icon('edit', 12) + '</button>' +
            '<button class="btn sm primary" onclick="MW.act.pubMark(\'' + c.id + '\')">' + MW.icon('check', 12) + ' 发了</button>' +
            '</span></div>';
        }).join('');
      }
      html += '</div>';

      /* ---------- 最近母稿 ---------- */
      const ms = MW.masters().slice(0, 3);
      html += '<div class="card"><div class="card-head"><div class="card-title">' +
        MW.icon('layers', 15) + ' 最近母稿</div>' +
        '<div class="card-extra"><a href="javascript:MW.goto(\'#/ai\')">母稿总览 →</a></div></div>';
      if (!ms.length) {
        html += MW.ui.empty('暂无母稿', 'AI 文案台生成结果页点「一稿多发」，先存母稿再适配各账号');
      } else {
        html += ms.map(function (m) {
          const vers = MW.adaptationsOf(m.id);
          const src = MW.accOf(m.accountId);
          return '<div class="hm-master">' +
            '<span class="mp-badge">母稿</span>' +
            '<span class="hm-master-title" title="' + MW.esc(m.title) + '">' + MW.esc(m.title) + '</span>' +
            '<span class="hm-master-src">' + (src ? MW.esc(src.name) : '') + '</span>' +
            '<span class="hm-master-vers">' + vers.length + ' 个平台版本</span>' +
            '<button class="btn sm ghost" onclick="MW.act.adaptModal(\'' + m.id + '\')">' + MW.icon('layers', 12) + ' 适配账号</button>' +
            '</div>';
        }).join('');
      }
      html += '</div>';

      /* ---------- 账号节奏 ---------- */
      const accs = db.accounts.filter(function (a) { return cur === 'all' || a.id === cur; });
      if (accs.length) {
        html += '<div class="card"><div class="card-head"><div class="card-title">' +
          MW.icon('users', 15) + ' 账号节奏（本周）</div></div>';
        html += '<div class="hm-acc-grid">' + accs.map(function (a) {
          const cad = MW.cadenceOf(a);
          const sd = MW.silentDays(a);
          const silentLimit = (a.cadence ? Math.ceil(7 / a.cadence) : 3) + 2;
          const lp = MW.lastPublish(a.id);
          const bad = lp && sd >= silentLimit;
          const p = MW.pfOf(a);
          return '<div class="hm-acc">' +
            '<div class="hm-acc-name"><span class="pf-chip sm" style="--pc:' + p.color + '">' + MW.esc(p.name) + '</span>' +
            MW.esc(a.name) + '</div>' +
            '<div class="hm-acc-nums">' +
            '<span>本周 <b>' + cad.done + '/' + cad.goal + '</b> 篇</span>' +
            '<span>已排 <b>' + cad.planned + '</b> 篇</span>' +
            '<span class="' + (bad ? 'bad' : '') + '">' + (lp ? '断更 <b>' + sd + '</b> 天' : '未开张') + '</span>' +
            '</div>' +
            MW.ui.progress(cad.pct, p.color) +
            '</div>';
        }).join('') + '</div></div>';
      } else {
        html += '<div class="card">' + MW.ui.empty('还没有账号', '去「账号矩阵」把各平台账号和定位录进来，定位决定母稿改写成什么味道') + '</div>';
      }

      root.innerHTML = html;
    }
  };
})();
