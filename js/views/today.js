/* ============================================================
   视图 · 今日作战台
   博主视角：今天发什么 → 哪个号掉队了 → 下一条从哪来
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  /* ---------- 快捷打卡 / 待办 ---------- */
  MW.act.toggleRitual = function (id) {
    const db = MW.getDB(), t = MW.dateStr();
    db.ritualLog[t] = db.ritualLog[t] || [];
    const i = db.ritualLog[t].indexOf(id);
    if (i >= 0) db.ritualLog[t].splice(i, 1); else db.ritualLog[t].push(id);
    MW.save(); MW.render();
  };

  MW.act.toggleTodo = function (id) {
    const db = MW.getDB();
    const td = db.todos.find(function (x) { return x.id === id; });
    if (td) { td.done = !td.done; MW.save(); MW.render(); }
  };

  /* 提醒区的一键补发：不做就绪校验（提醒本身就是催人动的），
     但落库字段必须和发布管理那条路一致，否则两边的状态会分叉。 */
  MW.act.markPublished = function (id) {
    const db = MW.getDB();
    const c = db.contents.find(function (x) { return x.id === id; });
    if (!c) return;
    c.status = 'published';
    const now = new Date();
    c.publishedAt = MW.dateStr() + ' ' + ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
    if (c.topicId) {
      const tp = db.topics.find(function (x) { return x.id === c.topicId; });
      if (tp) tp.stage = 'published';
    }
    MW.save(); MW.render();
    MW.toast('已标记发布，请于次日回填数据');
  };

  MW.act.quickAddTodo = function () {
    const el = document.getElementById('quick-todo-input');
    const v = (el.value || '').trim();
    if (!v) { MW.toast('先输入待办内容', 'error'); return; }
    const db = MW.getDB();
    db.todos.push({ id: MW.uid(), title: v, date: MW.dateStr(), time: '', status: 'todo', owner: '我', priority: 'mid', done: false, createdAt: MW.dateStr() });
    MW.save(); MW.render();
    MW.toast('待办已添加');
  };

  /* ---------- 30 秒补录数据（博主最烦填长表单） ---------- */
  MW.act.quickMetrics = function (id) {
    const db = MW.getDB();
    const c = db.contents.find(function (x) { return x.id === id; });
    if (!c) return;
    const m = c.metrics || {};
    const F = [['views', '浏览'], ['likes', '点赞'], ['comments', '评论'], ['collects', '收藏'], ['shares', '分享'], ['newFollowers', '涨粉']];
    const body = '<div class="qm-grid">' + F.map(function (f) {
      return '<div class="qm-item"><label>' + f[1] + '</label>' +
        '<input id="qm-' + f[0] + '" type="number" min="0" value="' + (+m[f[0]] || 0) + '"></div>';
    }).join('') + '</div>' +
      MW.ui.row('一句话结论', '<input id="qm-note" placeholder="为什么好/不好？下一个能复制的点是什么" value="' + MW.esc(c.note || '') + '">',
        '发布 24 小时后数据才稳，建议第二天早上补录');

    MW.modal({
      title: '补录数据', sub: c.title, body: body, okText: '保存数据',
      onOk: function (root) {
        const o = {};
        F.forEach(function (f) { o[f[0]] = +root.querySelector('#qm-' + f[0]).value || 0; });
        c.metrics = o;
        c.note = (root.querySelector('#qm-note').value || '').trim();
        if (c.topicId) {
          const tp = db.topics.find(function (x) { return x.id === c.topicId; });
          if (tp && tp.stage === 'published') tp.stage = 'retro';
        }
        MW.save(); MW.render();
        MW.toast('数据已记录');
      }
    });
  };

  /* ---------- 提醒里的一键操作：把拖着的排期/待办挪到今天 ---------- */
  MW.act.contentToToday = function (id) {
    const db = MW.getDB();
    const c = db.contents.find(function (x) { return x.id === id; });
    if (!c) return;
    c.date = MW.dateStr();
    if (!c.time) c.time = defaultTime(new Date().getHours());
    MW.save(); MW.render();
    MW.toast('已挪到今天 ' + c.time);
  };

  MW.act.todoToToday = function (id) {
    const db = MW.getDB();
    const td = db.todos.find(function (x) { return x.id === id; });
    if (!td) return;
    td.date = MW.dateStr();
    MW.save(); MW.render();
    MW.toast('待办已调整至今日');
  };

  /* ---------- 把选题直接排到今天（避免当天断更） ---------- */
  MW.act.scheduleToday = function (topicId) {
    const db = MW.getDB();
    const tp = db.topics.find(function (x) { return x.id === topicId; });
    if (!tp) return;
    const acc = db.accounts.find(function (a) { return a.id === tp.accountId; });
    const t = MW.dateStr();
    const h = new Date().getHours();
    const time = h < 11 ? '12:00' : (h < 17 ? '18:00' : '21:00');
    db.contents.push({
      id: MW.uid(), title: tp.title, accountId: tp.accountId,
      platform: acc ? acc.platform : 'other', date: t, time: time,
      status: 'scheduled', topicId: tp.id, focus: tp.focus || MW.guessFocus(tp.accountId, tp.title),
      metrics: null, note: '', createdAt: t
    });
    tp.stage = 'scheduled';
    MW.save(); MW.render();
    MW.toast('已排到今天 ' + time);
  };

  /* ---------- 每天 30 秒：记录自己的粉丝快照 ---------- */
  MW.act.snapshotModal = function () {
    const db = MW.getDB();
    if (!db.accounts.length) { MW.toast('先去账号矩阵添加账号', 'error'); return; }
    const rows = db.accounts.map(function (a) {
      const g = MW.growth(a, 7);
      return '<div class="snap-row">' +
        '<span class="as-dot" style="background:' + MW.PLATFORMS[a.platform].color + '"></span>' +
        '<span class="snap-name">' + MW.esc(a.name) + '</span>' +
        '<span class="snap-week">' + (g.delta >= 0 ? '+' : '') + g.delta + ' / 7天</span>' +
        '<input id="sn-' + a.id + '" type="number" min="0" value="' + a.followers + '"></div>';
    }).join('');
    MW.modal({
      title: '记录今日粉丝数', sub: MW.dateStr() + ' · 每天 30 秒，涨粉曲线就有了',
      body: rows + '<div class="form-hint">同一天重复记录会覆盖当天数据；建议固定早上记一次。</div>',
      okText: '保存快照',
      onOk: function (root) {
        db.accounts.forEach(function (a) {
          const el = root.querySelector('#sn-' + a.id);
          MW.pushSnapshot(a.id, el ? el.value : a.followers);
        });
        MW.save(); MW.render();
        MW.toast('粉丝快照已记录');
      }
    });
  };

  /* ---------- 问候语 ---------- */
  function greet() {
    const h = new Date().getHours();
    if (h < 6) return '深夜了，早点休息';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }
  function defaultTime(h) { return h < 11 ? '12:00' : (h < 17 ? '18:00' : '21:00'); }

  MW.views['today'] = {
    id: 'today', name: '今日作战台', icon: 'sun',
    sub: '今天发什么、哪个号掉队了、下一条从哪来',
    render: function (root) {
      const db = MW.getDB();
      const t = MW.dateStr();
      const cur = MW.curAcc();
      /* 过滤掉已被删掉但残留记录里的仪式 id，否则完成度会算过头 */
      const doneIds = (db.ritualLog[t] || []).filter(function (id) {
        return db.rituals.some(function (r) { return r.id === id; });
      });
      const ritualTotal = db.rituals.length;

      /* 今日排期（跟随账号视角） */
      const schedToday = db.contents.filter(function (c) {
        return c.date === t && (cur === 'all' || c.accountId === cur);
      }).sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); });
      const pubToday = schedToday.filter(function (c) { return c.status === 'published'; }).length;
      /* 发布就绪度：四项检查都勾了才算真能发。今日页只报数，补齐去发布管理 */
      const readyToday = schedToday.filter(function (c) { return MW.checksOf(c).ready; }).length;

      /* 待办按人分工，不按账号，所以任何视角都显示 */
      const todosToday = db.todos.filter(function (x) { return x.date === t; })
        .sort(function (a, b) { return (a.time || '99:99').localeCompare(b.time || '99:99'); });
      const todosDone = todosToday.filter(function (x) { return x.done; }).length;

      const weekStart = MW.addDays(t, -6);
      const pubWeek = db.contents.filter(function (c) {
        return c.status === 'published' && c.date >= weekStart && c.date <= t && (cur === 'all' || c.accountId === cur);
      });

      /* 预警 */
      const alerts = MW.alerts().filter(function (a) {
        if (cur === 'all') return true;
        if (a.acc) return a.acc === cur;
        if (a.accs) return a.accs.indexOf(cur) >= 0;
        return true;   /* 全局提醒（如待补数据）任何视角都显示 */
      });

      /* 弹药：还没发出去的高优先级选题 */
      const armed = db.topics.filter(function (x) {
        if (cur !== 'all' && x.accountId !== cur) return false;
        return x.stage !== 'published' && x.stage !== 'retro';
      }).sort(function (a, b) {
        const w = { high: 0, mid: 1, low: 2 };
        return (w[a.priority] || 1) - (w[b.priority] || 1);
      });
      const suggest = armed.filter(function (x) {
        return !db.contents.some(function (c) { return c.topicId === x.id; });
      }).slice(0, 3);

      const totalAll = ritualTotal + todosToday.length;
      const doneAll = doneIds.length + todosDone;
      const pct = totalAll ? Math.max(0, Math.min(100, Math.round(doneAll / totalAll * 100))) : 0;

      /* ---------- Hero ---------- */
      let headLine, headSub;
      if (!schedToday.length) {
        headLine = '今日尚未排期';
        headSub = '请从下方选题库选择一条排上，或先补充灵感储备';
      } else if (pubToday < schedToday.length) {
        headLine = '今天还有 ' + (schedToday.length - pubToday) + ' 条要发';
        headSub = '建议优先处理最早发布的一条，其余按节奏推进';
      } else {
        headLine = '今日发布任务已全部完成';
        headSub = '可提前补充次日排期，避免临时从零开始';
      }

      let html = '<div class="hero card">' +
        '<div class="hero-left">' +
          '<div class="hero-date">' + t + ' ' + MW.weekdayCN(t) + ' · ' + greet() + '</div>' +
          '<div class="hero-line">' + headLine + '</div>' +
          '<div class="hero-sub">' + headSub + '</div>' +
          '<div class="hero-stats">' +
            '<span><b>' + schedToday.length + '</b> 今日排期</span>' +
            '<span><b>' + pubWeek.length + '</b> 本周已发</span>' +
            '<span><b>' + armed.length + '</b> 选题库存</span>' +
          '</div>' +
          '<div class="hero-ops">' +
            '<button class="btn sm primary" onclick="MW.act.aiWeekPlanModal()">' + MW.icon('sparkles', 13) + ' AI 补排期</button>' +
            '<button class="btn sm" onclick="MW.act.aiFillIdeas()">' + MW.icon('bulb', 13) + ' AI 补选题</button>' +
          '</div>' +
        '</div>' +
        '<div class="hero-right">' + MW.charts.ring(pct, 'var(--primary)', 92, 8, pct + '%') +
          '<div class="hero-ring-label">今日完成度</div></div>' +
        '</div>';

      /* ---------- 行动提醒：欠着的 / 今天要做的 / 接下来预计的 ---------- */
      const R = MW.reminderGroups();
      function remRow(r) {
        return '<div class="rem-row ' + r.level + '">' +
          '<span class="rem-dot" style="background:' + r.color + '"></span>' +
          '<div class="rem-main">' +
            '<div class="rem-title">' + MW.esc(r.title) + '</div>' +
            '<div class="rem-sub">' + MW.esc(r.sub) + (r.who ? ' · ' + MW.esc(r.who) : '') + '</div>' +
          '</div>' +
          (r.badge ? '<span class="rem-badge">' + MW.esc(r.badge) + '</span>' : '') +
          '<div class="rem-ops">' + (r.ops || []).map(function (o) {
            return '<button class="btn sm' + (o.primary ? ' primary' : '') + '" onclick="' + o.on + '">' + o.label + '</button>';
          }).join('') + '</div>' +
          '</div>';
      }
      const RG = [
        { key: 'overdue', label: '已逾期', hint: '超过截止时间', empty: '无逾期事项' },
        { key: 'today', label: '今日待办 / 预计发布', hint: '截止今天', empty: '今日无待办' },
        { key: 'upcoming', label: '未来 3 天', hint: '即将到期', empty: '未来 3 天暂无安排' }
      ];
      let remHtml = '<div class="card remind-card"><div class="card-head">' +
        '<div class="card-title">' + MW.icon('clock', 15) + ' 行动提醒</div>' +
        '<div class="card-extra">' +
          '<span class="rem-chip danger">逾期 ' + R.overdue.length + '</span>' +
          '<span class="rem-chip warn">今天 ' + R.today.length + '</span>' +
          '<span class="rem-chip info">接下来 ' + R.upcoming.length + '</span>' +
        '</div></div>';
      if (!R.all.length) {
        remHtml += MW.ui.empty('暂无待办事项', '排期、选题、待办均在轨道上，可按节奏推进');
      } else {
        remHtml += '<div class="rem-groups">' + RG.map(function (g) {
          const list = R[g.key];
          return '<div class="rem-group ' + g.key + '">' +
            '<div class="rem-ghead"><span class="rem-gname">' + g.label + '</span>' +
            '<span class="rem-gnum">' + list.length + '</span>' +
            '<span class="rem-ghint">' + g.hint + '</span></div>' +
            (list.length
              ? list.map(remRow).join('')
              : '<div class="rem-none">' + g.empty + '</div>') +
            '</div>';
        }).join('') + '</div>';
      }
      remHtml += '</div>';
      html += remHtml;

      /* ---------- 预警条 ---------- */
      if (alerts.length) {
        html += '<div class="alert-bar">' + alerts.slice(0, 4).map(function (a) {
          return '<div class="alert-item ' + a.level + '">' +
            MW.icon(a.icon, 14) +
            '<span class="alert-text">' + MW.esc(a.text) + '</span>' +
            '<button class="alert-btn" onclick="MW.goto(\'' + a.goto + '\')">' + a.action + '</button>' +
            '</div>';
        }).join('') + '</div>';
      }

      html += '<div class="today-grid">';

      /* ================= 左列：今天要发的 ================= */
      html += '<div class="today-col main">';

      html += '<div class="card"><div class="card-head">' +
        '<div class="card-title">' + MW.icon('bolt', 15) + ' 今日发布清单</div>' +
        '<div class="card-extra">' +
          /* 就绪度一眼看出来：今天这几条里，几条真能发 */
          (schedToday.length
            ? '<span class="task-ready-sum' + (readyToday === schedToday.length ? ' ok' : '') + '">' +
              readyToday + '/' + schedToday.length + ' 就绪</span>'
            : '') +
          '<button class="btn sm" onclick="MW.goto(\'#/publish\')">' + MW.icon('upload', 12) + ' 去发布</button>' +
          '<button class="btn sm" onclick="MW.act.aiWeekPlanModal()">' + MW.icon('sparkles', 12) + ' AI 补排期</button>' +
          '<button class="btn sm" onclick="MW.act.openContentModal(null, \'' + t + '\')">' + MW.icon('plus', 12) + ' 加一条</button>' +
        '</div></div>';

      if (!schedToday.length) {
        html += MW.ui.empty('今日无排期', '从下方选题库挑一条排上，或点右上角「加一条」');
      } else {
        html += schedToday.map(function (c) {
          const acc = db.accounts.find(function (a) { return a.id === c.accountId; });
          const pc = acc ? MW.PLATFORMS[acc.platform].color : '#999';
          const published = c.status === 'published';
          const m = c.metrics;
          const ck = MW.checksOf(c);
          return '<div class="task-row' + (published ? ' published' : '') + '">' +
            '<div class="task-time">' + (c.time || '--:--') + '</div>' +
            '<span class="task-bar" style="background:' + pc + '"></span>' +
            '<div class="task-main">' +
              '<div class="task-title">' + MW.esc(c.title) + '</div>' +
              '<div class="task-meta">' + MW.ui.pfChip(c.platform, true) +
                '<span class="task-acc">' + MW.esc(acc ? acc.name : '未指定账号') + '</span>' +
                /* 发布检查项没齐就标出来，点一下直接去发布管理补齐 */
                (!published && !ck.ready
                  ? '<button class="task-unready" onclick="MW.goto(\'#/publish\')" title="去发布管理补齐">' +
                    MW.icon('dot', 11) + ' ' + ck.done + '/' + ck.total + ' 就绪</button>'
                  : '') +
                (m ? '<span class="task-data">浏览 ' + MW.fmt.num(m.views) + ' · 涨粉 ' + (m.newFollowers >= 0 ? '+' : '') + m.newFollowers + '</span>' : '') +
              '</div>' +
            '</div>' +
            '<div class="task-ops">' +
              (published
                ? '<button class="btn sm" onclick="MW.act.quickMetrics(\'' + c.id + '\')">' + MW.icon('chart', 12) + (m ? ' 改数据' : ' 录数据') + '</button>'
                : '<button class="btn sm" onclick="MW.act.aiFromContent(\'' + c.id + '\')">' + MW.icon('sparkles', 12) + ' 写文案</button>' +
                  /* 走发布管理的同一套标记逻辑：没就绪会先确认，且会记下实际发布时间，
                     两个入口不能各写一份，否则状态和文案会不一致 */
                  '<button class="btn sm primary" onclick="MW.act.pubMark(\'' + c.id + '\')">' + MW.icon('check', 12) + ' 发了</button>') +
            '</div>' +
            '</div>';
        }).join('');
      }
      html += '</div>';

      /* 补排期：博主最容易断更的地方 */
      if (suggest.length) {
        html += '<div class="card"><div class="card-head">' +
          '<div class="card-title">' + MW.icon('flag', 15) + ' 今天还能排这些</div>' +
          '<div class="card-extra">库存里最该先发的</div></div>';
        html += suggest.map(function (tp) {
          const acc = db.accounts.find(function (a) { return a.id === tp.accountId; });
          const ty = MW.TOPIC_TYPES[tp.type] || MW.TOPIC_TYPES.case;
          return '<div class="suggest-row">' +
            '<span class="type-chip" style="--tc:' + ty.color + '">' + ty.name + '</span>' +
            '<div class="suggest-main"><div class="suggest-title">' + MW.esc(tp.title) + '</div>' +
            '<div class="suggest-sub">' + MW.esc(acc ? acc.name : '') + (tp.due ? ' · 截止 ' + tp.due.slice(5) : '') + '</div></div>' +
            '<button class="btn sm" onclick="MW.act.aiFromTopic(\'' + tp.id + '\')">写</button>' +
            '<button class="btn sm primary" onclick="MW.act.scheduleToday(\'' + tp.id + '\')">排今天</button>' +
            '</div>';
        }).join('');
        html += '</div>';
      }

      html += '</div>';

      /* ================= 右列：情报与节奏 ================= */
      html += '<div class="today-col side">';

      /* 账号健康 */
      const accList = cur === 'all' ? db.accounts : db.accounts.filter(function (a) { return a.id === cur; });
      html += '<div class="card"><div class="card-head">' +
        '<div class="card-title">' + MW.icon('users', 15) + ' 账号健康</div>' +
        '<div class="card-extra"><button class="btn sm" onclick="MW.act.snapshotModal()">' + MW.icon('trend', 12) + ' 记粉丝</button></div></div>';
      html += accList.map(function (a) {
        const p = MW.PLATFORMS[a.platform];
        const g = MW.growth(a, 7);
        const todayN = db.contents.filter(function (c) { return c.accountId === a.id && c.date === t; }).length;
        const silent = MW.silentDays(a);
        const stock = MW.stockCount(a.id);
        const vs = MW.snapValues(a, 8);
        return '<div class="health-row" onclick="MW.setCurAcc(\'' + a.id + '\')">' +
          '<span class="as-dot" style="background:' + p.color + '"></span>' +
          '<div class="health-main">' +
            '<div class="health-top"><span class="health-name">' + MW.esc(a.name) + '</span>' +
            '<span class="health-fans">' + MW.fmt.int(a.followers) + '</span>' +
            '<span class="health-delta ' + (g.delta >= 0 ? 'up' : 'down') + '">' + (g.delta >= 0 ? '+' : '') + g.delta + '</span></div>' +
            '<div class="health-bot">' +
              '<span' + (todayN ? ' class="on"' : '') + '>今日 ' + todayN + ' 篇</span>' +
              '<span' + (stock < 3 ? ' class="warn"' : '') + '>库存 ' + stock + '</span>' +
              '<span' + (silent >= 5 ? ' class="warn"' : '') + '>' + (MW.lastPublish(a.id) ? '断更 ' + silent + ' 天' : '尚未发布') + '</span>' +
              '<span class="health-spark">' + (vs.length > 1
                ? MW.charts.sparkline(vs, g.delta >= 0 ? '#e5484d' : '#18a058', 54, 18) : '') + '</span>' +
            '</div>' +
          '</div></div>';
      }).join('');
      html += '</div>';

      /* 今日热点：一键变选题 */
      const hots = db.hotspots.slice().sort(function (a, b) { return b.heat - a.heat; }).slice(0, 3);
      html += '<div class="card"><div class="card-head">' +
        '<div class="card-title">' + MW.icon('flame', 15) + ' 今天能蹭的热点</div>' +
        '<div class="card-extra"><a href="#/ideas" onclick="MW.goto(\'#/ideas\');return false;">更多</a></div></div>';
      html += hots.map(function (h) {
        return '<div class="hot-mini">' +
          '<span class="hot-heat">' + h.heat + '</span>' +
          '<div class="hot-main"><div class="hot-title">' + MW.esc(h.title) + '</div>' +
          '<div class="hot-sub">' + MW.esc(h.note || '') + '</div></div>' +
          '<button class="btn sm" onclick="MW.act.hotToTopic(\'' + h.id + '\')">转选题</button>' +
          '</div>';
      }).join('');
      html += '</div>';

      /* 仪式 + 待办 */
      html += '<div class="card"><div class="card-head">' +
        '<div class="card-title">' + MW.icon('flame', 15) + ' 每日仪式</div>' +
        '<div class="card-extra">' + doneIds.length + '/' + ritualTotal + '</div></div>';
      if (!db.rituals.length) {
        html += MW.ui.empty('尚未设置仪式', '前往「打卡待办」创建固定动作');
      } else {
        html += db.rituals.map(function (r) {
          const done = doneIds.indexOf(r.id) >= 0;
          return '<div class="rt-row' + (done ? ' done' : '') + '" onclick="MW.act.toggleRitual(\'' + r.id + '\')">' +
            '<span class="rt-check">' + MW.icon('check', 13) + '</span>' +
            '<span class="rt-name">' + MW.esc(r.name) + '</span></div>';
        }).join('');
      }
      html += '</div>';

      html += '<div class="card"><div class="card-head">' +
        '<div class="card-title">' + MW.icon('checksq', 15) + ' 今日待办</div>' +
        '<div class="card-extra">' + todosDone + '/' + todosToday.length + '</div></div>';
      html += '<div class="quick-add"><input id="quick-todo-input" placeholder="快速添加待办，回车即可" onkeydown="if(event.key===\'Enter\')MW.act.quickAddTodo()">' +
        '<button class="btn primary sm" onclick="MW.act.quickAddTodo()">添加</button></div>';
      if (!todosToday.length) {
        html += MW.ui.empty('今日无待办', '保持节奏，避免创作中断');
      } else {
        html += todosToday.map(function (td) {
          return '<div class="td-row' + (td.done ? ' done' : '') + '" onclick="MW.act.toggleTodo(\'' + td.id + '\')">' +
            '<span class="td-check">' + MW.icon('check', 12) + '</span>' +
            '<span class="td-title">' + MW.esc(td.title) + '</span>' +
            MW.ui.statusChip(td.status) +
            MW.ui.ownerChip(td.owner) + MW.ui.prioChip(td.priority) +
            (td.time ? '<span class="td-due">' + td.time + '</span>' : '') + '</div>';
        }).join('');
      }
      html += '</div>';

      html += '</div>';
      html += '</div>';

      root.innerHTML = html;
    }
  };
})();
