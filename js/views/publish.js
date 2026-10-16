/* ============================================================
   视图 · 发布管理
   ------------------------------------------------------------
   位置：动线里「定哪天发（日历）」之后、「看效果（复盘）」之前。
   日历回答「哪天发」，这一页回答「今天能不能发、还差什么、发完没」。

   数据不另起炉灶：就长在 contents 上（checks / url / publishedAt）。
   这样日历排的期、这里执行的检查、复盘看的数据是同一批记录——
   否则又会多出一个和主流程脱节的孤岛。

   往上游联动：日历 / 看板 / AI 文案台 / 素材库
   往下游联动：标记发布 → 看板阶段推进；补录数据 → 复盘
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  let scope = 'today';        /* today | week | all */
  let onlyUnready = false;    /* 只看还没准备就绪的 */

  const inView = function (c) {
    const cur = MW.curAcc();
    return cur === 'all' || !c.accountId || c.accountId === cur;
  };

  /* 平台色 + 平台名，走统一口径，别各页自己拼 */
  function pfOf(c) {
    const a = MW.accOf(c.accountId);
    const key = c.platform || (a && a.platform) || 'other';
    const p = MW.PLATFORMS[key] || MW.PLATFORMS.other;
    return { key: key, name: p.name, color: p.color };
  }

  /* ---------------- 发布检查清单 ---------------- */

  function checksHtml(c) {
    const ck = MW.checksOf(c);
    const boundN = MW.assetIdsOf(c).length;
    return '<div class="pub-checks">' + MW.PUB_CHECKS.map(function (x) {
      const on = !!ck.map[x.key];
      /* 「封面素材」上挂已绑定数量：这一项从此不止是手勾，是真的绑了素材 */
      const badge = (x.key === 'asset' && boundN) ? '<b class="pub-check-n">' + boundN + '</b>' : '';
      return '<button class="pub-check' + (on ? ' on' : '') + '" title="' + MW.esc(x.hint) + '" ' +
        'onclick="event.stopPropagation();MW.act.pubToggleCheck(\'' + c.id + '\',\'' + x.key + '\')">' +
        MW.icon(on ? 'check' : 'dot', 12) + '<span>' + x.name + '</span>' + badge + '</button>';
    }).join('') + '</div>';
  }

  /* ---------------- 素材绑定（内容 ↔ 素材） ----------------
     弹窗里勾选素材，保存进 c.assetIds。文件夹文件（settings.assets.list）
     和登记条目（db.assets）合成一个列表；首次绑定自动勾上「封面素材」
     检查项——绑了素材却还显示「素材没备」，就白绑了。 */

  MW.act.pubSaveAssets = function (id, keys) {
    const db = MW.getDB();
    const c = db.contents.find(function (x) { return x.id === id; });
    if (!c) return;
    c.assetIds = (keys || []).filter(function (k) { return !!MW.assetByKey(k); });
    if (c.assetIds.length) {
      c.checks = c.checks || {};
      if (!c.checks.asset) c.checks.asset = true;
    }
    MW.save();
  };

  MW.act.pubBindAssets = function (id) {
    const db = MW.getDB();
    const c = db.contents.find(function (x) { return x.id === id; });
    if (!c) return;
    const cur = MW.assetIdsOf(c);

    /* 素材来源：文件夹索引 + 登记/笔记条目，按名称排序，封顶 300 条 */
    const s = (db.settings && db.settings.assets) || {};
    const folder = (s.list || []).map(function (f) {
      return {
        key: f.rel,
        name: f.name || f.rel,
        sub: f.rel.indexOf('/') >= 0 ? f.rel : (f.kind || ''),
        group: '文件夹'
      };
    });
    const notes = (db.assets || []).map(function (a) {
      return { key: a.id, name: a.name, sub: a.type || '素材笔记', group: '登记' };
    });
    const all = folder.concat(notes).sort(function (a, b) { return a.name.localeCompare(b.name, 'zh'); }).slice(0, 300);

    function listHtml(kw) {
      const k = (kw || '').trim().toLowerCase();
      const hit = all.filter(function (o) {
        return !k || (o.name + ' ' + o.sub).toLowerCase().indexOf(k) >= 0;
      });
      if (!hit.length) return MW.ui.empty('未找到匹配的素材', '换个关键词，或先去素材库连接文件夹');
      return hit.map(function (o) {
        const on = cur.indexOf(o.key) >= 0;
        return '<label class="bind-item' + (on ? ' on' : '') + '" data-key="' + MW.esc(o.key) + '">' +
          '<input type="checkbox" value="' + MW.esc(o.key) + '"' + (on ? ' checked' : '') + '>' +
          '<span class="bind-item-name">' + MW.esc(o.name) + '</span>' +
          '<span class="bind-item-sub">' + MW.esc(o.sub) + '</span></label>';
      }).join('');
    }

    MW.modal({
      title: '绑定素材',
      sub: c.title,
      body: '<div class="bind-search"><input id="bind-q" placeholder="搜索素材名称或路径……"></div>' +
        '<div class="bind-list" id="bind-list">' + listHtml('') + '</div>' +
        '<div class="bind-foot">已选 <b id="bind-n">' + cur.length + '</b> 个 · 首次绑定会自动勾选「封面素材」检查项</div>',
      okText: '保存绑定',
      onOk: function (root) {
        const keys = Array.prototype.map.call(
          root.querySelectorAll('#bind-list input[type="checkbox"]:checked'),
          function (i) { return i.value; }
        );
        MW.act.pubSaveAssets(id, keys);
        MW.render();
        MW.toast(keys.length ? '已绑定 ' + keys.length + ' 个素材' : '已清空绑定');
      }
    });

    /* 搜索 + 选中计数：弹窗内自己闭环，不整页重渲染 */
    const q = document.getElementById('bind-q');
    const list = document.getElementById('bind-list');
    const n = document.getElementById('bind-n');
    if (q && list) {
      q.oninput = function () { list.innerHTML = listHtml(q.value); };
      list.addEventListener('change', function () {
        const keys = Array.prototype.map.call(
          list.querySelectorAll('input[type="checkbox"]:checked'),
          function (i) { return i.value; }
        );
        if (n) n.textContent = keys.length;
        list.querySelectorAll('.bind-item').forEach(function (el) {
          const cb = el.querySelector('input');
          el.classList.toggle('on', !!(cb && cb.checked));
        });
      });
      setTimeout(function () { q.focus(); }, 60);
    }
  };

  MW.act.pubToggleCheck = function (id, key) {
    const db = MW.getDB();
    const c = db.contents.find(function (x) { return x.id === id; });
    if (!c) return;
    c.checks = c.checks || {};
    c.checks[key] = !c.checks[key];
    MW.save();
    MW.render();
    const ck = MW.checksOf(c);
    if (ck.ready) MW.toast('四项都齐了，可以发了');
  };

  /* 一键把四项全勾上：真要发的时候一项项点太烦 */
  MW.act.pubAllChecks = function (id) {
    const db = MW.getDB();
    const c = db.contents.find(function (x) { return x.id === id; });
    if (!c) return;
    c.checks = {};
    MW.PUB_CHECKS.forEach(function (x) { c.checks[x.key] = true; });
    MW.save(); MW.render();
    MW.toast('已标记就绪');
  };

  /* ---------------- 标记发布（联动看板阶段） ---------------- */

  MW.act.pubMark = function (id) {
    const db = MW.getDB();
    const c = db.contents.find(function (x) { return x.id === id; });
    if (!c) return;
    const ck = MW.checksOf(c);
    if (!ck.ready) {
      MW.confirm('还有 ' + (ck.total - ck.done) + ' 项没准备好（' +
        ck.all.filter(function (x) { return !ck.map[x.key]; }).map(function (x) { return x.name; }).join('、') +
        '）。确认现在发布吗？',
        function () { doMark(c); },
        { title: '发布前检查未全部完成', okText: '仍然发布' });
      return;
    }
    doMark(c);
  };

  function doMark(c) {
    const db = MW.getDB();
    c.status = 'published';
    const now = new Date();
    c.publishedAt = MW.dateStr() + ' ' + ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
    /* 联动看板：这条内容背后的选题一并推进到「已发布」 */
    if (c.topicId) {
      const tp = db.topics.find(function (x) { return x.id === c.topicId; });
      if (tp) tp.stage = 'published';
    }
    MW.save(); MW.render();
    MW.toast('已发布 · 明天记得回来补数据');
  }

  /* 撤销误标：发布是高频误操作，必须能一键退回去 */
  MW.act.pubUndo = function (id) {
    const db = MW.getDB();
    const c = db.contents.find(function (x) { return x.id === id; });
    if (!c) return;
    c.status = 'scheduled';
    c.publishedAt = '';
    if (c.topicId) {
      const tp = db.topics.find(function (x) { return x.id === c.topicId; });
      /* 只有还在「已发布」的才退回，别把已经复盘过的拽回去 */
      if (tp && tp.stage === 'published') tp.stage = 'scheduled';
    }
    MW.save(); MW.render();
    MW.toast('已退回待发布');
  };

  /* ---------------- 发布链接 ---------------- */

  MW.act.pubLink = function (id) {
    const db = MW.getDB();
    const c = db.contents.find(function (x) { return x.id === id; });
    if (!c) return;
    MW.modal({
      title: '发布链接',
      sub: c.title,
      body: MW.ui.row('链接', '<input id="pl-url" placeholder="https://…" value="' + MW.esc(c.url || '') + '">',
        '存下来以后找旧内容方便，复盘时也能直接点进去看') +
        MW.ui.row('发布备注', '<input id="pl-note" placeholder="比如：这条换了 B 版封面" value="' + MW.esc(c.pubNote || '') + '">'),
      okText: '保存',
      onOk: function (root) {
        c.url = (root.querySelector('#pl-url').value || '').trim();
        c.pubNote = (root.querySelector('#pl-note').value || '').trim();
        MW.save(); MW.render();
        MW.toast('已保存');
      }
    });
  };

  /* ---------------- 渲染 ---------------- */

  MW.views['publish'] = {
    id: 'publish', name: '发布管理', icon: 'upload',
    sub: '今天能不能发、还差什么、发完没',
    render: function (root) {
      const t = MW.dateStr();
      const b = MW.pubBuckets(MW.curAcc());
      const todayAll = MW.pubBuckets('all').today;
      const readyN = b.today.filter(function (c) { return MW.checksOf(c).ready; }).length;
      const doneN = b.today.filter(function (c) { return c.status === 'published'; }).length;

      let html = '<div class="page-head"><div class="page-title">发布管理</div>' +
        '<div class="page-sub">' + headLine(b, todayAll, readyN, doneN) + '</div></div>';

      /* ① 今日发布台 */
      html += '<div class="card pub-today">' +
        '<div class="pub-today-head">' +
          '<div class="pub-today-title">' + MW.icon('upload', 15) + ' 今天要发</div>' +
          /* 「已发 0 / 2」比「2 / 2 条待发」直观：分子分母都是同一件事，
             而且进度感是往前涨的 */
          '<div class="pub-today-num">已发 <b>' + doneN + '</b> / ' + b.today.length + '</div>' +
        '</div>' +
        (b.today.length
          ? '<div class="pub-list">' + b.today.map(function (c) { return rowHtml(c, t, true); }).join('') + '</div>'
          : MW.ui.empty('今日无排期', '可前往内容日历排期，或从选题库补充')) +
        '</div>';

      /* ② 逾期：排期日过了还没发 */
      if (b.overdue.length) {
        html += '<div class="card pub-sec">' +
          '<div class="card-head"><div class="card-title">' + MW.icon('clock', 15) + ' 逾期未发</div>' +
          '<div class="card-sub">已经拖了，要么补发要么挪到今天</div></div>' +
          '<div class="pub-list">' + b.overdue.map(function (c) { return rowHtml(c, t, false); }).join('') + '</div>' +
          '</div>';
      }

      /* ③ 待回填数据 */
      if (b.needMetrics.length) {
        html += '<div class="card pub-sec">' +
          '<div class="card-head"><div class="card-title">' + MW.icon('chart', 15) + ' 待补数据</div>' +
          '<div class="card-sub">发布超过一天未回填数据，间隔越久数据越难补准</div></div>' +
          '<div class="pub-list">' + b.needMetrics.map(function (c) { return rowHtml(c, t, false); }).join('') + '</div>' +
          '</div>';
      }

      /* ④ 未来 7 天队列 */
      html += '<div class="card pub-sec">' +
        '<div class="card-head"><div class="card-title">' + MW.icon('calendar', 15) + ' 未来 7 天</div>' +
        '<div class="card-sub">提前把检查项勾上，别临到当天才赶</div></div>';
      if (!b.upcoming.length) {
        html += MW.ui.empty('未来 7 天暂无排期', '可在内容日历使用「一键智能排期」铺排库存选题');
      } else {
        html += b.upcoming.map(function (g) {
          return '<div class="pub-day">' +
            '<div class="pub-day-head"><b>' + g.date.slice(5) + '</b>' +
            '<span>' + MW.weekdayCN(g.date) + ' · ' + g.list.length + ' 条</span></div>' +
            '<div class="pub-list">' + g.list.map(function (c) { return rowHtml(c, t, false); }).join('') + '</div>' +
            '</div>';
        }).join('');
      }
      html += '</div>';

      /* ⑤ 发布节奏：各账号本周进度 */
      html += renderCadence();

      root.innerHTML = html;
    }
  };

  /* 副标题不报流水账，直接给「下一步该干什么」。
     「0 条就绪」这种数字用户看了不知道做什么，改成指出最接近的那条差几项。 */
  function headLine(b, todayAll, readyN, doneN) {
    const n = b.today.length;
    if (!n) {
      return b.overdue.length
        ? '今日无排期 · 有 ' + b.overdue.length + ' 条已逾期未发布，需优先处理'
        : '今日无排期 · 可前往内容日历补充';
    }
    if (doneN >= n) {
      return '今天 ' + n + ' 条都发完了' +
        (b.needMetrics.length ? ' · 还有 ' + b.needMetrics.length + ' 条数据没补' : ' · 数据也齐了');
    }
    const pending = b.today.filter(function (c) { return c.status !== 'published'; });
    if (readyN === pending.length) return '今天 ' + n + ' 条，' + pending.length + ' 条都就绪了，可以发';
    /* 找差最少的那条，告诉他还差几项 */
    let best = null, bestGap = 99;
    pending.forEach(function (c) {
      const ck = MW.checksOf(c);
      const gap = ck.total - ck.done;
      if (gap < bestGap) { bestGap = gap; best = ck; }
    });
    if (best) {
      const miss = best.all.filter(function (x) { return !best.map[x.key]; }).map(function (x) { return x.name; });
      return '今天 ' + n + ' 条 · ' + doneN + ' 条已发 · 最接近的一条还差：' + miss.join('、');
    }
    return '今天 ' + n + ' 条 · ' + doneN + ' 条已发';
  }

  /* 单行：时间 / 平台 / 标题 / 检查清单 / 状态 / 操作 */
  function rowHtml(c, today, isToday) {
    const pf = pfOf(c);
    const ck = MW.checksOf(c);
    const published = c.status === 'published';
    const late = !published && c.date < today;
    const needData = published && (!c.metrics || +c.metrics.views === 0);
    const acc = MW.accOf(c.accountId);
    const assetN = MW.assetCountFor(c.accountId);
    const boundN = MW.assetIdsOf(c).length;

    return '<div class="pub-row' + (published ? ' done' : '') + (late ? ' late' : '') + '">' +
      '<div class="pub-time">' + MW.esc(c.time || '—') + '</div>' +
      '<div class="pub-main">' +
        '<div class="pub-title">' +
          '<span class="pf-chip sm" style="--pc:' + pf.color + '">' + pf.name + '</span>' +
          '<b>' + MW.esc(c.title) + '</b>' +
          (late ? '<span class="pub-late">逾期 ' + MW.daysBetween(c.date, today) + ' 天</span>' : '') +
        '</div>' +
        '<div class="pub-meta">' +
          '<span>' + MW.icon('users', 11) + ' ' + MW.esc(acc ? acc.name : '未指定') + '</span>' +
          '<span>' + c.date.slice(5) + '</span>' +
          /* 素材检查项的智能提示：这个号在素材库里有多少可用的，
             拿不到就说「去素材库」，不谎报 0 */
          (assetN > 0 ? '<span>' + MW.icon('folder', 11) + ' 素材库 ' + assetN + ' 个可用</span>' : '') +
          /* 本条内容实际绑定的素材数：从「号里有素材」精确到「这条用了什么」 */
          (boundN ? '<span class="pub-bound">' + MW.icon('check', 11) + ' 已绑 ' + boundN + ' 个素材</span>' : '') +
          (c.url ? '<span>' + MW.icon('link', 11) + ' 有链接</span>' : '') +
        '</div>' +
        /* 检查清单只在还没发时有意义。已发布的行再摆四个未勾的框，
           只会让人以为自己漏了事——收起来，换成发布时间。 */
        (published
          ? '<div class="pub-meta pub-check-line">' +
              '<span class="pub-ok">' + MW.icon('check', 11) + ' 已发布' +
              (c.publishedAt ? ' · ' + MW.esc(c.publishedAt.slice(11) || c.publishedAt.slice(5)) : '') + '</span>' +
              (boundN ? '<span>' + MW.icon('folder', 11) + ' 素材 ' + boundN + ' 个</span>' : '') +
              (c.pubNote ? '<span>' + MW.esc(c.pubNote) + '</span>' : '') +
            '</div>'
          : '<div class="pub-meta pub-check-line">' +
              '<span class="pub-ready' + (ck.ready ? ' ok' : '') + '">' +
                MW.icon(ck.ready ? 'check' : 'dot', 11) + ' ' + ck.done + '/' + ck.total + ' 就绪</span>' +
              checksHtml(c) +
            '</div>') +
        /* 平台专属提醒：只在还没发布时给，发完就没用了 */
        (!published ? '<div class="pub-tip">' + MW.icon('bulb', 11) + ' ' +
          MW.esc(MW.PLATFORM_TIPS[pf.key] || MW.PLATFORM_TIPS.other) + '</div>' : '') +
      '</div>' +
      '<div class="pub-ops">' +
        (published
          ? (needData
              ? '<button class="btn sm primary" onclick="MW.act.quickMetrics(\'' + c.id + '\')">' + MW.icon('chart', 12) + ' 补数据</button>'
              : '<span class="pub-ok">' + MW.icon('check', 12) + ' 已发布</span>') +
            '<button class="btn sm" onclick="MW.act.pubLink(\'' + c.id + '\')">' + MW.icon('link', 12) + ' 链接</button>' +
            '<button class="btn sm ghost" onclick="MW.act.pubUndo(\'' + c.id + '\')">撤销</button>'
          : '<button class="btn sm' + (ck.ready ? ' primary' : '') + '" onclick="MW.act.pubMark(\'' + c.id + '\')">' +
              MW.icon('upload', 12) + ' 发了</button>' +
            (ck.ready ? '' : '<button class="btn sm ghost" onclick="MW.act.pubAllChecks(\'' + c.id + '\')">全勾</button>') +
            '<button class="btn sm ghost" onclick="MW.act.pubBindAssets(\'' + c.id + '\')">' +
              MW.icon('folder', 12) + (boundN ? '素材 ' + boundN : '绑素材') + '</button>' +
            '<button class="btn sm ghost" onclick="MW.act.pubToAi(\'' + c.id + '\')">' + MW.icon('sparkles', 12) + ' 写文案</button>' +
            '<button class="btn sm ghost" onclick="MW.goto(\'#/assets\')">' + MW.icon('folder', 12) + ' 找素材</button>') +
      '</div>' +
    '</div>';
  }

  /* 从发布管理直接跳 AI 文案台，并带上这条的标题和账号——
     省得用户自己再选一遍 */
  MW.act.pubToAi = function (id) {
    const db = MW.getDB();
    const c = db.contents.find(function (x) { return x.id === id; });
    if (!c) return;
    MW.goto('#/ai');
    setTimeout(function () {
      const el = document.getElementById('ai-topic');
      const acc = document.getElementById('ai-account');
      if (el) { el.value = c.title; el.dispatchEvent(new Event('input', { bubbles: true })); }
      if (acc && c.accountId) acc.value = c.accountId;
      if (el) el.focus();
    }, 260);
  };

  /* ---------------- 发布节奏 ---------------- */

  function renderCadence() {
    const db = MW.getDB();
    const cur = MW.curAcc();
    const accs = db.accounts.filter(function (a) {
      return a.status === 'active' && (cur === 'all' || a.id === cur);
    });
    if (!accs.length) return '';
    return '<div class="card pub-sec">' +
      '<div class="card-head"><div class="card-title">' + MW.icon('trend', 15) + ' 本周发布节奏</div>' +
      '<div class="card-sub">按账号的更新频率看，谁掉队了</div></div>' +
      '<div class="cad-list">' + accs.map(function (a) {
        const cd = MW.cadenceOf(a);
        const pf = MW.PLATFORMS[a.platform] || MW.PLATFORMS.other;
        const short = cd.done < cd.goal;
        return '<div class="cad-row">' +
          '<span class="pf-chip sm" style="--pc:' + pf.color + '">' + pf.name + '</span>' +
          '<div class="cad-name">' + MW.esc(a.name) + '</div>' +
          '<div class="cad-bar">' + MW.ui.progress(cd.pct, pf.color) + '</div>' +
          '<div class="cad-num' + (short ? ' short' : '') + '"><b>' + cd.done + '</b> / ' + cd.goal + '</div>' +
          '<div class="cad-planed">' + (cd.planned ? '已排 ' + cd.planned + ' 条' : '没排期') + '</div>' +
        '</div>';
      }).join('') + '</div></div>';
  }
})();
