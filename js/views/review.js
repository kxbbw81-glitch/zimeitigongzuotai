/* ============================================================
   视图 · 数据复盘（记录数据 → 对比目标 → 沉淀经验）
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  MW.act.openRetroModal = function (id) {
    const db = MW.getDB();
    const c = db.contents.find(function (x) { return x.id === id; });
    if (!c) return;
    const m = c.metrics || { views: 0, likes: 0, comments: 0, collects: 0, shares: 0, newFollowers: 0 };
    const eng = m.views ? ((m.likes + m.comments + m.collects + m.shares) / m.views * 100).toFixed(1) : '0.0';
    const body =
      '<div class="retro-metrics">' +
      [['浏览', m.views], ['点赞', m.likes], ['评论', m.comments], ['收藏', m.collects], ['涨粉', m.newFollowers]].map(function (x) {
        return '<div class="rm-item"><b>' + MW.fmt.int(x[1]) + '</b><span>' + x[0] + '</span></div>';
      }).join('') +
      '<div class="rm-item"><b>' + eng + '%</b><span>互动率</span></div>' +
      '</div>' +
      MW.ui.row('复盘笔记', '<textarea id="rt-note" rows="5" placeholder="这篇为什么好/不好？选题、封面、标题、发布时间，哪个变量在起作用？下次怎么复制？">' + MW.esc(c.note || '') + '</textarea>', '复盘笔记会自动汇总进每周报告');

    MW.modal({
      title: '数据复盘',
      sub: c.title,
      body: body,
      okText: '保存笔记',
      onOk: function (root) {
        c.note = (root.querySelector('#rt-note').value || '').trim();
        MW.save(); MW.render();
        MW.toast('复盘笔记已保存');
      }
    });
  };

  MW.act.genWeeklyReport = function () {
    const db = MW.getDB();
    const t = MW.dateStr();
    const start = MW.addDays(t, -6);
    const pubs = db.contents.filter(function (c) {
      return c.status === 'published' && c.date >= start && c.date <= t;
    });
    const sum = function (k) {
      return pubs.reduce(function (s, c) { return s + ((c.metrics && +c.metrics[k]) || 0); }, 0);
    };
    const views = sum('views'), likes = sum('likes'), comments = sum('comments');
    const collects = sum('collects'), nf = sum('newFollowers');
    const best = pubs.slice().sort(function (a, b) {
      return ((b.metrics && +b.metrics.views) || 0) - ((a.metrics && +a.metrics.views) || 0);
    })[0];

    /* 打卡完成率 */
    let fullDays = 0;
    for (let i = 0; i < 7; i++) {
      const ds = MW.addDays(start, i);
      /* 只统计「现在还存在」的仪式，删过的仪式不该让这天算全勤 */
      const done = (db.ritualLog[ds] || []).filter(function (id) {
        return db.rituals.some(function (r) { return r.id === id; });
      });
      if (db.rituals.length && done.length >= db.rituals.length) fullDays++;
    }

    /* 下周临近截止选题 */
    const soon = db.topics.filter(function (x) {
      return x.due && x.due >= t && x.stage !== 'published' && x.stage !== 'retro';
    }).sort(function (a, b) { return a.due.localeCompare(b.due); }).slice(0, 5);

    /* 复盘笔记 */
    const notes = pubs.filter(function (c) { return c.note && c.note.trim(); });

    let txt = '【自媒体周报】' + start + ' ~ ' + t + '\n\n';
    txt += '一、内容产出\n本周发布 ' + pubs.length + ' 篇';
    if (pubs.length) {
      const accNames = {};
      pubs.forEach(function (c) {
        const a = db.accounts.find(function (x) { return x.id === c.accountId; });
        if (a) accNames[a.name] = (accNames[a.name] || 0) + 1;
      });
      txt += '，涉及 ' + Object.keys(accNames).length + ' 个账号：' +
        Object.keys(accNames).map(function (k) { return k + ' ' + accNames[k] + ' 篇'; }).join('、');
    }
    txt += '。\n\n';
    txt += '二、核心数据\n总浏览 ' + MW.fmt.int(views) + '，总点赞 ' + MW.fmt.int(likes) + '，总评论 ' + MW.fmt.int(comments) +
      '，总收藏 ' + MW.fmt.int(collects) + '，合计涨粉 ' + MW.fmt.int(nf) + '。\n';
    if (best) txt += '单篇最高浏览：《' + best.title + '》（' + MW.fmt.int((best.metrics && best.metrics.views) || 0) + '）\n';
    txt += '\n三、目标进度\n';
    db.accounts.forEach(function (a) {
      if (!a.goalFollowers) return;
      txt += a.name + '：' + MW.fmt.int(a.followers) + ' / ' + MW.fmt.int(a.goalFollowers) + ' 粉（' +
        Math.round(a.followers / a.goalFollowers * 100) + '%）\n';
    });
    txt += '\n四、每日仪式\n全勤 ' + fullDays + ' / 7 天。\n';
    txt += '\n五、经验沉淀\n';
    if (notes.length) {
      notes.forEach(function (c) { txt += '· ' + c.title + '：' + c.note + '\n'; });
    } else {
      txt += '（本周暂无复盘笔记，建议为每篇爆款与哑弹各记录一条）\n';
    }
    txt += '\n六、下周重点\n';
    if (soon.length) {
      soon.forEach(function (x) { txt += '· ' + x.due + ' 《' + x.title + '》（' + x.owner + '）\n'; });
    } else {
      txt += '· 暂无临近截止选题，注意补充弹药\n';
    }

    /* AI 诊断：把数据翻译成动作 */
    txt += '\n七、AI 诊断与建议\n';
    const withData = pubs.filter(function (c) { return c.metrics && +c.metrics.views > 0; });
    if (withData.length && MW.ai && MW.ai.retro) {
      withData.slice(0, 6).forEach(function (c) {
        const r = MW.ai.retro(c);
        txt += '· 《' + c.title + '》：' + r.verdict;
        if (r.next.length) txt += ' → ' + r.next[0];
        txt += '\n';
      });
    } else {
      txt += '（本周暂无可诊断数据，发布后请回填）\n';
    }

    MW.modal({
      title: '每周报告（' + start + ' ~ ' + t + '）',
      sub: '基于本周数据自动生成，可复制后人工润色',
      body: '<div class="report-box">' + MW.esc(txt).replace(/\n/g, '<br>') + '</div>',
      okText: '复制全文',
      onOk: function () { MW.copy(txt); }
    });
  };

  MW.views['review'] = {
    id: 'review', name: '数据复盘', icon: 'chart',
    sub: '记录数据 → 对比目标 → 沉淀经验，复盘闭环',
    render: function (root) {
      const db = MW.getDB();
      const t = MW.dateStr();
      const cur = MW.curAcc();
      const inView = function (c) { return cur === 'all' || c.accountId === cur; };
      const accList = cur === 'all' ? db.accounts : db.accounts.filter(function (a) { return a.id === cur; });
      const pubs = db.contents.filter(function (c) { return c.status === 'published' && inView(c); })
        .sort(function (a, b) { return b.date.localeCompare(a.date); });

      /* 爆款基准：同账号平均浏览的 1.8 倍算爆 */
      const avgViews = {};
      db.accounts.forEach(function (a) {
        const cs = db.contents.filter(function (c) {
          return c.accountId === a.id && c.status === 'published' && c.metrics && +c.metrics.views > 0;
        });
        avgViews[a.id] = cs.length ? cs.reduce(function (s, c) { return s + (+c.metrics.views || 0); }, 0) / cs.length : 0;
      });

      /* 粉丝增长曲线：把各账号快照按日期对齐求和 */
      const dateSet = {};
      accList.forEach(function (a) { (a.snapshots || []).forEach(function (s) { dateSet[s.date] = 1; }); });
      const snapDates = Object.keys(dateSet).sort();
      const snapVals = snapDates.map(function (d) {
        return accList.reduce(function (sum, a) {
          const sn = (a.snapshots || []).filter(function (s) { return s.date <= d; })
            .sort(function (x, y) { return x.date.localeCompare(y.date); });
          return sum + (sn.length ? +sn[sn.length - 1].followers : 0);
        }, 0);
      });

      /* 近 30 天序列 */
      const days = [], pubCount = [], viewTrend = [];
      for (let i = 29; i >= 0; i--) {
        const ds = MW.addDays(t, -i);
        days.push(ds.slice(5));
        const dayPubs = db.contents.filter(function (c) { return c.status === 'published' && c.date === ds && inView(c); });
        pubCount.push(dayPubs.length);
        viewTrend.push(dayPubs.reduce(function (s, c) { return s + ((c.metrics && +c.metrics.views) || 0); }, 0));
      }

      let html = '<div class="page-head"><div class="page-title">数据复盘</div>' +
        '<div class="page-sub">已发布 ' + pubs.length + ' 篇 · 数据越诚实，迭代越快</div>' +
        '<div class="page-head-actions">' +
        '<button class="btn ai" onclick="MW.act.aiReviewAll()">' + MW.icon('sparkles', 14) + ' AI 复盘</button>' +
        '<button class="btn" onclick="MW.act.genWeeklyReport()">' + MW.icon('file', 14) + ' 生成周报</button>' +
        '<button class="btn primary" onclick="MW.act.openContentModal()">' + MW.icon('plus', 14) + ' 补录数据</button></div></div>';

      /* 目标进度 */
      html += '<div class="card"><div class="card-head"><div class="card-title">' + MW.icon('target', 15) + ' 目标进度（在账号矩阵里调整目标）</div></div>' +
        '<div class="goal-grid">' + accList.map(function (a) {
          const fp = a.goalFollowers ? Math.min(100, a.followers / a.goalFollowers * 100) : 0;
          const monthPubs = db.contents.filter(function (c) {
            return c.accountId === a.id && c.status === 'published' && c.date.slice(0, 7) === t.slice(0, 7);
          }).length;
          const pp = a.goalPosts ? Math.min(100, monthPubs / a.goalPosts * 100) : 0;
          return '<div class="goal-item">' +
            '<div class="goal-name">' + MW.esc(a.name) + '</div>' +
            '<div class="goal-line"><span>粉丝</span><b>' + MW.fmt.num(a.followers) + ' / ' + MW.fmt.num(a.goalFollowers) + '</b>' +
            MW.ui.progress(fp, MW.PLATFORMS[a.platform].color) + '</div>' +
            '<div class="goal-line"><span>本月发布</span><b>' + monthPubs + ' / ' + a.goalPosts + ' 篇</b>' +
            MW.ui.progress(pp, 'var(--teal)') + '</div>' +
            '</div>';
        }).join('') + '</div></div>';

      /* 图表 */
      html += '<div class="chart-grid">' +
        '<div class="card"><div class="card-head"><div class="card-title">粉丝增长曲线</div>' +
        '<div class="card-extra">' + (snapDates.length ? '共 ' + snapDates.length + ' 次记录' : '去账号矩阵记粉丝') + '</div></div>' +
        (snapDates.length > 1
          ? MW.charts.line({ labels: snapDates.map(function (d) { return d.slice(5); }), series: [{ name: '粉丝', color: MW.CHART_COLORS.red, values: snapVals }] })
          : MW.ui.empty('暂无粉丝记录', '在账号矩阵点击「记今日粉丝」，每日一次')) + '</div>' +
        '<div class="card"><div class="card-head"><div class="card-title">近 30 天每日新增浏览</div></div>' +
        MW.charts.line({ labels: days, series: [{ name: '浏览', color: MW.CHART_COLORS.amber, values: viewTrend }] }) + '</div>' +
        '<div class="card"><div class="card-head"><div class="card-title">近 30 天每日发布数</div></div>' +
        MW.charts.bar({ labels: days, series: [{ name: '发布数', color: MW.CHART_COLORS.primary, values: pubCount }] }) + '</div>' +
        '</div>';

      /* 已发布内容表 */
      html += '<div class="card table-card"><div class="card-head"><div class="card-title">' + MW.icon('chart', 15) + ' 已发布内容数据</div>' +
        '<div class="card-extra">互动率 =（点赞+评论+收藏+转发）/ 浏览</div></div>';
      if (!pubs.length) {
        html += MW.ui.empty('暂无已发布内容', '发布后可回填数据，或先在内容日历标记发布');
      } else {
        html += '<table class="table"><thead><tr><th>内容</th><th>账号</th><th>发布日期</th><th>浏览</th><th>点赞</th><th>评论</th><th>收藏</th><th>涨粉</th><th>互动率</th><th>操作</th></tr></thead><tbody>';
        pubs.forEach(function (c) {
          const acc = db.accounts.find(function (a) { return a.id === c.accountId; });
          const m = c.metrics || {};
          const eng = m.views ? ((m.likes + m.comments + m.collects + m.shares) / m.views * 100) : 0;
          const engCls = eng >= 8 ? 'good' : eng >= 4 ? 'mid' : 'low';
          const avg = avgViews[c.accountId] || 0;
          const hot = avg && m.views >= avg * 1.8;
          html += '<tr>' +
            '<td class="rv-title">' + MW.esc(c.title) +
              (hot ? '<span class="hot-flag">爆款</span>' : '') +
              (c.note ? '<span class="rv-note-flag" title="已有复盘笔记">' + MW.icon('note', 11) + '</span>' : '') + '</td>' +
            '<td>' + (acc ? MW.esc(acc.name) : '--') + '</td>' +
            '<td>' + c.date.slice(5) + '</td>' +
            '<td>' + MW.fmt.int(m.views || 0) + '</td>' +
            '<td>' + MW.fmt.int(m.likes || 0) + '</td>' +
            '<td>' + MW.fmt.int(m.comments || 0) + '</td>' +
            '<td>' + MW.fmt.int(m.collects || 0) + '</td>' +
            '<td>' + MW.fmt.int(m.newFollowers || 0) + '</td>' +
            '<td><span class="eng ' + engCls + '">' + eng.toFixed(1) + '%</span></td>' +
            '<td class="td-actions"><button class="btn sm" onclick="MW.act.aiRetro(\'' + c.id + '\')">' + MW.icon('sparkles', 12) + ' AI 诊断</button>' +
            '<button class="btn sm" onclick="MW.act.openRetroModal(\'' + c.id + '\')">复盘</button>' +
            '<button class="btn sm" onclick="MW.act.openContentModal(\'' + c.id + '\')">改数据</button></td>' +
            '</tr>';
        });
        html += '</tbody></table>';
      }
      html += '</div>';

      root.innerHTML = html;
    }
  };
})();
