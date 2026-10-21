/* ============================================================
   社媒工作台 · 应用外壳（侧边导航 / 路由 / 顶栏 / 数据管理）
   定位：外贸社媒 + 自媒体一体化工作台
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});

  /* 导航顺序 = 运营者真实的日常动线，而不是模块分类表：
     今天要发什么 → 想发什么（找灵感 → 定选题 → 写文案 → 配素材）→ 定哪天发
     → 发完看效果（复盘 / 跟同行）→ 日常杂事（待办 / 账本 / 账号设置，低频垫底）。
     每个模块的 id 与路由不变，老链接照常可用。 */
  const NAV = [
    { label: '今天', items: ['today'] },
    { label: '做内容', items: ['ideas', 'reposts', 'board', 'ai', 'assets'] },
    { label: '发出去', items: ['calendar', 'publish'] },
    { label: '看效果', items: ['review', 'competitors'] },
    { label: '日常', items: ['todos', 'finance', 'accounts'] }
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
      const g = MW.growth(a, 7);
      html += '<button class="as-item' + (cur === a.id ? ' active' : '') + '" onclick="MW.setCurAcc(\'' + a.id + '\')"' +
        ' title="' + MW.esc(a.positioning || a.name) + '">' +
        '<span class="as-dot" style="background:' + p.color + '"></span>' +
        '<span class="as-name">' + MW.esc(a.name) + '</span>' +
        (todo ? '<em class="as-badge hot">' + todo + '</em>' : (g.delta > 0 ? '<em class="as-gain">+' + MW.fmt.num(g.delta) + '</em>' : '')) +
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
      '<div class="brand-text"><b>社媒工作台</b><span>外贸社媒 · 自媒体一体化</span></div></div>';

    html += '<div id="acc-switch-slot">' + buildAccSwitch() + '</div>';

    html += '<nav class="side-nav">';
    NAV.forEach(function (g) {
      html += '<div class="nav-group-label">' + g.label + '</div>';
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
      '<div class="side-foot-note">数据存在本机浏览器，多设备用「导出 / 导入」同步</div>' +
      '</div>';

    side.innerHTML = html;
  }

  function updateBadges() {
    const db = MW.getDB();
    const t = MW.dateStr();
    const counts = {
      today: db.todos.filter(function (x) { return x.date === t && !x.done; }).length,
      todos: db.todos.filter(function (x) { return !x.done; }).length,
      board: db.topics.filter(function (x) { return x.stage === 'review' || x.stage === 'producing'; }).length,
      ideas: db.inspirations.length,
      reposts: MW.pendingReposts()
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
    a.download = '社媒工作台-数据-' + MW.dateStr() + '.json';
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
          /* 导入的老版本数据也要走一遍升级，否则 focus / snapshots 字段缺失会让统计失真 */
          if (typeof MW.migrate === 'function') data = MW.migrate(data);
          const db = MW.getDB();
          Object.keys(db).forEach(function (k) { delete db[k]; });
          Object.assign(db, data);
          /* 缺的集合一律补齐，避免半份数据导致视图取属性报错 */
          ['competitors', 'inspirations', 'hotspots', 'topics', 'contents', 'todos',
            'rituals', 'finance', 'assets', 'drafts'].forEach(function (k) {
            if (!Array.isArray(db[k])) db[k] = [];
          });
          if (!db.ritualLog || typeof db.ritualLog !== 'object') db.ritualLog = {};
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
    MW.confirm('这会清空当前所有数据并恢复成示例账号/选题/账单，确定继续吗？建议先「导出备份」。', function () {
      MW.resetDemo();
    }, { title: '恢复示例数据', okText: '确定恢复' });
  };

  /* ---------- 快速添加 ---------- */
  function bindQuickAdd() {
    const btn = document.getElementById('qa-btn');
    const menu = document.getElementById('qa-menu');
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
      '<div class="help-sec"><b>先选视角，再干活</b>' +
      '<p>侧边栏顶部是<b>账号视角切换器</b>。运营者是按「号」思考的：选中某个账号后，今日排期、选题看板、内容日历、AI 文案、数据复盘会自动只显示这个号的内容。想看全局就切回「全部账号」。</p></div>' +
      '<div class="help-sec"><b>每天的四件事</b>' +
      '<p>1. <b>今日作战台</b>：看今天要发几条，点「写文案」直接生成，发完点「发了」；</p>' +
      '<p>2. <b>记一次粉丝</b>：账号矩阵或今日页右上角「记粉丝」，30 秒，涨粉曲线就有了；</p>' +
      '<p>3. <b>补弹药</b>：库存低于 3 个会有预警，去灵感雷达把热点一键转成选题；</p>' +
      '<p>4. <b>补数据</b>：昨天发的今天录数据，复盘才准，也能自动标出「爆款」。</p></div>' +
      '<div class="help-sec"><b>预警会主动找你</b>' +
      '<p>断更天数、选题库存不足、已发布但没录数据，会在今日页顶部红色提示。断更阈值由账号的「周更频率」决定——更得越勤，提醒越早。</p></div>' +
      '<div class="help-sec"><b>账号矩阵是根</b>' +
      '<p><b>平台内置国内外常用站点</b>：国内（小红书 / 抖音 / 公众号 / B站 / 视频号 / 知乎 / 微博）与国外外贸社媒主阵地（YouTube / TikTok / Instagram / Facebook / X / LinkedIn / Pinterest / Threads / Reddit / Telegram / WhatsApp）分开分组；列表里没有的，选「<b>自定义平台…</b>」自建名称和标识色，筛选、账号卡、发布提醒全都认。</p>' +
      '<p>账号卡上的<b>IP 规范</b>不是档案，是内容生产的输入：定位、目标受众、内容风格、表达风格、内容聚焦、内容配比——这六项会原样进入每一次 AI 生成的上下文，改其中一个字，选题工厂、AI 文案台、AI 补排期的产出全都跟着变。</p>' +
      '<p><b>内容配比</b>（案例 / 方法 / 工具 / 复盘各占多少）决定选题工厂按什么比例造题，也决定一周排期里各类内容的数量。账号卡上会把「目标配比」和「实际产出」画在一起对比，偏差超过 15 个百分点会标橙；已发不足 5 篇时样本太少，只显示目标不对比，避免用一个假百分比误导你。</p>' +
      '<p>内容聚焦<b>一行一个方向</b>（建议 3-5 个，按重要性排序）。每条内容和每个选题都能标一个「内容方向」，账号页会统计每个方向<b>已发几篇、库存几篇、最近什么时候发过</b>——哪个方向在空转一眼看得出来。</p>' +
      '<p>点账号页里任意一个方向，会直接跳到 AI 文案台并把该方向填进主题，少打一次字。</p>' +
      '<p><b>AI 识别导入</b>：右上角「AI 识别导入」，或在编辑账号时展开顶部的识别框，把 ChatGPT / Claude / 豆包等任何 AI 帮你写好的账号资料<b>整段粘贴</b>进去，点「识别并填入」就会自动拆出平台、账号名、ID、定位、风格、内容聚焦、粉丝、更新频率等字段；<b>识别到的字段会高亮一下</b>，之后照样可以手工改。一行一条、加粗标签、Markdown 小标题、表格、口语化长句都能认；没认出来的字段会明确列出来提醒你手填，也不会覆盖你已填好的内容。</p></div>' +
      '<div class="help-sec"><b>AI 已经长在每个模块里</b>' +
      '<p>不用先去「AI 文案台」再回来——需要的地方直接有按钮：</p>' +
      '<p>· <b>今日作战台 / 内容日历</b>：点「AI 补排期」，按周更节奏自动铺开一周，先用库存选题填空档，不够的按内容聚焦现造；</p>' +
      '<p>· <b>选题看板</b>：点「AI 补选题」，按 6:2:1:1 配比一次生成 3 个进灵感池；</p>' +
      '<p>· <b>灵感雷达</b>：灵感可「AI 扩写」，热点可「AI 二创」出 3 个角度；</p>' +
      '<p>· <b>数据复盘</b>：每行有「AI 诊断」，把数字翻译成下一步动作，周报也会自动带上；页头「🤖 AI 复盘」跨内容找规律——哪类选题能打、下次怎么复制。</p>' +
      '<p>· <b>内容日历</b>：「一键智能排期」把选题库存按各账号周更频率铺满未来两周（只排库存、不现造）；「AI 补排期」补空缺（不够会按内容聚焦现造）。</p>' +
      '<p>· <b>灵感雷达</b>：「选题工厂」没货了就现造一批——「⚡ 本地公式」随时可用，「🤖 AI 生成」需先在侧边栏「AI 接口」里配置。服务商下拉里已经放好<b>国内常用</b>（智谱 / DeepSeek / 通义 / Kimi / 豆包 / 混元等，智谱 glm-4-flash 有免费额度）、<b>国外</b>（OpenAI / Claude / Gemini / Grok / OpenRouter 等）和<b>本地模型</b>（Ollama / LM Studio / vLLM，无需密钥、完全离线）——选一个就自动填好接口地址和推荐模型，密钥去对应开放平台页面一键获取。不配也能用，全部有本地降级。</p>' +
      '<p>文案台本身负责精修单篇：标题候选、钩子、大纲、标签、发布建议。当前为本地模板引擎，接真实大模型只改 js/ai-engine.js 的 MW.ai.gen。</p></div>' +
      '<div class="help-sec"><b>数据与协作</b>' +
      '<p>数据保存在本机浏览器 localStorage，不联网、不上传。侧边栏「导出备份」生成 JSON，合伙人导入即可同步；误操作可「恢复示例」。2 人团队建议每天下班前导出一次。</p></div>' +
      '<div class="help-sec"><b>发布管理：排完期到发出去，中间那段</b>' +
      '<p>日历回答「哪天发」，<b>发布管理</b>回答「今天能不能发、还差什么、发完没」。每条内容有四项<b>发布前检查</b>：文案定稿 / 封面素材 / 话题标签 / 发布时段——点一下就勾上，四项齐了才算「就绪」。</p>' +
      '<p>「封面素材」不止是手勾：点行内「绑素材」把这条内容实际用的图 / 视频 / 模板勾上，检查项上会显示已绑数量，首次绑定自动勾选该项。素材库里每个文件也会显示「N 条内容在用」，点开能看到是哪几条——<b>内容和素材是双向关联的</b>，换过的封面、复用过的图，都有据可查。</p>' +
      '<p>点「发了」时才真正推进状态：内容变已发布、关联的选题在看板上同步进「已发布」、并记下实际发布时间。没就绪会先问你一次，想发也能发；标错了可以「撤销」。</p>' +
      '<p>页面按四个桶组织：<b>今天要发</b>、<b>逾期未发</b>（拖过日期的）、<b>待补数据</b>（发完超过一天还没录数据的）、<b>未来 7 天</b>。底部「本周发布节奏」按各账号的更新频率对比实发量，谁掉队一眼看到。</p>' +
      '<p>另外每行都带该平台的发布提醒（比如小红书靠封面、公众号靠开头 100 字），行内能直接跳去「AI 文案台」写文案（标题和账号自动带过去）或去素材库找图。</p></div>' +
      '<div class="help-sec"><b>财务管理：一笔订单记一行，利润自动算</b>' +
      '<p>记的是<b>订单</b>不是流水：客户是谁、卖的什么项目、收了多少（金额）、本钱多少（成本），利润 = 金额 − 成本，自己算，不用心算。</p>' +
      '<p>「来源渠道」记客户从哪来（小红书 / 朋友圈 / 私域转介绍），「收款渠道」记钱怎么收的（微信 / 支付宝 / 银行卡）。底部两张排行直接告诉你<b>哪个渠道、哪门生意最赚钱</b>。</p>' +
      '<p>工具订阅、API 算力、投放、团队分成这些运营开销记在<b>「支出流水」页签</b>里。所以口径是：营收 − 成本 = 毛利，毛利 − 运营支出 = 净利，这才是本月到底到手多少。</p>' +
      '<p>已经有 Excel 账本的，不用手敲：点「<b>从 Excel 导入</b>」，在 Excel 里选中区域复制，粘进框里，会先给你预览再入账。有表头自动认列，没有表头就按你那张表原来的列序认；订单号重复的可以自动跳过。</p></div>' +
      '<div class="help-sec"><b>素材库：文件在你自己硬盘上</b>' +
      '<p>第一次进素材库会让你先选一个文件夹（比如 <code>D:\\社媒素材库</code>），连上后自动建好<b>图片 / 视频 / 音频 / 文章 / 模板</b> 五个子文件夹，新素材按扩展名自动归位；文件名里有日期的（<code>2026-10-13</code>、<code>20261013</code>）优先用文件名标日期，没有就用文件修改时间。</p>' +
      '<p>工作台<b>不复制、不上传、不转存</b>任何文件——它只存一份索引和你打的标签，标签写成文件夹里的 <code>.mw-assets.json</code>，跟着文件夹走，换电脑、清缓存都不丢。文件可以直接拖进页面。</p>' +
      '<p>「从清单移除」只删索引不动文件；「永久删除」才会真的删硬盘文件，且必须二次确认。</p>' +
      '<p>需要 Chrome 或 Edge 才能直接读写文件夹；Safari / Firefox 会降级成「手动登记路径」，只记位置不影响用。</p></div>' +
      '</div>';
    MW.modal({ title: '使用指南', body: body, footer: false });
  }

  /* ---------- 路由 ---------- */
  function route() {
    const hash = (location.hash || '').replace(/^#\/?/, '') || 'today';
    const v = MW.views[hash];
    if (!v) { location.hash = '#/today'; return; }

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
    /* 视图可选的进入钩子：用于异步恢复状态（如素材库重连本地文件夹） */
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

  /* ---------- 插件捕获箱：浏览器插件在公众号文章页捕获的转载候选，
     经 content.js 桥接进来，在右下角提示收录（纯 Web 环境下不会有任何消息） ---------- */
  function bindCaptureInbox() {
    window.addEventListener('message', function (ev) {
      if (ev.source !== window) return;
      var d = ev.data;
      if (!d || d.source !== 'mw-extension' || d.type !== 'mw-capture') return;
      if (!Array.isArray(d.items) || !d.items.length) return;
      var old = document.querySelector('.mw-cap-banner');
      if (old) old.remove();
      var el = document.createElement('div');
      el.className = 'mw-cap-banner';
      el.innerHTML = '<div class="mw-cap-head"><span class="dot"></span>插件捕获 · ' + d.items.length + ' 条转载待收录</div>' +
        '<div class="mw-cap-list">' + d.items.slice(0, 6).map(function (it) {
          return '<div class="mw-cap-item"><b>' + MW.esc(it.title || '') + '</b><br>来源：' + MW.esc(it.sourceName || '未识别') + '</div>';
        }).join('') + '</div>' +
        '<div class="mw-cap-ops">' +
        '<button class="btn sm primary" id="mw-cap-import">全部收录</button>' +
        '<button class="btn sm" id="mw-cap-later">稍后</button>' +
        '</div>';
      document.body.appendChild(el);
      document.getElementById('mw-cap-import').onclick = function () {
        MW.act.importCaptures(d.items);
      };
      document.getElementById('mw-cap-later').onclick = function () { el.remove(); };
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    buildSidebar();
    bindQuickAdd();
    bindDrawer();
    bindDesktopUpdater();
    bindCaptureInbox();
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
    if (!location.hash) location.hash = '#/today';
    route();
  }

  init();
})();
