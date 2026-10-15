/* ============================================================
   视图 · 竞品库（追踪同赛道账号，对比打法与内容策略）
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  MW.act.openCompetitorModal = function (id) {
    const db = MW.getDB();
    const c = id ? db.competitors.find(function (x) { return x.id === id; }) : null;
    const body =
      MW.ui.row('账号名称', '<input id="cp-name" placeholder="对标账号的名字" value="' + MW.esc(c ? c.name : '') + '">') +
      '<div class="form-2col">' +
        MW.ui.row('平台', MW.ui.platformOptions('cp-platform', c ? c.platform : 'xhs')) +
        MW.ui.row('账号 ID / 链接', '<input id="cp-accountid" placeholder="主页链接或 ID" value="' + MW.esc(c ? c.accountId : '') + '">') +
      '</div>' +
      '<div class="form-2col">' +
        MW.ui.row('所属赛道', '<input id="cp-category" placeholder="例如：AI工具 / 3D打印 / 增长方法" value="' + MW.esc(c ? c.category : '') + '">') +
        MW.ui.row('粉丝数', '<input id="cp-followers" type="number" min="0" value="' + (c ? c.followers : 0) + '">') +
      '</div>' +
      '<div class="form-2col">' +
        MW.ui.row('更新频率', '<input id="cp-freq" placeholder="例如：日更 / 周3更" value="' + MW.esc(c ? c.freq : '') + '">') +
        MW.ui.row('对标等级', MW.ui.select('cp-level', [{ v: '核心对标', t: '核心对标' }, { v: '一般关注', t: '一般关注' }], c ? (c.level || '核心对标') : '核心对标')) +
      '</div>' +
      MW.ui.row('打法与内容策略', '<textarea id="cp-strategy" rows="3" placeholder="他靠什么起量？选题套路、封面风格、变现路径……">' + MW.esc(c ? c.strategy : '') + '</textarea>', '定期回来更新，这是竞品库的核心价值');

    MW.modal({
      title: c ? '编辑竞品' : '添加竞品',
      sub: '不是抄，是看清差距在哪',
      body: body,
      okText: '保存',
      onOk: function (root) {
        const v = function (id2) { return (root.querySelector('#' + id2).value || '').trim(); };
        const name = v('cp-name');
        if (!name) { MW.toast('请填写账号名称', 'error'); return false; }
        const obj = {
          platform: v('cp-platform'), name: name, accountId: v('cp-accountid'),
          category: v('cp-category'), followers: +v('cp-followers') || 0,
          freq: v('cp-freq'), level: v('cp-level') || '核心对标',
          strategy: v('cp-strategy'), updatedAt: MW.dateStr()
        };
        if (c) {
          const changed = c.followers !== obj.followers;
          Object.assign(c, obj);
          if (changed) {
            c.snapshots = c.snapshots || [];
            c.snapshots.push({ date: MW.dateStr(), followers: obj.followers });
          }
        } else {
          db.competitors.push(Object.assign({ id: MW.uid(), snapshots: [{ date: MW.dateStr(), followers: +obj.followers || 0 }] }, obj));
        }
        MW.save(); MW.render();
        MW.toast(c ? '竞品已更新' : '竞品已添加');
      }
    });
  };

  MW.act.openSnapshotModal = function (id) {
    const db = MW.getDB();
    const c = db.competitors.find(function (x) { return x.id === id; });
    if (!c) return;
    const body =
      MW.ui.row('记录日期', '<input id="sn-date" type="date" value="' + MW.dateStr() + '">') +
      MW.ui.row('当前粉丝数', '<input id="sn-followers" type="number" min="0" value="' + c.followers + '">', '每周固定记一次，就能看到增长趋势');
    MW.modal({
      title: '记录粉丝快照',
      sub: c.name,
      body: body,
      okText: '记录',
      onOk: function (root) {
        const date = root.querySelector('#sn-date').value;
        const f = +root.querySelector('#sn-followers').value || 0;
        c.followers = f;
        c.updatedAt = date || MW.dateStr();
        c.snapshots = c.snapshots || [];
        c.snapshots.push({ date: date || MW.dateStr(), followers: f });
        MW.save(); MW.render();
        MW.toast('快照已记录');
      }
    });
  };

  MW.act.delCompetitor = function (id) {
    const db = MW.getDB();
    MW.confirm('确定删除这个竞品？', function () {
      db.competitors = db.competitors.filter(function (x) { return x.id !== id; });
      MW.save(); MW.render();
      MW.toast('已删除');
    }, { okText: '删除' });
  };

  MW.views['competitors'] = {
    id: 'competitors', name: '竞品库', icon: 'eye',
    sub: '追踪同赛道账号数据，对比打法和内容策略',
    render: function (root) {
      const db = MW.getDB();

      let html = '<div class="page-head"><div class="page-title">竞品库</div>' +
        '<div class="page-sub">' + db.competitors.length + ' 个对标账号 · 建议每周记录一次粉丝快照</div>' +
        '<button class="btn primary" onclick="MW.act.openCompetitorModal()">' + MW.icon('plus', 14) + ' 添加竞品</button></div>';

      if (!db.competitors.length) {
        html += MW.ui.empty('暂无竞品', '添加同赛道账号，持续追踪其运营策略');
        root.innerHTML = html;
        return;
      }

      html += '<div class="card table-card"><table class="table"><thead><tr>' +
        '<th>账号</th><th>平台</th><th>赛道</th><th>粉丝趋势</th><th>粉丝数</th><th>更新频率</th><th>打法与策略</th><th>更新于</th><th>操作</th>' +
        '</tr></thead><tbody>';

      db.competitors.forEach(function (c) {
        const snaps = (c.snapshots || []).slice(-6);
        const delta = snaps.length >= 2 ? snaps[snaps.length - 1].followers - snaps[snaps.length - 2].followers : 0;
        html += '<tr>' +
          '<td><div class="cp-name">' + MW.esc(c.name) +
            '<span class="cp-level' + (c.level === '一般关注' ? ' gray' : '') + '">' + MW.esc(c.level || '核心对标') + '</span></div>' +
            '<div class="cp-id">' + MW.esc(c.accountId || '') + '</div></td>' +
          '<td>' + MW.ui.pfChip(c.platform, true) + '</td>' +
          '<td><span class="cp-cat">' + MW.esc(c.category || '--') + '</span></td>' +
          '<td>' + MW.charts.sparkline(snaps.map(function (s) { return s.followers; }), 'var(--primary)') + '</td>' +
          '<td><b>' + MW.fmt.num(c.followers) + '</b><span class="' + (delta >= 0 ? 'up' : 'down') + '">' + (delta >= 0 ? '+' : '') + MW.fmt.num(delta) + '</span></td>' +
          '<td>' + MW.esc(c.freq || '--') + '</td>' +
          '<td class="cp-strategy">' + MW.esc(c.strategy || '--') + '</td>' +
          '<td>' + (c.updatedAt || '--').slice(5) + '</td>' +
          '<td class="td-actions"><button class="btn sm" onclick="MW.act.openSnapshotModal(\'' + c.id + '\')">记快照</button>' +
          '<button class="btn sm" onclick="MW.act.openCompetitorModal(\'' + c.id + '\')">编辑</button>' +
          '<button class="btn sm danger-ghost" onclick="MW.act.delCompetitor(\'' + c.id + '\')">' + MW.icon('trash', 12) + '</button></td>' +
          '</tr>';
      });

      html += '</tbody></table></div>';

      /* 策略对比提示 */
      html += '<div class="card compare-card"><div class="card-title">' + MW.icon('target', 15) + ' 对标结论（建议每周填一次）</div>' +
        '<div class="compare-grid">' +
        db.competitors.slice(0, 4).map(function (c) {
          return '<div class="compare-item"><div class="compare-name">' + MW.esc(c.name) + '</div>' +
            '<div class="compare-q">他最值得我学的一点：</div><div class="compare-a">' + MW.esc((c.strategy || '').split('；')[0].slice(0, 40)) + '……</div></div>';
        }).join('') +
        '</div></div>';

      root.innerHTML = html;
    }
  };
})();
