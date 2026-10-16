/* ============================================================
   视图 · 打卡待办（每日仪式 + 待办清单）
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  /* 待办清单的筛选页签：全部 / 待完成 / 已完成（模块级状态，切页回来还在） */
  let todoFilter = 'all';

  MW.act.setTodoFilter = function (f) {
    todoFilter = f === 'open' || f === 'done' ? f : 'all';
    MW.render();
  };

  /* 把「2026-10-12 14:00」说成人话："今天 14:00" / "逾期 2 天 · 10/12 14:00"。
     只显示日期的话，今天的待办和三天后的待办长得一样，扫一眼分不出轻重。 */
  function dueText(td, today) {
    if (!td.date) return null;
    const hm = td.time ? ' ' + td.time : '';
    const md = td.date.slice(5).replace('-', '/');
    const d = td.date;
    if (d < today) {
      return { text: '逾期 ' + MW.daysBetween(d, today) + ' 天', late: true };
    }
    if (d === today) return { text: '今天' + hm, late: false };
    if (d === MW.addDays(today, 1)) return { text: '明天' + hm, late: false };
    if (d === MW.addDays(today, 2)) return { text: '后天' + hm, late: false };
    return { text: md + hm, late: false };
  }

      function dayComplete(dateStr) {
        const db = MW.getDB();
        const done = validIds(db.ritualLog[dateStr] || []);
        return db.rituals.length > 0 && done.length >= db.rituals.length;
      }

      function validIds(ids) {
        const db = MW.getDB();
        return ids.filter(function (id) {
          return db.rituals.some(function (r) { return r.id === id; });
        });
      }

  function calcStreak() {
    const t = MW.dateStr();
    let streak = 0;
    let d = dayComplete(t) ? t : MW.addDays(t, -1);
    while (dayComplete(d)) { streak++; d = MW.addDays(d, -1); }
    return streak;
  }

  function monthRate() {
    const db = MW.getDB();
    const t = MW.dateStr();
    const month = t.slice(0, 7);
    let done = 0, total = 0;
    for (let i = 1; i <= 31; i++) {
      const ds = month + '-' + String(i).padStart(2, '0');
      if (ds > t) break;
      total++;
      if (dayComplete(ds)) done++;
    }
    return { done: done, total: total };
  }

  MW.act.toggleRitualToday = function (id) { MW.act.toggleRitual(id); };

  MW.act.openRitualModal = function (id) {
    const db = MW.getDB();
    const r = id ? db.rituals.find(function (x) { return x.id === id; }) : null;
    const body = MW.ui.row('仪式名称', '<input id="r-name" placeholder="例如：刷 30 分钟对标账号找灵感" value="' + MW.esc(r ? r.name : '') + '">', '小而具体的仪式更容易坚持');
    MW.modal({
      title: r ? '编辑仪式' : '添加每日仪式',
      body: body,
      okText: '保存',
      onOk: function (root) {
        const name = (root.querySelector('#r-name').value || '').trim();
        if (!name) { MW.toast('请填写仪式名称', 'error'); return false; }
        if (r) r.name = name;
        else db.rituals.push({ id: MW.uid(), name: name, icon: 'check' });
        MW.save(); MW.render();
        MW.toast('已保存');
      }
    });
  };

  MW.act.delRitual = function (id) {
    const db = MW.getDB();
    const r = db.rituals.find(function (x) { return x.id === id; });
    MW.confirm('删除「' + (r ? r.name : '该仪式') + '」？历史打卡记录会一并清掉。', function () {
      db.rituals = db.rituals.filter(function (x) { return x.id !== id; });
      /* 必须把历史打卡里残留的 id 也清掉，否则今日完成度和周报全勤天数会算多 */
      Object.keys(db.ritualLog || {}).forEach(function (d) {
        db.ritualLog[d] = (db.ritualLog[d] || []).filter(function (x) { return x !== id; });
      });
      MW.save(); MW.render();
      MW.toast('仪式已删除');
    }, { okText: '删除' });
  };

  MW.act.openTodoModal = function (id, presetDate) {
    const db = MW.getDB();
    const td = id ? db.todos.find(function (x) { return x.id === id; }) : null;
    const body =
      MW.ui.row('待办内容', '<input id="td-title" placeholder="要做什么" value="' + MW.esc(td ? td.title : '') + '">') +      '<div class="form-2col">' +
        MW.ui.row('日期', '<input id="td-date" type="date" value="' + (td ? td.date : (presetDate || MW.dateStr())) + '">') +
        MW.ui.row('时间', '<input id="td-time" type="time" value="' + (td && td.time ? td.time : '') + '">', '可留空，只按天排') +
      '</div>' +
      '<div class="form-2col">' +
        MW.ui.row('状态', MW.ui.select('td-status', MW.TODO_STATUSES.map(function (s) { return { v: s.key, t: s.label }; }),
          td ? (td.status || 'todo') : 'todo'), '当前所处环节') +
        MW.ui.row('优先级', MW.ui.select('td-priority', [{ v: 'high', t: '高' }, { v: 'mid', t: '中' }, { v: 'low', t: '低' }], td ? td.priority : 'mid')) +
      '</div>' +
      MW.ui.row('负责人', MW.ui.select('td-owner', [{ v: '我', t: '我' }, { v: '合伙人', t: '合伙人' }], td ? td.owner : '我'));

    MW.modal({
      title: td ? '编辑待办' : '添加待办',
      body: body,
      okText: '保存',
      onOk: function (root) {
        const v = function (id2) { return (root.querySelector('#' + id2).value || '').trim(); };
        const title = v('td-title');
        if (!title) { MW.toast('请填写待办内容', 'error'); return false; }
        const obj = {
          title: title,
          date: v('td-date') || MW.dateStr(),
          time: v('td-time'),
          status: v('td-status') || 'todo',
          owner: v('td-owner'),
          priority: v('td-priority')
        };
        if (td) Object.assign(td, obj);
        else db.todos.push(Object.assign({ id: MW.uid(), done: false, createdAt: MW.dateStr() }, obj));
        MW.save(); MW.render();
        MW.toast(td ? '待办已更新' : '待办已添加');
      }
    });
    if (td) {
      const foot = document.querySelector('#modal-root .modal-foot');
      if (foot) {
        const extra = document.createElement('div');
        extra.className = 'modal-foot-extra';
        extra.innerHTML = '<button class="btn sm danger-ghost" onclick="MW.act.delTodo(\'' + td.id + '\')">' + MW.icon('trash', 13) + ' 删除</button>';
        foot.appendChild(extra);
      }
    }
  };

  MW.act.delTodo = function (id) {
    const db = MW.getDB();
    db.todos = db.todos.filter(function (x) { return x.id !== id; });
    MW.save(); MW.render(); MW.closeModal();
    MW.toast('已删除');
  };

  MW.views['todos'] = {
    id: 'todos', name: '打卡待办', icon: 'checksq',
    sub: '以固定仪式培养创作节奏，以待办清单推进执行',
    render: function (root) {
      const db = MW.getDB();
      const t = MW.dateStr();
      const doneIds = validIds(db.ritualLog[t] || []);
      const streak = calcStreak();
      const rate = monthRate();

      let html = '<div class="page-head"><div class="page-title">打卡待办</div>' +
        '<div class="page-sub">用固定仪式沉淀创作节奏，用待办清单保障计划落地</div>' +
        '<button class="btn primary" onclick="MW.act.openTodoModal()">' + MW.icon('plus', 14) + ' 添加待办</button></div>';

      html += '<div class="todo-grid">';

      /* 左列：每日仪式 */
      html += '<div class="card"><div class="card-head"><div class="card-title">' + MW.icon('flame', 15) + ' 每日仪式</div>' +
        '<div class="card-extra"><button class="btn sm" onclick="MW.act.openRitualModal()">' + MW.icon('plus', 12) + ' 添加</button></div></div>';

      html += '<div class="streak-bar">' +
        '<div class="streak-flame">' + MW.icon('flame', 20) + '<b>' + streak + '</b><span>天连续打卡</span></div>' +
        '<div class="streak-dots">' + Array.from({ length: 7 }, function (_, i) {
          const ds = MW.addDays(t, -(6 - i));
          const ok = dayComplete(ds);
          return '<span class="sdot' + (ok ? ' on' : '') + (ds === t ? ' today' : '') + '" title="' + ds + '"></span>';
        }).join('') + '</div>' +
        '<div class="streak-rate">本月打卡率 <b>' + Math.round(rate.done / Math.max(rate.total, 1) * 100) + '%</b>（' + rate.done + '/' + rate.total + ' 天）</div>' +
        '</div>';

      if (!db.rituals.length) {
        html += MW.ui.empty('暂无每日仪式', '例如：刷对标账号 30 分钟、记录昨日数据、收集 3 个选题');
      } else {
        html += db.rituals.map(function (r) {
          const done = doneIds.indexOf(r.id) >= 0;
          return '<div class="rt-row' + (done ? ' done' : '') + '">' +
            '<span class="rt-check" onclick="MW.act.toggleRitualToday(\'' + r.id + '\')">' + MW.icon('check', 13) + '</span>' +
            '<span class="rt-name">' + MW.esc(r.name) + '</span>' +
            '<span class="rt-ops"><button class="icon-btn sm" onclick="MW.act.openRitualModal(\'' + r.id + '\')">' + MW.icon('edit', 12) + '</button>' +
            '<button class="icon-btn sm" onclick="MW.act.delRitual(\'' + r.id + '\')">' + MW.icon('trash', 12) + '</button></span></div>';
        }).join('');
      }
      html += '</div>';

      /* 右列：待办清单
         不按「今天/明天/本周」分组了——分组标签占了高度，同一条待办到底是
         今天要交还是三天后交，还得去读组名。改成平铺 + 每行自带人话时间。 */
      const openN = db.todos.filter(function (x) { return !x.done; }).length;
      const doneN = db.todos.length - openN;

      html += '<div class="card"><div class="card-head">' +
        '<div class="card-title">' + MW.icon('checksq', 15) + ' 待办清单</div>' +
        '<div class="card-extra"><div class="seg small">' +
          [['all', '全部', db.todos.length], ['open', '未完成', openN], ['done', '已完成', doneN]].map(function (f) {
            return '<button class="seg-btn' + (todoFilter === f[0] ? ' active' : '') +
              '" onclick="MW.act.setTodoFilter(\'' + f[0] + '\')">' + f[1] + '<span class="seg-n">' + f[2] + '</span></button>';
          }).join('') +
        '</div></div></div>';

      let list = db.todos.slice();
      if (todoFilter === 'open') list = list.filter(function (x) { return !x.done; });
      else if (todoFilter === 'done') list = list.filter(function (x) { return x.done; });

      /* 未完成在前；未完成内部按日期+时间升序（逾期自然浮到最上面）；
         已完成的沉底并按完成时间倒序。没填时间的排到当天最后，而不是当成 00:00。 */
      list.sort(function (a, b) {
        if (!!a.done !== !!b.done) return a.done ? 1 : -1;
        const ka = (a.date || '') + ' ' + (a.time || '99:99');
        const kb = (b.date || '') + ' ' + (b.time || '99:99');
        return a.done ? kb.localeCompare(ka) : ka.localeCompare(kb);
      });

      if (!list.length) {
        html += MW.ui.empty(
          todoFilter === 'done' ? '暂无已完成的待办' : (todoFilter === 'open' ? '暂无未完成的待办' : '暂无待办'),
          todoFilter === 'all' ? '从添加一条待办开始' : '');
      } else {
        html += list.map(function (td) {
          const due = dueText(td, t);
          return '<div class="td-row' + (td.done ? ' done' : '') + '">' +
            '<span class="td-check" onclick="MW.act.toggleTodo(\'' + td.id + '\')">' + MW.icon('check', 12) + '</span>' +
            '<span class="td-title" onclick="MW.act.toggleTodo(\'' + td.id + '\')">' + MW.esc(td.title) + '</span>' +
            MW.ui.statusChip(td.status) +
            MW.ui.ownerChip(td.owner) + MW.ui.prioChip(td.priority) +
            (due ? '<span class="td-due' + (due.late ? ' late' : '') + '">' + due.text + '</span>' : '') +
            '<span class="td-ops"><button class="icon-btn sm" onclick="MW.act.openTodoModal(\'' + td.id + '\')">' + MW.icon('edit', 12) + '</button></span>' +
            '</div>';
        }).join('');
      }
      html += '</div>';

      html += '</div>';

      root.innerHTML = html;
    }
  };
})();
