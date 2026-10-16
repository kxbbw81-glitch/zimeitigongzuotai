/* ============================================================
   视图 · 内容日历（排期一览，拖拽改期，营销节点自动标注）
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  const NODE_CAT_COLOR = { '电商大促': 'var(--red)', '传统节日': 'var(--amber)', '跨境电商': 'var(--purple)', '营销节点': 'var(--blue)' };
  let calMonth = MW.dateStr().slice(0, 7);

  MW.act.calNav = function (delta) {
    const d = MW.parseDate(calMonth + '-01');
    d.setMonth(d.getMonth() + delta);
    calMonth = MW.dateStr(d).slice(0, 7);
    MW.render();
  };
  MW.act.calToday = function () { calMonth = MW.dateStr().slice(0, 7); MW.render(); };

  /* ============================================================
     一键智能排期：把选题库存按各账号的周更频率铺满未来两周
     - 只排「已经在库里的选题」（灵感池/待评审/制作中），不现造
     - 按优先级取题，避开该账号已有排期的日期，同一天不双发
     - 与「AI 补排期」互补：那个补空缺、库存不够会现造；这个纯铺库存
     ============================================================ */
  MW.act.autoSchedule = function () {
    const db = MW.getDB();
    const t = MW.dateStr();
    const cur = MW.curAcc();
    const PRIO = { high: 0, mid: 1, low: 2 };
    const accs = db.accounts.filter(function (a) { return cur === 'all' || a.id === cur; });
    if (!accs.length) { MW.toast('先在账号矩阵添加账号', 'error'); return; }

    const lines = [];
    let total = 0;
    accs.forEach(function (acc) {
      const cadence = +acc.cadence || 3;
      const gap = Math.max(1, Math.round(7 / cadence));
      /* 库存：还没排期的选题，优先级高的先排 */
      const stock = db.topics.filter(function (x) {
        if (x.accountId !== acc.id) return false;
        if (x.stage !== 'idea' && x.stage !== 'review' && x.stage !== 'producing') return false;
        return !db.contents.some(function (c) { return c.topicId === x.id; });
      }).sort(function (a, b) {
        return (PRIO[a.priority] || 1) - (PRIO[b.priority] || 1) || (a.due || '9').localeCompare(b.due || '9');
      });
      if (!stock.length) return;

      let si = 0;
      for (let k = 1; k <= 14 && si < stock.length; k++) {
        if ((k - 1) % gap !== 0) continue;
        const ds = MW.addDays(t, k);
        const busy = db.contents.some(function (c) { return c.date === ds && c.accountId === acc.id; });
        if (busy) continue;
        const tp = stock[si++];
        const focus = tp.focus || MW.guessFocus(acc.id, tp.title);
        db.contents.push({
          id: MW.uid(), title: tp.title, accountId: acc.id, platform: acc.platform,
          date: ds, time: MW.ai.pfTime(acc.platform), status: 'scheduled', topicId: tp.id,
          focus: focus, metrics: null, note: '一键智能排期', createdAt: t
        });
        tp.stage = 'scheduled';
        if (!tp.due) tp.due = ds;
        total++;
        lines.push('📅 ' + ds.slice(5) + ' ' + MW.weekdayCN(ds) + ' · ' + MW.esc(acc.name) + ' · 「' + MW.esc(tp.title) + '」');
      }
    });
    MW.save(); MW.render();

    const logic = '<div class="form-hint" style="margin-top:10px">排期逻辑：按各账号「周更频率」（账号矩阵里可改）自动铺满未来两周，按优先级取库存选题，避开已有排期的日期，同一天不双发。排完后去日历拖拽微调时间。</div>';
    MW.modal({
      title: '🪄 一键智能排期结果',
      sub: total ? '本次排入 ' + total + ' 篇' : '',
      body: total
        ? '<div class="as-list">' + lines.map(function (l) { return '<div class="as-line">' + l + '</div>'; }).join('') + '</div>' + logic
        : '<div class="form-hint">没有可排的选题了——先去「灵感雷达」补货（选题工厂 / 热点二创），或给选题分配账号。</div>' + logic,
      okText: '好的'
    });
  };

  MW.act.moveContent = function (id, date) {
    const db = MW.getDB();
    const c = db.contents.find(function (x) { return x.id === id; });
    if (!c || c.date === date) return;
    c.date = date;
    MW.save(); MW.render();
    MW.toast('「' + c.title.slice(0, 12) + '…」已改期到 ' + date.slice(5));
  };

  MW.act.openContentModal = function (id, presetDate) {
    const db = MW.getDB();
    const c = id ? db.contents.find(function (x) { return x.id === id; }) : null;
    const accOpts = db.accounts.length
      ? db.accounts.map(function (a) { return { v: a.id, t: a.name }; })
      : [{ v: '', t: '（请先添加账号）' }];
    const topicOpts = [{ v: '', t: '不关联' }].concat(db.topics.map(function (t) { return { v: t.id, t: t.title }; }));

    let body =
      MW.ui.row('内容标题', '<input id="c-title" placeholder="这篇内容叫什么" value="' + MW.esc(c ? c.title : '') + '">') +
      '<div class="form-2col">' +
        MW.ui.row('所属账号', MW.ui.select('c-account', accOpts, c ? c.accountId : (db.accounts[0] ? db.accounts[0].id : ''))) +
        MW.ui.row('发布平台', MW.ui.platformOptions('c-platform', c ? c.platform : 'xhs')) +
      '</div>' +
      '<div class="form-2col">' +
        MW.ui.row('发布日期', '<input id="c-date" type="date" value="' + (c ? c.date : (presetDate || MW.dateStr())) + '">') +
        MW.ui.row('发布时间', '<input id="c-time" type="time" value="' + (c ? c.time : '12:00') + '">') +
      '</div>' +
      '<div class="form-2col">' +
        MW.ui.row('关联选题', MW.ui.select('c-topic', topicOpts, c ? c.topicId : '')) +
        MW.ui.row('状态', MW.ui.select('c-status', [{ v: 'scheduled', t: '待发布' }, { v: 'published', t: '已发布' }], c ? c.status : 'scheduled')) +
      '</div>' +
      MW.ui.row('内容方向', '<div id="c-focus-wrap">' +
        MW.ui.focusOptions(c ? c.accountId : (db.accounts[0] ? db.accounts[0].id : ''), c ? c.focus : '', 'c-focus') + '</div>',
        '对应该账号的一个内容聚焦方向，账号页会统计每个方向的产出');

    const m = c && c.metrics ? c.metrics : { views: 0, likes: 0, comments: 0, collects: 0, shares: 0, newFollowers: 0 };
    body += '<div class="form-sep">数据（发布后补充，用于复盘）</div>' +
      '<div class="form-3col">' +
        MW.ui.row('浏览', '<input id="c-views" type="number" min="0" value="' + m.views + '">') +
        MW.ui.row('点赞', '<input id="c-likes" type="number" min="0" value="' + m.likes + '">') +
        MW.ui.row('评论', '<input id="c-comments" type="number" min="0" value="' + m.comments + '">') +
      '</div>' +
      '<div class="form-3col">' +
        MW.ui.row('收藏', '<input id="c-collects" type="number" min="0" value="' + m.collects + '">') +
        MW.ui.row('转发', '<input id="c-shares" type="number" min="0" value="' + m.shares + '">') +
        MW.ui.row('涨粉', '<input id="c-newf" type="number" min="0" value="' + m.newFollowers + '">') +
      '</div>' +
      MW.ui.row('备注', '<textarea id="c-note" rows="2" placeholder="封面版本、评论区运营要点……">' + MW.esc(c ? c.note : '') + '</textarea>');

    MW.modal({
      title: c ? '编辑内容' : '添加排期',
      sub: '拖拽日历里的卡片也可以直接改期',
      body: body,
      okText: '保存',
      onOk: function (root) {
        const v = function (id2) { return (root.querySelector('#' + id2).value || '').trim(); };
        const title = v('c-title');
        if (!title) { MW.toast('请填写内容标题', 'error'); return false; }
        const status = v('c-status');
        const obj = {
          title: title,
          accountId: v('c-account'),
          platform: v('c-platform'),
          date: v('c-date') || MW.dateStr(),
          time: v('c-time') || '12:00',
          topicId: v('c-topic'),
          focus: (root.querySelector('#c-focus') || { value: '' }).value || '',
          status: status,
          note: v('c-note'),
          metrics: {
            views: +v('c-views') || 0, likes: +v('c-likes') || 0, comments: +v('c-comments') || 0,
            collects: +v('c-collects') || 0, shares: +v('c-shares') || 0, newFollowers: +v('c-newf') || 0
          }
        };
        if (c) {
          Object.assign(c, obj);
          if (obj.topicId) {
            const tp = db.topics.find(function (x) { return x.id === obj.topicId; });
            if (tp && status === 'published') tp.stage = 'published';
            else if (tp && status === 'scheduled') tp.stage = 'scheduled';
          }
        } else {
          db.contents.push(Object.assign({ id: MW.uid(), createdAt: MW.dateStr() }, obj));
        }
        MW.save(); MW.render();
        MW.toast(c ? '内容已更新' : '排期已添加');
      }
    });
    if (c) {
      const foot = document.querySelector('#modal-root .modal-foot');
      if (foot) {
        const extra = document.createElement('div');
        extra.className = 'modal-foot-extra';
        extra.innerHTML = '<button class="btn sm danger-ghost" onclick="MW.act.delContent(\'' + c.id + '\')">' + MW.icon('trash', 13) + ' 删除</button>';
        foot.appendChild(extra);
      }
    }
    /* 换账号时，内容方向选项跟着换 */
    const accSel = document.getElementById('c-account');
    const fw = document.getElementById('c-focus-wrap');
    if (accSel && fw) {
      accSel.onchange = function () {
        const cur = fw.querySelector('#c-focus') ? fw.querySelector('#c-focus').value : '';
        fw.innerHTML = MW.ui.focusOptions(accSel.value, cur, 'c-focus');
      };
    }
  };

  MW.act.delContent = function (id) {
    const db = MW.getDB();
    MW.confirm('确定删除这条排期？', function () {
      db.contents = db.contents.filter(function (x) { return x.id !== id; });
      MW.save(); MW.render(); MW.closeModal();
      MW.toast('已删除');
    }, { okText: '删除' });
  };

  MW.views['calendar'] = {
    id: 'calendar', name: '内容日历', icon: 'calendar',
    sub: '排期一览，拖拽卡片改期，营销节点自动标注',
    render: function (root) {
      const db = MW.getDB();
      const today = MW.dateStr();
      const y = +calMonth.slice(0, 4), m = +calMonth.slice(5, 7);
      const first = new Date(y, m - 1, 1);
      const startOffset = (first.getDay() + 6) % 7; /* 周一起始 */
      const daysInMonth = new Date(y, m, 0).getDate();

      const curAcc = MW.curAcc();
      const inView = function (c) { return curAcc === 'all' || c.accountId === curAcc; };
      const monthContents = db.contents.filter(function (c) { return c.date.slice(0, 7) === calMonth && inView(c); });
      const monthPublished = monthContents.filter(function (c) { return c.status === 'published'; }).length;
      const monthNodeSeen = {};
      let monthNodeCount = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = calMonth + '-' + String(d).padStart(2, '0');
        MW.nodesOn(ds).forEach(function (n) {
          const key = n.date + n.name;
          if (!monthNodeSeen[key]) { monthNodeSeen[key] = 1; monthNodeCount++; }
        });
      }

      let html = '<div class="page-head"><div class="page-title">内容日历</div>' +
        '<div class="page-sub">本月排期 ' + monthContents.length + ' 篇 · 已发布 ' + monthPublished + ' 篇 · 营销节点 ' + monthNodeCount + ' 个</div>' +
        '<div class="cal-nav">' +
        '<button class="icon-btn" onclick="MW.act.calNav(-1)">' + MW.icon('left', 15) + '</button>' +
        '<span class="cal-month">' + MW.monthLabel(calMonth) + '</span>' +
        '<button class="icon-btn" onclick="MW.act.calNav(1)">' + MW.icon('right', 15) + '</button>' +
        '<button class="btn sm" onclick="MW.act.calToday()">今天</button>' +
        '<button class="btn sm" onclick="MW.act.autoSchedule()">' + MW.icon('calendar', 13) + ' 一键智能排期</button>' +
        '<button class="btn sm" onclick="MW.act.aiWeekPlanModal()">' + MW.icon('sparkles', 13) + ' AI 补排期</button>' +
        '<button class="btn primary sm" onclick="MW.act.openContentModal(\'\', \'' + calMonth + '-01\')">' + MW.icon('plus', 13) + ' 添加排期</button>' +
        /* 排完期下一步就是去发，给个直通入口，别让人自己找 */
        '<button class="btn sm" onclick="MW.goto(\'#/publish\')">' + MW.icon('upload', 13) + ' 去发布</button>' +
        '</div></div>';

      /* 图例 */
      html += '<div class="cal-legend">' +
        Object.keys(NODE_CAT_COLOR).map(function (k) {
          return '<span class="legend-item"><i style="background:' + NODE_CAT_COLOR[k] + '"></i>' + k + '</span>';
        }).join('') +
        '<span class="legend-tip">节点日自动标注，可提前规划借势内容</span></div>';

      /* 表头 */
      html += '<div class="cal-grid cal-weekdays">' + ['一', '二', '三', '四', '五', '六', '日'].map(function (w) {
        return '<div class="cal-wd">' + w + '</div>';
      }).join('') + '</div>';

      html += '<div class="cal-grid cal-days">';
      const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
      for (let i = 0; i < totalCells; i++) {
        const dayNum = i - startOffset + 1;
        const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
        const ds = inMonth ? calMonth + '-' + String(dayNum).padStart(2, '0') : '';
        const isToday = ds === today;
        const nodes = inMonth ? MW.nodesOn(ds) : [];
        const dayContents = inMonth
          ? db.contents.filter(function (c) { return c.date === ds && inView(c); }).sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); })
          : [];
        html += '<div class="cal-cell' + (inMonth ? '' : ' other') + (isToday ? ' today' : '') + (nodes.length ? ' has-node' : '') + '"' +
          (inMonth ? ' data-date="' + ds + '"' : '') + '>' +
          '<div class="cal-cell-head">' +
          '<span class="cal-num">' + (inMonth ? dayNum : '') + '</span>' +
          (nodes.length ? '<span class="cal-node-names">' + nodes.map(function (n) {
            return '<span class="node-badge" style="--nc:' + (NODE_CAT_COLOR[n.cat] || 'var(--blue)') + '">' + MW.esc(n.name) + '</span>';
          }).join('') + '</span>' : '') +
          '</div>' +
          '<div class="cal-items">' +
          dayContents.slice(0, 3).map(function (c) {
            const acc = db.accounts.find(function (a) { return a.id === c.accountId; });
            const pc = acc ? MW.PLATFORMS[acc.platform].color : '#999';
            return '<div class="cal-chip' + (c.status === 'published' ? ' published' : '') + '" data-id="' + c.id + '" style="--pc:' + pc + '">' +
              '<span class="cal-chip-time">' + (c.time || '') + '</span>' +
              '<span class="cal-chip-title">' + MW.esc(c.title) + '</span></div>';
          }).join('') +
          (dayContents.length > 3 ? '<div class="cal-more">+' + (dayContents.length - 3) + ' 篇</div>' : '') +
          '</div>' +
          (inMonth ? '<button class="cal-add" onclick="MW.act.openContentModal(\'\', \'' + ds + '\')">' + MW.icon('plus', 13) + '</button>' : '') +
          '</div>';
      }
      html += '</div>';

      root.innerHTML = html;

      /* 拖拽改期 */
      root.querySelectorAll('.cal-chip').forEach(function (el) {
        MW.dragSrc(el, 'content', el.getAttribute('data-id'));
        el.addEventListener('click', function () {
          if (!el.classList.contains('dragging')) MW.act.openContentModal(el.getAttribute('data-id'));
        });
      });
      root.querySelectorAll('.cal-cell[data-date]').forEach(function (el) {
        MW.dropZone(el, function (parts) {
          if (parts[0] === 'content') MW.act.moveContent(parts[1], el.getAttribute('data-date'));
        });
      });
    }
  };
})();
