/* ============================================================
   社媒工作台 · 分发版 · 应用外壳（侧边导航 / 路由 / 顶栏 / 数据管理）
   定位：一稿多发——同一份母稿，按各平台账号定位改写成多平台版本
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});

  /* 导航顺序 = 分发博主的日常动线：
     竞品侦察（看对标在发什么）→ 首页看今天发什么 → 写母稿 → 排日历 →
     发布检查 → 账号定位。「关于与联系」从侧栏底部数据管理区进。 */
  const NAV = [
    { label: '侦察', items: ['competitors'] },
    { label: '动线', items: ['home', 'ai', 'calendar', 'publish'] },
    { label: '设置', items: ['accounts'] }
  ];

  /* ---------- 账号视角切换器（运营者的核心心智：我是哪个号） ---------- */
  function buildAccSwitch() {
    const db = MW.getDB();
    const t = MW.dateStr();
    const cur = MW.curAcc();
    let html = '<div class="acc-switch">' +
      '<div class="as-head"><span class="as-title">当前视角</span>' +
      '<span class="as-count">' + db.accounts.length + ' 个账号</span></div>';

    const allTodo = db.contents.filter(function (c) { return c.date === t && c.status !== 'published'; }).length;
    html += '<button class="as-item' + (cur === 'all' ? ' active' : '') + '" onclick="MW.setCurAcc(\'all\')">' +
      '<span class="as-dot all">' + MW.icon('layers', 11) + '</span>' +
      '<span class="as-name">全部账号</span>' +
      (allTodo ? '<em class="as-badge">' + allTodo + '</em>' : '') + '</button>';

    db.accounts.forEach(function (a) {
      const p = MW.pfOf(a);
      const todo = db.contents.filter(function (c) {
        return c.accountId === a.id && c.date === t && c.status !== 'published';
      }).length;
      html += '<button class="as-item' + (cur === a.id ? ' active' : '') + '" onclick="MW.setCurAcc(\'' + a.id + '\')"' +
        ' title="' + MW.esc(a.positioning || a.name) + '">' +
        '<span class="as-dot" style="background:' + p.color + '"></span>' +
        '<span class="as-name">' + MW.esc(a.name) + '</span>' +
        (todo ? '<em class="as-badge hot">' + todo + '</em>' : '') +
        '</button>';
    });
    html += '</div>';
    return html;
  }

  /* ---------- 侧边导航 ---------- */
  function buildSidebar() {
    const side = document.getElementById('sidebar');
    let html = '<div class="side-brand">' +
      '<div class="brand-mark">' + MW.icon('sparkles', 18) + '</div>' +
      '<div class="brand-text"><b>社媒工作台</b><span>分发版 · 一稿多发</span></div></div>';

    html += '<div id="acc-switch-slot">' + buildAccSwitch() + '</div>';

    html += '<nav class="side-nav">';
    NAV.forEach(function (g) {
      if (g.label) html += '<div class="nav-group-label">' + g.label + '</div>';
      g.items.forEach(function (id) {
        const v = MW.views[id];
        if (!v) return;
        html += '<a class="nav-item" href="#/' + id + '" data-nav="' + id + '">' +
          MW.icon(v.icon, 16) + '<span>' + v.name + '</span>' +
          '<em class="nav-badge" data-badge="' + id + '"></em></a>';
      });
    });
    html += '</nav>';

    html += '<div class="side-foot">' +
      '<div class="side-foot-title">数据管理</div>' +
      '<div class="side-foot-btns">' +
      '<button class="side-btn" onclick="MW.act.exportData()">' + MW.icon('download', 13) + ' 导出备份</button>' +
      '<button class="side-btn" onclick="MW.act.importData()">' + MW.icon('upload', 13) + ' 导入恢复</button>' +
      '<button class="side-btn" onclick="MW.act.resetDemo()">' + MW.icon('refresh', 13) + ' 恢复示例</button>' +
      '<button class="side-btn" onclick="MW.act.aiSettings()">' + MW.icon('sparkles', 13) + ' AI 接口</button>' +
      '<button class="side-btn" onclick="MW.act.aboutApp()">' + MW.icon('help', 13) + ' 关于与联系</button>' +
      '</div>' +
      '<div class="side-foot-note">数据存在本机浏览器，换电脑用「导出 / 导入」同步</div>' +
      '</div>';

    side.innerHTML = html;
  }

  function updateBadges() {
    const db = MW.getDB();
    const t = MW.dateStr();
    /* 简版只关心一件事：今天该发的发了没有 */
    const counts = {
      publish: db.contents.filter(function (c) { return c.status === 'scheduled' && c.date <= t; }).length
    };
    document.querySelectorAll('.nav-badge').forEach(function (el) {
      const n = counts[el.getAttribute('data-badge')] || 0;
      el.textContent = n > 0 ? (n > 99 ? '99+' : n) : '';
      el.style.display = n > 0 ? 'inline-flex' : 'none';
    });
  }

  /* ---------- 数据管理 ---------- */
  MW.act.exportData = function () {
    /* __t 是本机多标签页防覆盖用的内部时间戳，不属于用户数据，
       导出时剔掉，免得备份文件里混进一个用户看不懂的字段。 */
    const copy = Object.assign({}, MW.getDB());
    delete copy.__t;
    const data = JSON.stringify(copy, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '社媒工作台分发版-数据-' + MW.dateStr() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    MW.toast('备份已导出');
  };

  MW.act.importData = function () {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = function () {
      const file = inp.files && inp.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          let data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.accounts)) throw new Error('格式不正确');
          /* 导入的老版本数据也要走一遍升级；旗舰版导出的备份表更多，
             这里只取本版需要的两张表，其余忽略（子集兼容）。 */
          if (typeof MW.migrate === 'function') data = MW.migrate(data);
          const db = MW.getDB();
          Object.keys(db).forEach(function (k) { delete db[k]; });
          db.accounts = Array.isArray(data.accounts) ? data.accounts : [];
          db.contents = Array.isArray(data.contents) ? data.contents : [];
          db.competitors = Array.isArray(data.competitors) ? data.competitors : [];
          db.settings = data.settings && typeof data.settings === 'object' ? data.settings : {};
          if (!db.settings.ai) db.settings.ai = { baseUrl: '', apiKey: '', model: '', provider: '' };
          if (!db.settings.about) db.settings.about = { contactLabel: '', contactValue: '', contactNote: '' };
          if (!db.settings.license) db.settings.license = null;
          /* 备份里若带 __t（早期版本或手改过），清掉让 MW.save() 重写一个当前时间 */
          delete db.__t;
          MW.save();
          MW.render();
          MW.toast('数据导入成功');
        } catch (e) {
          MW.toast('导入失败：文件格式不正确', 'error');
        }
      };
      reader.readAsText(file);
    };
    inp.click();
  };

  /* 「恢复示例」会覆盖全部数据，必须先确认 */
  MW.act.resetDemo = function () {
    MW.confirm('这会清空当前所有数据并恢复成示例账号与母稿，确定继续吗？建议先「导出备份」。', function () {
      MW.resetDemo();
    }, { title: '恢复示例数据', okText: '确定恢复' });
  };

  /* ---------- 快速添加 ---------- */
  function bindQuickAdd() {
    const btn = document.getElementById('qa-btn');
    const menu = document.getElementById('qa-menu');
    if (!btn || !menu) return;
    btn.onclick = function (e) {
      e.stopPropagation();
      menu.classList.toggle('open');
    };
    document.addEventListener('click', function () { menu.classList.remove('open'); });
    menu.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  /* ---------- 帮助 ---------- */
  function showHelp() {
    const body =
      '<div class="help-body">' +
      '<div class="help-sec"><b>竞品库：先看清对标在发什么</b>' +
      '<p>写母稿之前，去「竞品库」看看同赛道账号最近发了什么：<b>内容动态</b>记录对方的爆款（标题、链接、赞评藏、你的判断），<b>粉丝快照</b>每周记一次看增长。刷到值得研究的操作就记一条，攒下来就是你的选题库。</p></div>' +
      '<div class="help-sec"><b>这是一稿多发工具</b>' +
      '<p>核心动线四步：<b>写母稿</b>（AI 文案台生成或粘贴）→ <b>适配账号</b>（勾选各平台账号，按每个号的定位/受众/语气自动改写成对应版本）→ <b>核实后排期</b>（适配版默认「未就绪」，发布管理里逐项检查）→ <b>标记发布</b>（点「发了」记下发布时间，可回填链接与数据）。</p></div>' +
      '<div class="help-sec"><b>账号定位是改写质量的源头</b>' +
      '<p>每个账号填四项：<b>定位、目标受众、内容风格、表达风格</b>，再加 3-5 个<b>内容聚焦</b>方向。这五项会原样进入改写上下文——同一个母稿，公众号版是深度长文、抖音版是快节奏脚本、X 版是英文短帖，区别全来自这里。改账号卡上任何一个字，之后所有平台的版本都跟着变。</p></div>' +
      '<div class="help-sec"><b>AI 接口：配了更强，不配也能用</b>' +
      '<p>侧边栏「AI 接口」里选服务商（智谱 GLM 有免费额度）、填密钥即可，支持一键导入本机已装好的配置。没配接口时，适配会生成本地初稿（标题/钩子/大纲/标签），正文人工补全后照常发布。</p></div>' +
      '<div class="help-sec"><b>发布前四项检查</b>' +
      '<p>每条排期有四项检查：<b>文案定稿 / 封面素材 / 话题标签 / 发布时段</b>，四项齐了才算就绪。发布管理按「今天要发 / 逾期未发 / 未来 7 天」分组，点「发了」推进状态，标错可撤销。</p></div>' +
      '<div class="help-sec"><b>数据与换机</b>' +
      '<p>数据保存在本机浏览器，不联网、不上传。侧边栏「导出备份」生成 JSON，换电脑或重装后「导入恢复」即可。示例数据随时可「恢复示例」重来。</p></div>' +
      '</div>';
    MW.modal({ title: '使用指南', body: body, footer: false });
  }

  /* ---------- 路由 ---------- */
  function route() {
    const hash = (location.hash || '').replace(/^#\/?/, '') || 'home';
    const v = MW.views[hash];
    if (!v) { location.hash = '#/home'; return; }

    /* 账号视角是全局状态，每次路由都刷新一次切换器 */
    const slot = document.getElementById('acc-switch-slot');
    if (slot) slot.innerHTML = buildAccSwitch();

    const curA = MW.curAcc();
    document.getElementById('tb-title').innerHTML = MW.esc(v.name) +
      (curA !== 'all' ? '<span class="tb-acc-chip">' + MW.esc(MW.accName(curA)) + '</span>' : '');
    document.getElementById('tb-sub').textContent = v.sub || '';
    document.querySelectorAll('.nav-item').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-nav') === hash);
    });
    const view = document.getElementById('view');
    view.innerHTML = '';
    view.scrollTop = 0;
    v.render(view);
    if (typeof v.onEnter === 'function') {
      try { v.onEnter(view); } catch (e) { /* 钩子失败不影响页面 */ }
    }
    updateBadges();
  }

  MW.render = route;
  MW.goto = function (h) { location.hash = h; };

  /* ---------- 移动端抽屉（≤900px 时侧栏滑出） ---------- */
  function bindDrawer() {
    const btn = document.getElementById('menu-btn');
    const mask = document.getElementById('side-mask');
    if (!btn || !mask) return;
    btn.innerHTML = MW.icon('menu', 18);
    const close = function () { document.body.classList.remove('side-open'); };
    btn.onclick = function (e) {
      e.stopPropagation();
      document.body.classList.toggle('side-open');
    };
    mask.onclick = close;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    /* 抽屉里点了导航就合上——不然内容被抽屉挡着，还得再点一次遮罩 */
    document.getElementById('sidebar').addEventListener('click', function (e) {
      const a = e.target && e.target.closest ? e.target.closest('.nav-item') : null;
      if (a) close();
    });
  }

  /* ---------- 桌面版更新横幅（仅 Electron 环境挂载，纯 Web 无副作用） ---------- */
  function bindDesktopUpdater() {
    if (!window.mwDesktop) return;
    var banner = null;

    function fmtTime(iso) {
      if (!iso) return '';
      return String(iso).slice(0, 10) + ' ' + String(iso).slice(11, 16);
    }
    function ensureBanner() {
      if (banner) return banner;
      banner = document.createElement('div');
      banner.className = 'mw-update-banner';
      banner.style.display = 'none';
      document.body.appendChild(banner);
      return banner;
    }
    function hideBanner() { if (banner) banner.style.display = 'none'; }
    function setText(t) {
      if (!banner) return;
      var el = banner.querySelector('.mw-ub-text');
      if (el) el.textContent = t;
    }

    function showAvailable(info) {
      var b = ensureBanner();
      b.innerHTML = '<div class="mw-ub-inner">' +
        '<span class="mw-ub-dot"></span>' +
        '<span class="mw-ub-text">发现新版本' + (info.message ? ' · ' + MW.esc(info.message) : '') +
        (info.date ? '（' + fmtTime(info.date) + '）' : '') + '</span>' +
        '<button class="mw-ub-btn" id="mw-ub-install">立即更新</button>' +
        '<button class="mw-ub-later" id="mw-ub-later">稍后</button>' +
        '</div>';
      b.style.display = 'block';
      document.getElementById('mw-ub-install').onclick = function () {
        var btn = document.getElementById('mw-ub-install');
        var later = document.getElementById('mw-ub-later');
        if (btn) btn.style.display = 'none';
        if (later) later.style.display = 'none';
        window.mwDesktop.installUpdate();
      };
      document.getElementById('mw-ub-later').onclick = hideBanner;
    }

    window.mwDesktop.onUpdateEvent(function (ev) {
      if (!ev || !ev.type) return;
      if (ev.type === 'available') showAvailable(ev);
      else if (ev.type === 'progress') {
        setText(ev.phase === 'downloading' ? '正在下载更新，请保持网络畅通…' : '正在安装更新…');
      } else if (ev.type === 'applied') {
        MW.toast('已更新到最新版本，正在重新加载…');
      } else if (ev.type === 'up-to-date') {
        MW.toast('已是最新版本');
      } else if (ev.type === 'error') {
        MW.toast('更新失败：' + (ev.message || '未知错误'), 'error');
        hideBanner();
      }
    });

    /* 启动时若已有待更新（上次查到但没装），直接把横幅摆出来 */
    window.mwDesktop.getState().then(function (s) {
      if (s && s.available && s.available.sha !== s.currentSha) showAvailable(s.available);
    }).catch(function () { /* 状态读取失败就不显示，等下次事件 */ });
  }

  /* ---------- 启动 ---------- */
  function init() {
    buildSidebar();
    bindQuickAdd();
    bindDrawer();
    bindDesktopUpdater();
    document.getElementById('help-btn').innerHTML = MW.icon('help', 17);
    document.getElementById('help-btn').onclick = showHelp;
    document.getElementById('tb-date').textContent = MW.dateStr() + ' ' + MW.weekdayCN(MW.dateStr());
    window.addEventListener('hashchange', route);
    /* 卸载前别无条件写库：多标签页同时开着时，未修改的旧副本会在关闭瞬间
       把别处的新数据冲掉。MW.isStale() 判断本页内存是否已被别人更新过。 */
    window.addEventListener('beforeunload', function () {
      try { if (typeof MW.isStale === 'function' && MW.isStale()) return; } catch (e) { /* 判断失败就照旧写 */ }
      MW.save();
    });
    if (!location.hash) location.hash = '#/home';
    route();
  }

  init();
})();
