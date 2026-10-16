/* ============================================================
   视图 · 账号矩阵（多平台账号统一管理）
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  let filterPlatform = 'all';
  let sortBy = 'fans';

  MW.act.setAccFilter = function (p) { filterPlatform = p; MW.render(); };

  MW.act.openTopicModal = null; // 占位，board.js 会覆盖

  /* ============================================================
     AI 识别导入：把别的 AI 写好的账号资料整段粘进来，自动填表
     ============================================================ */
  const ACC_FORM_MAP = [
    ['platform', 'f-platform', '平台'],
    ['accountId', 'f-accountid', '账号 ID'],
    ['name', 'f-name', '账号名称'],
    ['style', 'f-style', '风格'],
    ['positioning', 'f-positioning', '定位'],
    ['audience', 'f-audience', '目标受众'],
    ['tone', 'f-tone', '表达风格'],
    ['focus', 'f-focus', '内容聚焦'],
    ['cadence', 'f-cadence', '周更频率'],
    ['goalPosts', 'f-goalp', '月更目标'],
    ['followers', 'f-followers', '当前粉丝'],
    ['goalFollowers', 'f-goalf', '涨粉目标'],
    ['status', 'f-status', '状态']
  ];
  const MISS_CN = {
    platform: '平台', accountId: '账号 ID', name: '账号名称', style: '内容风格', tone: '表达风格',
    positioning: '定位', audience: '目标受众', focus: '内容聚焦', followers: '当前粉丝', goalFollowers: '涨粉目标',
    cadence: '周更频率', goalPosts: '月更目标'
  };

  function aiImportBox(open) {
    return '<div class="aii-box' + (open ? '' : ' collapsed') + '" id="aii-box">' +
      '<div class="aii-head" onclick="document.getElementById(\'aii-box\').classList.toggle(\'collapsed\')">' +
        '<span class="aii-ic">' + MW.icon('sparkles', 14) + '</span>' +
        '<span class="aii-title">AI 识别导入</span>' +
        '<span class="aii-tip">把其他 AI 写好的账号资料整段粘进来，自动填入下方字段</span>' +
        MW.icon('down', 15, 'aii-chev') +
      '</div>' +
      '<div class="aii-body">' +
        '<textarea id="aii-text" rows="4" placeholder="支持各种格式，例如：&#10;【账号名称】烟枪先森-AI搞钱&#10;平台：小红书&#10;定位：用 AI 开发产品和业务系统的实战创业者&#10;内容聚焦：&#10;- AI工具实操&#10;- 独立站&#10;更新频率：每周 3 篇"></textarea>' +
        '<div class="aii-foot">' +
          '<button class="btn sm ghost" id="aii-demo">' + MW.icon('bulb', 12) + ' 看个示例</button>' +
          '<button class="btn sm ghost" id="aii-paste">' + MW.icon('paste', 12) + ' 从剪贴板粘贴</button>' +
          '<span class="aii-count" id="aii-count"></span>' +
          '<button class="btn sm primary" id="aii-run">' + MW.icon('scan', 13) + ' 识别并填入</button>' +
        '</div>' +
        '<div class="aii-result" id="aii-result"></div>' +
      '</div>' +
      '<div class="aii-split"><span>以下字段可随时手工修改</span></div>' +
      '</div>';
  }

  function bindAiImport(root) {
    const box = root.querySelector('#aii-text');
    if (!box) return;
    const count = root.querySelector('#aii-count');
    const result = root.querySelector('#aii-result');
    const panel = root.querySelector('#aii-box');

    const updCount = function () {
      const n = box.value.trim().length;
      count.textContent = n ? n + ' 字' : '';
    };

    /* 把识别结果写进表单，只覆盖认出来的字段，用户填过的不动 */
    const apply = function (r) {
      let n = 0;
      ACC_FORM_MAP.forEach(function (m) {
        const v = r.fields[m[0]];
        const empty = Array.isArray(v) ? !v.length : (v === '' || v === 0 || v == null);
        if (empty) return;
        const el = root.querySelector('#' + m[1]);
        if (!el) return;
        el.value = Array.isArray(v) ? v.join('\n') : v;
        const row = el.closest('.form-row');
        if (row) {
          row.classList.remove('field-hit');
          void row.offsetWidth;                 /* 重启动画 */
          row.classList.add('field-hit');
          setTimeout(function () { row.classList.remove('field-hit'); }, 2400);
        }
        n++;
      });
      return n;
    };

    const showResult = function (r, n) {
      if (!n) {
        result.className = 'aii-result show fail';
        result.innerHTML = '<div class="aii-res-none">' + MW.icon('x', 13) +
          ' 没能识别出字段。试试写成「账号名称：xxx」这样一行一条，或直接手工填写下方表单。</div>';
        return;
      }
      let html = '<div class="aii-res-line"><b>已填入 ' + n + ' 项</b>' +
        r.hits.map(function (h) {
          const t = h.text.length > 26 ? h.text.slice(0, 26) + '…' : h.text;
          return '<span class="aii-chip" title="' + MW.esc(h.label + '：' + h.text) + '">' + MW.esc(h.label) + '</span>';
        }).join('') + '</div>';
      if (r.missed.length) {
        html += '<div class="aii-res-miss">未能识别：' +
          r.missed.map(function (k) { return MISS_CN[k]; }).join('、') +
          ' — 可在下方手动补</div>';
      } else {
        html += '<div class="aii-res-miss ok">主要字段都认出来了，检查一下无误再保存</div>';
      }
      result.className = 'aii-result show';
      result.innerHTML = html;
    };

    const run = function () {
      const txt = box.value;
      if (!txt.trim()) { MW.toast('先粘贴一段账号资料', 'error'); return; }
      const r = MW.ai.parseAccount(txt);
      const n = apply(r);
      showResult(r, n);
      MW.toast(n ? '已识别并填入 ' + n + ' 项' : '没识别出可用字段', n ? '' : 'error');
    };

    box.addEventListener('input', updCount);
    box.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    });
    root.querySelector('#aii-run').onclick = run;
    root.querySelector('#aii-demo').onclick = function () {
      panel.classList.remove('collapsed');
      box.value = MW.ai.accountSample;
      updCount();
      box.focus();
    };
    root.querySelector('#aii-paste').onclick = function () {
      panel.classList.remove('collapsed');
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        MW.toast('当前环境读不了剪贴板，请手动 Ctrl+V', 'error'); box.focus(); return;
      }
      navigator.clipboard.readText().then(function (t) {
        if (!t || !t.trim()) { MW.toast('剪贴板是空的', 'error'); return; }
        box.value = t; updCount(); box.focus();
        MW.toast('已粘贴 ' + t.trim().length + ' 字');
      }).catch(function () { MW.toast('读取失败，请手动 Ctrl+V', 'error'); box.focus(); });
    };
    const clearBtn = document.createElement('span');
    clearBtn.className = 'aii-clear';
    clearBtn.innerHTML = MW.icon('x', 12) + ' 清空';
    clearBtn.onclick = function () { box.value = ''; updCount(); result.className = 'aii-result'; result.innerHTML = ''; box.focus(); };
    count.parentNode.insertBefore(clearBtn, count);
    updCount();
  }

  /* 内容配比编辑器：四个类型各一个百分比，实时合计。
     这是「我说要做什么」和「实际发了什么」之间的基准线，
     所以做成显式输入 + 合计校验，而不是藏在某句话里。 */
  function mixEditor(a) {
    const mix = MW.accMix(a);
    const rows = MW.TOPIC_TYPE_LIST.map(function (t) {
      return '<div class="mix-row">' +
        '<span class="mix-name">' + MW.esc(t.name) + '</span>' +
        '<span class="mix-desc">' + MW.esc(t.desc || '') + '</span>' +
        '<span class="mix-input"><input id="mix-' + t.key + '" type="number" min="0" max="100" step="5" value="' + mix[t.key] + '"><i>%</i></span>' +
        '</div>';
    }).join('');
    return '<div class="form-block"><div class="fb-title">内容配比' +
      '<span class="fb-sub">决定选题工厂和 AI 补排期按什么比例造内容</span></div>' +
      '<div class="mix-editor">' + rows +
      '<div class="mix-total" id="mix-total"></div></div></div>';
  }

  /* 读取配比表单 + 合计校验提示。返回 null 表示不合法（调用方据此拦住保存） */
  function readMix(root) {
    const mix = {};
    MW.TOPIC_TYPE_LIST.forEach(function (t) {
      mix[t.key] = Math.max(0, Math.round(+root.querySelector('#mix-' + t.key).value || 0));
    });
    const total = MW.mixTotal(mix);
    const tip = root.querySelector('#mix-total');
    if (tip) {
      tip.innerHTML = total === 100
        ? '<span class="mix-ok">' + MW.icon('check', 12) + ' 合计 100%</span>'
        : '<span class="mix-bad">' + MW.icon('flag', 12) + ' 合计 ' + total + '%，建议凑整到 100%（不影响保存）</span>';
    }
    return mix;
  }

  MW.act.editAccount = function (id, opt) {
    opt = opt || {};
    const db = MW.getDB();
    const a = id ? db.accounts.find(function (x) { return x.id === id; }) : null;
    const body = aiImportBox(!a || !!opt.ai) +
      MW.ui.row('平台', MW.ui.platformOptions('f-platform', a ? a.platform : 'xhs')) +
      MW.ui.row('账号 ID', '<input id="f-accountid" placeholder="各平台的后台账号 / ID" value="' + MW.esc(a ? a.accountId : '') + '">') +
      MW.ui.row('账号名称', '<input id="f-name" placeholder="例如：烟枪先森-AI搞钱" value="' + MW.esc(a ? a.name : '') + '">') +
      MW.ui.row('账号定位', '<textarea id="f-positioning" rows="2" placeholder="一句话说清楚这个号是干什么的、给谁看">' + MW.esc(a ? a.positioning : '') + '</textarea>', '定位决定内容边界，也是 AI 生成时的上下文') +
      MW.ui.row('目标受众',
        '<textarea id="f-audience" rows="2" placeholder="例如：想用 AI 做副业或创业的开发者与电商人">' + MW.esc(a ? (a.audience || '') : '') + '</textarea>',
        '写文案时对着谁说话。AI 会用它调整用词和案例选择') +
      '<div class="form-2col">' +
        MW.ui.row('内容风格', '<input id="f-style" placeholder="例如：干货实操 / 轻教程 / 深度长文" value="' + MW.esc(a ? a.style : '') + '">') +
        MW.ui.row('表达风格', '<input id="f-tone" placeholder="例如：第一人称实战记录，数据截图佐证" value="' + MW.esc(a ? (a.tone || '') : '') + '">', '语气和人称，直接影响生成文案的写法') +
      '</div>' +
      MW.ui.row('内容聚焦（每行一个方向）',
        '<textarea id="f-focus" rows="5" placeholder="每行一个方向，例如：&#10;AI工具实操&#10;独立站&#10;外贸CRM&#10;电商增长">' + MW.esc(a ? a.focus.join('\n') : '') + '</textarea>',
        'AI 生成选题和文案时的方向来源，建议 3-5 个，按重要性排序') +
      mixEditor(a) +
      '<div class="form-2col">' +
        MW.ui.row('周更频率（篇）', '<input id="f-cadence" type="number" min="1" value="' + (a ? (a.cadence || 3) : 3) + '">', '决定「断更提醒」的松紧：更得越勤，提醒越早') +
        MW.ui.row('月更目标（篇）', '<input id="f-goalp" type="number" min="0" value="' + (a ? a.goalPosts : 0) + '">') +
      '</div>' +
      '<div class="form-2col">' +
        MW.ui.row('当前粉丝', '<input id="f-followers" type="number" min="0" value="' + (a ? a.followers : 0) + '">') +
        MW.ui.row('涨粉目标', '<input id="f-goalf" type="number" min="0" value="' + (a ? a.goalFollowers : 0) + '">') +
      '</div>' +
      MW.ui.row('状态', MW.ui.select('f-status', [{ v: 'active', t: '运营中' }, { v: 'paused', t: '已暂停' }], a ? a.status : 'active'), '暂停的账号不参与断更提醒');

    MW.modal({
      title: a ? '编辑账号' : '添加账号',
      sub: a ? '可直接改字段，也可贴一段新的账号资料让 AI 重新识别' : '手工填写，或把 AI 写好的方案粘进顶部识别框',
      body: body,
      size: 'md',
      okText: '保存',
      onOk: function (root) {
        const v = function (id) { return (root.querySelector('#' + id).value || '').trim(); };
        const name = v('f-name');
        if (!name) { MW.toast('请填写账号名称', 'error'); return false; }
        const obj = {
          platform: v('f-platform'),
          accountId: v('f-accountid'),
          name: name,
          style: v('f-style'),
          tone: v('f-tone'),
          positioning: v('f-positioning'),
          audience: v('f-audience'),
          focus: v('f-focus').split(/[\n,，、;；]+/).map(function (s) { return s.trim(); }).filter(Boolean),
          mix: readMix(root),
          followers: +v('f-followers') || 0,
          goalFollowers: +v('f-goalf') || 0,
          goalPosts: +v('f-goalp') || 0,
          cadence: +v('f-cadence') || 3,
          status: v('f-status')
        };
        if (a) Object.assign(a, obj);
        else db.accounts.push(Object.assign({ id: MW.uid(), createdAt: MW.dateStr() }, obj));
        MW.save(); MW.render();
        MW.toast(a ? '账号已更新' : '账号已添加');
      }
    });

    bindAiImport(document.getElementById('modal-root'));

    /* 配比输入即时算合计，不用等保存才发现不是 100% */
    MW.TOPIC_TYPE_LIST.forEach(function (t) {
      const el = document.getElementById('mix-' + t.key);
      if (el) el.addEventListener('input', function () { readMix(document.getElementById('modal-root')); });
    });
    readMix(document.getElementById('modal-root'));
  };

  /* 单个账号快速更新粉丝 */
  MW.act.snapOne = function (id) {
    const db = MW.getDB();
    const a = db.accounts.find(function (x) { return x.id === id; });
    if (!a) return;
    const g = MW.growth(a, 7);
    MW.modal({
      title: '更新粉丝数', sub: a.name + ' · 近 7 天 ' + (g.delta >= 0 ? '+' : '') + g.delta,
      body: MW.ui.row('当前粉丝', '<input id="sn-f" type="number" min="0" value="' + a.followers + '">',
        '每记一次，涨粉曲线就多一个点；同一天会覆盖'),
      okText: '保存',
      onOk: function (root) {
        MW.pushSnapshot(a.id, root.querySelector('#sn-f').value);
        MW.save(); MW.render();
        MW.toast('粉丝已更新');
      }
    });
  };

  MW.act.delAccount = function (id) {
    const db = MW.getDB();
    MW.confirm('删除账号后，其关联的选题、内容和数据仍会保留。确定删除？', function () {
      db.accounts = db.accounts.filter(function (a) { return a.id !== id; });
      MW.save(); MW.render();
      MW.toast('账号已删除');
    }, { okText: '删除' });
  };

  /* 某个聚焦方向的产出情况：让「方向」不再是空话 */
  function focusStat(accId, f) {
    const db = MW.getDB();
    /* 优先用内容上标注的方向字段，老数据走标题模糊匹配兜底 */
    const rel = function (item) { return item.focus ? item.focus === f : MW.focusHit(f, item.title); };
    let pub = 0, last = '';
    db.contents.forEach(function (c) {
      if (c.accountId !== accId || c.status !== 'published' || !rel(c)) return;
      pub++;
      if (c.date > last) last = c.date;
    });
    let stock = 0;
    db.topics.forEach(function (tp) {
      if (tp.accountId !== accId || tp.stage === 'published' || tp.stage === 'retro') return;
      if (rel(tp)) stock++;
    });
    return { pub: pub, stock: stock, last: last };
  }

  /* 内容/选题表单里的「所属方向」下拉（跟随账号联动） */
  MW.ui.focusOptions = function (accId, value, id) {
    const acc = MW.accOf(accId);
    const fs = (acc && acc.focus) || [];
    return MW.ui.select(id || 'f-focus-item', [{ v: '', t: '未归类' }].concat(fs.map(function (f) { return { v: f, t: f }; })), value || '');
  };

  MW.views['accounts'] = {
    id: 'accounts', name: '账号矩阵', icon: 'users',
    sub: '多平台账号统一管理，一个品牌 = 一个内容策略',
    render: function (root) {
      const db = MW.getDB();
      const t = MW.dateStr();
      const month = t.slice(0, 7);
      const weekStart = MW.addDays(t, -6);

      let list = db.accounts.filter(function (a) { return filterPlatform === 'all' || a.platform === filterPlatform; });
      /* 排序：默认粉丝多的在前，也可按涨粉或「需要关注」排 */
      const rank = {};
      db.accounts.forEach(function (a) { rank[a.id] = { g: MW.growth(a, 7).delta, s: MW.silentDays(a), st: MW.stockCount(a.id) }; });
      list = list.slice().sort(function (a, b) {
        if (sortBy === 'growth') return rank[b.id].g - rank[a.id].g;
        if (sortBy === 'alert') {
          const score = function (a2) {
            const r = rank[a2.id];
            const limit = (a2.cadence ? Math.ceil(7 / a2.cadence) : 3) + 2;
            return (r.s >= limit ? 100 : 0) + Math.min(r.s, 30) + (r.st < 3 ? 40 : 0);
          };
          return score(b) - score(a);
        }
        return (+b.followers || 0) - (+a.followers || 0);
      });

      /* ---------- 矩阵总览 ---------- */
      const totalFans = db.accounts.reduce(function (s, a) { return s + (+a.followers || 0); }, 0);
      const weekGain = db.accounts.reduce(function (s, a) { return s + MW.growth(a, 7).delta; }, 0);
      const activeN = db.accounts.filter(function (a) { return a.status === 'active'; }).length;
      const monthPub = db.contents.filter(function (c) { return c.status === 'published' && c.date.slice(0, 7) === month; }).length;
      const noFocus = db.accounts.filter(function (a) { return !(a.focus && a.focus.length); }).length;

      let html = '<div class="page-head"><div class="page-title">账号矩阵</div>' +
        '<div class="page-sub">一个账号 = 一套内容策略 · 定位越清晰，AI 生成越准</div>' +
        '<button class="btn" onclick="MW.act.snapshotModal()">' + MW.icon('trend', 14) + ' 记今日粉丝</button>' +
        '<button class="btn" onclick="MW.act.editAccount(\'\', { ai: true })">' + MW.icon('sparkles', 14) + ' AI 识别导入</button>' +
        '<button class="btn primary" onclick="MW.act.editAccount()">' + MW.icon('plus', 14) + ' 添加账号</button></div>';

      html += '<div class="matrix-bar">' +
        '<div class="mb-item"><b>' + MW.fmt.int(totalFans) + '</b><span>矩阵总粉丝</span></div>' +
        '<div class="mb-item"><b class="' + (weekGain >= 0 ? 'up' : 'down') + '">' + (weekGain >= 0 ? '+' : '') + MW.fmt.int(weekGain) + '</b><span>本周净涨</span></div>' +
        '<div class="mb-item"><b>' + activeN + '/' + db.accounts.length + '</b><span>运营中账号</span></div>' +
        '<div class="mb-item"><b>' + monthPub + '</b><span>本月已发布</span></div>' +
        '<div class="mb-item"><b class="' + (noFocus ? 'down' : 'up') + '">' + noFocus + '</b><span>缺聚焦方向</span></div>' +
        '<div class="mb-tip">' + MW.icon('clock', 13) + ' 每天记一次粉丝数，曲线才连得起来</div>' +
        '</div>';

      /* ---------- 平台筛选 + 排序 ---------- */
      const pfCount = {};
      db.accounts.forEach(function (a) { pfCount[a.platform] = (pfCount[a.platform] || 0) + 1; });
      const pfTabs = [{ v: 'all', t: '全部 ' + db.accounts.length }].concat(Object.keys(MW.PLATFORMS)
        .filter(function (k) { return pfCount[k]; })
        .map(function (k) { return { v: k, t: MW.PLATFORMS[k].name + ' ' + pfCount[k] }; }));
      html += '<div class="acc-toolbar">' +
        '<div class="seg">' + pfTabs.map(function (p) {
          return '<button class="seg-btn' + (filterPlatform === p.v ? ' active' : '') + '" onclick="MW.act.setAccFilter(\'' + p.v + '\')">' + MW.esc(p.t) + '</button>';
        }).join('') + '</div>' +
        '<div class="acc-sort"><span>排序</span>' +
        MW.ui.select('acc-sort', [
          { v: 'fans', t: '粉丝数' }, { v: 'growth', t: '本周涨粉' }, { v: 'alert', t: '需要关注优先' }
        ], sortBy) + '</div>' +
        '</div>';

      if (!list.length) {
        html += MW.ui.empty('暂无账号', '点击「添加账号」手动填写，或使用「AI 识别导入」自动解析账号资料');
      } else {
        html += '<div class="acc-list">' + list.map(function (a) {
          const p = MW.PLATFORMS[a.platform];
          const g7 = MW.growth(a, 7);
          const vs = MW.snapValues(a, 10);
          const gp = a.goalFollowers ? Math.min(100, a.followers / a.goalFollowers * 100) : 0;
          const active = a.status === 'active';

          const weekPubN = db.contents.filter(function (c) {
            return c.accountId === a.id && c.status === 'published' && c.date >= weekStart && c.date <= t;
          }).length;
          const monthN = db.contents.filter(function (c) {
            return c.accountId === a.id && c.status === 'published' && c.date.slice(0, 7) === month;
          }).length;
          const stock = MW.stockCount(a.id);
          const silent = MW.silentDays(a);
          const lp = MW.lastPublish(a.id);
          const silentLimit = (a.cadence ? Math.ceil(7 / a.cadence) : 3) + 2;
          const silentBad = lp && silent >= silentLimit;

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
            '<div class="acc-pos">' + MW.esc(a.positioning || '未填写定位——AI 会缺上下文') + '</div>' +
            '<div class="acc-meta-line">' +
            '<span class="am-chip">' + MW.icon('palette', 11) + ' ' + MW.esc(a.style || '未设风格') + '</span>' +
            '<span class="am-chip">' + MW.icon('refresh', 11) + ' 周更 ' + (a.cadence || 3) + ' 篇</span>' +
            '<span class="am-chip">' + MW.icon('target', 11) + ' 目标 ' + MW.fmt.int(a.goalFollowers) + ' 粉</span>' +
            '</div>' +
            '</div>' +
            '<div class="acc-week"><div class="aw-title">近 7 天发布节奏</div>' +
            '<div class="aw-cells">' + cells + '</div></div>' +
            '<div class="acc-metrics">' +
            '<div class="am-fans"><b>' + MW.fmt.int(a.followers) + '</b><span>粉丝</span></div>' +
            '<div class="am-delta ' + (g7.delta >= 0 ? 'up' : 'down') + '">' + (g7.delta >= 0 ? '+' : '') + MW.fmt.int(g7.delta) +
            '<em>近 7 天</em></div>' +
            '<div class="am-spark">' + (vs.length > 1
              ? MW.charts.sparkline(vs, g7.delta >= 0 ? '#e5484d' : '#18a058', 168, 34)
              : '<span class="ag-nodata">记一次粉丝就有曲线</span>') + '</div>' +
            '<div class="am-goal">目标进度 ' + Math.round(gp) + '%（还差 ' + MW.fmt.int(Math.max(0, a.goalFollowers - a.followers)) + '）</div>' +
            MW.ui.progress(gp, p.color) +
            '</div>' +
            '</div>';

          /* --- 健康体检 + 操作 --- */
          h += '<div class="acc-health">' +
            '<div class="ah-item"><b>' + weekPubN + '</b><span>本周发布</span></div>' +
            '<div class="ah-item' + (stock < 3 ? ' warn' : '') + '"><b>' + stock + '</b><span>选题库存</span></div>' +
            '<div class="ah-item' + (silentBad ? ' bad' : '') + '"><b>' + (lp ? silent + ' 天' : '未开张') + '</b><span>断更</span></div>' +
            '<div class="ah-item"><b>' + monthN + '/' + (a.goalPosts || 0) + '</b><span>本月发布</span></div>' +
            '<div class="ah-ops">' +
            '<button class="btn sm" onclick="MW.setCurAcc(\'' + a.id + '\')">' + MW.icon('eye', 12) + ' 只看该号</button>' +
            '<button class="btn sm" onclick="MW.act.snapOne(\'' + a.id + '\')">' + MW.icon('trend', 12) + ' 记粉丝</button>' +
            '<button class="btn sm" onclick="MW.goto(\'#/ai\');MW.act.aiUseAccount(\'' + a.id + '\')">' + MW.icon('sparkles', 12) + ' AI 文案</button>' +
            '<button class="btn sm" onclick="MW.act.editAccount(\'' + a.id + '\')">' + MW.icon('edit', 12) + ' 编辑</button>' +
            '<button class="btn sm danger-ghost" onclick="MW.act.delAccount(\'' + a.id + '\')">' + MW.icon('trash', 12) + '</button>' +
            '</div></div>';

          /* --- IP 规范：账号信息不是档案，是喂给内容生产的输入 --- */
          const mix = MW.accMix(a);
          const ms = MW.mixStat(a.id);
          /* 样本太少时「实际」没有统计意义（发 1 篇就是 100%），
             显示破折号并说明，别拿一个假百分比误导人 */
          const mixEnough = ms.total >= 5;
          const mixRows = MW.TOPIC_TYPE_LIST.map(function (t) {
            const want = mix[t.key];
            const got = ms[t.key + '_pct'];
            /* 偏差超过 15 个百分点才标出来——小偏差是正常的，全标等于没标 */
            const off = mixEnough && Math.abs(want - got) >= 15;
            return '<div class="ip-mix-row' + (off ? ' off' : '') + '">' +
              '<span class="ip-mix-name">' + MW.esc(t.name) + '</span>' +
              '<span class="ip-mix-bar"><i style="width:' + want + '%"></i>' +
                (mixEnough ? '<em style="width:' + got + '%"></em>' : '') + '</span>' +
              '<span class="ip-mix-num">' + want + '%' + (mixEnough ? ' / <b>' + got + '%</b>' : ' / <b>—</b>') + '</span>' +
              '</div>';
          }).join('');
          h += '<div class="acc-ip-sec"><div class="ip-head">' +
            MW.icon('flag', 12) + ' IP 规范 · 内容生产依据' +
            '<span class="ip-tip">下列每项都会进入 AI 生成上下文，改这里等于改所有内容</span>' +
            '<button class="btn sm ghost" onclick="MW.act.editAccount(\'' + a.id + '\')">' + MW.icon('edit', 11) + ' 调整</button></div>';
          h += '<div class="ip-grid">' +
            '<div class="ip-cell"><span class="ip-label">定位</span><span class="ip-val">' + MW.esc(a.positioning || '未填写') + '</span></div>' +
            '<div class="ip-cell"><span class="ip-label">目标受众</span><span class="ip-val">' + MW.esc(a.audience || '未填写') + '</span></div>' +
            '<div class="ip-cell"><span class="ip-label">表达风格</span><span class="ip-val">' + MW.esc(a.tone || a.style || '未填写') + '</span></div>' +
            '<div class="ip-cell"><span class="ip-label">内容风格</span><span class="ip-val">' + MW.esc(a.style || '未填写') + '</span></div>' +
            '</div>';
          const mixNote = mixEnough
            ? '<span class="ip-mix-legend"><i class="want"></i>目标 <i class="got"></i>实际（已发 ' + ms.total + ' 篇）</span>'
            : '<span class="ip-mix-legend thin">已发 ' + ms.total + ' 篇，样本不足 5 篇暂不对比</span>';
          h += '<div class="ip-mix' + (mixEnough ? '' : ' thin') + '"><div class="ip-mix-head">内容配比' +
            mixNote + '</div>' + mixRows + '</div>';
          h += '</div>';

          /* --- 内容聚焦：每行一个方向 --- */
          h += '<div class="acc-focus-sec"><div class="af-head">' +
            MW.icon('target', 12) + ' 内容聚焦 · AI 生成方向' +
            '<span class="af-tip">每行一个方向，点任意一行直接用它写文案</span></div>';
          if (!a.focus.length) {
            h += '<div class="af-empty">尚未设置内容聚焦，AI 生成将缺乏方向。' +
              '<button class="btn sm" onclick="MW.act.editAccount(\'' + a.id + '\')">去设置</button></div>';
          } else {
            h += '<div class="af-list">' + a.focus.map(function (f, i) {
              const st = focusStat(a.id, f);
              return '<div class="af-row" onclick="MW.act.aiFocusWrite(\'' + a.id + '\', ' + JSON.stringify(f).replace(/"/g, '&quot;') + ')">' +
                '<span class="af-idx">' + (i + 1) + '</span>' +
                '<span class="af-name">' + MW.esc(f) + '</span>' +
                '<span class="af-pills">' +
                (st.pub ? '<span class="af-pill pub">已发 ' + st.pub + '</span>' : '<span class="af-pill none">未产出</span>') +
                (st.stock ? '<span class="af-pill stock">库存 ' + st.stock + '</span>' : '') +
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
