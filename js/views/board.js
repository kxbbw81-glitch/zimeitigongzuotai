/* ============================================================
   视图 · 选题看板（选题入库、评审、状态流转）
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  let filterAcc = 'all';
  let lastCur = null;

  MW.act.setBoardFilter = function (a) { filterAcc = a; MW.render(); };

  /* 用当前筛选的账号补选题，避免生成到别的号上 */
  MW.act.aiFillIdeasBoard = function () {
    MW.act.aiFillIdeas(filterAcc === 'all' ? '' : filterAcc, 3);
  };

  MW.act.moveTopic = function (id, stage) {
    const db = MW.getDB();
    const tp = db.topics.find(function (x) { return x.id === id; });
    if (!tp || tp.stage === stage) return;
    tp.stage = stage;
    MW.save(); MW.render();
    const st = MW.STAGES.find(function (s) { return s.id === stage; });
    MW.toast('已移动到「' + st.name + '」');
  };

  MW.act.scheduleTopic = function (id) {
    const db = MW.getDB();
    const tp = db.topics.find(function (x) { return x.id === id; });
    if (!tp) return;
    const acc = db.accounts.find(function (a) { return a.id === tp.accountId; });
    const date = tp.due || MW.dateStr();
    db.contents.push({
      id: MW.uid(), title: tp.title, accountId: tp.accountId,
      platform: acc ? acc.platform : 'other', date: date, time: '12:00',
      status: 'scheduled', topicId: tp.id, focus: tp.focus || MW.guessFocus(tp.accountId, tp.title),
      metrics: null, note: '', createdAt: MW.dateStr()
    });
    tp.stage = 'scheduled';
    MW.save(); MW.render();
    MW.closeModal();
    MW.toast('已排期到 ' + date + '，可在内容日历调整');
  };

  MW.act.aiFromTopic = function (id) {
    MW.closeModal();
    MW.goto('#/ai');
    MW.act.aiUseTopic(id);
  };

  MW.act.delTopic = function (id) {
    const db = MW.getDB();
    MW.confirm('确定删除这个选题？', function () {
      db.topics = db.topics.filter(function (x) { return x.id !== id; });
      MW.save(); MW.render(); MW.closeModal();
      MW.toast('选题已删除');
    }, { okText: '删除' });
  };

  MW.act.openTopicModal = function (id, presetStage) {
    const db = MW.getDB();
    const tp = id ? db.topics.find(function (x) { return x.id === id; }) : null;
    const accOpts = db.accounts.length
      ? db.accounts.map(function (a) { return { v: a.id, t: a.name + '（' + MW.PLATFORMS[a.platform].name + '）' }; })
      : [{ v: '', t: '（请先添加账号）' }];
    const body =
      MW.ui.row('选题标题', '<input id="t-title" placeholder="一句话说清楚这篇内容讲什么" value="' + MW.esc(tp ? tp.title : '') + '">') +
      '<div class="form-2col">' +
        MW.ui.row('所属账号', MW.ui.select('t-account', accOpts, tp ? tp.accountId : (db.accounts[0] ? db.accounts[0].id : ''))) +
        MW.ui.row('内容类型', MW.ui.select('t-type', Object.keys(MW.TOPIC_TYPES).map(function (k) { return { v: k, t: MW.TOPIC_TYPES[k].name }; }), tp ? tp.type : 'case')) +
      '</div>' +
      '<div class="form-2col">' +
        MW.ui.row('当前阶段', MW.ui.select('t-stage', MW.STAGES.map(function (s) { return { v: s.id, t: s.name }; }), tp ? tp.stage : (presetStage || 'idea'))) +
        MW.ui.row('截止日期', '<input id="t-due" type="date" value="' + (tp && tp.due ? tp.due : '') + '">') +
      '</div>' +
      '<div class="form-2col">' +
        MW.ui.row('优先级', MW.ui.select('t-priority', [{ v: 'high', t: '高' }, { v: 'mid', t: '中' }, { v: 'low', t: '低' }], tp ? tp.priority : 'mid')) +
        MW.ui.row('负责人', MW.ui.select('t-owner', [{ v: '我', t: '我' }, { v: '合伙人', t: '合伙人' }], tp ? tp.owner : '我')) +
      '</div>' +
      MW.ui.row('备注', '<textarea id="t-note" rows="3" placeholder="切入点、参考链接、要突出的数据……">' + MW.esc(tp ? tp.note : '') + '</textarea>') +
      MW.ui.row('内容方向', '<div id="t-focus-wrap">' +
        MW.ui.focusOptions(tp ? tp.accountId : (db.accounts[0] ? db.accounts[0].id : ''), tp ? tp.focus : '', 't-focus') + '</div>',
        '对应该账号的一个内容聚焦方向，账号页会统计每个方向的产出');

    MW.modal({
      title: tp ? '编辑选题' : '新建选题',
      sub: tp ? '' : '灵感先入库，再逐步流转到发布',
      body: body,
      okText: '保存',
      onOk: function (root) {
        const v = function (id2) { return (root.querySelector('#' + id2).value || '').trim(); };
        const title = v('t-title');
        if (!title) { MW.toast('请填写选题标题', 'error'); return false; }
        const obj = {
          title: title,
          accountId: v('t-account'),
          type: v('t-type'),
          stage: v('t-stage'),
          priority: v('t-priority'),
          due: v('t-due'),
          owner: v('t-owner'),
          focus: (root.querySelector('#t-focus') || { value: '' }).value || '',
          note: v('t-note')
        };
        if (tp) Object.assign(tp, obj);
        else db.topics.push(Object.assign({ id: MW.uid(), createdAt: MW.dateStr() }, obj));
        MW.save(); MW.render();
        MW.toast(tp ? '选题已更新' : '选题已入库');
        if (!tp) MW.closeModal();
      }
    });
    /* 换账号时，内容方向选项跟着换 */
    const accSel = document.getElementById('t-account');
    const fw = document.getElementById('t-focus-wrap');
    if (accSel && fw) {
      accSel.onchange = function () {
        const cur = fw.querySelector('#t-focus') ? fw.querySelector('#t-focus').value : '';
        fw.innerHTML = MW.ui.focusOptions(accSel.value, cur, 't-focus');
      };
    }
    if (tp) {
      const foot = document.querySelector('#modal-root .modal-foot');
      if (foot) {
        const extra = document.createElement('div');
        extra.className = 'modal-foot-extra';
        extra.innerHTML =
          '<button class="btn sm" onclick="MW.act.scheduleTopic(\'' + tp.id + '\')">' + MW.icon('calendar', 13) + ' 排期到日历</button>' +
          '<button class="btn sm" onclick="MW.act.aiFromTopic(\'' + tp.id + '\')">' + MW.icon('sparkles', 13) + ' AI 生成文案</button>' +
          '<button class="btn sm danger-ghost" onclick="MW.act.delTopic(\'' + tp.id + '\')">' + MW.icon('trash', 13) + ' 删除</button>';
        foot.appendChild(extra);
      }
    }
  };
  MW.act.editTopic = MW.act.openTopicModal;

  MW.views['board'] = {
    id: 'board', name: '选题看板', icon: 'kanban',
    sub: '选题入库、评审、状态流转，形成内容资产',
    render: function (root) {
      const db = MW.getDB();
      const today = MW.dateStr();
      /* 跟随侧边栏账号视角 */
      const cur = MW.curAcc();
      if (cur !== lastCur) { filterAcc = cur === 'all' ? 'all' : cur; lastCur = cur; }

      let html = '<div class="page-head"><div class="page-title">选题看板</div>' +
        '<div class="page-sub">拖拽卡片即可流转阶段 · 共 ' + db.topics.length + ' 个选题</div>' +
        '<button class="btn primary" onclick="MW.act.openTopicModal()">' + MW.icon('plus', 14) + ' 新建选题</button></div>';

      const accOpts = [{ v: 'all', t: '全部账号' }].concat(db.accounts.map(function (a) {
        return { v: a.id, t: a.name };
      }));
      html += '<div class="filter-bar">' + MW.ui.select('board-filter', accOpts, filterAcc) +
        '<span class="filter-tip">' + MW.icon('filter', 13) + ' 按账号筛选</span>' +
        '<button class="btn sm" onclick="MW.act.aiFillIdeasBoard()">' + MW.icon('sparkles', 12) + ' AI 补选题</button></div>';

      html += '<div class="kans">';
      MW.STAGES.forEach(function (st) {
        const items = db.topics.filter(function (t) {
          return t.stage === st.id && (filterAcc === 'all' || t.accountId === filterAcc);
        });
        html += '<div class="kan-col">' +
          '<div class="kan-head"><span class="kan-dot" style="background:' + st.color + '"></span>' +
          '<span class="kan-name">' + st.name + '</span><span class="kan-count">' + items.length + '</span></div>' +
          '<div class="kan-body" id="kbody-' + st.id + '">' +
          (items.length ? items.map(function (t) {
            const acc = db.accounts.find(function (a) { return a.id === t.accountId; });
            const ty = MW.TOPIC_TYPES[t.type] || MW.TOPIC_TYPES.case;
            const overdue = t.due && t.due < today && st.id !== 'published' && st.id !== 'retro';
            return '<div class="k-card" data-id="' + t.id + '">' +
              '<div class="k-card-top"><span class="type-chip" style="--tc:' + ty.color + '">' + ty.name + '</span>' + MW.ui.prioChip(t.priority) + '</div>' +
              '<div class="k-title">' + MW.esc(t.title) + '</div>' +
              '<div class="k-meta">' +
              (acc ? '<span class="k-acc" style="--pc:' + MW.PLATFORMS[acc.platform].color + '">' + MW.esc(acc.name) + '</span>' : '') +
              (t.due ? '<span class="k-due' + (overdue ? ' over' : '') + '">' + MW.icon('clock', 11) + ' ' + t.due.slice(5) + '</span>' : '') +
              MW.ui.ownerChip(t.owner) +
              '</div></div>';
          }).join('') : '<div class="kan-empty">暂无选题</div>') +
          '</div>' +
          '<button class="kan-add" onclick="MW.act.openTopicModal(\'\', \'' + st.id + '\')">' + MW.icon('plus', 13) + ' 添加</button>' +
          '</div>';
      });
      html += '</div>';

      root.innerHTML = html;

      /* 绑定拖拽 */
      root.querySelectorAll('.k-card').forEach(function (el) {
        MW.dragSrc(el, 'topic', el.getAttribute('data-id'));
        el.addEventListener('click', function () {
          if (!el.classList.contains('dragging')) MW.act.editTopic(el.getAttribute('data-id'));
        });
      });
      root.querySelectorAll('.kan-body').forEach(function (el) {
        const stage = el.id.replace('kbody-', '');
        MW.dropZone(el, function (parts) {
          if (parts[0] === 'topic') MW.act.moveTopic(parts[1], stage);
        });
      });
      const filterEl = document.getElementById('board-filter');
      if (filterEl) filterEl.onchange = function () { filterAcc = this.value; MW.render(); };
    }
  };
})();
