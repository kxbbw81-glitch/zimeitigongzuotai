/* ============================================================
   视图 · 灵感雷达（每日选题灵感 + 爆款热点二创）
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  let filterAcc = 'all';
  let lastCur = null;

  /* 选题工厂：没货了就地取材——本地公式顶一批，或接大模型现造 */
  const fac = { accId: '', list: [] };
  function facAcc() {
    const db = MW.getDB();
    if (!db.accounts.length) return '';
    if (!db.accounts.some(function (a) { return a.id === fac.accId; })) {
      const cur = MW.curAcc();
      fac.accId = (cur !== 'all' ? cur : db.accounts[0].id);
    }
    return fac.accId;
  }
  /* AI 返回的原始行 → 统一结构（去序号/引号，长度过滤） */
  function parseAiTitles(txt, accId) {
    return String(txt || '').split('\n')
      .map(function (s) {
        return s.replace(/^\s*[\d.、\-•)】\s]+/, '').replace(/^["“'']+|["”'']+$/g, '').trim();
      })
      .filter(function (s) { return s.length >= 5; })
      .slice(0, 10)
      .map(function (t) {
        return { title: t, type: MW.ai.guessType(t), focus: MW.guessFocus(accId, t), reason: 'AI 生成 · 围绕账号内容聚焦', src: 'ai' };
      });
  }
  function localTitles(accId) {
    return MW.ai.ideas(accId, 8).map(function (it) {
      return { title: it.title, type: it.type, focus: it.focus, reason: it.reason, src: 'local' };
    });
  }
  MW.act.factorySetAcc = function (id) { fac.accId = id; MW.render(); };
  MW.act.factoryGen = function (mode) {
    const db = MW.getDB();
    const accId = facAcc();
    if (!accId) { MW.toast('先在账号矩阵添加账号', 'error'); return; }
    const acc = MW.accOf(accId);
    if (mode === 'local' || !MW.ai.aiReady()) {
      fac.list = localTitles(accId);
      MW.render();
      MW.toast('本地公式生成 ' + fac.list.length + ' 个选题 ⚡');
      if (mode === 'ai') {
        MW.copy(MW.ai.accountBrief(acc) + '请直接输出 10 个选题标题，每行一个。要求：有爆款潜力、符合账号定位与平台调性、围绕内容聚焦主题。不要编号、不要引号、不要解释。');
        MW.toast('尚未配置 AI 接口——已用本地公式生成，提示词已复制', 'error');
      }
      return;
    }
    MW.toast('🤖 AI 生成中，请稍候…');
    const prompt = MW.ai.accountBrief(acc) + '请直接输出 10 个选题标题，每行一个。要求：有爆款潜力、符合账号定位与平台调性、围绕内容聚焦主题。不要编号、不要引号、不要解释。';
    MW.ai.chat(prompt).then(function (txt) {
      const list = txt ? parseAiTitles(txt, accId) : [];
      if (!list.length) {
        fac.list = localTitles(accId);
        MW.copy(prompt);
        MW.toast('AI 没返回可用结果，已用本地公式顶一批；提示词已复制', 'error');
      } else {
        fac.list = list;
        MW.toast('AI 生成了 ' + list.length + ' 个选题 🤖');
      }
      MW.render();
    });
  };
  MW.act.factoryImport = function () {
    const db = MW.getDB();
    const boxes = Array.prototype.slice.call(document.querySelectorAll('#fac-list input:checked'));
    if (!boxes.length) { MW.toast('先勾选要入库的选题'); return; }
    const accId = facAcc();
    boxes.forEach(function (b) {
      const it = fac.list[+b.getAttribute('data-i')];
      if (!it) return;
      db.topics.push({
        id: MW.uid(), title: it.title, accountId: accId, type: it.type,
        stage: 'idea', priority: 'mid', due: '', owner: '我',
        focus: it.focus || MW.guessFocus(accId, it.title),
        note: '选题工厂' + (it.src === 'ai' ? ' · AI 生成' : ' · 本地公式'), createdAt: MW.dateStr()
      });
    });
    fac.list = [];
    MW.save(); MW.render();
    MW.toast('已入库 ' + boxes.length + ' 个选题，在「灵感池」阶段');
  };
  MW.act.factoryClear = function () { fac.list = []; MW.render(); };

  MW.act.setIdeaFilter = function (a) { filterAcc = a; MW.render(); };

  MW.act.openInspirationModal = function (id) {
    const db = MW.getDB();
    const it = id ? db.inspirations.find(function (x) { return x.id === id; }) : null;
    const accOpts = db.accounts.length
      ? db.accounts.map(function (a) { return { v: a.id, t: a.name }; })
      : [{ v: '', t: '（请先添加账号）' }];
    const body =
      MW.ui.row('灵感标题', '<input id="i-title" placeholder="一句能勾起表达欲的话" value="' + MW.esc(it ? it.title : '') + '">') +
      '<div class="form-2col">' +
        MW.ui.row('来源', '<input id="i-source" placeholder="竞品评论区 / 客户咨询 / 自己项目" value="' + MW.esc(it ? it.source : '') + '">') +
        MW.ui.row('关联账号', MW.ui.select('i-account', accOpts, it ? it.accountId : (db.accounts[0] ? db.accounts[0].id : ''))) +
      '</div>' +
      MW.ui.row('标签', '<textarea id="i-tags" rows="2" placeholder="每行一个，或用逗号分隔" style="min-height:48px">' + MW.esc(it ? it.tags.join('\n') : '') + '</textarea>') +
      MW.ui.row('备注', '<textarea id="i-note" rows="2" placeholder="为什么值得做？切入点是什么？">' + MW.esc(it ? it.note : '') + '</textarea>');

    MW.modal({
      title: it ? '编辑灵感' : '捕捉灵感',
      sub: '先记下来，评审是后面的事',
      body: body,
      okText: '保存',
      onOk: function (root) {
        const v = function (id2) { return (root.querySelector('#' + id2).value || '').trim(); };
        const title = v('i-title');
        if (!title) { MW.toast('请填写灵感标题', 'error'); return false; }
        const obj = {
          title: title, source: v('i-source'), accountId: v('i-account'),
          tags: MW.parseTags(v('i-tags')),
          note: v('i-note')
        };
        if (it) Object.assign(it, obj);
        else db.inspirations.unshift(Object.assign({ id: MW.uid(), createdAt: MW.dateStr() }, obj));
        MW.save(); MW.render();
        MW.toast('灵感已入库');
      }
    });
  };

  MW.act.delInspiration = function (id) {
    const db = MW.getDB();
    db.inspirations = db.inspirations.filter(function (x) { return x.id !== id; });
    MW.save(); MW.render();
    MW.toast('已删除');
  };

  MW.act.inspirationToTopic = function (id) {
    const db = MW.getDB();
    const it = db.inspirations.find(function (x) { return x.id === id; });
    if (!it) return;
    const accId = it.accountId || (db.accounts[0] ? db.accounts[0].id : '');
    db.topics.push({
      id: MW.uid(), title: it.title, accountId: accId,
      type: 'case', stage: 'review', priority: 'mid', due: '', owner: '我',
      /* 带上标题和标签一起猜方向，账号页「每个方向产出」才统计得到 */
      focus: MW.guessFocus(accId, it.title + ' ' + (it.tags || []).join(' ')),
      note: '来自灵感：' + (it.source || '灵感雷达'), createdAt: MW.dateStr()
    });
    db.inspirations = db.inspirations.filter(function (x) { return x.id !== id; });
    MW.save(); MW.render();
    MW.toast('已转为选题，去「待评审」看看');
  };

  /* 热点一步变选题：热点讲时效性，少点几下就是抢时间 */
  MW.act.hotToTopic = function (id) {
    const db = MW.getDB();
    const hs = db.hotspots.find(function (x) { return x.id === id; });
    if (!hs) return;
    /* 按内容聚焦挑最合适的账号，别把所有热点都堆到主号上 */
    const accId = MW.pickAcc(hs.title + ' ' + (hs.category || ''), hs.platform);
    if (!accId) { MW.toast('先在账号矩阵添加账号', 'error'); return; }
    db.topics.push({
      id: MW.uid(), title: hs.title, accountId: accId, type: 'case', stage: 'review',
      priority: 'high', due: MW.addDays(MW.dateStr(), 2), owner: '我',
      focus: MW.guessFocus(accId, hs.title + ' ' + (hs.category || '')),
      note: '热点二创：' + (hs.note || '') + '（热度 ' + hs.heat + '）', createdAt: MW.dateStr()
    });
    MW.save(); MW.render();
    MW.toast('已转为选题，热点要快——48 小时内发出去才有流量');
  };

  /* 营销节点提前布局：节点内容是白捡的流量，但必须提前做——当天赶来不及。
     一键出选题：自动挑账号（按内容聚焦语义匹配，不会全砸主号）、
     带上该账号的第一个内容方向、截止日 = 节点前 2 天 */
  MW.act.nodeToTopic = function (date, name, cat) {
    const db = MW.getDB();
    const accId = MW.pickAcc((name || '') + ' ' + (cat || ''), '') || (db.accounts[0] ? db.accounts[0].id : '');
    if (!accId) { MW.toast('先在账号矩阵添加账号', 'error'); return; }
    const acc = MW.accOf(accId);
    const f = (acc && acc.focus && acc.focus[0]) || '';
    const due = MW.addDays(date, -2);
    const t = MW.dateStr();
    db.topics.push({
      id: MW.uid(),
      title: name + '借势：' + (f ? f + '这个角度怎么写' : '结合账号定位做节点内容'),
      accountId: accId, type: 'case', stage: 'idea',
      priority: 'high', due: due < t ? t : due, owner: '我',
      focus: f,
      note: '营销节点「' + name + '」（' + date + '）借势，建议提前 5-7 天发出去占位',
      createdAt: t
    });
    MW.save(); MW.render();
    MW.toast('已生成借势选题，截止 ' + (due < t ? '今天' : due));
  };

  MW.act.hotspotToInspiration = function (id) {
    const db = MW.getDB();
    const hs = db.hotspots.find(function (x) { return x.id === id; });
    if (!hs) return;
    db.inspirations.unshift({
      id: MW.uid(), title: hs.title, source: '热点雷达 · ' + hs.category,
      accountId: MW.pickAcc(hs.title + ' ' + (hs.category || ''), hs.platform),
      tags: [hs.category],
      note: (hs.note || '') + '（热度 ' + hs.heat + '）', createdAt: MW.dateStr()
    });
    MW.save(); MW.render();
    MW.toast('热点已转为灵感，可继续加工成选题');
  };

  MW.views['ideas'] = {
    id: 'ideas', name: '灵感雷达', icon: 'bulb',
    sub: '每日选题灵感 + 爆款热点二创，一站式发现方向',
    render: function (root) {
      const db = MW.getDB();
      /* 跟随侧边栏的账号视角 */
      const cur = MW.curAcc();
      if (cur !== lastCur) { filterAcc = cur === 'all' ? 'all' : cur; lastCur = cur; }

      let html = '<div class="page-head"><div class="page-title">灵感雷达</div>' +
        '<div class="page-sub">先求数量，再谈质量——灵感不落地，就会被遗忘</div>' +
        '<button class="btn primary" onclick="MW.act.openInspirationModal()">' + MW.icon('plus', 14) + ' 捕捉灵感</button></div>';

      html += '<div class="ideas-grid">';

      /* 左列：选题工厂 + 我的灵感 */
      const facId = facAcc();
      const facAccObj = MW.accOf(facId);
      html += '<div class="card"><div class="card-head"><div class="card-title">' + MW.icon('bolt', 15) + ' 选题工厂</div>' +
        '<div class="card-extra">库存见底了就现造一批</div></div>';
      if (!db.accounts.length) {
        html += MW.ui.empty('请先前往账号矩阵添加账号', '选题工厂将依据账号定位与内容聚焦生成');
      } else {
        html += '<div class="fac-bar">' +
          MW.ui.select('fac-acc', db.accounts.map(function (a) { return { v: a.id, t: a.name }; }), facId) +
          '<button class="btn sm" onclick="MW.act.factoryGen(\'local\')">⚡ 本地公式生成</button>' +
          '<button class="btn sm ai" onclick="MW.act.factoryGen(\'ai\')">🤖 AI 生成</button>' +
          '</div>' +
          '<div class="form-hint">围绕「' + MW.esc(facAccObj ? facAccObj.name : '') + '」的内容聚焦：' +
          MW.esc((facAccObj && facAccObj.focus || []).join('、') || '未设置，去账号矩阵补充') + '</div>';
        if (fac.list.length) {
          html += '<div class="fac-list" id="fac-list">' +
            fac.list.map(function (it, i) {
              const ty = MW.TOPIC_TYPES[it.type] || MW.TOPIC_TYPES.case;
              return '<label class="fac-row"><input type="checkbox" data-i="' + i + '" checked>' +
                '<span class="fac-title">' + MW.esc(it.title) + '</span>' +
                '<span class="wp-type" style="--tc:' + ty.color + '">' + ty.name + '</span>' +
                '<span class="fac-reason">' + MW.esc(it.reason || '') + '</span></label>';
            }).join('') + '</div>' +
            '<div class="fac-ops"><button class="btn sm primary" onclick="MW.act.factoryImport()">📥 入库选中选题</button>' +
            '<button class="btn sm" onclick="MW.act.factoryClear()">换一批 / 清空</button></div>';
        } else {
          html += '<div class="form-hint">点上方按钮批量造选题；AI 生成需先在侧边栏配置「AI 接口」，不配置则用本地公式。</div>';
        }
      }
      html += '</div>';

      html += '<div class="card"><div class="card-head"><div class="card-title">' + MW.icon('bulb', 15) + ' 我的灵感库</div>' +
        '<div class="card-extra">' + db.inspirations.length + ' 条</div></div>';
      const accOpts = [{ v: 'all', t: '全部账号' }].concat(db.accounts.map(function (a) { return { v: a.id, t: a.name }; }));
      html += '<div class="filter-bar">' + MW.ui.select('idea-filter', accOpts, filterAcc) + '</div>';
      const ideas = db.inspirations.filter(function (x) { return filterAcc === 'all' || x.accountId === filterAcc; });
      if (!ideas.length) {
        html += MW.ui.empty('暂无灵感', '竞品爆款与评论区问题均可记录于此');
      } else {
        html += ideas.map(function (it) {
          return '<div class="idea-row">' +
            '<div class="idea-main">' +
            '<div class="idea-title">' + MW.esc(it.title) + '</div>' +
            '<div class="idea-meta"><span class="idea-src">' + MW.icon('link', 11) + ' ' + MW.esc(it.source || '未知来源') + '</span>' +
            '<span class="idea-date">' + it.createdAt.slice(5) + '</span></div>' +
            (it.tags.length ? '<div class="idea-tags">' + it.tags.map(function (t) { return MW.ui.tag(t); }).join('') + '</div>' : '') +
            (it.note ? '<div class="idea-note">' + MW.esc(it.note) + '</div>' : '') +
            '</div>' +
            '<div class="idea-actions">' +
            '<button class="btn sm" onclick="MW.act.aiExpandIdea(\'' + it.id + '\')">' + MW.icon('sparkles', 12) + ' AI 扩写</button>' +
            '<button class="btn sm primary-ghost" onclick="MW.act.inspirationToTopic(\'' + it.id + '\')">转为选题</button>' +
            '<button class="btn sm" onclick="MW.act.openInspirationModal(\'' + it.id + '\')">' + MW.icon('edit', 12) + '</button>' +
            '<button class="btn sm danger-ghost" onclick="MW.act.delInspiration(\'' + it.id + '\')">' + MW.icon('trash', 12) + '</button>' +
            '</div></div>';
        }).join('');
      }
      html += '</div>';

      /* 未来营销节点：博主最容易白捡的流量，前提是提前看见它。
         注意「双11」这类区间节点只能用开始日算一次，否则会连着刷十几天屏 */
      const t = MW.dateStr();
      const nodes = MW.MARKETING.map(function (n) {
        const days = MW.daysBetween(t, n.date);
        return {
          date: n.date, name: n.name, cat: n.cat || '', days: days,
          running: !!(n.end && n.date <= t && t <= n.end)
        };
      }).filter(function (n) {
        if (n.running) return true;
        return n.days >= 0 && n.days <= 60;
      }).sort(function (a, b) { return a.days - b.days; });
      if (nodes.length) {
        html += '<div class="card"><div class="card-head"><div class="card-title">' +
          MW.icon('calendar', 15) + ' 未来 60 天能蹭的节点</div>' +
          '<div class="card-extra">提前 5-7 天布局，流量最好</div></div>';
        html += nodes.slice(0, 7).map(function (n) {
          const safe = String(n.name).replace(/['"\\]/g, '');
          const safeCat = String(n.cat).replace(/['"\\]/g, '');
          return '<div class="node-row">' +
            '<span class="node-name">' + MW.esc(n.name) + '</span>' +
            '<span class="node-cat">' + MW.esc(n.cat) + '</span>' +
            '<span class="node-when">' + n.date.slice(5) + ' · ' +
            (n.running ? '进行中' : (n.days === 0 ? '就是今天' : (n.days === 1 ? '明天' : '还有 ' + n.days + ' 天'))) + '</span>' +
            '<button class="btn sm" onclick="MW.act.nodeToTopic(\'' + n.date + '\',\'' + safe + '\',\'' + safeCat + '\')">' +
            MW.icon('sparkles', 12) + ' 借势出选题</button>' +
            '</div>';
        }).join('');
        html += '</div>';
      }

      /* 右列：热点雷达 */
      html += '<div class="card"><div class="card-head"><div class="card-title">' + MW.icon('flame', 15) + ' 热点雷达</div>' +
        '<div class="card-extra">' + MW.icon('refresh', 13) + ' 每日更新</div></div>' +
        '<div class="hot-note">当前为示例热点。后续可接入微博 / 抖音 / 百度热搜 API 自动刷新，或每天早上花 10 分钟手动更新。</div>';
      html += db.hotspots.map(function (hs) {
        const heatColor = hs.heat >= 90 ? 'var(--red)' : hs.heat >= 75 ? 'var(--amber)' : 'var(--blue)';
        return '<div class="hot-row">' +
          '<div class="hot-main"><div class="hot-title">' + MW.esc(hs.title) + '</div>' +
          '<div class="hot-meta">' + MW.ui.pfChip(hs.platform, true) + '<span class="hot-cat">' + MW.esc(hs.category) + '</span>' +
          (hs.note ? '<span class="hot-tip">' + MW.esc(hs.note) + '</span>' : '') + '</div></div>' +
          '<div class="hot-right"><div class="heat-bar"><i style="width:' + hs.heat + '%;background:' + heatColor + '"></i></div>' +
          '<span class="heat-num" style="color:' + heatColor + '">' + hs.heat + '</span>' +
          '<button class="btn sm" onclick="MW.act.aiHotAngles(\'' + hs.id + '\')">' + MW.icon('sparkles', 12) + ' AI 二创</button>' +
          '<button class="btn sm" onclick="MW.act.hotToTopic(\'' + hs.id + '\')">转选题</button></div>' +
          '</div>';
      }).join('');
      html += '</div>';

      html += '</div>';

      root.innerHTML = html;

      const filterEl = document.getElementById('idea-filter');
      if (filterEl) filterEl.onchange = function () { filterAcc = this.value; MW.render(); };
      const facEl = document.getElementById('fac-acc');
      if (facEl) facEl.onchange = function () { fac.accId = this.value; MW.render(); };
    }
  };
})();
