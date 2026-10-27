/* ============================================================
   视图 · 竞品库（分发版）
   追踪同赛道账号：粉丝数据 + 内容动态 + 打法策略。
   分发前先看清对标账号在发什么，母稿才改得有针对性。
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  /* 分发版不引 charts.js，粉丝趋势用内联 SVG 画（8 行，够用） */
  function sparkline(values, color, w, h) {
    w = w || 92; h = h || 30;
    const vs = (values || []).map(function (v) { return +v || 0; });
    if (vs.length < 2) return '<span style="color:var(--text3);font-size:11px">数据不足</span>';
    const min = Math.min.apply(null, vs), max = Math.max.apply(null, vs);
    const span = max - min || 1;
    const pts = vs.map(function (v, i) {
      return (i / (vs.length - 1) * (w - 6) + 3) + ',' + (h - 4 - (v - min) / span * (h - 8));
    }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" style="display:block">' +
      '<polyline points="' + pts + '" fill="none" stroke="' + (color || 'var(--primary)') + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  /* 竞品的内容动态按发布日期倒序（新发的在前） */
  function postsOf(c) {
    return (c.posts || []).slice().sort(function (a, b) {
      return (b.publishedAt || '').localeCompare(a.publishedAt || '');
    });
  }
  MW.compPostsOf = postsOf;

  MW.act.openCompetitorModal = function (id) {
    const db = MW.getDB();
    const c = id ? db.competitors.find(function (x) { return x.id === id; }) : null;
    const body =
      MW.ui.row('账号名称', '<input id="cp-name" placeholder="对标账号的名字" value="' + MW.esc(c ? c.name : '') + '">') +
      '<div class="form-2col">' +
        MW.ui.row('平台', MW.ui.platformOptions('cp-platform', c ? c.platform : 'xhs')) +
        MW.ui.row('账号 ID / 链接', '<input id="cp-accountid" placeholder="主页链接或 ID" value="' + MW.esc(c ? c.accountId : '') + '">') +
      '</div>' +
      '<div class="form-2col">' +
        MW.ui.row('所属赛道', '<input id="cp-category" placeholder="例如：手作教程 / 厨房好物" value="' + MW.esc(c ? c.category : '') + '">') +
        MW.ui.row('粉丝数', '<input id="cp-followers" type="number" min="0" value="' + (c ? c.followers : 0) + '">') +
      '</div>' +
      '<div class="form-2col">' +
        MW.ui.row('更新频率', '<input id="cp-freq" placeholder="例如：日更 / 周3更" value="' + MW.esc(c ? c.freq : '') + '">') +
        MW.ui.row('对标等级', MW.ui.select('cp-level', [{ v: '核心对标', t: '核心对标' }, { v: '一般关注', t: '一般关注' }], c ? (c.level || '核心对标') : '核心对标')) +
      '</div>' +
      MW.ui.row('打法与内容策略', '<textarea id="cp-strategy" rows="3" placeholder="他靠什么起量？选题套路、封面风格、变现路径……">' + MW.esc(c ? c.strategy : '') + '</textarea>', '定期回来更新，这是竞品库的核心价值');

    MW.modal({
      title: c ? '编辑竞品' : '添加竞品',
      sub: '不是抄，是看清差距在哪',
      body: body,
      okText: '保存',
      onOk: function (root) {
        const v = function (id2) { return (root.querySelector('#' + id2).value || '').trim(); };
        const name = v('cp-name');
        if (!name) { MW.toast('请填写账号名称', 'error'); return false; }
        const obj = {
          platform: v('cp-platform'), name: name, accountId: v('cp-accountid'),
          category: v('cp-category'), followers: +v('cp-followers') || 0,
          freq: v('cp-freq'), level: v('cp-level') || '核心对标',
          strategy: v('cp-strategy'), updatedAt: MW.dateStr()
        };
        if (c) {
          const changed = c.followers !== obj.followers;
          Object.assign(c, obj);
          if (changed) {
            c.snapshots = c.snapshots || [];
            c.snapshots.push({ date: MW.dateStr(), followers: obj.followers });
          }
        } else {
          db.competitors.push(Object.assign({ id: MW.uid(), snapshots: [{ date: MW.dateStr(), followers: +obj.followers || 0 }], posts: [] }, obj));
        }
        MW.save(); MW.render();
        MW.toast(c ? '竞品已更新' : '竞品已添加');
      }
    });
  };

  MW.act.openSnapshotModal = function (id) {
    const db = MW.getDB();
    const c = db.competitors.find(function (x) { return x.id === id; });
    if (!c) return;
    const body =
      MW.ui.row('记录日期', '<input id="sn-date" type="date" value="' + MW.dateStr() + '">') +
      MW.ui.row('当前粉丝数', '<input id="sn-followers" type="number" min="0" value="' + c.followers + '">', '每周固定记一次，就能看到增长趋势');
    MW.modal({
      title: '记录粉丝快照',
      sub: c.name,
      body: body,
      okText: '记录',
      onOk: function (root) {
        const date = root.querySelector('#sn-date').value;
        const f = +root.querySelector('#sn-followers').value || 0;
        c.followers = f;
        c.updatedAt = date || MW.dateStr();
        c.snapshots = c.snapshots || [];
        c.snapshots.push({ date: date || MW.dateStr(), followers: f });
        MW.save(); MW.render();
        MW.toast('快照已记录');
      }
    });
  };

  /* ---------- 竞品内容动态：记一条 / 删一条 ---------- */
  MW.act.openCompPostModal = function (compId, postId) {
    const db = MW.getDB();
    const c = db.competitors.find(function (x) { return x.id === compId; });
    if (!c) return;
    const p = postId ? postsOf(c).find(function (x) { return x.id === postId; }) : null;
    const body =
      MW.ui.row('内容标题', '<input id="cpp-title" placeholder="对方这篇内容的标题" value="' + MW.esc(p ? p.title : '') + '">') +
      '<div class="form-2col">' +
        MW.ui.row('内容链接', '<input id="cpp-link" placeholder="粘贴原文链接，回头看原文用" value="' + MW.esc(p ? p.link || '' : '') + '">') +
        MW.ui.row('发布日期', '<input id="cpp-date" type="date" value="' + (p ? p.publishedAt : MW.dateStr()) + '">') +
      '</div>' +
      '<div class="form-3col">' +
        MW.ui.row('点赞', '<input id="cpp-likes" type="number" min="0" value="' + (p ? p.likes || 0 : 0) + '">') +
        MW.ui.row('评论', '<input id="cpp-comments" type="number" min="0" value="' + (p ? p.comments || 0 : 0) + '">') +
        MW.ui.row('收藏', '<input id="cpp-saves" type="number" min="0" value="' + (p ? p.saves || 0 : 0) + '">') +
      '</div>' +
      MW.ui.row('观察笔记', '<textarea id="cpp-note" rows="3" placeholder="这条为什么数据好？选题、封面、钩子还是节奏？我能学到什么……">' + MW.esc(p ? p.note || '' : '') + '</textarea>', '写下你的判断，下次翻回来就是素材');

    MW.modal({
      title: p ? '编辑内容动态' : '记一条内容动态',
      sub: c.name,
      body: body,
      okText: '保存',
      onOk: function (root) {
        const v = function (id2) { return (root.querySelector('#' + id2).value || '').trim(); };
        const title = v('cpp-title');
        if (!title) { MW.toast('请填写内容标题', 'error'); return false; }
        const obj = {
          title: title, link: v('cpp-link'), publishedAt: v('cpp-date') || MW.dateStr(),
          likes: +v('cpp-likes') || 0, comments: +v('cpp-comments') || 0, saves: +v('cpp-saves') || 0,
          note: v('cpp-note')
        };
        c.posts = c.posts || [];
        if (p) {
          Object.assign(p, obj);
        } else {
          c.posts.push(Object.assign({ id: MW.uid() }, obj));
        }
        MW.save(); MW.render();
        MW.toast(p ? '动态已更新' : '已记录');
      }
    });
  };

  MW.act.delCompPost = function (compId, postId) {
    const db = MW.getDB();
    const c = db.competitors.find(function (x) { return x.id === compId; });
    if (!c) return;
    MW.confirm('确定删除这条内容动态？', function () {
      c.posts = (c.posts || []).filter(function (x) { return x.id !== postId; });
      MW.save(); MW.render();
      MW.toast('已删除');
    }, { okText: '删除' });
  };

  MW.act.delCompetitor = function (id) {
    const db = MW.getDB();
    MW.confirm('确定删除这个竞品？其内容动态记录会一并删除。', function () {
      db.competitors = db.competitors.filter(function (x) { return x.id !== id; });
      MW.save(); MW.render();
      MW.toast('已删除');
    }, { okText: '删除' });
  };

  /* ---------- 竞品详情：账号数据 + 内容动态 ---------- */
  MW.act.openCompDetail = function (id) {
    const db = MW.getDB();
    const c = db.competitors.find(function (x) { return x.id === id; });
    if (!c) return;
    const snaps = c.snapshots || [];
    const delta = snaps.length >= 2 ? snaps[snaps.length - 1].followers - snaps[snaps.length - 2].followers : 0;
    const posts = postsOf(c);

    let html = '<div class="cpd-head">' +
      '<div class="cpd-name">' + MW.esc(c.name) +
        '<span class="cp-level' + (c.level === '一般关注' ? ' gray' : '') + '">' + MW.esc(c.level || '核心对标') + '</span></div>' +
      '<div class="cpd-meta">' + MW.ui.pfChip(c.platform, true) +
        '<span class="cpd-cat">' + MW.esc(c.category || '未分类') + '</span>' +
        '<span class="cpd-id">' + MW.esc(c.accountId || '未填账号 ID') + '</span></div>' +
      '</div>' +

      '<div class="cpd-stats">' +
        '<div class="cpd-stat"><b>' + MW.fmt.num(c.followers) + '</b><span>粉丝</span></div>' +
        '<div class="cpd-stat"><b class="' + (delta >= 0 ? 'up' : 'down') + '">' + (delta >= 0 ? '+' : '') + MW.fmt.num(delta) + '</b><span>较上次快照</span></div>' +
        '<div class="cpd-stat"><b>' + posts.length + '</b><span>条内容动态</span></div>' +
        '<div class="cpd-stat"><b>' + MW.esc(c.freq || '--') + '</b><span>更新频率</span></div>' +
      '</div>' +

      (snaps.length >= 2 ? '<div class="cpd-trend"><div class="cpd-sec-title">' + MW.icon('trend', 13) + ' 粉丝趋势</div>' +
        sparkline(snaps.slice(-8).map(function (s) { return s.followers; }), 'var(--primary)') + '</div>' : '') +

      (c.strategy ? '<div class="cpd-strat"><div class="cpd-sec-title">' + MW.icon('target', 13) + ' 打法与内容策略</div>' +
        '<div class="cpd-strat-text">' + MW.esc(c.strategy) + '</div></div>' : '') +

      '<div class="cpd-sec-title cpd-posts-title">' + MW.icon('file', 13) + ' 内容动态（' + posts.length + '）</div>';

    if (!posts.length) {
      html += '<div class="cpd-empty">还没有记录过对方的内容。刷到值得研究的爆款或反常操作，就记一条——标题、链接、互动数据和你的判断。</div>';
    } else {
      html += posts.map(function (p) {
        const nums = (p.likes ? '赞 ' + MW.fmt.num(p.likes) + ' · ' : '') +
          (p.comments ? '评 ' + MW.fmt.num(p.comments) + ' · ' : '') +
          (p.saves ? '藏 ' + MW.fmt.num(p.saves) : '');
        return '<div class="cpp-row">' +
          '<div class="cpp-top">' +
            '<span class="cpp-date">' + MW.esc((p.publishedAt || '').slice(5)) + '</span>' +
            (p.link
              ? '<a class="cpp-title" href="' + MW.esc(p.link) + '" target="_blank" rel="noopener" title="打开原文">' + MW.esc(p.title) + ' ↗</a>'
              : '<span class="cpp-title">' + MW.esc(p.title) + '</span>') +
            (nums ? '<span class="cpp-nums">' + nums.replace(/ · $/, '') + '</span>' : '') +
          '</div>' +
          (p.note ? '<div class="cpp-note">' + MW.icon('note', 12) + ' ' + MW.esc(p.note) + '</div>' : '') +
          '<div class="cpp-ops">' +
            '<button class="btn sm" onclick="MW.act.openCompPostModal(\'' + c.id + '\',\'' + p.id + '\')">编辑</button>' +
            '<button class="btn sm danger-ghost" onclick="MW.act.delCompPost(\'' + c.id + '\',\'' + p.id + '\')">删除</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    MW.modal({
      title: '竞品详情',
      sub: '数据与内容，分开看',
      body: '<div class="cpd">' + html + '</div>',
      footer: false
    });
    /* 自定义底部操作条 */
    const root = document.getElementById('modal-root');
    const foot = document.createElement('div');
    foot.className = 'modal-foot';
    foot.innerHTML = '<div class="modal-foot-extra">' +
      '<button class="btn" id="cpd-snap">记粉丝快照</button>' +
      '<button class="btn" id="cpd-edit">编辑账号</button>' +
      '<button class="btn primary" id="cpd-add">' + MW.icon('plus', 13) + ' 记一条内容动态</button>' +
      '<button class="btn" id="cpd-close">关闭</button></div>';
    root.querySelector('.modal').appendChild(foot);
    document.getElementById('cpd-snap').onclick = function () { MW.act.openSnapshotModal(c.id); };
    document.getElementById('cpd-edit').onclick = function () { MW.act.openCompetitorModal(c.id); };
    document.getElementById('cpd-add').onclick = function () { MW.act.openCompPostModal(c.id); };
    document.getElementById('cpd-close').onclick = MW.closeModal;
  };

  MW.views['competitors'] = {
    id: 'competitors', name: '竞品库', icon: 'eye',
    sub: '追踪同赛道账号的粉丝数据与内容动态，对比打法',
    render: function (root) {
      const db = MW.getDB();
      const totalPosts = db.competitors.reduce(function (n, c) { return n + (c.posts || []).length; }, 0);

      let html = '<div class="page-head"><div class="page-title">竞品库</div>' +
        '<div class="page-sub">' + db.competitors.length + ' 个对标账号 · ' + totalPosts + ' 条内容动态 · 建议每周记录一次粉丝快照</div>' +
        '<button class="btn primary" onclick="MW.act.openCompetitorModal()">' + MW.icon('plus', 14) + ' 添加竞品</button></div>';

      if (!db.competitors.length) {
        html += MW.ui.empty('暂无竞品', '添加同赛道账号，持续追踪其运营策略与内容动态');
        root.innerHTML = html;
        return;
      }

      html += '<div class="card table-card"><table class="table"><thead><tr>' +
        '<th>账号</th><th>平台</th><th>赛道</th><th>粉丝趋势</th><th>粉丝数</th><th>更新频率</th><th>内容动态</th><th>打法与策略</th><th>更新于</th><th>操作</th>' +
        '</tr></thead><tbody>';

      db.competitors.forEach(function (c) {
        const snaps = (c.snapshots || []).slice(-6);
        const delta = snaps.length >= 2 ? snaps[snaps.length - 1].followers - snaps[snaps.length - 2].followers : 0;
        const posts = postsOf(c);
        const last = posts.length ? posts[0] : null;
        html += '<tr>' +
          '<td><div class="cp-name">' + MW.esc(c.name) +
            '<span class="cp-level' + (c.level === '一般关注' ? ' gray' : '') + '">' + MW.esc(c.level || '核心对标') + '</span></div>' +
            '<div class="cp-id">' + MW.esc(c.accountId || '') + '</div></td>' +
          '<td>' + MW.ui.pfChip(c.platform, true) + '</td>' +
          '<td><span class="cp-cat">' + MW.esc(c.category || '--') + '</span></td>' +
          '<td>' + sparkline(snaps.map(function (s) { return s.followers; }), 'var(--primary)') + '</td>' +
          '<td><b>' + MW.fmt.num(c.followers) + '</b><span class="' + (delta >= 0 ? 'up' : 'down') + '">' + (delta >= 0 ? '+' : '') + MW.fmt.num(delta) + '</span></td>' +
          '<td>' + MW.esc(c.freq || '--') + '</td>' +
          '<td><button class="btn sm cp-posts-btn" onclick="MW.act.openCompDetail(\'' + c.id + '\')" title="查看内容动态">' +
            (posts.length ? '<b>' + posts.length + '</b> 条' : '记动态') +
            (last ? '<span class="cp-posts-last">最近 ' + MW.esc((last.publishedAt || '').slice(5)) + '</span>' : '') +
          '</button></td>' +
          '<td class="cp-strategy">' + MW.esc(c.strategy || '--') + '</td>' +
          '<td>' + (c.updatedAt || '--').slice(5) + '</td>' +
          '<td class="td-actions"><button class="btn sm" onclick="MW.act.openCompDetail(\'' + c.id + '\')">详情</button>' +
          '<button class="btn sm" onclick="MW.act.openSnapshotModal(\'' + c.id + '\')">记快照</button>' +
          '<button class="btn sm" onclick="MW.act.openCompetitorModal(\'' + c.id + '\')">编辑</button>' +
          '<button class="btn sm danger-ghost" onclick="MW.act.delCompetitor(\'' + c.id + '\')">' + MW.icon('trash', 12) + '</button></td>' +
          '</tr>';
      });

      html += '</tbody></table></div>';

      /* ---------- 跨竞品的内容动态流 ---------- */
      const feed = [];
      db.competitors.forEach(function (c) {
        (c.posts || []).forEach(function (p) {
          feed.push({ c: c, p: p });
        });
      });
      feed.sort(function (a, b) {
        return (b.p.publishedAt || '').localeCompare(a.p.publishedAt || '');
      });

      if (feed.length) {
        html += '<div class="card compare-card"><div class="card-head"><div class="card-title">' +
          MW.icon('flame', 15) + ' 竞品内容动态 · 最近记录</div>' +
          '<div class="card-extra"><span class="rp-chip info">' + feed.length + ' 条</span></div></div>' +
          '<div class="cf-list">' +
          feed.slice(0, 8).map(function (it) {
            const p = it.p;
            const nums = (p.likes ? '赞 ' + MW.fmt.num(p.likes) + ' · ' : '') +
              (p.comments ? '评 ' + MW.fmt.num(p.comments) + ' · ' : '') +
              (p.saves ? '藏 ' + MW.fmt.num(p.saves) : '');
            return '<div class="cf-row" onclick="MW.act.openCompDetail(\'' + it.c.id + '\')" title="查看 ' + MW.esc(it.c.name) + ' 的全部动态">' +
              '<span class="cf-who">' + MW.esc(it.c.name) + '</span>' +
              '<span class="cf-date">' + MW.esc((p.publishedAt || '').slice(5)) + '</span>' +
              (p.link
                ? '<a class="cf-title" href="' + MW.esc(p.link) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">' + MW.esc(p.title) + ' ↗</a>'
                : '<span class="cf-title">' + MW.esc(p.title) + '</span>') +
              (nums ? '<span class="cf-nums">' + nums.replace(/ · $/, '') + '</span>' : '') +
              (p.note ? '<span class="cf-note" title="' + MW.esc(p.note) + '">' + MW.icon('note', 11) + ' ' + MW.esc(p.note) + '</span>' : '') +
            '</div>';
          }).join('') +
          '</div></div>';
      }

      /* 策略对比提示 */
      html += '<div class="card compare-card"><div class="card-title">' + MW.icon('target', 15) + ' 对标结论（建议每周填一次）</div>' +
        '<div class="compare-grid">' +
        db.competitors.slice(0, 4).map(function (c) {
          return '<div class="compare-item"><div class="compare-name">' + MW.esc(c.name) + '</div>' +
            '<div class="compare-q">他最值得我学的一点：</div><div class="compare-a">' + MW.esc((c.strategy || '').split('；')[0].slice(0, 40)) + '……</div></div>';
        }).join('') +
        '</div></div>';

      root.innerHTML = html;
    }
  };
})();
