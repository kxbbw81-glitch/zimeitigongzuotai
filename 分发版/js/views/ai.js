/* ============================================================
   视图 · AI 文案台（分发版）
   定位：母稿工作台——生成一篇母稿，按各账号定位适配成多平台版本。
   本地模板引擎，无需联网；配置 AI 接口后由大模型改写（见侧边栏「AI 接口」）。
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  let aiLast = null;    /* 最近一次生成结果 */
  let aiAccount = '';   /* 当前选中账号 */
  let aiPrefill = '';   /* 预填标题 */
  let lastCur = null;

  MW.act.aiSetAccount = function (id) { if (id) aiAccount = id; };

  MW.act.aiUseAccount = function (id) {
    aiAccount = id;
    if (location.hash === '#/ai') MW.render();
    else MW.goto('#/ai');
  };

  /* 从账号矩阵的「内容聚焦」某一行直接开写 */
  MW.act.aiFocusWrite = function (accId, focus) {
    if (accId) aiAccount = accId;
    aiPrefill = focus;
    if (location.hash === '#/ai') MW.render();
    else MW.goto('#/ai');
    setTimeout(function () {
      const el = document.getElementById('ai-topic');
      if (el) { el.value = focus; el.focus(); }
      MW.toast('已带入方向「' + focus + '」，点生成即可');
    }, 80);
  };

  /* 从排期直接开写：少一次复制粘贴 */
  MW.act.aiFromContent = function (id) {
    const c = MW.getDB().contents.find(function (x) { return x.id === id; });
    if (!c) return;
    if (c.accountId) aiAccount = c.accountId;
    aiPrefill = c.title;
    if (location.hash === '#/ai') MW.render();
    else MW.goto('#/ai');
    setTimeout(function () {
      const el = document.getElementById('ai-topic');
      if (el) { el.value = c.title; el.focus(); }
      MW.toast('已带入排期标题，点「生成母稿」即可');
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
    MW.toast('母稿已生成，点「一稿多发」分到各平台');
  };

  function draftText(d) { return MW.ai.draftText(d); }

  /* 母稿与多平台版本：一稿多发的结果总览。
     每个母稿下面挂着各平台的适配版，就绪度直接看——
     差的项去发布页补，不用来这页找状态。 */
  function mastersPanelHtml() {
    const ms = MW.masters();
    let h = '<div class="card"><div class="card-head"><div class="card-title">' +
      MW.icon('layers', 15) + ' 母稿与多平台版本</div>' +
      '<div class="card-extra">' + ms.length + ' 组</div></div>';
    if (!ms.length) {
      h += MW.ui.empty('暂无母稿', '在生成结果页点「一稿多发」：先存母稿，再按各账号定位适配');
    } else {
      h += ms.slice(0, 6).map(function (m) {
        const vers = MW.adaptationsOf(m.id);
        const vh = vers.length ? vers.map(function (c) {
          const a = MW.accOf(c.accountId);
          const ck = MW.checksOf(c);
          const st = c.status === 'published'
            ? '<em class="mp-st ok">已发布</em>'
            : (ck.ready ? '<em class="mp-st ready">就绪待发</em>' : '<em class="mp-st">差 ' + (ck.total - ck.done) + ' 项</em>');
          return '<div class="mp-ver">' +
            '<span class="pf-chip sm" style="--pc:' + MW.pfOf(a).color + '">' + MW.pfOf(a).name + '</span>' +
            '<span class="mp-ver-title" title="' + MW.esc(c.title) + '">' + MW.esc(c.title) + '</span>' +
            st + '<span class="mp-ver-date">' + c.date.slice(5) + '</span></div>';
        }).join('') : '<div class="mp-ver none">还没有适配版本</div>';
        return '<div class="mp-item">' +
          '<div class="mp-master"><span class="mp-badge">母稿</span>' +
          '<span class="mp-master-title" onclick="MW.act.openContentModal(\'' + m.id + '\')" title="' + MW.esc(m.title) + '">' + MW.esc(m.title) + '</span>' +
          '<button class="btn sm ghost" onclick="MW.act.adaptModal(\'' + m.id + '\')">' + MW.icon('layers', 12) + ' 适配账号</button></div>' +
          '<div class="mp-vers">' + vh + '</div></div>';
      }).join('');
      if (ms.length > 6) h += '<div class="form-hint">仅显示最近 6 组母稿，完整记录在内容日历</div>';
    }
    return h + '</div>';
  }

  function renderAiResult() {
    const box = document.getElementById('ai-result');
    if (!box) return;
    if (!aiLast) {
      box.innerHTML = MW.ui.empty('暂无生成结果', '在左侧选择账号并填写选题，点击「生成母稿」');
      return;
    }
    const d = aiLast;
    const acc = MW.getDB().accounts.find(function (a) { return a.id === d.accountId; });
    let html = '';
    html += '<div class="ai-ctx">' + (acc ? MW.esc(acc.name) : '通用') + ' · ' + (MW.TOPIC_TYPES[d.type] || MW.TOPIC_TYPES.case).name + '型 · ' + MW.esc(MW.pfName(d.platform, d)) + '</div>';

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
      '<button class="btn" onclick="MW.act.aiAdapt()" title="先存为母稿，再按各账号定位改写成多平台版本">' + MW.icon('layers', 13) + ' 一稿多发</button>' +
      '<button class="btn primary" onclick="MW.act.aiSchedule()">' + MW.icon('calendar', 13) + ' 排到日历</button>' +
      '</div>';

    box.innerHTML = html;
  }

  /* 生成完直接排进日历（来源账号单发，不走多平台分发） */
  MW.act.aiSchedule = function () {
    if (!aiLast) return;
    const db = MW.getDB();
    const acc = db.accounts.find(function (a) { return a.id === aiLast.accountId; });
    if (!acc) { MW.toast('请先选择账号', 'error'); return; }
    const t = MW.dateStr();
    const h = new Date().getHours();
    const time = h < 11 ? '12:00' : (h < 17 ? '18:00' : '21:00');
    const focus = MW.guessFocus(aiLast.accountId, aiLast.topic);
    db.contents.push({
      id: MW.uid(), title: aiLast.titles[0], accountId: aiLast.accountId, platform: acc.platform,
      platformName: acc.platform === 'custom' ? (acc.platformName || '') : '',
      date: t, time: time, status: 'scheduled',
      focus: focus, body: draftText(aiLast),
      checks: {}, metrics: null, note: 'AI 文案台生成', createdAt: t
    });
    MW.save();
    MW.toast('已排到今天 ' + time + '，去日历可拖拽改期');
    MW.goto('#/calendar');
  };

  /* 一稿多发：把当前生成结果先存成母稿（原始素材），再按各账号定位适配出多平台版本。
     母稿本身是来源账号那条内容，适配版本走排期，发布前逐条人工核实。 */
  MW.act.aiAdapt = function () {
    if (!aiLast) return;
    const db = MW.getDB();
    const master = {
      id: MW.uid(), title: aiLast.titles[0], accountId: aiLast.accountId,
      platform: aiLast.platform, platformName: aiLast.platformName || '',
      date: MW.dateStr(), time: MW.ai.pfTime(aiLast.platform), status: 'scheduled',
      focus: MW.guessFocus(aiLast.accountId, aiLast.topic),
      master: true, body: MW.ai.draftText(aiLast),
      checks: {}, metrics: null, note: '母稿：多平台分发的原始素材', createdAt: MW.dateStr()
    };
    db.contents.push(master);
    MW.save();
    MW.act.adaptModal(master.id);
  };

  /* 母稿适配弹窗：勾选目标账号 → 按各账号定位逐个生成 → 建成排期。
     共享给 AI 文案台（从生成结果发家）和内容日历（把已有排期升为母稿）。
     生成是异步的：弹窗挂着进度逐篇跑，跑完自己关，不阻塞界面。 */
  MW.act.adaptModal = function (masterId) {
    const db = MW.getDB();
    const master = db.contents.find(function (c) { return c.id === masterId; });
    if (!master) return;
    /* 从日历/发布页进来时这条内容还没母稿名分——就地升为母稿 */
    if (!master.master) { master.master = true; MW.save(); }
    const others = db.accounts.filter(function (a) {
      return a.status === 'active' && a.id !== master.accountId;
    });
    if (!others.length) { MW.toast('暂无其他可分发的账号', 'error'); return; }
    const hasVer = {};
    MW.adaptationsOf(master.id).forEach(function (c) { hasVer[c.accountId] = true; });
    const srcFocus = (MW.accOf(master.accountId) || {}).focus || [];

    const rows = others.map(function (a) {
      /* 模糊匹配：'CRM' 命中 '外贸CRM'，'增长' 命中 '电商增长' */
      const hit = (a.focus || []).some(function (f) {
        return srcFocus.some(function (s) { return s.indexOf(f) >= 0 || f.indexOf(s) >= 0; });
      });
      const seen = !!hasVer[a.id];
      return '<label class="dist-row' + (seen ? ' has' : '') + '">' +
        '<input type="checkbox" id="adapt-' + a.id + '"' + (hit && !seen ? ' checked' : '') + '>' +
        '<span class="as-dot" style="background:' + MW.pfOf(a).color + '"></span>' +
        '<span class="dist-name">' + MW.esc(a.name) + '</span>' +
        '<span class="dist-pf">' + MW.pfOf(a).name + '</span>' +
        (seen ? '<span class="dist-fit">已有版本，将重新生成</span>'
          : (hit ? '<span class="dist-fit">聚焦相近</span>' : '<span class="dist-fit off">定位不同，将按本号定位改写</span>')) +
        '</label>';
    }).join('');

    MW.modal({
      title: '一稿多发 · 适配其他账号',
      sub: '母稿：' + MW.esc(master.title),
      body: '<div class="dist-list">' + rows + '</div>' +
        MW.ui.row('排期日期', '<input id="adapt-date" type="date" value="' + MW.addDays(MW.dateStr(), 1) + '">',
          '发布时间取各平台建议时段，之后可在日历里拖拽改期') +
        '<div class="form-hint">' + (MW.ai.aiReady()
          ? '按各账号的定位、受众与平台规范逐篇改写；生成后请逐条核实事实再发布。'
          : 'AI 接口未配置：将按账号定位生成本地初稿（标题 / 钩子 / 大纲 / 标签），正文需人工补全后再发。') + '</div>' +
        '<div class="adapt-status" id="adapt-status"></div>',
      okText: '开始适配',
      onOk: function (root) {
        const date = (root.querySelector('#adapt-date').value || '').trim() || MW.addDays(MW.dateStr(), 1);
        const picked = others.filter(function (a) {
          const cb = root.querySelector('#adapt-' + a.id);
          return cb && cb.checked;
        });
        if (!picked.length) { MW.toast('没有勾选任何账号', 'error'); return false; }
        const okBtn = document.getElementById('modal-ok');
        if (okBtn) { okBtn.disabled = true; okBtn.textContent = '适配中…'; }
        const st = document.getElementById('adapt-status');
        let i = 0, okN = 0;
        (function step() {
          if (i >= picked.length) {
            MW.save(); MW.render(); MW.closeModal();
            MW.toast('已生成 ' + okN + ' 个平台版本，发布前请逐条核实');
            setTimeout(function () { MW.goto('#/calendar'); }, 400);
            return;
          }
          const a = picked[i]; i++;
          if (st) st.textContent = '正在适配「' + a.name + '」（' + i + ' / ' + picked.length + '）…';
          MW.ai.adapt(master.id, a.id).then(function (r) {
            if (r) {
              /* 同一账号已有适配版本 → 原地更新，不堆重复记录 */
              const exist = MW.adaptationsOf(master.id).find(function (x) { return x.accountId === a.id; });
              if (exist) {
                exist.title = r.title; exist.body = r.body;
                exist.date = date; exist.time = MW.ai.pfTime(a.platform);
                exist.note = '适配自母稿「' + master.title + '」';
              } else {
                db.contents.push({
                  id: MW.uid(), title: r.title, accountId: a.id, platform: a.platform,
                  platformName: a.platform === 'custom' ? (a.platformName || '') : '',
                  date: date, time: MW.ai.pfTime(a.platform), status: 'scheduled',
                  masterId: master.id,
                  focus: MW.guessFocus(a.id, master.title), body: r.body,
                  checks: {}, metrics: null,
                  note: '适配自母稿「' + master.title + '」', createdAt: MW.dateStr()
                });
              }
              okN++;
            }
            step();
          });
        })();
        return false;   /* 异步没跑完，别关弹窗 */
      }
    });
  };

  MW.views['ai'] = {
    id: 'ai', name: 'AI 文案台', icon: 'sparkles',
    sub: '生成母稿 → 按各账号定位适配成多平台版本',
    render: function (root) {
      const db = MW.getDB();
      /* 跟随侧边栏账号视角：切了号，AI 就跟着换定位 */
      const cur = MW.curAcc();
      if (cur !== lastCur) { if (cur !== 'all') aiAccount = cur; lastCur = cur; }
      if (!aiAccount && db.accounts.length) aiAccount = db.accounts[0].id;

      let html = '<div class="page-head"><div class="page-title">AI 文案台</div>' +
        '<div class="page-sub">母稿工作台：同一份内容，按各账号定位改写成多平台版本</div></div>';

      html += '<div class="ai-grid">';

      /* 左列：表单 */
      html += '<div class="ai-left">';
      html += '<div class="card"><div class="card-head"><div class="card-title">' + MW.icon('sparkles', 15) + ' 生成设置</div></div>';
      if (!db.accounts.length) {
        html += MW.ui.empty('请先在账号矩阵添加账号', '定位和聚焦是生成质量的源头');
      } else {
        const acc = db.accounts.find(function (a) { return a.id === aiAccount; }) || db.accounts[0];
        html += MW.ui.row('选择账号', MW.ui.select('ai-acc', db.accounts.map(function (a) {
          return { v: a.id, t: a.name + '（' + MW.pfOf(a).name + '）' };
        }), aiAccount), '自动带入定位与内容聚焦');
        if (acc) {
          /* IP 规范全量带出来：这里显示的每一项都会进生成 prompt，
             所以用户在账号卡上改任何一个字，这边立刻能看到变化。 */
          html += '<div class="ai-ctx-box">' +
            '<div class="ai-ctx-line"><span>定位</span>' + MW.esc(acc.positioning || '未填写') + '</div>' +
            '<div class="ai-ctx-line"><span>受众</span>' + MW.esc(acc.audience || '未填写') + '</div>' +
            '<div class="ai-ctx-line"><span>风格</span>' + MW.esc(acc.style || '未填写') + '</div>' +
            '<div class="ai-ctx-line"><span>语气</span>' + MW.esc(acc.tone || '未填写') + '</div>' +
            '<div class="ai-ctx-line"><span>聚焦</span>' + (acc.focus.length ? acc.focus.map(function (f) { return MW.ui.tag(f); }).join('') : '未设置') + '</div></div>';
        }
        html += MW.ui.row('选题 / 主题', '<input id="ai-topic" placeholder="例如：中秋月饼盒改造收纳" value="' + MW.esc(aiPrefill) + '">');
        html += '<div class="form-2col">' +
          MW.ui.row('内容类型', MW.ui.select('ai-type', Object.keys(MW.TOPIC_TYPES).map(function (k) { return { v: k, t: MW.TOPIC_TYPES[k].name }; }), 'case')) +
          MW.ui.row('目标平台', MW.ui.platformOptions('ai-platform', acc ? acc.platform : 'xhs'), '跟随所选账号，也可手动改') +
          '</div>';
        html += MW.ui.row('关键词（可选）', '<input id="ai-kw" placeholder="例如：收纳, 环保，多个用逗号分隔">');
        html += '<button class="btn primary btn-block" onclick="MW.act.aiGen()">' + MW.icon('sparkles', 14) + ' 生成母稿</button>';
        html += '<div class="form-hint">生成后点「一稿多发」：勾选各平台账号，按定位逐篇改写并排期</div>';
      }
      html += '</div>';

      html += mastersPanelHtml();
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
