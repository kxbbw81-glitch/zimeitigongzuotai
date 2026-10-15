/* ============================================================
   视图 · 财务管理（订单式记账）
   ------------------------------------------------------------
   一笔订单占一行：客户 / 项目 / 金额 / 成本 / 自动算利润 / 来源渠道 / 收款渠道。
   运营支出（工具、投放、分成）另外记，在「支出流水」页签里。
   两个合起来才是「这个月到底到手多少」。

   为什么不做成「收入一条 + 支出一条」的纯流水账：
   那样永远看不出单笔订单赚不赚，也没有客户和渠道的概念——
   而做生意最想知道的恰恰是「哪个客户、哪个渠道、哪门生意最赚钱」。
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  let finMonth = MW.dateStr().slice(0, 7);
  let finTab = 'order';        /* order = 订单收入 | expense = 支出流水 */
  let finSort = 'date';        /* 订单排序：date | profit | amount */

  MW.act.setFinMonth = function (m) { finMonth = m; MW.render(); };
  MW.act.setFinTab = function (t) { finTab = t; MW.render(); };
  MW.act.setFinSort = function (s) { finSort = s; MW.render(); };

  function datalist(id, list) {
    return '<datalist id="' + id + '">' + list.map(function (c) {
      return '<option value="' + MW.esc(c) + '"></option>';
    }).join('') + '</datalist>';
  }

  /* 收入行 = 订单，支出行 = 流水 */
  function isOrder(f) { return f && f.type === 'income'; }

  function sortOrders(rows) {
    const arr = rows.slice();
    if (finSort === 'profit') arr.sort(function (a, b) { return MW.orderProfit(b) - MW.orderProfit(a); });
    else if (finSort === 'amount') arr.sort(function (a, b) { return (+b.amount || 0) - (+a.amount || 0); });
    else arr.sort(function (a, b) { return b.date.localeCompare(a.date); });
    return arr;
  }

  /* ============================================================
     记一笔 / 编辑
     ============================================================ */
  /* forceType：顶栏「快速创建 → 记一笔」用。不指定时跟当前页签走
     （在「支出流水」页点记一笔，多半就是要记支出），
     但从别的页面点进来时，不该被上次停留的页签决定弹出哪种表单。 */
  MW.act.openFinanceModal = function (id, forceType) {
    const db = MW.getDB();
    const f = id ? db.finance.find(function (x) { return x.id === id; }) : null;
    let curType = f ? f.type : (forceType || (finTab === 'expense' ? 'expense' : 'income'));

    const accOpts = [{ v: '', t: '不关联' }].concat(db.accounts.map(function (a) { return { v: a.id, t: a.name }; }));
    const ownerOpts = [{ v: '我', t: '我' }, { v: '合伙人', t: '合伙人' }];
    const pick = function (v) { return f ? (f[v] || '') : ''; };

    const orderBody =
      '<div class="form-2col">' +
        MW.ui.row('日期', '<input id="fo-date" type="date" value="' + (f ? f.date : MW.dateStr()) + '">') +
        MW.ui.row('客户 / 联系人', '<input id="fo-customer" placeholder="张三、某某公司" value="' + MW.esc(pick('customer')) + '">') +
      '</div>' +
      '<div class="form-2col">' +
        MW.ui.row('项目', '<input id="fo-category" list="fo-cats" placeholder="这单卖的什么" value="' + MW.esc(pick('category')) + '">' +
          datalist('fo-cats', MW.FIN_PROJECTS)) +
        MW.ui.row('笔次 / 订购号', '<input id="fo-orderno" placeholder="20260601-001（选填，用来防重复导入）" value="' + MW.esc(pick('orderNo')) + '">') +
      '</div>' +
      '<div class="form-2col">' +
        MW.ui.row('金额（元）', '<input id="fo-amount" type="number" min="0" step="0.01" placeholder="收到的钱" value="' + (f ? f.amount : '') + '">') +
        MW.ui.row('成本（元）', '<input id="fo-cost" type="number" min="0" step="0.01" placeholder="这单的本钱，没有就留空" value="' + (f && f.cost ? f.cost : '') + '">') +
      '</div>' +
      '<div class="fin-profit-bar">这单利润 <b id="fo-profit">¥0</b><span class="fin-profit-hint">金额 − 成本，自动算</span></div>' +
      '<div class="form-2col">' +
        MW.ui.row('来源渠道', '<input id="fo-source" list="fo-sources" placeholder="客户从哪来的" value="' + MW.esc(pick('source')) + '">' +
          datalist('fo-sources', MW.FIN_SOURCES)) +
        MW.ui.row('收款渠道', '<input id="fo-channel" list="fo-channels" placeholder="钱怎么收的" value="' + MW.esc(pick('channel')) + '">' +
          datalist('fo-channels', MW.FIN_CHANNELS)) +
      '</div>' +
      MW.ui.row('相关信息', '<input id="fo-detail" placeholder="这单具体做了什么" value="' + MW.esc(pick('detail')) + '">') +
      '<div class="form-2col">' +
        MW.ui.row('负责人', MW.ui.select('fo-owner', ownerOpts, f ? f.owner : '我')) +
        MW.ui.row('关联账号（选填）', MW.ui.select('fo-account', accOpts, pick('accountId'))) +
      '</div>' +
      MW.ui.row('备注', '<input id="fo-note" placeholder="分成说明、售后情况……" value="' + MW.esc(pick('note')) + '">');

    const expenseBody =
      '<div class="form-2col">' +
        MW.ui.row('日期', '<input id="fe-date" type="date" value="' + (f ? f.date : MW.dateStr()) + '">') +
        MW.ui.row('类目', '<input id="fe-category" list="fe-cats" placeholder="例如：工具订阅" value="' + MW.esc(pick('category')) + '">' +
          datalist('fe-cats', MW.FIN_EXPENSE_CATS)) +
      '</div>' +
      '<div class="form-2col">' +
        MW.ui.row('金额（元）', '<input id="fe-amount" type="number" min="0" step="0.01" value="' + (f ? f.amount : '') + '">') +
        MW.ui.row('负责人', MW.ui.select('fe-owner', ownerOpts, f ? f.owner : '我')) +
      '</div>' +
      MW.ui.row('关联账号（选填）', MW.ui.select('fe-account', accOpts, pick('accountId'))) +
      MW.ui.row('备注', '<input id="fe-note" placeholder="买什么了……" value="' + MW.esc(pick('note')) + '">');

    const body =
      '<div class="fin-switch"><span class="seg small" id="fn-seg">' +
        '<button type="button" class="seg-btn' + (curType === 'income' ? ' active' : '') + '" data-t="income">' +
          MW.icon('trend', 12) + ' 订单收入</button>' +
        '<button type="button" class="seg-btn' + (curType === 'expense' ? ' active' : '') + '" data-t="expense">' +
          MW.icon('wallet', 12) + ' 支出流水</button>' +
      '</span></div>' +
      '<div id="fn-order"' + (curType === 'income' ? '' : ' style="display:none"') + '>' + orderBody + '</div>' +
      '<div id="fn-expense"' + (curType === 'expense' ? '' : ' style="display:none"') + '>' + expenseBody + '</div>';

    MW.modal({
      title: f ? '编辑账目' : (curType === 'expense' ? '记一笔支出' : '记一笔订单'),
      sub: '一笔订单记清收入和成本，才知道每个客户、每个渠道到底赚不赚钱',
      body: body,
      okText: '保存',
      onOk: function (root) {
        const v = function (id2) {
          const el = root.querySelector('#' + id2);
          return el ? String(el.value || '').trim() : '';
        };
        let obj;
        if (curType === 'income') {
          const amount = +v('fo-amount');
          if (!amount || amount <= 0) { MW.toast('请填写订单金额', 'error'); return false; }
          obj = {
            type: 'income', date: v('fo-date') || MW.dateStr(),
            customer: v('fo-customer'), category: v('fo-category') || '其他收入',
            orderNo: v('fo-orderno'), amount: amount,
            /* 成本留空就是 0，不写 undefined——不然利润会算成 NaN */
            cost: +v('fo-cost') || 0,
            detail: v('fo-detail'), source: v('fo-source'), channel: v('fo-channel'),
            owner: v('fo-owner'), accountId: v('fo-account'), note: v('fo-note')
          };
        } else {
          const amount = +v('fe-amount');
          if (!amount || amount <= 0) { MW.toast('请填写正确金额', 'error'); return false; }
          obj = {
            type: 'expense', date: v('fe-date') || MW.dateStr(),
            category: v('fe-category') || '其他支出', amount: amount, cost: 0,
            owner: v('fe-owner'), accountId: v('fe-account'), note: v('fe-note')
          };
        }
        if (f) {
          /* 改类型时先把另一种账才有的字段清掉，
             否则一条支出流水里还挂着客户和订单号，看着莫名其妙 */
          ['customer', 'detail', 'orderNo', 'source', 'channel'].forEach(function (k) { delete f[k]; });
          Object.assign(f, obj);
        } else {
          db.finance.push(Object.assign({ id: MW.uid() }, obj));
        }
        MW.save(); MW.render();
        MW.toast(f ? '账目已更新' : (curType === 'income' ? '订单已记录' : '支出已记录'));
      }
    });

    if (f) {
      const foot = document.querySelector('#modal-root .modal-foot');
      if (foot) {
        const extra = document.createElement('div');
        extra.className = 'modal-foot-extra';
        extra.innerHTML = '<button class="btn sm danger-ghost" onclick="MW.act.delFinance(\'' + f.id + '\')">' + MW.icon('trash', 13) + ' 删除</button>';
        foot.appendChild(extra);
      }
    }

    /* 类型切换：两套字段都渲染在 DOM 里，只是显示/隐藏，切回来不丢已填内容 */
    const seg = document.getElementById('fn-seg');
    if (seg) {
      seg.querySelectorAll('.seg-btn').forEach(function (b) {
        b.onclick = function () {
          curType = b.getAttribute('data-t');
          seg.querySelectorAll('.seg-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
          document.getElementById('fn-order').style.display = curType === 'income' ? '' : 'none';
          document.getElementById('fn-expense').style.display = curType === 'expense' ? '' : 'none';
        };
      });
    }

    /* 利润实时预览：边填边看赚多少，不用心算 */
    const amountEl = document.getElementById('fo-amount');
    const costEl = document.getElementById('fo-cost');
    function refreshProfit() {
      const el = document.getElementById('fo-profit');
      if (!el) return;
      const p = (+((amountEl || {}).value) || 0) - (+((costEl || {}).value) || 0);
      el.textContent = MW.fmt.money(p);
      el.className = p < 0 ? 'loss' : '';
    }
    if (amountEl) amountEl.oninput = refreshProfit;
    if (costEl) costEl.oninput = refreshProfit;
    refreshProfit();
  };

  MW.act.delFinance = function (id) {
    const db = MW.getDB();
    const f = db.finance.find(function (x) { return x.id === id; });
    MW.confirm('删掉这条' + (f && isOrder(f) ? '订单（' + (f.customer || '未填客户') + ' · ' + MW.fmt.money(f.amount) + '）' : '支出') + '？删了就找不回来了。',
      function () {
        db.finance = db.finance.filter(function (x) { return x.id !== id; });
        MW.save(); MW.render(); MW.closeModal();
        MW.toast('已删除');
      }, { title: '删除账目', okText: '删除' });
  };

  /* ============================================================
     从 Excel 粘贴导入
     ------------------------------------------------------------
     Excel 里选中区域复制出来是 TSV（制表符分隔）。识别表头 → 映射列 → 预览 → 入库。
     这是「让工作台接受你已有的账」的关键：没人愿意把几十条老账手敲一遍。
     ============================================================ */
  const HEAD_MAP = [
    [/日期|时间|date/i, 'date'],
    [/客户|联系人|姓名/, 'customer'],
    [/订购号|订单号|单号|笔次|编号/, 'orderNo'],
    [/收款/, 'channel'],
    [/来源|获客/, 'source'],
    [/相关信息|详情|说明/, 'detail'],
    [/成本/, 'cost'],
    [/金额|收入|营收|amount/i, 'amount'],
    [/项目|业务|类目/, 'category'],
    [/备注|描述|note/i, 'note']
  ];
  /* 没有表头时的兜底列序，就是「日期/客户/项目/相关信息/订购号/金额/成本/利润/来源/收款/备注」
     （_x = 利润列，直接忽略：它跟「金额 − 成本」可能不一致，我们自己算） */
  const DEFAULT_COLS = ['date', 'customer', 'category', 'detail', 'orderNo', 'amount', 'cost', '_x', 'source', 'channel', 'note'];

  function p2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  function toNum(s) {
    const t = String(s == null ? '' : s).replace(/[^\d.\-]/g, '');
    if (!t || t === '-' || t === '.') return 0;
    return +t || 0;
  }

  /* 日期只认能真实验证的。「2026-02-31」这种写错的必须拦下——
     JS 的 Date 会悄悄把它滚成 3 月 3 日，那就等于自己编了一条账出来。
     也不认「06/01」这种没年份的：年份全靠猜，猜错就是一笔错账。 */
  function toDate(s) {
    const t = String(s == null ? '' : s).trim();
    const m = t.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
    if (!m) return '';
    const y = +m[1], mo = +m[2], da = +m[3];
    const d = new Date(y, mo - 1, da);
    if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return '';
    return y + '-' + p2(mo) + '-' + p2(da);
  }

  function splitCells(line) {
    if (line.indexOf('\t') >= 0) return line.split('\t');
    if (line.indexOf(',') >= 0) return line.split(',');
    if (line.indexOf('，') >= 0) return line.split('，');
    return [line];
  }

  function parseLedger(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n')
      .filter(function (l) { return l.trim() !== ''; });
    if (!lines.length) return { rows: [], skipped: 0, header: false };

    let cols = DEFAULT_COLS, start = 0, header = false;
    const first = splitCells(lines[0]).map(function (c) { return String(c).trim(); });
    const mapped = first.map(function (h) {
      for (let i = 0; i < HEAD_MAP.length; i++) { if (HEAD_MAP[i][0].test(h)) return HEAD_MAP[i][1]; }
      return '';
    });
    /* 认到两个以上字段名才当表头，不然「备注」里带个「日期」二字就可能被误判 */
    if (mapped.filter(Boolean).length >= 2) { cols = mapped; start = 1; header = true; }

    const rows = [];
    let skipped = 0;
    for (let i = start; i < lines.length; i++) {
      const cells = splitCells(lines[i]).map(function (c) { return String(c).trim(); });
      const o = {};
      cols.forEach(function (k, j) { if (k && k !== '_x') o[k] = cells[j] == null ? '' : cells[j]; });
      const date = toDate(o.date);
      const amount = toNum(o.amount);
      /* 日期读不出来、或者金额是 0 的行跳过：
         Excel 里预填了公式的空行会带一堆 ¥0.00，那些本来就不是账 */
      if (!date || !amount) { skipped++; continue; }
      rows.push({
        date: date,
        customer: o.customer || '',
        category: o.category || '其他收入',
        detail: o.detail || '',
        orderNo: o.orderNo || '',
        amount: amount,
        cost: toNum(o.cost),
        source: o.source || '',
        channel: o.channel || '',
        note: o.note || ''
      });
    }
    return { rows: rows, skipped: skipped, header: header };
  }

  let finImportRows = [];

  MW.act.finImport = function () {
    finImportRows = [];
    MW.modal({
      title: '从 Excel 粘贴导入订单',
      size: 'lg',
      sub: '在 Excel 里选中区域 → Ctrl+C → 粘到下面。有表头会自动认列；没有表头就按「日期 / 客户 / 项目 / 相关信息 / 订购号 / 金额 / 成本 / 利润 / 来源 / 收款 / 备注」的顺序认',
      body:
        '<textarea id="fi-text" rows="9" class="fin-import-ta" placeholder="在这里 Ctrl+V 粘贴。例如：&#10;2026-06-01　张三　AI绘图订单　产品主图5张　20260529-001　¥399.00　¥30.00　¥369.00　小红书　微信"></textarea>' +
        '<div class="fin-import-ops">' +
          '<button type="button" class="btn sm" id="fi-parse">' + MW.icon('search', 13) + ' 解析预览</button>' +
          '<label class="fin-chk"><input type="checkbox" id="fi-dedupe" checked> 跳过订单号重复的</label>' +
          '<span class="fin-import-hint">表里的「利润」列会被忽略，按「金额 − 成本」自己算</span>' +
        '</div>' +
        '<div id="fi-preview"></div>',
      okText: '导入',
      onOk: function () {
        /* 用户可能粘完直接点导入，那就先解析一次 */
        if (!finImportRows.length) {
          const ta0 = document.getElementById('fi-text');
          finImportRows = parseLedger(ta0 ? ta0.value : '').rows;
        }
        if (!finImportRows.length) {
          MW.toast('没解析出可导入的行，检查一下是不是复制全了', 'error');
          return false;
        }
        const db = MW.getDB();
        const dedupeEl = document.getElementById('fi-dedupe');
        const dedupe = !dedupeEl || dedupeEl.checked;
        const exist = {};
        db.finance.forEach(function (x) { if (x.orderNo) exist[x.orderNo] = 1; });
        let added = 0, dup = 0;
        finImportRows.forEach(function (r) {
          if (dedupe && r.orderNo && exist[r.orderNo]) { dup++; return; }
          db.finance.push(Object.assign({ id: MW.uid(), type: 'income', owner: '我', accountId: '' }, r));
          if (r.orderNo) exist[r.orderNo] = 1;
          added++;
        });
        /* 导完跳到导入数据里最新的那个月，不然用户看不到自己刚导进去的东西 */
        const ms = finImportRows.map(function (r) { return r.date.slice(0, 7); }).sort();
        if (ms.length) finMonth = ms[ms.length - 1];
        finTab = 'order'; finSort = 'date';
        MW.save(); MW.render();
        MW.toast('导入 ' + added + ' 条订单' + (dup ? '，跳过 ' + dup + ' 条重复订单号' : ''));
      }
    });

    const ta = document.getElementById('fi-text');
    const btn = document.getElementById('fi-parse');
    if (!ta || !btn) return;

    btn.onclick = function () {
      const p = parseLedger(ta.value);
      finImportRows = p.rows;
      const box = document.getElementById('fi-preview');
      if (!p.rows.length) {
        box.innerHTML = '<div class="fin-import-empty">没解析出可导入的行。常见原因：日期没有年份（<code>06/01</code> 这种不敢猜），或者金额是 0（Excel 里预填公式的空行会被自动跳过）。</div>';
        return;
      }
      const sum = MW.finSummary(p.rows.map(function (r) { return Object.assign({ type: 'income' }, r); }));
      box.innerHTML =
        '<div class="fin-import-sum">识别到 <b>' + p.rows.length + '</b> 条订单：金额合计 <b class="up">' + MW.fmt.money(sum.revenue) + '</b>' +
        '、成本 <b class="down">' + MW.fmt.money(sum.cost) + '</b>、预计毛利 <b class="up">' + MW.fmt.money(sum.gross) + '</b>' +
        '<span class="muted">（' + (p.header ? '已识别表头' : '没有表头，按默认列序读的') +
        (p.skipped ? '　·　跳过 ' + p.skipped + ' 行空行/无效行' : '') + '）</span></div>' +
        '<table class="table fin-import-table"><thead><tr><th>日期</th><th>客户</th><th>项目</th><th>订单号</th><th>金额</th><th>成本</th><th>利润</th></tr></thead><tbody>' +
        p.rows.slice(0, 5).map(function (r) {
          return '<tr><td>' + r.date + '</td>' +
            '<td>' + MW.esc(r.customer || '—') + '</td>' +
            '<td>' + MW.esc(r.category) + '</td>' +
            '<td class="fin-orderno">' + MW.esc(r.orderNo || '—') + '</td>' +
            '<td class="fin-amount">' + MW.fmt.money(r.amount) + '</td>' +
            '<td class="fin-cost">' + (r.cost ? '−' + MW.fmt.money(r.cost) : '—') + '</td>' +
            '<td class="fin-profit">' + MW.fmt.money(r.amount - r.cost) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        (p.rows.length > 5 ? '<div class="fin-import-more">上面只显示前 5 条，点右下角「导入」把 ' + p.rows.length + ' 条全部入账</div>' : '');
    };
    /* 内容一改就作废上次解析结果，免得粘了新的却导入了旧的 */
    ta.oninput = function () { finImportRows = []; };
    ta.focus();
  };

  /* ============================================================
     页面
     ============================================================ */
  MW.views['finance'] = {
    id: 'finance', name: '财务管理', icon: 'wallet',
    sub: '订单式记账：一笔订单记收入和成本，自动算利润',
    render: function (root) {
      const db = MW.getDB();
      const t = MW.dateStr();

      /* 近 6 个月 */
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = MW.parseDate(t.slice(0, 7) + '-01');
        d.setMonth(d.getMonth() - i);
        months.push(MW.dateStr(d).slice(0, 7));
      }
      const seriesOf = function (key) {
        return months.map(function (m) {
          const s = MW.finSummary(db.finance.filter(function (f) { return f.date.slice(0, 7) === m; }));
          return s[key];
        });
      };

      /* 选「全部」时，上面四张卡和支出结构图的统计范围也跟着变成累计口径。
         不这么做的话，选了「全部」它们的分子是全部、分母却是空集合，
         四张卡会一起变成 ¥0——同一屏里两套口径，用户只会觉得数字错了。 */
      const scopeAll = finMonth === 'all';
      const monthRows = scopeAll ? db.finance : db.finance.filter(function (f) { return f.date.slice(0, 7) === finMonth; });
      const m = MW.finSummary(monthRows);
      const all = MW.finSummary(db.finance);
      const allOrders = db.finance.filter(isOrder);
      const scopeLabel = scopeAll ? '累计' : '本月';

      const card = function (icon, color, label, val, cls, sub) {
        return '<div class="stat-card card"><div class="stat-icon" style="--sc:' + color + '">' + icon + '</div>' +
          '<div class="stat-label">' + label + '</div>' +
          '<div class="stat-val ' + cls + '">' + val + '</div>' +
          '<div class="stat-sub">' + sub + '</div></div>';
      };
      /* 正数用红、负数用绿（涨红跌绿），跟全站口径一致 */
      const pn = function (v) { return v >= 0 ? 'up' : 'down'; };
      let html = '<div class="page-head"><div class="page-title">财务管理</div>' +
        '<div class="page-sub">涨红跌绿 · 累计净利 ' + MW.fmt.money(all.net) +
          '（营收 ' + MW.fmt.money(all.revenue) + ' − 成本 ' + MW.fmt.money(all.cost) +
          ' − 运营支出 ' + MW.fmt.money(all.expense) + '）</div>' +
        '<div class="page-head-actions">' +
          '<button class="btn" onclick="MW.act.finImport()">' + MW.icon('paste', 14) + ' 从 Excel 导入</button>' +
          '<button class="btn primary" onclick="MW.act.openFinanceModal()">' + MW.icon('plus', 14) + ' 记一笔</button>' +
        '</div></div>';

      html += '<div class="stat-row">' +
        card(MW.icon('trend', 17), 'var(--red)', scopeLabel + '营收（订单）', MW.fmt.money(m.revenue), 'up',
          m.orders ? m.orders + ' 笔订单' : scopeAll ? '暂无订单' : '本月暂无订单') +
        card(MW.icon('wallet', 17), 'var(--green)', scopeLabel + '成本', MW.fmt.money(m.cost), 'down',
          m.revenue ? '占营收 ' + Math.round(m.cost / m.revenue * 100) + '%' : '暂无订单') +
        card(MW.icon('chart', 17), 'var(--primary)', scopeLabel + '毛利', MW.fmt.money(m.gross), pn(m.gross),
          m.revenue ? '毛利率 ' + m.margin.toFixed(1) + '%' : '营收 − 成本') +
        card(MW.icon('layers', 17), 'var(--teal)', scopeLabel + '净利', MW.fmt.money(m.net), pn(m.net),
          '已扣 ' + MW.fmt.money(m.expense) + ' 运营支出') +
        '</div>';

      /* 支出结构 */
      const expCats = {};
      monthRows.filter(function (f) { return !isOrder(f); }).forEach(function (f) {
        const k = f.category || '其他支出';
        expCats[k] = (expCats[k] || 0) + (+f.amount || 0);
      });
      const donutColors = ['#e5484d', '#f59e0b', '#4f46e5', '#0ea5a4', '#8b5cf6', '#2f6fed', '#6b7280'];
      const donutData = Object.keys(expCats).map(function (k, i) {
        return { label: k, value: expCats[k], color: donutColors[i % donutColors.length] };
      });

      html += '<div class="chart-grid">' +
        '<div class="card"><div class="card-head"><div class="card-title">近 6 个月营收 · 成本 · 毛利</div>' +
        '<div class="card-extra">' +
          '<span class="legend-item"><i style="background:var(--red)"></i>营收</span>' +
          '<span class="legend-item"><i style="background:var(--green)"></i>成本</span>' +
          '<span class="legend-item"><i style="background:var(--primary)"></i>毛利</span>' +
        '</div></div>' +
        MW.charts.bar({ labels: months.map(function (x) { return x.slice(5); }), series: [
          { name: '营收', color: MW.CHART_COLORS.red, values: seriesOf('revenue') },
          { name: '成本', color: MW.CHART_COLORS.green, values: seriesOf('cost') },
          { name: '毛利', color: MW.CHART_COLORS.primary, values: seriesOf('gross') }
        ] }) + '</div>' +
        '<div class="card"><div class="card-head"><div class="card-title">' + scopeLabel + '支出结构</div>' +
        '<div class="card-sub">工具、投放、分成这些运营开销</div></div>' +
        (donutData.length
          ? '<div class="donut-wrap">' + MW.charts.donut(donutData, { center: MW.fmt.money(m.expense), centerLabel: scopeLabel + '支出' }) +
            '<div class="donut-legend">' + donutData.map(function (d) {
              return '<div class="dl-item"><i style="background:' + d.color + '"></i><span>' + MW.esc(d.label) + '</span><b>' + MW.fmt.money(d.value) + '</b></div>';
            }).join('') + '</div></div>'
          : MW.ui.empty(scopeLabel + '暂无支出记录', '工具订阅、投放、团队分成等记录于此')) +
        '</div></div>';

      /* 明细：两个页签 */
      const orderRows = sortOrders(scopeAll ? allOrders : monthRows.filter(isOrder));
      const expRows = (scopeAll ? db.finance.filter(function (f) { return !isOrder(f); }) : monthRows.filter(function (f) { return !isOrder(f); }))
        .slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
      const monthOrders = monthRows.filter(isOrder).length;
      const monthExps = monthRows.length - monthOrders;

      html += '<div class="card table-card"><div class="card-head">' +
        '<div class="seg small">' +
          '<button class="seg-btn' + (finTab === 'order' ? ' active' : '') + '" onclick="MW.act.setFinTab(\'order\')">订单收入 <span class="seg-n">' + monthOrders + '</span></button>' +
          '<button class="seg-btn' + (finTab === 'expense' ? ' active' : '') + '" onclick="MW.act.setFinTab(\'expense\')">支出流水 <span class="seg-n">' + monthExps + '</span></button>' +
        '</div>' +
        '<div class="card-extra">' +
          (finTab === 'order'
            ? MW.ui.select('fin-sort', [{ v: 'date', t: '按日期' }, { v: 'profit', t: '按利润' }, { v: 'amount', t: '按金额' }], finSort)
            : '') +
          MW.ui.select('fin-month', months.concat(['all']).map(function (x) {
            return { v: x, t: x === 'all' ? '全部' : MW.monthLabel(x) };
          }), finMonth) +
        '</div></div>';

      if (finTab === 'order') {
        if (!orderRows.length) {
          html += MW.ui.empty(scopeAll ? '暂无订单' : MW.monthLabel(finMonth) + ' 暂无订单',
            '点「记一笔」记订单，或「从 Excel 导入」把已有的账搬进来');
        } else {
          html += '<table class="table fin-table"><thead><tr>' +
            '<th>日期</th><th>客户 / 联系人</th><th>项目 / 相关信息</th><th>订购号</th>' +
            '<th class="ta-r">金额</th><th class="ta-r">成本</th><th class="ta-r">利润</th>' +
            '<th>来源渠道</th><th>备注</th><th></th></tr></thead><tbody>';
          orderRows.forEach(function (f) {
            const profit = MW.orderProfit(f);
            const cost = MW.orderCost(f);
            html += '<tr>' +
              '<td class="fin-date">' + f.date + '</td>' +
              '<td><div class="cell-main">' + MW.esc(f.customer || '—') + '</div>' +
                (f.channel ? '<div class="cell-sub">' + MW.icon('wallet', 10) + ' ' + MW.esc(f.channel) + '</div>' : '') + '</td>' +
              '<td><div class="cell-main">' + MW.esc(f.category || '—') + '</div>' +
                (f.detail ? '<div class="cell-sub">' + MW.esc(f.detail) + '</div>' : '') + '</td>' +
              '<td class="fin-orderno">' + MW.esc(f.orderNo || '—') + '</td>' +
              '<td class="ta-r fin-amount">' + MW.fmt.money(f.amount) + '</td>' +
              '<td class="ta-r fin-cost">' + (cost ? '−' + MW.fmt.money(cost) : '—') + '</td>' +
              '<td class="ta-r fin-profit' + (profit < 0 ? ' loss' : '') + '">' + MW.fmt.money(profit) + '</td>' +
              '<td>' + (f.source ? '<span class="fin-src">' + MW.esc(f.source) + '</span>' : '—') + '</td>' +
              '<td class="fin-note" title="' + MW.esc(f.note || '') + '">' + MW.esc(f.note || '—') + '</td>' +
              '<td class="td-actions">' +
                '<button class="btn sm" onclick="MW.act.openFinanceModal(\'' + f.id + '\')">' + MW.icon('edit', 12) + '</button>' +
                '<button class="btn sm danger-ghost" onclick="MW.act.delFinance(\'' + f.id + '\')">' + MW.icon('trash', 12) + '</button>' +
              '</td></tr>';
          });
          html += '</tbody></table>';
        }
      } else {
        if (!expRows.length) {
          html += MW.ui.empty(scopeAll ? '暂无支出记录' : MW.monthLabel(finMonth) + ' 暂无支出',
            '工具订阅、API 算力、投放、团队分成记在这里');
        } else {
          html += '<table class="table fin-table"><thead><tr>' +
            '<th>日期</th><th>类目</th><th>负责人</th><th>关联账号</th><th>备注</th>' +
            '<th class="ta-r">金额</th><th></th></tr></thead><tbody>';
          expRows.forEach(function (f) {
            const acc = db.accounts.find(function (a) { return a.id === f.accountId; });
            html += '<tr>' +
              '<td class="fin-date">' + f.date + '</td>' +
              '<td>' + MW.ui.tag(f.category || '其他支出', '#18a058') + '</td>' +
              '<td>' + MW.ui.ownerChip(f.owner) + '</td>' +
              '<td>' + (acc ? MW.esc(acc.name) : '--') + '</td>' +
              '<td class="fin-note" title="' + MW.esc(f.note || '') + '">' + MW.esc(f.note || '—') + '</td>' +
              '<td class="ta-r fin-cost"><b>−' + MW.fmt.money(f.amount) + '</b></td>' +
              '<td class="td-actions">' +
                '<button class="btn sm" onclick="MW.act.openFinanceModal(\'' + f.id + '\')">' + MW.icon('edit', 12) + '</button>' +
                '<button class="btn sm danger-ghost" onclick="MW.act.delFinance(\'' + f.id + '\')">' + MW.icon('trash', 12) + '</button>' +
              '</td></tr>';
          });
          html += '</tbody></table>';
        }
      }
      html += '</div>';

      /* 排行：订单页看「谁最赚钱」，支出页看「钱花在哪」 */
      const rankCard = function (title, tip, iconName, list, green) {
        if (!list.length) return '';
        const max = Math.max.apply(null, list.map(function (x) { return Math.abs(x.value); })) || 1;
        return '<div class="card"><div class="card-head"><div class="card-title">' + MW.icon(iconName, 15) + ' ' + title + '</div>' +
          '<div class="card-sub">' + tip + '</div></div><div class="roi-list">' +
          list.map(function (x, i) {
            return '<div class="roi-row"><span class="roi-rank r' + (i + 1) + '">' + (i + 1) + '</span>' +
              '<span class="roi-name">' + MW.esc(x.name) + '</span>' +
              '<span class="roi-bar' + (green ? ' green' : '') + '"><i style="width:' + (Math.abs(x.value) / max * 100) + '%"></i></span>' +
              '<span class="roi-sub">' + x.n + ' 单</span>' +
              '<b class="' + (green ? 'down' : 'up') + '">' + MW.fmt.money(x.value) + '</b></div>';
          }).join('') + '</div></div>';
      };
      const groupBy = function (rows, keyFn, valFn) {
        const map = {};
        rows.forEach(function (f) {
          const k = keyFn(f);
          if (!k) return;
          if (!map[k]) map[k] = { name: k, n: 0, value: 0 };
          map[k].n++;
          map[k].value += valFn(f);
        });
        return Object.keys(map).map(function (k) { return map[k]; })
          .sort(function (a, b) { return b.value - a.value; });
      };

      if (finTab === 'order' && allOrders.length) {
        html += '<div class="chart-grid">' +
          rankCard('按来源渠道，谁带来的钱最多', '客户从哪来，就知道该往哪使劲', 'target',
            groupBy(allOrders, function (f) { return f.source; }, function (f) { return MW.orderProfit(f); }), false) +
          rankCard('按项目，哪门生意最赚钱', '卖什么最赚，一目了然', 'layers',
            groupBy(allOrders, function (f) { return f.category; }, function (f) { return MW.orderProfit(f); }), false) +
          '</div>';
      } else if (finTab === 'expense') {
        const expAll = db.finance.filter(function (f) { return !isOrder(f); });
        html += '<div class="chart-grid">' +
          rankCard('支出花在哪了', '累计口径，不分月份', 'wallet',
            groupBy(expAll, function (f) { return f.category; }, function (f) { return +f.amount || 0; }), true) +
          rankCard('按账号的支出口径', '算投产比时看这个', 'users',
            groupBy(expAll, function (f) {
              const a = db.accounts.find(function (x) { return x.id === f.accountId; });
              return a ? a.name : '';
            }, function (f) { return +f.amount || 0; }), true) +
          '</div>';
      }

      root.innerHTML = html;

      const monthEl = document.getElementById('fin-month');
      if (monthEl) monthEl.onchange = function () { finMonth = this.value; MW.render(); };
      const sortEl = document.getElementById('fin-sort');
      if (sortEl) sortEl.onchange = function () { finSort = this.value; MW.render(); };
    }
  };
})();
