/* ============================================================
   视图 · AI 文案台（基于账号定位 + 内容聚焦生成文案）
   本地模板引擎，无需联网；后续可在此接入真实大模型 API
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  let aiLast = null;    /* 最近一次生成结果 */
  let aiAccount = '';   /* 当前选中账号 */
  let aiTopicId = '';   /* 预填选题 */
  let aiPrefill = '';   /* 预填标题 */
  let lastCur = null;

  MW.act.aiSetAccount = function (id) { if (id) aiAccount = id; };

  MW.act.aiUseAccount = function (id) {
    aiAccount = id; aiTopicId = '';
    if (location.hash === '#/ai') MW.render();
    else MW.goto('#/ai');
  };

  /* 从账号矩阵的「内容聚焦」某一行直接开写 */
  MW.act.aiFocusWrite = function (accId, focus) {
    if (accId) aiAccount = accId;
    aiTopicId = '';
    aiPrefill = focus;
    if (location.hash === '#/ai') MW.render();
    else MW.goto('#/ai');
    setTimeout(function () {
      const el = document.getElementById('ai-topic');
      if (el) { el.value = focus; el.focus(); }
      MW.toast('已带入方向「' + focus + '」，点生成即可');
    }, 80);
  };

  /* 从今日排期直接开写：少一次复制粘贴 */
  MW.act.aiFromContent = function (id) {
    const c = MW.getDB().contents.find(function (x) { return x.id === id; });
    if (!c) return;
    if (c.accountId) aiAccount = c.accountId;
    aiTopicId = '';
    aiPrefill = c.title;
    if (location.hash === '#/ai') MW.render();
    else MW.goto('#/ai');
    setTimeout(function () {
      const el = document.getElementById('ai-topic');
      if (el) { el.value = c.title; el.focus(); }
      MW.toast('已带入排期标题，点「生成文案」即可');
    }, 60);
  };

  MW.act.aiUseTopic = function (id) {
    const db = MW.getDB();
    const tp = db.topics.find(function (x) { return x.id === id; });
    if (!tp) return;
    aiAccount = tp.accountId;
    aiTopicId = tp.id;
    MW.goto('#/ai');
    MW.render();
    setTimeout(function () {
      const t = document.getElementById('ai-topic');
      if (t) t.value = tp.title;
      const ty = document.getElementById('ai-type');
      if (ty) ty.value = tp.type;
      MW.toast('已带入选题，可直接生成');
    }, 60);
  };

  /* 生成逻辑统一走 MW.ai.gen（js/ai-engine.js），接真实大模型只改那一处 */
  MW.act.aiGen = function () {
    const topic = (document.getElementById('ai-topic').value || '').trim();
    if (!topic) { MW.toast('先填写选题或主题', 'error'); return; }
    aiLast = MW.ai.gen({
      accountId: document.getElementById('ai-acc').value,
      topic: topic,
      type: document.getElementById('ai-type').value,
      platform: document.getElementById('ai-platform').value,
      kws: document.getElementById('ai-kw').value
    });
    renderAiResult();
    MW.toast('文案已生成');
  };

  function draftText(d) { return MW.ai.draftText(d); }

  function renderAiResult() {
    const box = document.getElementById('ai-result');
    if (!box) return;
    if (!aiLast) {
      box.innerHTML = MW.ui.empty('暂无生成结果', '在左侧选择账号并填写选题，点击「生成文案」');
      return;
    }
    const d = aiLast;
    const acc = MW.getDB().accounts.find(function (a) { return a.id === d.accountId; });
    let html = '';
    html += '<div class="ai-ctx">' + (acc ? MW.esc(acc.name) : '通用') + ' · ' + (MW.TOPIC_TYPES[d.type] || MW.TOPIC_TYPES.case).name + '型 · ' + MW.esc((MW.PLATFORMS[d.platform] || MW.PLATFORMS.other).name) + '</div>';

    html += '<div class="ai-block"><div class="ai-block-head"><span class="ai-block-title">' + MW.icon('flag', 13) + ' 标题候选（' + d.titles.length + '）</span>' +
      '<button class="btn sm" onclick="MW.copy(' + JSON.stringify(d.titles.join('\n')).replace(/"/g, '&quot;') + ')">' + MW.icon('copy', 12) + ' 复制全部</button></div>' +
      d.titles.map(function (t, i) {
        return '<div class="ai-title-row"><span class="ai-title-idx">' + (i + 1) + '</span><span class="ai-title-text">' + MW.esc(t) + '</span>' +
          '<button class="icon-btn sm" onclick="MW.copy(' + JSON.stringify(t).replace(/"/g, '&quot;') + ')">' + MW.icon('copy', 13) + '</button></div>';
      }).join('') + '</div>';

    html += '<div class="ai-block"><div class="ai-block-head"><span class="ai-block-title">' + MW.icon('bolt', 13) + ' 开头钩子</span>' +
      '<button class="btn sm" onclick="MW.copy(' + JSON.stringify(d.hook).replace(/"/g, '&quot;') + ')">' + MW.icon('copy', 12) + ' 复制</button></div>' +
      '<div class="ai-hook">' + MW.esc(d.hook) + '</div></div>';

    html += '<div class="ai-block"><div class="ai-block-head"><span class="ai-block-title">' + MW.icon('note', 13) + ' 正文大纲</span></div><ol class="ai-outline">' +
      d.outline.map(function (o) { return '<li>' + MW.esc(o) + '</li>'; }).join('') + '</ol></div>';

    html += '<div class="ai-block"><div class="ai-block-head"><span class="ai-block-title">' + MW.icon('target', 13) + ' 推荐标签</span></div>' +
      '<div class="ai-tags">' + d.tags.map(function (t) { return MW.ui.tag(t, 'var(--primary)'); }).join('') + '</div></div>';

    html += '<div class="ai-block"><div class="ai-block-head"><span class="ai-block-title">' + MW.icon('clock', 13) + ' 发布建议</span></div>' +
      '<div class="ai-tips">' + d.tips + '</div></div>';

    html += '<div class="ai-actions">' +
      '<button class="btn" onclick="MW.copy(' + JSON.stringify(draftText(d)).replace(/"/g, '&quot;') + ')">' + MW.icon('copy', 13) + ' 复制全文</button>' +
      '<button class="btn" onclick="MW.act.aiSaveDraft()">' + MW.icon('download', 13) + ' 保存草稿</button>' +
      '<button class="btn" onclick="MW.act.aiToTopic()">' + MW.icon('kanban', 13) + ' 存为选题</button>' +
      '<button class="btn" onclick="MW.act.aiDistribute()">' + MW.icon('layers', 13) + ' 分发多平台</button>' +
      '<button class="btn primary" onclick="MW.act.aiSchedule()">' + MW.icon('calendar', 13) + ' 排到日历</button>' +
      '</div>';

    box.innerHTML = html;
  }

  MW.act.aiSaveDraft = function () {
    if (!aiLast) return;
    const db = MW.getDB();
    db.drafts.unshift(Object.assign({}, aiLast));
    if (db.drafts.length > 20) db.drafts.length = 20;
    MW.save();
    MW.toast('草稿已保存');
    MW.render();
  };

  MW.act.aiToTopic = function () {
    if (!aiLast) return;
    const db = MW.getDB();
    const tp = {
      id: MW.uid(), title: aiLast.topic, accountId: aiLast.accountId, type: aiLast.type,
      stage: 'producing', priority: 'mid', due: '', owner: '我',
      focus: MW.guessFocus(aiLast.accountId, aiLast.topic),
      note: 'AI 文案台生成，标题：' + aiLast.titles[0], createdAt: MW.dateStr()
    };
    db.topics.push(tp);
    MW.save(); MW.render();
    MW.toast('已转为选题并进入「制作中」');
  };

  /* 生成完直接排进日历，省掉再填一次表单 */
  MW.act.aiSchedule = function () {
    if (!aiLast) return;
    const db = MW.getDB();
    const acc = db.accounts.find(function (a) { return a.id === aiLast.accountId; });
    if (!acc) { MW.toast('请先选择账号', 'error'); return; }
    const t = MW.dateStr();
    const h = new Date().getHours();
    const time = h < 11 ? '12:00' : (h < 17 ? '18:00' : '21:00');
    const focus = MW.guessFocus(aiLast.accountId, aiLast.topic);
    const tp = {
      id: MW.uid(), title: aiLast.topic, accountId: aiLast.accountId, type: aiLast.type,
      stage: 'scheduled', priority: 'mid', due: t, owner: '我', focus: focus,
      note: 'AI 生成标题：' + aiLast.titles[0], createdAt: t
    };
    db.topics.push(tp);
    db.contents.push({
      id: MW.uid(), title: aiLast.titles[0], accountId: aiLast.accountId, platform: acc.platform,
      date: t, time: time, status: 'scheduled', topicId: tp.id, focus: focus,
      metrics: null, note: '', createdAt: t
    });
    MW.save();
    MW.toast('已排到今天 ' + time + '，去日历可拖拽改期');
    MW.goto('#/calendar');
  };

  /* 一条内容分发到多个平台账号：多平台博主的日常动作 */
  MW.act.aiDistribute = function () {
    if (!aiLast) return;
    const db = MW.getDB();
    const src = db.accounts.find(function (a) { return a.id === aiLast.accountId; });
    const srcFocus = (src && src.focus) || [];
    const others = db.accounts.filter(function (a) {
      return a.id !== aiLast.accountId && a.status === 'active';
    });
    if (!others.length) { MW.toast('暂无其他可分发账号', 'error'); return; }

    const rows = others.map(function (a) {
      /* 模糊匹配：'CRM' 命中 '外贸CRM'，'增长' 命中 '电商增长' */
      const hit = (a.focus || []).some(function (f) {
        return srcFocus.some(function (s) { return s.indexOf(f) >= 0 || f.indexOf(s) >= 0; });
      });
      return '<label class="dist-row">' +
        '<input type="checkbox" id="dist-' + a.id + '"' + (hit ? ' checked' : '') + '>' +
        '<span class="as-dot" style="background:' + MW.PLATFORMS[a.platform].color + '"></span>' +
        '<span class="dist-name">' + MW.esc(a.name) + '</span>' +
        '<span class="dist-pf">' + MW.PLATFORMS[a.platform].name + '</span>' +
        (hit ? '<span class="dist-fit">聚焦相近</span>' : '<span class="dist-fit off">定位不同，需改写</span>') +
        '</label>';
    }).join('');

    MW.modal({
      title: '分发到其他平台', sub: '已默认勾选内容聚焦相近的账号',
      body: '<div class="dist-list">' + rows + '</div>' +
        MW.ui.row('排期日期', '<input id="dist-date" type="date" value="' + MW.addDays(MW.dateStr(), 1) + '">',
          '时间为各平台建议时段，之后可在日历里拖拽改期'),
      okText: '创建排期',
      onOk: function (root) {
        const date = root.querySelector('#dist-date').value || MW.addDays(MW.dateStr(), 1);
        let n = 0;
        others.forEach(function (a) {
          const cb = root.querySelector('#dist-' + a.id);
          if (!cb || !cb.checked) return;
          db.contents.push({
            id: MW.uid(), title: aiLast.titles[0], accountId: a.id, platform: a.platform,
            date: date, time: MW.ai.pfTime(a.platform), status: 'scheduled',
            topicId: '', metrics: null, focus: MW.guessFocus(a.id, aiLast.topic),
            note: '与「' + (src ? src.name : '同源') + '」同选题，需按本号定位改写', createdAt: MW.dateStr()
          });
          n++;
        });
        MW.save();
        MW.toast(n ? '已创建 ' + n + ' 条跨平台排期，去日历看看' : '没有勾选任何账号');
        if (n) setTimeout(function () { MW.goto('#/calendar'); }, 400);
      }
    });
  };

  MW.act.aiLoadDraft = function (id) {
    const d = MW.getDB().drafts.find(function (x) { return x.id === id; });
    if (!d) return;
    aiLast = d;
    renderAiResult();
    MW.toast('已载入草稿');
  };

  MW.act.aiDelDraft = function (id) {
    const db = MW.getDB();
    db.drafts = db.drafts.filter(function (x) { return x.id !== id; });
    MW.save(); MW.render();
    MW.toast('草稿已删除');
  };

  MW.views['ai'] = {
    id: 'ai', name: 'AI 文案台', icon: 'sparkles',
    sub: '基于账号定位 + 内容聚焦，一键生成标题、钩子、大纲和标签',
    render: function (root) {
      const db = MW.getDB();
      /* 跟随侧边栏账号视角：切了号，AI 就跟着换定位 */
      const cur = MW.curAcc();
      if (cur !== lastCur) { if (cur !== 'all') aiAccount = cur; lastCur = cur; }
      if (!aiAccount && db.accounts.length) aiAccount = db.accounts[0].id;
      const tp = aiTopicId ? db.topics.find(function (x) { return x.id === aiTopicId; }) : null;

      let html = '<div class="page-head"><div class="page-title">AI 文案台</div>' +
        '<div class="page-sub">本地模板引擎：把账号定位、内容聚焦和选题组装成可直接改的初稿</div>' +
        '<div class="page-head-actions">' +
        '<button class="btn" onclick="MW.act.aiFillIdeas()">' + MW.icon('bulb', 14) + ' AI 补选题</button>' +
        '<button class="btn primary" onclick="MW.act.aiWeekPlanModal()">' + MW.icon('calendar', 14) + ' AI 补排期</button>' +
        '</div></div>';

      html += '<div class="ai-grid">';

      /* 左列：表单 + 草稿 */
      html += '<div class="ai-left">';
      html += '<div class="card"><div class="card-head"><div class="card-title">' + MW.icon('sparkles', 15) + ' 生成设置</div></div>';
      if (!db.accounts.length) {
        html += MW.ui.empty('请先在账号矩阵添加账号', '定位和聚焦是生成质量的源头');
      } else {
        const acc = db.accounts.find(function (a) { return a.id === aiAccount; }) || db.accounts[0];
        html += MW.ui.row('选择账号', MW.ui.select('ai-acc', db.accounts.map(function (a) {
          return { v: a.id, t: a.name + '（' + MW.PLATFORMS[a.platform].name + '）' };
        }), aiAccount), '自动带入定位与内容聚焦');
        if (acc) {
          /* IP 规范全量带出来：这里显示的每一项都会进生成 prompt，
             所以用户在账号卡上改任何一个字，这边立刻能看到变化。 */
          const mix = MW.accMix(acc);
          html += '<div class="ai-ctx-box">' +
            '<div class="ai-ctx-line"><span>定位</span>' + MW.esc(acc.positioning || '未填写') + '</div>' +
            '<div class="ai-ctx-line"><span>受众</span>' + MW.esc(acc.audience || '未填写') + '</div>' +
            '<div class="ai-ctx-line"><span>风格</span>' + MW.esc(acc.style || '未填写') + '</div>' +
            '<div class="ai-ctx-line"><span>语气</span>' + MW.esc(acc.tone || '未填写') + '</div>' +
            '<div class="ai-ctx-line"><span>聚焦</span>' + (acc.focus.length ? acc.focus.map(function (f) { return MW.ui.tag(f); }).join('') : '未设置') + '</div>' +
            '<div class="ai-ctx-line"><span>配比</span>' + MW.TOPIC_TYPE_LIST.map(function (t) {
              return '<em class="ctx-mix">' + MW.esc(t.name) + ' ' + mix[t.key] + '%</em>';
            }).join('') + '</div></div>';
        }
        html += MW.ui.row('选题 / 主题', '<input id="ai-topic" placeholder="例如：AI 模特实操案例" value="' + MW.esc(tp ? tp.title : aiPrefill) + '">');
        html += '<div class="form-2col">' +
          MW.ui.row('内容类型', MW.ui.select('ai-type', Object.keys(MW.TOPIC_TYPES).map(function (k) { return { v: k, t: MW.TOPIC_TYPES[k].name }; }), tp ? tp.type : 'case')) +
          MW.ui.row('目标平台', MW.ui.select('ai-platform', Object.keys(MW.PLATFORMS).map(function (k) { return { v: k, t: MW.PLATFORMS[k].name }; }), acc ? acc.platform : 'xhs')) +
          '</div>';
        html += MW.ui.row('关键词（可选）', '<input id="ai-kw" placeholder="例如：降本, 工作流，多个用逗号分隔">');
        html += '<button class="btn primary btn-block" onclick="MW.act.aiGen()">' + MW.icon('sparkles', 14) + ' 生成文案</button>';
      }
      html += '</div>';

      html += '<div class="card"><div class="card-head"><div class="card-title">' + MW.icon('file', 15) + ' 草稿箱</div>' +
        '<div class="card-extra">' + db.drafts.length + ' 篇</div></div>';
      if (!db.drafts.length) {
        html += MW.ui.empty('暂无草稿', '生成后点击「保存草稿」即可存档');
      } else {
        html += db.drafts.map(function (d) {
          return '<div class="draft-row"><div class="draft-main" onclick="MW.act.aiLoadDraft(\'' + d.id + '\')">' +
            '<div class="draft-title">' + MW.esc(d.topic) + '</div>' +
            '<div class="draft-meta">' + (MW.TOPIC_TYPES[d.type] || MW.TOPIC_TYPES.case).name + ' · ' + MW.esc((MW.PLATFORMS[d.platform] || MW.PLATFORMS.other).name) + ' · ' + d.createdAt.slice(5) + '</div></div>' +
            '<button class="icon-btn sm" onclick="MW.act.aiDelDraft(\'' + d.id + '\')">' + MW.icon('trash', 13) + '</button></div>';
        }).join('');
      }
      html += '</div>';
      html += '</div>';

      /* 右列：结果 */
      html += '<div class="ai-right"><div class="card ai-result-card"><div class="card-head"><div class="card-title">' + MW.icon('note', 15) + ' 生成结果</div>' +
        '<div class="card-extra">可复制修改，不必照搬</div></div><div id="ai-result"></div></div></div>';

      html += '</div>';

      root.innerHTML = html;
      aiPrefill = '';   /* 预填只生效一次 */
      renderAiResult();
    }
  };
})();
