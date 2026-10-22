/* ============================================================
   视图 · 账号矩阵（分发版）
   定位：一个账号 = 一套内容策略。定位/受众/语气/聚焦四项
   直接进 AI 适配的上下文——改这里，所有平台的改写都跟着变。
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  let filterPlatform = 'all';
  let sortBy = 'fans';

  MW.act.setAccFilter = function (p) { filterPlatform = p; MW.render(); };

  MW.act.editAccount = function (id) {
    const db = MW.getDB();
    const a = id ? db.accounts.find(function (x) { return x.id === id; }) : null;
    const body =
      MW.ui.row('平台', MW.ui.platformOptions('f-platform', a ? a.platform : 'xhs'),
        '内置国内外常用平台；选「自定义平台…」可自建名称与标识色') +
      /* 自定义平台才出现的两个字段：名字和颜色都存在账号自己身上 */
      '<div id="pf-custom-wrap" class="form-2col" style="display:none">' +
        MW.ui.row('平台名称', '<input id="f-platform-name" maxlength="12" placeholder="例如：TikTok Shop / 快手" value="' + MW.esc(a && a.platform === 'custom' ? (a.platformName || '') : '') + '">') +
        MW.ui.row('标识颜色', '<input id="f-platform-color" type="color" value="' + MW.esc(a && a.platform === 'custom' ? (a.platformColor || '#6b7280') : '#6b7280') + '">') +
      '</div>' +
      MW.ui.row('账号 ID', '<input id="f-accountid" placeholder="各平台的后台账号 / ID" value="' + MW.esc(a ? a.accountId : '') + '">') +
      MW.ui.row('账号名称', '<input id="f-name" placeholder="例如：阿茶的手作厨房" value="' + MW.esc(a ? a.name : '') + '">') +
      MW.ui.row('账号定位', '<textarea id="f-positioning" rows="2" placeholder="一句话说清楚这个号是干什么的、给谁看">' + MW.esc(a ? a.positioning : '') + '</textarea>', '定位决定内容边界，也是 AI 改写时的上下文') +
      MW.ui.row('目标受众',
        '<textarea id="f-audience" rows="2" placeholder="例如：25-40 岁喜欢动手、想给生活添点乐趣的女性用户">' + MW.esc(a ? (a.audience || '') : '') + '</textarea>',
        '改写时对着谁说话。AI 会用它调整用词和案例选择') +
      '<div class="form-2col">' +
        MW.ui.row('内容风格', '<input id="f-style" placeholder="例如：干货实操 / 轻教程 / 深度长文" value="' + MW.esc(a ? a.style : '') + '">') +
        MW.ui.row('表达风格', '<input id="f-tone" placeholder="例如：第一人称分享，像闺蜜聊天" value="' + MW.esc(a ? (a.tone || '') : '') + '">', '语气和人称，直接影响改写后的写法') +
      '</div>' +
      MW.ui.row('内容聚焦（每行一个方向）',
        '<textarea id="f-focus" rows="4" placeholder="每行一个方向，例如：&#10;手作教程&#10;厨房好物&#10;节日改造">' + MW.esc(a ? a.focus.join('\n') : '') + '</textarea>',
        'AI 改写时的方向来源，建议 3-5 个，按重要性排序') +
      '<div class="form-2col">' +
        MW.ui.row('周更频率（篇）', '<input id="f-cadence" type="number" min="1" value="' + (a ? (a.cadence || 3) : 3) + '">', '用于计算断更天数') +
        MW.ui.row('当前粉丝', '<input id="f-followers" type="number" min="0" value="' + (a ? a.followers : 0) + '">') +
      '</div>' +
      MW.ui.row('状态', MW.ui.select('f-status', [{ v: 'active', t: '运营中' }, { v: 'paused', t: '已暂停' }], a ? a.status : 'active'), '暂停的账号不参与一稿多发的目标勾选');

    MW.modal({
      title: a ? '编辑账号' : '添加账号',
      sub: '定位、受众、语气、聚焦——这四项决定母稿改写成什么味道',
      body: body,
      size: 'md',
      okText: '保存',
      onOk: function (root) {
        const v = function (id2) { return (root.querySelector('#' + id2).value || '').trim(); };
        const name = v('f-name');
        if (!name) { MW.toast('请填写账号名称', 'error'); return false; }
        /* 自定义平台：名字必填（不给就兜个底），颜色取自带取色器 */
        let platform = v('f-platform'), platformName = '', platformColor = '';
        if (platform === 'custom') {
          platformName = v('f-platform-name') || '自定义平台';
          platformColor = v('f-platform-color') || '#6b7280';
        }
        const obj = {
          platform: platform,
          accountId: v('f-accountid'),
          name: name,
          style: v('f-style'),
          tone: v('f-tone'),
          positioning: v('f-positioning'),
          audience: v('f-audience'),
          focus: v('f-focus').split(/[\n,，、;；]+/).map(function (s) { return s.trim(); }).filter(Boolean),
          followers: +v('f-followers') || 0,
          cadence: +v('f-cadence') || 3,
          status: v('f-status')
        };
        /* 只在自定义时带上名字 / 颜色；切回内置平台时清掉，免得留下脏字段 */
        if (platformName) { obj.platformName = platformName; obj.platformColor = platformColor; }
        else { delete obj.platformName; delete obj.platformColor; }
        if (a) Object.assign(a, obj);
        else db.accounts.push(Object.assign({ id: MW.uid(), createdAt: MW.dateStr() }, obj));
        MW.save(); MW.render();
        MW.toast(a ? '账号已更新' : '账号已添加');
      }
    });

    /* 选了「自定义平台…」才展开名称 / 颜色两个字段 */
    const pfSel = document.getElementById('f-platform');
    const pfWrap = document.getElementById('pf-custom-wrap');
    if (pfSel && pfWrap) {
      const syncPfCustom = function () {
        pfWrap.style.display = pfSel.value === 'custom' ? '' : 'none';
      };
      pfSel.onchange = syncPfCustom;
      syncPfCustom();
    }
  };

  MW.act.delAccount = function (id) {
    const db = MW.getDB();
    MW.confirm('删除账号后，其排期与发布记录仍会保留。确定删除？', function () {
      db.accounts = db.accounts.filter(function (a) { return a.id !== id; });
      MW.save(); MW.render();
      MW.toast('账号已删除');
    }, { okText: '删除' });
  };

  /* 某个聚焦方向的产出情况：让「方向」不再是空话 */
  function focusStat(accId, f) {
    const db = MW.getDB();
    const rel = function (item) { return item.focus ? item.focus === f : MW.focusHit(f, item.title); };
    let pub = 0, last = '';
    db.contents.forEach(function (c) {
      if (c.accountId !== accId || c.status !== 'published' || !rel(c)) return;
      pub++;
      if (c.date > last) last = c.date;
    });
    return { pub: pub, last: last };
  }

  /* 内容表单里的「所属方向」下拉（跟随账号联动） */
  MW.ui.focusOptions = function (accId, value, id) {
    const acc = MW.accOf(accId);
    const fs = (acc && acc.focus) || [];
    return MW.ui.select(id || 'f-focus-item', [{ v: '', t: '未归类' }].concat(fs.map(function (f) { return { v: f, t: f }; })), value || '');
  };

  MW.views['accounts'] = {
    id: 'accounts', name: '账号矩阵', icon: 'users',
    sub: '一个账号 = 一套内容策略 · 定位越清晰，母稿改写越准',
    render: function (root) {
      const db = MW.getDB();
      const t = MW.dateStr();
      const month = t.slice(0, 7);
      const weekStart = MW.addDays(t, -6);

      let list = db.accounts.filter(function (a) { return filterPlatform === 'all' || a.platform === filterPlatform; });
      const rank = {};
      db.accounts.forEach(function (a) { rank[a.id] = { s: MW.silentDays(a) }; });
      list = list.slice().sort(function (a, b) {
        if (sortBy === 'alert') {
          const score = function (a2) {
            const r = rank[a2.id];
            const limit = (a2.cadence ? Math.ceil(7 / a2.cadence) : 3) + 2;
            return (r.s >= limit ? 100 : 0) + Math.min(r.s, 30);
          };
          return score(b) - score(a);
        }
        return (+b.followers || 0) - (+a.followers || 0);
      });

      /* ---------- 矩阵总览 ---------- */
      const totalFans = db.accounts.reduce(function (s, a) { return s + (+a.followers || 0); }, 0);
      const activeN = db.accounts.filter(function (a) { return a.status === 'active'; }).length;
      const monthPub = db.contents.filter(function (c) { return c.status === 'published' && c.date.slice(0, 7) === month; }).length;
      const noFocus = db.accounts.filter(function (a) { return !(a.focus && a.focus.length); }).length;

      let html = '<div class="page-head"><div class="page-title">账号矩阵</div>' +
        '<div class="page-sub">一个账号 = 一套内容策略 · 定位越清晰，母稿改写越准</div>' +
        '<button class="btn primary" onclick="MW.act.editAccount()">' + MW.icon('plus', 14) + ' 添加账号</button></div>';

      html += '<div class="matrix-bar">' +
        '<div class="mb-item"><b>' + MW.fmt.int(totalFans) + '</b><span>矩阵总粉丝</span></div>' +
        '<div class="mb-item"><b>' + activeN + '/' + db.accounts.length + '</b><span>运营中账号</span></div>' +
        '<div class="mb-item"><b>' + monthPub + '</b><span>本月已发布</span></div>' +
        '<div class="mb-item"><b class="' + (noFocus ? 'down' : 'up') + '">' + noFocus + '</b><span>缺聚焦方向</span></div>' +
        '</div>';

      /* ---------- 平台筛选 + 排序 ---------- */
      const pfCount = {};
      db.accounts.forEach(function (a) { pfCount[a.platform] = (pfCount[a.platform] || 0) + 1; });
      const pfTabs = [{ v: 'all', t: '全部 ' + db.accounts.length }].concat(Object.keys(MW.PLATFORMS)
        .filter(function (k) { return pfCount[k]; })
        .map(function (k) { return { v: k, t: MW.PLATFORMS[k].name + ' ' + pfCount[k] }; }));
      if (pfCount.custom) pfTabs.push({ v: 'custom', t: '自定义 ' + pfCount.custom });
      html += '<div class="acc-toolbar">' +
        '<div class="seg">' + pfTabs.map(function (p) {
          return '<button class="seg-btn' + (filterPlatform === p.v ? ' active' : '') + '" onclick="MW.act.setAccFilter(\'' + p.v + '\')">' + MW.esc(p.t) + '</button>';
        }).join('') + '</div>' +
        '<div class="acc-sort"><span>排序</span>' +
        MW.ui.select('acc-sort', [
          { v: 'fans', t: '粉丝数' }, { v: 'alert', t: '需要关注优先' }
        ], sortBy) + '</div>' +
        '</div>';

      if (!list.length) {
        html += MW.ui.empty('暂无账号', '点击「添加账号」，把各平台的账号和定位录进来');
      } else {
        html += '<div class="acc-list">' + list.map(function (a) {
          const p = MW.pfOf(a);
          const active = a.status === 'active';

          const weekPubN = db.contents.filter(function (c) {
            return c.accountId === a.id && c.status === 'published' && c.date >= weekStart && c.date <= t;
          }).length;
          const monthN = db.contents.filter(function (c) {
            return c.accountId === a.id && c.status === 'published' && c.date.slice(0, 7) === month;
          }).length;
          const silent = MW.silentDays(a);
          const lp = MW.lastPublish(a.id);
          const silentLimit = (a.cadence ? Math.ceil(7 / a.cadence) : 3) + 2;
          const silentBad = lp && silent >= silentLimit;
          /* 该账号作为母稿源 / 适配目标的版本数 */
          const verN = db.contents.filter(function (c) {
            return c.accountId === a.id && (c.master || c.masterId);
          }).length;

          /* --- 近 7 天发布节奏：断没断一眼看到 --- */
          let cells = '';
          for (let i = 6; i >= 0; i--) {
            const ds = MW.addDays(t, -i);
            const n = db.contents.filter(function (c) {
              return c.accountId === a.id && c.status === 'published' && c.date === ds;
            }).length;
            cells += '<span class="aw-cell' + (n ? ' on' : '') + (ds === t ? ' today' : '') + '" title="' + ds + '（' + MW.weekdayCN(ds) + '）发布 ' + n + ' 篇">' +
              '<b>' + (n || (ds === t ? '今' : '·')) + '</b><em>' + MW.weekdayCN(ds).slice(1) + '</em></span>';
          }

          /* --- 头部：身份 + 节奏 + 数据 --- */
          let h = '<div class="acc-item card' + (active ? '' : ' paused') + '" style="--pfc:' + p.color + '">' +
            '<div class="acc-head">' +
            '<div class="acc-ident">' +
            '<div class="acc-line1">' +
            '<span class="pf-chip" style="--pc:' + p.color + '">' + MW.esc(p.name) + '</span>' +
            '<span class="acc-name">' + MW.esc(a.name) + '</span>' +
            '<span class="status-dot ' + (active ? 'on' : 'off') + '">' + (active ? '运营中' : '已暂停') + '</span>' +
            '</div>' +
            '<div class="acc-id">' + MW.icon('at', 11) + ' ' + MW.esc(a.accountId || '未填写 ID') + '</div>' +
            '<div class="acc-pos">' + MW.esc(a.positioning || '未填写定位——AI 改写会缺上下文') + '</div>' +
            '<div class="acc-meta-line">' +
            '<span class="am-chip">' + MW.icon('palette', 11) + ' ' + MW.esc(a.style || '未设风格') + '</span>' +
            '<span class="am-chip">' + MW.icon('refresh', 11) + ' 周更 ' + (a.cadence || 3) + ' 篇</span>' +
            '</div>' +
            '</div>' +
            '<div class="acc-week"><div class="aw-title">近 7 天发布节奏</div>' +
            '<div class="aw-cells">' + cells + '</div></div>' +
            '<div class="acc-metrics">' +
            '<div class="am-fans"><b>' + MW.fmt.int(a.followers) + '</b><span>粉丝</span></div>' +
            '</div>' +
            '</div>';

          /* --- 健康体检 + 操作 --- */
          h += '<div class="acc-health">' +
            '<div class="ah-item"><b>' + weekPubN + '</b><span>本周发布</span></div>' +
            '<div class="ah-item' + (silentBad ? ' bad' : '') + '"><b>' + (lp ? silent + ' 天' : '未开张') + '</b><span>断更</span></div>' +
            '<div class="ah-item"><b>' + monthN + '</b><span>本月发布</span></div>' +
            '<div class="ah-item"><b>' + verN + '</b><span>一稿多发版本</span></div>' +
            '<div class="ah-ops">' +
            '<button class="btn sm" onclick="MW.setCurAcc(\'' + a.id + '\')">' + MW.icon('eye', 12) + ' 只看该号</button>' +
            '<button class="btn sm" onclick="MW.goto(\'#/ai\');MW.act.aiUseAccount(\'' + a.id + '\')">' + MW.icon('sparkles', 12) + ' AI 文案</button>' +
            '<button class="btn sm" onclick="MW.act.editAccount(\'' + a.id + '\')">' + MW.icon('edit', 12) + ' 编辑</button>' +
            '<button class="btn sm danger-ghost" onclick="MW.act.delAccount(\'' + a.id + '\')">' + MW.icon('trash', 12) + '</button>' +
            '</div></div>';

          /* --- IP 规范：账号信息不是档案，是喂给内容改写的输入 --- */
          h += '<div class="acc-ip-sec"><div class="ip-head">' +
            MW.icon('flag', 12) + ' IP 规范 · 母稿改写依据' +
            '<span class="ip-tip">下列每项都会进入 AI 改写上下文，改这里等于改所有平台的版本</span>' +
            '<button class="btn sm ghost" onclick="MW.act.editAccount(\'' + a.id + '\')">' + MW.icon('edit', 11) + ' 调整</button></div>';
          h += '<div class="ip-grid">' +
            '<div class="ip-cell"><span class="ip-label">定位</span><span class="ip-val">' + MW.esc(a.positioning || '未填写') + '</span></div>' +
            '<div class="ip-cell"><span class="ip-label">目标受众</span><span class="ip-val">' + MW.esc(a.audience || '未填写') + '</span></div>' +
            '<div class="ip-cell"><span class="ip-label">表达风格</span><span class="ip-val">' + MW.esc(a.tone || a.style || '未填写') + '</span></div>' +
            '<div class="ip-cell"><span class="ip-label">内容风格</span><span class="ip-val">' + MW.esc(a.style || '未填写') + '</span></div>' +
            '</div></div>';

          /* --- 内容聚焦：每行一个方向 --- */
          h += '<div class="acc-focus-sec"><div class="af-head">' +
            MW.icon('target', 12) + ' 内容聚焦 · 改写方向' +
            '<span class="af-tip">每行一个方向，点任意一行直接用它写母稿</span></div>';
          if (!a.focus.length) {
            h += '<div class="af-empty">尚未设置内容聚焦，AI 改写将缺乏方向。' +
              '<button class="btn sm" onclick="MW.act.editAccount(\'' + a.id + '\')">去设置</button></div>';
          } else {
            h += '<div class="af-list">' + a.focus.map(function (f, i) {
              const st = focusStat(a.id, f);
              return '<div class="af-row" onclick="MW.act.aiFocusWrite(\'' + a.id + '\', ' + JSON.stringify(f).replace(/"/g, '&quot;') + ')">' +
                '<span class="af-idx">' + (i + 1) + '</span>' +
                '<span class="af-name">' + MW.esc(f) + '</span>' +
                '<span class="af-pills">' +
                (st.pub ? '<span class="af-pill pub">已发 ' + st.pub + '</span>' : '<span class="af-pill none">未产出</span>') +
                (st.last ? '<span class="af-pill date">最近 ' + st.last.slice(5) + '</span>' : '') +
                '</span>' +
                '<span class="af-write">写一条 →</span>' +
                '</div>';
            }).join('') + '</div>';
          }
          h += '</div></div>';
          return h;
        }).join('') + '</div>';
      }

      root.innerHTML = html;

      const sortEl = document.getElementById('acc-sort');
      if (sortEl) sortEl.onchange = function () { sortBy = this.value; MW.render(); };
    }
  };
})();
