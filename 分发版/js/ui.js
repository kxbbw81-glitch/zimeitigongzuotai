/* ============================================================
   社媒工作台 · 通用 UI（模态 / 提示 / 格式化 / 拖拽）
   定位：外贸社媒 + 自媒体一体化工作台
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});

  /* ---------- HTML 转义 ---------- */
  MW.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- 格式化 ---------- */
  MW.fmt = {
    num: function (n) {
      n = +n || 0;
      if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace('.0', '') + 'w';
      if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
      return String(n);
    },
    int: function (n) { return (+n || 0).toLocaleString('zh-CN'); },
    money: function (n) { return '¥' + (+n || 0).toLocaleString('zh-CN'); },
    pct: function (a, b) { return b ? Math.round(a / b * 100) + '%' : '0%'; },
    dateCN: function (s) { const p = s.split('-'); return parseInt(p[1], 10) + '月' + parseInt(p[2], 10) + '日'; }
  };

  /* ---------- 模态框 ---------- */
  MW.modal = function (opt) {
    const root = document.getElementById('modal-root');
    root.innerHTML =
      '<div class="mask"></div>' +
      '<div class="modal ' + (opt.size || '') + '">' +
        '<div class="modal-head">' +
          '<div><div class="modal-title">' + opt.title + '</div>' +
          (opt.sub ? '<div class="modal-sub">' + opt.sub + '</div>' : '') + '</div>' +
          '<button class="icon-btn" id="modal-close">' + MW.icon('x', 16) + '</button>' +
        '</div>' +
        '<div class="modal-body">' + opt.body + '</div>' +
        (opt.footer === false ? '' :
          '<div class="modal-foot"><button class="btn" id="modal-cancel">取消</button>' +
          '<button class="btn primary" id="modal-ok">' + (opt.okText || '确定') + '</button></div>') +
      '</div>';
    document.querySelector('#modal-root .mask').onclick = MW.closeModal;
    document.getElementById('modal-close').onclick = MW.closeModal;
    const cancel = document.getElementById('modal-cancel');
    if (cancel) cancel.onclick = MW.closeModal;
    const ok = document.getElementById('modal-ok');
    if (ok) ok.onclick = function () { if (!opt.onOk || opt.onOk(root) !== false) MW.closeModal(); };
    return root;
  };
  MW.closeModal = function () { document.getElementById('modal-root').innerHTML = ''; };

  MW.confirm = function (text, onOk, opt) {
    opt = opt || {};
    MW.modal({
      title: opt.title || '确认操作',
      body: '<div class="confirm-text">' + MW.esc(text) + '</div>',
      okText: opt.okText || '确认',
      onOk: function () { onOk(); }
    });
  };

  /* ---------- 轻提示 ---------- */
  MW.toast = function (msg, type) {
    const root = document.getElementById('toast-root');
    const d = document.createElement('div');
    d.className = 'toast ' + (type || '');
    d.innerHTML = MW.icon(type === 'error' ? 'x' : 'check', 15) + '<span>' + MW.esc(msg) + '</span>';
    root.appendChild(d);
    setTimeout(function () { d.classList.add('out'); setTimeout(function () { d.remove(); }, 280); }, 2200);
  };

  /* ---------- 复制 ---------- */
  MW.copy = function (text) {
    function done() { MW.toast('已复制到剪贴板'); }
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { MW.toast('复制失败，请手动选择', 'error'); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else fallback();
  };

  /* ---------- 拖拽 ---------- */
  MW.dragSrc = function (el, type, id) {
    el.setAttribute('draggable', 'true');
    el.addEventListener('dragstart', function (e) {
      e.dataTransfer.setData('text/plain', type + ':' + id);
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', function () { el.classList.remove('dragging'); });
  };
  MW.dropZone = function (el, onDrop) {
    el.addEventListener('dragover', function (e) { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', function () { el.classList.remove('drag-over'); });
    el.addEventListener('drop', function (e) {
      e.preventDefault();
      el.classList.remove('drag-over');
      const data = e.dataTransfer.getData('text/plain');
      if (data) onDrop(data.split(':'), e);
    });
  };

  /* ---------- 表单辅助 ---------- */
  MW.ui = {};

  /* 下拉框。options 里带 group + items 的项渲染成 optgroup（平台下拉的分组用） */
  MW.ui.select = function (id, options, value, cls) {
    let h = '<select id="' + id + '" class="' + (cls || '') + '">';
    options.forEach(function (o) {
      if (o.group) {
        h += '<optgroup label="' + MW.esc(o.group) + '">';
        (o.items || []).forEach(function (it) {
          h += '<option value="' + it.v + '"' + (String(it.v) === String(value) ? ' selected' : '') + '>' + MW.esc(it.t) + '</option>';
        });
        h += '</optgroup>';
      } else {
        h += '<option value="' + o.v + '"' + (String(o.v) === String(value) ? ' selected' : '') + '>' + MW.esc(o.t) + '</option>';
      }
    });
    return h + '</select>';
  };

  MW.ui.row = function (label, inner, hint) {
    return '<div class="form-row"><label class="form-label">' + label + '</label>' + inner +
      (hint ? '<div class="form-hint">' + hint + '</div>' : '') + '</div>';
  };

  MW.ui.accountOptions = function (id, value) {
    if (value === undefined) { value = id; id = 'f-account'; }
    return MW.ui.select(id || 'f-account', MW.getDB().accounts.map(function (a) {
      return { v: a.id, t: a.name + '（' + MW.pfOf(a).name + '）' };
    }), value);
  };

  /* 平台下拉：国内 / 国外分组，「自定义平台…」让用户自建平台（名字和颜色存账号上）。
     选中 custom 时，调用方负责显示名称输入框（见 accounts.js 的编辑弹窗）。 */
  MW.ui.platformOptions = function (id, value) {
    if (value === undefined) { value = id; id = 'f-platform'; }
    const cn = [], gl = [];
    Object.keys(MW.PLATFORMS).forEach(function (k) {
      const r = MW.PLATFORMS[k].region;
      const item = { v: k, t: MW.PLATFORMS[k].name };
      if (r === 'cn') cn.push(item);
      else if (r === 'global') gl.push(item);
    });
    return MW.ui.select(id || 'f-platform', [
      { group: '国内平台', items: cn },
      { group: '国外平台 · 外贸社媒', items: gl },
      { v: 'other', t: '其他' },
      { v: 'custom', t: '自定义平台…' }
    ], value);
  };

  /* ---------- 展示辅助 ---------- */
  /* 平台 chip。第三个参数可传账号 / 内容对象——自定义平台的名字存在对象上，
     不传就按 key 查表（竞品、热点这类不挂账号的场景）。 */
  MW.ui.pfChip = function (platform, small, obj) {
    let p;
    if (platform === 'custom') {
      p = { name: MW.pfName('custom', obj), color: (obj && obj.platformColor) || '#6b7280' };
    } else {
      p = MW.PLATFORMS[platform] || MW.PLATFORMS.other;
    }
    return '<span class="pf-chip' + (small ? ' sm' : '') + '" style="--pc:' + p.color + '">' + MW.esc(p.name) + '</span>';
  };

  MW.ui.tag = function (t, color) {
    return '<span class="tag"' + (color ? ' style="--tc:' + color + '"' : '') + '>' + MW.esc(t) + '</span>';
  };

  MW.ui.empty = function (text, sub) {
    return '<div class="empty"><div class="empty-icon">' + MW.icon('layers', 30) + '</div>' +
      '<div class="empty-text">' + MW.esc(text) + '</div>' +
      (sub ? '<div class="empty-sub">' + MW.esc(sub) + '</div>' : '') + '</div>';
  };

  MW.ui.progress = function (pct, color) {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    return '<div class="progress"><i style="width:' + pct + '%;background:' + (color || 'var(--primary)') + '"></i></div>';
  };

  MW.ui.ownerChip = function (owner) {
    return '<span class="owner-chip ' + (owner === '合伙人' ? 'partner' : 'me') + '">' + MW.esc(owner || '我') + '</span>';
  };

  MW.ui.prioChip = function (p) {
    const m = { high: ['高', 'var(--red)'], mid: ['中', 'var(--amber)'], low: ['低', 'var(--text3)'] }[p] || ['中', 'var(--amber)'];
    return '<span class="prio-chip" style="--pc:' + m[1] + '">' + m[0] + '</span>';
  };

  /* 工作状态标签：待办 / 待写 / 写稿中 / 制作中 / 待发布
     传进来的可能是个未知 key（老数据或手改过），交给 MW.todoStatus 兜底，不显示空白。 */
  MW.ui.statusChip = function (st) {
    const s = typeof st === 'string' ? MW.todoStatus(st) : (st || MW.todoStatus(''));
    return '<span class="td-status tone-' + s.tone + '">' + MW.esc(s.label) + '</span>';
  };
})();
