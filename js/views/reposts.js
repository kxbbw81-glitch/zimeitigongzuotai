/* ============================================================
   视图 · 转载（关注来源账号 → 记录对方更新 → 一键转成带署名的选题）
   定位：内容不全是自己产的。把值得转载的账号盯住，
   对方一更新就记下来，趁时效转成选题走正常发布流程。
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  /* 更新记录的状态机：new 待处理 → planned 已转选题 → reposted 已转载（或 skip 不转载） */
  const POST_STATUS = {
    new:      { name: '待处理',   color: '#d97706', bg: '#fef3c7' },
    planned:  { name: '已转选题', color: '#4f46e5', bg: '#eef2ff' },
    reposted: { name: '已转载',   color: '#16a34a', bg: '#dcfce7' },
    skip:     { name: '不转载',   color: '#9aa0b4', bg: '#f1f2f6' }
  };
  const FILTERS = [
    { v: 'all', t: '全部' }, { v: 'new', t: '待处理' },
    { v: 'planned', t: '已转选题' }, { v: 'reposted', t: '已转载' }, { v: 'skip', t: '不转载' }
  ];
  let filter = 'all';

  MW.act.setRepostFilter = function (f) { filter = f; MW.render(); };

  function postsOf(s) { return s.posts || []; }
  function pendingOf(s) {
    return postsOf(s).filter(function (p) { return p.status === 'new'; }).length;
  }
  function findSource(db, id) {
    for (let i = 0; i < db.sources.length; i++) if (db.sources[i].id === id) return db.sources[i];
    return null;
  }

  /* ---------- 关注账号 ---------- */
  MW.act.openSourceModal = function (id) {
    const db = MW.getDB();
    const s = id ? findSource(db, id) : null;
    const body =
      MW.ui.row('账号名称', '<input id="sr-name" placeholder="对方账号的名字，如：数字生命卡兹克" value="' + MW.esc(s ? s.name : '') + '">') +
      '<div class="form-2col">' +
        MW.ui.row('平台', MW.ui.platformOptions('sr-platform', s ? s.platform : 'gzh')) +
        MW.ui.row('账号 ID / 主页', '<input id="sr-accountid" placeholder="公众号 ID 或主页链接" value="' + MW.esc(s ? s.accountId : '') + '">') +
      '</div>' +
      MW.ui.row('关注标签', '<input id="sr-tags" placeholder="多个标签用逗号分隔，如：AI工具, 前沿资讯" value="' + MW.esc(s ? (s.tags || []).join(', ') : '') + '">') +
      MW.ui.row('转载注意', '<textarea id="sr-note" rows="2" placeholder="转载授权情况、署名要求、对方的内容特点……">' + MW.esc(s ? s.note : '') + '</textarea>',
        '授权状态写清楚，发布前对照检查，避免侵权');

    MW.modal({
      title: s ? '编辑来源账号' : '添加关注账号',
      sub: '盯住值得转载的号，对方更新就记进来',
      body: body,
      okText: '保存',
      onOk: function (root) {
        const v = function (id2) { return (root.querySelector('#' + id2).value || '').trim(); };
        const name = v('sr-name');
        if (!name) { MW.toast('请填写账号名称', 'error'); return false; }
        const obj = {
          name: name,
          platform: v('sr-platform'),
          accountId: v('sr-accountid'),
          tags: v('sr-tags').split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean),
          note: v('sr-note'),
          updatedAt: MW.dateStr()
        };
        if (s) Object.assign(s, obj);
        else db.sources.push(Object.assign({ id: MW.uid(), posts: [], lastCheckedAt: '', createdAt: MW.dateStr() }, obj));
        MW.save(); MW.render();
        MW.toast(s ? '来源账号已更新' : '已关注，去「记更新」把对方的文章记进来');
      }
    });
  };

  MW.act.delSource = function (id) {
    const db = MW.getDB();
    const s = findSource(db, id);
    if (!s) return;
    const n = postsOf(s).length;
    MW.confirm('确定取消关注「' + s.name + '」？' + (n ? '旗下 ' + n + ' 条更新记录会一起删除。' : ''), function () {
      db.sources = db.sources.filter(function (x) { return x.id !== id; });
      MW.save(); MW.render();
      MW.toast('已取消关注');
    }, { okText: '取消关注' });
  };

  /* 记录一次检查：不新增内容，只把「我来看过了」的时间记下 */
  MW.act.checkSource = function (id) {
    const db = MW.getDB();
    const s = findSource(db, id);
    if (!s) return;
    s.lastCheckedAt = MW.dateStr();
    s.updatedAt = MW.dateStr();
    MW.save(); MW.render();
    MW.toast('已记录检查：' + MW.dateStr() + '，有新文章就点「记更新」');
  };

  /* ---------- 记录对方更新 ---------- */
  MW.act.openSourcePostModal = function (sourceId, postId) {
    const db = MW.getDB();
    const s = findSource(db, sourceId);
    if (!s) return;
    const p = postId ? postsOf(s).find(function (x) { return x.id === postId; }) : null;
    const body =
      MW.ui.row('文章标题', '<input id="sp-title" placeholder="对方这篇文章的标题" value="' + MW.esc(p ? p.title : '') + '">') +
      MW.ui.row('原文链接', '<input id="sp-link" placeholder="https://mp.weixin.qq.com/s/……" value="' + MW.esc(p ? p.link : '') + '">',
        '用浏览器插件在公众号文章页可一键捕获，不用手抄') +
      '<div class="form-2col">' +
        MW.ui.row('对方发布日期', '<input id="sp-date" type="date" value="' + (p ? p.publishedAt : MW.dateStr()) + '">') +
        MW.ui.row('状态', MW.ui.select('sp-status', FILTERS.filter(function (f) { return f.v !== 'all'; }).map(function (f) {
          return { v: f.v, t: POST_STATUS[f.v].name };
        }), p ? p.status : 'new')) +
      '</div>' +
      MW.ui.row('备注', '<input id="sp-note" placeholder="为什么值得转载 / 授权进展 / 二创思路" value="' + MW.esc(p ? p.note : '') + '">');

    MW.modal({
      title: p ? '编辑更新记录' : '记录「' + s.name + '」的更新',
      sub: '对方一发新文章就记在这里，趁时效处理',
      body: body,
      okText: '保存',
      onOk: function (root) {
        const v = function (id2) { return (root.querySelector('#' + id2).value || '').trim(); };
        const title = v('sp-title');
        if (!title) { MW.toast('请填写文章标题', 'error'); return false; }
        const obj = {
          title: title,
          link: v('sp-link'),
          publishedAt: v('sp-date') || MW.dateStr(),
          status: v('sp-status') || 'new',
          note: v('sp-note')
        };
        if (p) Object.assign(p, obj);
        else postsOf(s).push(Object.assign({ id: MW.uid(), capturedAt: MW.dateStr() }, obj));
        s.updatedAt = MW.dateStr();
        MW.save(); MW.render();
        MW.toast(p ? '记录已更新' : '已记录，可一键转成选题');
      }
    });
  };

  MW.act.delSourcePost = function (sourceId, postId) {
    const db = MW.getDB();
    const s = findSource(db, sourceId);
    if (!s) return;
    MW.confirm('确定删除这条更新记录？', function () {
      s.posts = postsOf(s).filter(function (x) { return x.id !== postId; });
      s.updatedAt = MW.dateStr();
      MW.save(); MW.render();
      MW.toast('已删除');
    }, { okText: '删除' });
  };

  /* ---------- 一键转选题（转载工作流的核心一步） ---------- */
  MW.act.repostToTopic = function (sourceId, postId) {
    const db = MW.getDB();
    const s = findSource(db, sourceId);
    const p = s ? postsOf(s).find(function (x) { return x.id === postId; }) : null;
    if (!s || !p) return;
    if (p.status === 'planned') { MW.toast('这条已经转成选题了，去选题看板看看', 'error'); return; }
    if (p.status === 'reposted') { MW.toast('这条已经转载过了，不必重复转选题', 'error'); return; }

    /* 归属账号：优先当前视角；没定就优先公众号，再退到第一个账号 */
    let accId = MW.curAcc();
    if (accId === 'all' || !db.accounts.some(function (a) { return a.id === accId; })) {
      const gzh = db.accounts.find(function (a) { return a.platform === 'gzh'; });
      accId = gzh ? gzh.id : (db.accounts[0] ? db.accounts[0].id : '');
    }
    if (!accId) { MW.toast('先在账号矩阵添加账号', 'error'); return; }

    db.topics.push({
      id: MW.uid(), title: p.title, accountId: accId, type: 'review',
      stage: 'idea', priority: 'mid', due: '', owner: '我',
      focus: MW.guessFocus(accId, p.title),
      note: '转载自：' + s.name + (p.link ? '\n原文：' + p.link : '') + '\n转载前请确认已获授权，发布时注明来源。',
      repostFrom: { sourceId: s.id, sourceName: s.name, postId: p.id, link: p.link || '' },
      createdAt: MW.dateStr()
    });
    p.status = 'planned';
    s.updatedAt = MW.dateStr();
    MW.save(); MW.render();
    MW.toast('已转为转载选题（选题看板 · 灵感池），署名信息已带上');
  };

  MW.act.setPostStatus = function (sourceId, postId, status) {
    const db = MW.getDB();
    const s = findSource(db, sourceId);
    const p = s ? postsOf(s).find(function (x) { return x.id === postId; }) : null;
    if (!s || !p || p.status === status) return;
    p.status = status;
    s.updatedAt = MW.dateStr();
    MW.save(); MW.render();
    MW.toast('已标记为「' + POST_STATUS[status].name + '」');
  };

  /* ---------- 收录浏览器插件捕获的转载候选 ----------
     插件在公众号文章页一键捕获后存进捕获箱，用户打开工作台时在这里落地：
     按 id / 名字找来源账号，找不到就地新建；同一链接不重复收录。 */
  MW.act.importCaptures = function (items) {
    const db = MW.getDB();
    let added = 0, skipped = 0, newSrc = 0;
    (items || []).forEach(function (it) {
      if (!it || !it.title) return;
      let s = it.sourceId ? findSource(db, it.sourceId) : null;
      if (!s && it.sourceName) {
        s = db.sources.find(function (x) { return x.name === it.sourceName; }) || null;
      }
      if (!s) {
        const meta = it.newSource || {};
        s = {
          id: MW.uid(), name: it.sourceName || meta.name || '未命名来源',
          platform: meta.platform || 'gzh', accountId: meta.accountId || '',
          tags: [], note: '由浏览器插件捕获时自动创建，请补充授权情况',
          posts: [], lastCheckedAt: MW.dateStr(), createdAt: MW.dateStr(), updatedAt: MW.dateStr()
        };
        db.sources.push(s);
        newSrc++;
      }
      if (it.link && postsOf(s).some(function (p) { return p.link === it.link; })) { skipped++; return; }
      postsOf(s).push({
        id: MW.uid(), title: it.title, link: it.link || '',
        publishedAt: it.publishedAt || MW.dateStr(), capturedAt: MW.dateStr(),
        status: 'new', note: ''
      });
      s.updatedAt = MW.dateStr();
      added++;
    });
    MW.save(); MW.render();
    /* 让插件清空捕获箱（content.js 在页面里转发给后台） */
    try {
      window.postMessage({ source: 'mw-workbench', type: 'mw-capture-clear' }, location.origin || '*');
    } catch (e) { /* 非插件环境（如桌面版）忽略 */ }
    const banner = document.querySelector('.mw-cap-banner');
    if (banner) banner.remove();
    let msg = '已收录 ' + added + ' 条转载更新';
    if (newSrc) msg += '，新建 ' + newSrc + ' 个来源账号';
    if (skipped) msg += '，' + skipped + ' 条已存在自动跳过';
    MW.toast(msg);
    if (added) MW.goto('#/reposts');
  };

  /* ---------- 视图 ---------- */
  MW.views['reposts'] = {
    id: 'reposts', name: '转载', icon: 'paste',
    sub: '关注来源账号，及时转载优质内容',
    render: function (root) {
      const db = MW.getDB();
      const pending = MW.pendingReposts();

      let html = '<div class="page-head"><div class="page-title">转载</div>' +
        '<div class="page-sub">关注 ' + db.sources.length + ' 个来源账号 · <b class="rp-pending-n">' + pending + '</b> 条更新待处理</div>' +
        '<div class="page-head-actions">' +
        '<button class="btn primary" onclick="MW.act.openSourceModal()">' + MW.icon('plus', 14) + ' 添加关注账号</button>' +
        '</div></div>';

      /* 首次使用的引导卡：说清三步 + 授权红线 */
      if (!db.sources.length) {
        html += '<div class="card rp-guide"><div class="card-title">' + MW.icon('paste', 15) + ' 转载三步走</div>' +
          '<div class="rp-steps">' +
          '<div class="rp-step"><b>1 · 关注账号</b><span>把值得转载的号加进来，写清授权情况</span></div>' +
          '<div class="rp-step"><b>2 · 记录更新</b><span>对方一发新文章就记下标题和链接（浏览器插件可一键捕获）</span></div>' +
          '<div class="rp-step"><b>3 · 一键转选题</b><span>带上署名信息进选题看板，走正常发布流程</span></div>' +
          '</div>' +
          '<div class="rp-warn">' + MW.icon('flag', 13) + ' 转载必须先取得对方授权，发布时注明来源；未获授权的文章不要直接转。</div>' +
          '</div>';
      }

      /* ---------- 来源账号 ---------- */
      if (db.sources.length) {
        html += '<div class="card"><div class="card-head">' +
          '<div class="card-title">' + MW.icon('eye', 15) + ' 关注的来源账号</div>' +
          '<div class="card-extra"><span class="rp-chip info">' + db.sources.length + ' 个账号</span></div></div>' +
          '<div class="src-grid">';
        db.sources.forEach(function (s) {
          const pn = pendingOf(s);
          const pf = MW.pfOf(s);
          html += '<div class="src-card">' +
            '<div class="src-top">' +
              '<span class="src-name">' + MW.esc(s.name) + '</span>' +
              MW.ui.pfChip(s.platform, true) +
              (pn ? '<span class="src-pending">' + pn + ' 条待处理</span>' : '') +
            '</div>' +
            '<div class="src-id">' + MW.esc(s.accountId || '未填账号 ID') + '</div>' +
            ((s.tags || []).length
              ? '<div class="src-tags">' + s.tags.map(function (t) { return '<span class="src-tag">' + MW.esc(t) + '</span>'; }).join('') + '</div>'
              : '') +
            (s.note ? '<div class="src-note" title="' + MW.esc(s.note) + '">' + MW.esc(s.note) + '</div>' : '') +
            '<div class="src-foot">' +
              '<span class="src-checked">' + (s.lastCheckedAt ? '最近检查 ' + s.lastCheckedAt.slice(5) : '尚未检查过') + '</span>' +
              '<span class="src-ops">' +
              '<button class="btn sm primary" onclick="MW.act.openSourcePostModal(\'' + s.id + '\')">' + MW.icon('plus', 12) + ' 记更新</button>' +
              '<button class="btn sm" onclick="MW.act.checkSource(\'' + s.id + '\')" title="记录今天检查过这个账号">检查过了</button>' +
              '<button class="btn sm" onclick="MW.act.openSourceModal(\'' + s.id + '\')">编辑</button>' +
              '<button class="btn sm danger-ghost" onclick="MW.act.delSource(\'' + s.id + '\')">' + MW.icon('trash', 12) + '</button>' +
              '</span>' +
            '</div></div>';
        });
        html += '</div></div>';
      }

      /* ---------- 转载动态 ---------- */
      const all = [];
      db.sources.forEach(function (s) {
        postsOf(s).forEach(function (p) {
          all.push({ p: p, s: s });
        });
      });
      all.sort(function (a, b) {
        return (b.p.publishedAt || '').localeCompare(a.p.publishedAt || '');
      });
      const shown = filter === 'all' ? all : all.filter(function (x) { return x.p.status === filter; });
      const cnt = function (f) {
        return f === 'all' ? all.length : all.filter(function (x) { return x.p.status === f; }).length;
      };

      html += '<div class="card table-card"><div class="card-head">' +
        '<div class="card-title">' + MW.icon('paste', 15) + ' 转载动态</div>' +
        '<div class="card-extra rp-filters">' +
        FILTERS.map(function (f) {
          const n = cnt(f.v);
          return '<button class="rp-chip' + (filter === f.v ? ' on' : '') + (f.v === 'new' && n ? ' hot' : '') + '"' +
            ' onclick="MW.act.setRepostFilter(\'' + f.v + '\')">' + f.t + ' ' + n + '</button>';
        }).join('') +
        '</div></div>';

      if (!db.sources.length) {
        html += MW.ui.empty('尚未关注任何来源账号', '点右上角「添加关注账号」开始盯号');
      } else if (!shown.length) {
        html += MW.ui.empty(filter === 'all' ? '还没有记录任何更新' : '该状态下暂无记录',
          filter === 'all' ? '在账号卡上点「记更新」，把对方的新文章记进来' : '切换上方筛选看看其他状态');
      } else {
        html += '<table class="table"><thead><tr>' +
          '<th>来源</th><th>标题</th><th>发布日期</th><th>状态</th><th>操作</th>' +
          '</tr></thead><tbody>';
        shown.forEach(function (x) {
          const p = x.p, s = x.s, st = POST_STATUS[p.status] || POST_STATUS.new;
          html += '<tr>' +
            '<td><div class="rp-src">' + MW.esc(s.name) + '</div>' +
              '<div class="rp-src-pf">' + MW.ui.pfChip(s.platform, true) + '</div></td>' +
            '<td><div class="rp-title">' + MW.esc(p.title) + '</div>' +
              (p.link ? '<a class="rp-link" href="' + MW.esc(p.link) + '" target="_blank" rel="noopener">' + MW.icon('link', 11) + ' 原文</a>' : '') +
              (p.note ? '<div class="rp-note">' + MW.esc(p.note) + '</div>' : '') + '</td>' +
            '<td>' + (p.publishedAt || '--') + '</td>' +
            '<td><span class="rp-status" style="color:' + st.color + ';background:' + st.bg + '">' + st.name + '</span></td>' +
            '<td class="td-actions">' +
              (p.status === 'new'
                ? '<button class="btn sm primary" onclick="MW.act.repostToTopic(\'' + s.id + '\', \'' + p.id + '\')">' + MW.icon('paste', 12) + ' 转选题</button>'
                : '') +
              (p.status === 'planned'
                ? '<button class="btn sm" onclick="MW.act.setPostStatus(\'' + s.id + '\', \'' + p.id + '\', \'reposted\')">' + MW.icon('check', 12) + ' 已转载</button>'
                : '') +
              (p.status === 'new' || p.status === 'reposted'
                ? '<button class="btn sm" onclick="MW.act.setPostStatus(\'' + s.id + '\', \'' + p.id + '\', \'skip\')">不转载</button>'
                : '') +
              (p.status === 'skip'
                ? '<button class="btn sm" onclick="MW.act.setPostStatus(\'' + s.id + '\', \'' + p.id + '\', \'new\')">重新处理</button>'
                : '') +
              '<button class="btn sm" onclick="MW.act.openSourcePostModal(\'' + s.id + '\', \'' + p.id + '\')">编辑</button>' +
              '<button class="btn sm danger-ghost" onclick="MW.act.delSourcePost(\'' + s.id + '\', \'' + p.id + '\')">' + MW.icon('trash', 12) + '</button>' +
            '</td></tr>';
        });
        html += '</tbody></table>';
      }
      html += '</div>';

      /* 底部提示：授权红线常驻 */
      if (db.sources.length) {
        html += '<div class="rp-warn bottom">' + MW.icon('flag', 13) +
          ' 转载前请确认已获对方授权，发布时注明来源；授权状态有变化，记得更新账号卡上的「转载注意」。</div>';
      }

      root.innerHTML = html;
    }
  };
})();
