/* ============================================================
   社媒工作台 · 数据层（localStorage 本地存储 + 示例数据）
   定位：外贸社媒 + 自媒体一体化工作台
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  const DB_KEY = 'mw_db_v1';

  /* ---------- 平台配置 ----------
     region 决定账号表单里下拉怎么分组：cn 国内平台 / global 国外平台（外贸社媒主阵地）。
     『自定义平台』不是表里的一项：用户自建的平台存在账号自己的
     platformName / platformColor 上（platform 键为 'custom'），
     读取一律走 MW.pfOf，别直接查表——查表会把自定义平台显示成「其他」。 */
  MW.PLATFORMS = {
    xhs:   { name: '小红书',   color: '#ff2442', region: 'cn' },
    dy:    { name: '抖音',     color: '#161823', region: 'cn' },
    gzh:   { name: '公众号',   color: '#07c160', region: 'cn' },
    bili:  { name: 'B站',      color: '#fb7299', region: 'cn' },
    sph:   { name: '视频号',   color: '#fa9d3b', region: 'cn' },
    zhihu: { name: '知乎',     color: '#0084ff', region: 'cn' },
    wb:    { name: '微博',     color: '#e6162d', region: 'cn' },
    yt:    { name: 'YouTube',  color: '#ff0000', region: 'global' },
    tt:    { name: 'TikTok',   color: '#010101', region: 'global' },
    ins:   { name: 'Instagram',color: '#e1306c', region: 'global' },
    fb:    { name: 'Facebook', color: '#1877f2', region: 'global' },
    x:     { name: 'X',        color: '#111827', region: 'global' },
    li:    { name: 'LinkedIn', color: '#0a66c2', region: 'global' },
    pin:   { name: 'Pinterest',color: '#e60023', region: 'global' },
    th:    { name: 'Threads',  color: '#000000', region: 'global' },
    rd:    { name: 'Reddit',   color: '#ff4500', region: 'global' },
    tg:    { name: 'Telegram', color: '#229ed9', region: 'global' },
    wa:    { name: 'WhatsApp', color: '#25d366', region: 'global' },
    other: { name: '其他',     color: '#6b7280', region: 'other' }
  };

  /* ---------- 发布前检查项 ----------
     排期只回答「哪天发」，发布管理要回答「能不能发」。
     这四项是博主临门一脚最常出问题的地方：文案没定稿、封面没做、
     话题标签没想、发布时间是拍脑袋填的。
     存在每条 content.checks 上，缺字段按「未检查」处理（老数据兼容）。 */
  MW.PUB_CHECKS = [
    { key: 'copy',   name: '文案定稿', icon: 'edit',   hint: '正文、标题都定了' },
    { key: 'asset',  name: '封面素材', icon: 'image',  hint: '封面 / 配图 / 视频已备好' },
    { key: 'tag',    name: '话题标签', icon: 'tag',    hint: '话题、标签、合集想好了' },
    { key: 'time',   name: '发布时段', icon: 'clock',  hint: '时间卡在这个号的人群活跃点' }
  ];

  /* 各平台发布时的额外提醒。不是硬性检查项，只是提醒——
     小红书没封面基本没流量，公众号没排版读不下去，X 超字数发不出去。 */
  MW.PLATFORM_TIPS = {
    xhs:  '封面决定 80% 的点击，标题带上数字或悬念，正文末尾放 3-5 个话题标签',
    dy:   '前 3 秒必须给钩子，封面大字不超过 12 个字，发布后 1 小时内回评论能加权',
    gzh:  '排版要留白，小标题加粗，开头 100 字决定完读率，记得开原创',
    bili: '封面 16:9 且人脸清楚，标题带关键词方便搜索，简介放时间轴',
    sph:  '视频号靠社交推荐，标题要能引发转发，时长控制在 1 分钟内',
    zhihu: '结构化回答，先给结论再展开，适当引用数据增强可信度',
    wb:   '热搜话题要带上，九宫格图比单图数据好，转发抽奖能拉互动',
    yt:   '缩略图人脸 + 大字幕，标题含搜索词，前 15 秒别放片头',
    tt:   '前 3 秒钩子，竖屏拍摄，蹭热门音乐能加权，文案简短带 1-2 个标签',
    ins:  'Reels 流量大于单图，封面统一风格，正文第一句就是钩子，别忘了位置标签',
    fb:   '群组比主页更适合获客，帖子带提问引评论，视频务必配字幕',
    x:    '英文 280 字以内，带 1-2 个 hashtag，配图能明显提升互动',
    li:   '专业向，开头给结论，段落短，结尾放一个开放式问题引讨论',
    pin:  '图用竖版 2:3，标题带搜索词，描述埋关键词，一条 Pin 能躺很久带来长尾',
    th:   '观点短平快，紧跟话题标签，适合发外链给独立站引流',
    rd:   '先看子版块规则再发，价值优先、软广慎入，标题说清读者能得到什么',
    tg:   '群发频率别太高，长文用格式化排版，置顶消息放核心链接',
    wa:   'Business 状态 24 小时过期，适合发新品快讯，深度沟通走一对一',
    other: '按平台习惯检查一遍封面、标题和话题标签'
  };

  /* ---------- 平台信息统一出口 ----------
     全站展示平台名 / 平台色只走这两个函数，不要再直接 MW.PLATFORMS[key]：
     账号级用 MW.pfOf(账号对象)，支持自定义平台；
     只有 key 的场景（草稿、热点、竞品）用 MW.pfName(key, 对象)。
     自定义平台 = 用户在账号上自建的平台（platform: 'custom'），
     名字和颜色存在账号自己的 platformName / platformColor 上。 */
  MW.pfOf = function (a) {
    if (!a) return { name: '未指定账号', color: '#9aa0b4' };
    const p = MW.PLATFORMS[a.platform];
    if (p) return { name: p.name, color: p.color };
    if (a.platform === 'custom') {
      return { name: a.platformName || '自定义平台', color: a.platformColor || '#6b7280' };
    }
    /* 脏数据兜底：老库里的 platform 键已不存在时，把键当名字显示，页面不白屏 */
    return { name: a.platform || '其他', color: '#9aa0b4' };
  };
  MW.pfName = function (key, obj) {
    if (key === 'custom') return (obj && obj.platformName) || '自定义平台';
    const p = MW.PLATFORMS[key];
    return p ? p.name : (key || '其他');
  };

  /* ---------- 内容类型（按 6:2:1:1 配比） ---------- */
  /* name/color 全站按 key 索引在用；desc 只服务于配比编辑器。
     TOPIC_TYPE_LIST 是同一份数据的数组形式（带 key），遍历用它——
     对象没有 map/forEach，直接遍历会炸。 */
  MW.TOPIC_TYPES = {
    case:   { name: '案例', color: '#4f46e5', desc: '真实项目跑通的过程，最能建立信任' },
    method: { name: '方法', color: '#0ea5a4', desc: '可复用的做法与 SOP，利于收藏和长尾' },
    tool:   { name: '工具', color: '#f59e0b', desc: '工具测评与横评，标题最容易出爆款' },
    review: { name: '复盘', color: '#e5484d', desc: '踩坑与反思，沉淀人设和老粉' }
  };
  MW.TOPIC_TYPE_LIST = Object.keys(MW.TOPIC_TYPES).map(function (k) {
    return Object.assign({ key: k }, MW.TOPIC_TYPES[k]);
  });

  /* ---------- 选题看板阶段 ---------- */
  MW.STAGES = [
    { id: 'idea',      name: '灵感池',   color: '#f59e0b' },
    { id: 'review',    name: '待评审',   color: '#2f6fed' },
    { id: 'scheduled', name: '已排期',   color: '#0ea5a4' },
    { id: 'producing', name: '制作中',   color: '#8b5cf6' },
    { id: 'published', name: '已发布',   color: '#18a058' },
    { id: 'retro',     name: '已复盘',   color: '#e5484d' }
  ];

  /* ---------- 待办工作状态 ----------
     一条待办在博主的日常里基本就是「某条内容的某个制作节点」，
     所以除了「做没做完」，还得看得见它卡在哪一步。
     顺序就是内容生产的天然动线：待办 → 待写 → 写稿中 → 制作中 → 待发布。 */
  MW.TODO_STATUSES = [
    { key: 'todo',  label: '待办',   tone: 'gray'  },
    { key: 'write', label: '待写',   tone: 'green' },
    { key: 'draft', label: '写稿中', tone: 'amber' },
    { key: 'edit',  label: '制作中', tone: 'amber' },
    { key: 'post',  label: '待发布', tone: 'blue'  }
  ];
  /* 老数据没有 status 字段 → 一律回落「待办」，不谎报进度 */
  MW.todoStatus = function (key) {
    return MW.TODO_STATUSES.find(function (s) { return s.key === key; }) || MW.TODO_STATUSES[0];
  };

  /* ---------- 2026 营销节点（日历自动标注） ---------- */
  MW.MARKETING = [
    { date: '2026-01-01', name: '元旦', cat: '传统节日' },
    { date: '2026-01-20', end: '2026-02-16', name: '年货节', cat: '电商大促' },
    { date: '2026-02-17', end: '2026-02-23', name: '春节', cat: '传统节日' },
    { date: '2026-03-08', name: '女神节', cat: '营销节点' },
    { date: '2026-03-15', name: '315', cat: '营销节点' },
    { date: '2026-04-01', end: '2026-04-10', name: '春上新', cat: '电商大促' },
    { date: '2026-05-01', end: '2026-05-05', name: '五一', cat: '传统节日' },
    { date: '2026-05-20', name: '520', cat: '营销节点' },
    { date: '2026-06-01', end: '2026-06-20', name: '618', cat: '电商大促' },
    { date: '2026-06-19', name: '端午', cat: '传统节日' },
    { date: '2026-06-15', end: '2026-06-30', name: '毕业季', cat: '营销节点' },
    { date: '2026-08-08', name: '88会员节', cat: '电商大促' },
    { date: '2026-08-19', name: '七夕', cat: '传统节日' },
    { date: '2026-09-01', name: '开学季', cat: '营销节点' },
    { date: '2026-09-25', name: '中秋', cat: '传统节日' },
    { date: '2026-10-01', end: '2026-10-08', name: '国庆', cat: '传统节日' },
    { date: '2026-10-31', name: '万圣节', cat: '跨境电商' },
    { date: '2026-11-01', end: '2026-11-11', name: '双11', cat: '电商大促' },
    { date: '2026-11-26', name: '感恩节', cat: '跨境电商' },
    { date: '2026-11-27', name: '黑五', cat: '跨境电商' },
    { date: '2026-11-30', name: '网一', cat: '跨境电商' },
    { date: '2026-12-12', name: '双12', cat: '电商大促' },
    { date: '2026-12-25', name: '圣诞', cat: '跨境电商' },
    { date: '2026-12-31', name: '跨年', cat: '营销节点' }
  ];

  /* 新增内容/选题时自动归属「内容聚焦」方向：
     没有显式指定时，用标题去匹配该账号的方向列表，猜不到就留空（留 \| 表示未归类） */
  MW.guessFocus = function (accId, title, explicit) {
    if (explicit !== undefined && explicit !== null && explicit !== '') return explicit;
    const acc = MW.accOf(accId);
    const fs = (acc && acc.focus) || [];
    const t = String(title || '');
    let best = '', bestLen = 0;
    /* 完整包含最可信，按词长计分；模糊命中要求更长的证据，
       否则「副业实验」会被「中小企业实测报告」里的「业实」这种跨词巧合骗到 */
    fs.forEach(function (f) {
      if (!f) return;
      let score = 0;
      if (f === t || t.indexOf(f) >= 0) score = f.length;
      else {
        const r = MW.lcsLen(f, t);
        if (/[\u4e00-\u9fa5]/.test(r.seg) ? r.len >= 3 : r.len >= 4) score = r.len;
      }
      if (score > bestLen) { bestLen = score; best = f; }
    });
    return best || '';
  };

  /* 一条内容该归给哪个账号（热点二创 / 灵感落地时用）：
     优先级 = 当前视角 > 内容聚焦命中 > 同平台 > 第一个账号。
     这样「3D 打印」的热点会落到 3D Printer Pro，而不是永远砸在主号上 */
  MW.pickAcc = function (text, platformHint) {
    const db = MW.getDB();
    if (!db.accounts.length) return '';
    const cur = MW.curAcc();
    if (cur !== 'all' && db.accounts.some(function (a) { return a.id === cur; })) return cur;

    const t = String(text || '');
    let bestId = '', bestLen = 0;
    /* 用「方向词与文本的公共子串长度」当匹配度：命中越长说明越贴这个号的定位，
       避免「AI」这种短通用词把热点抢走给边缘小号 */
    db.accounts.forEach(function (a) {
      if (a.status !== 'active') return;
      let m = 0;
      (a.focus || []).forEach(function (f) {
        if (!f) return;
        /* 与 guessFocus 同一套计分：完整包含按词长，模糊命中要求够长的证据 */
        if (f === t || t.indexOf(f) >= 0) m = Math.max(m, f.length);
        else {
          const r = MW.lcsLen(f, t);
          if (/[\u4e00-\u9fa5]/.test(r.seg) ? r.len >= 3 : r.len >= 4) m = Math.max(m, r.len);
        }
      });
      if (m > bestLen) { bestLen = m; bestId = a.id; }
    });
    if (bestId) return bestId;

    if (platformHint) {
      const same = db.accounts.find(function (a) { return a.platform === platformHint; });
      if (same) return same.id;
    }
    return db.accounts[0].id;
  };

  /* ---------- 日期工具 ---------- */
  MW.uid = function () {
    return 'id' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  };
  /* 标签解析：逗号 / 中文逗号 / 换行 / 顿号 / 分号 都算分隔。
     只认逗号是不够的——用户在一个输入框里习惯直接敲回车分行，
     那样会被黏成「耗材\n成本」一条标签。全站统一走这里。 */
  MW.parseTags = function (s) {
    if (Array.isArray(s)) return s.map(function (x) { return String(x).trim(); }).filter(Boolean);
    return String(s == null ? '' : s)
      .split(/[,，\n\r、;；]+/)
      .map(function (x) { return x.trim(); })
      .filter(Boolean);
  };
  MW.dateStr = function (d) {
    d = d || new Date();
    const p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  MW.parseDate = function (s) { const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  MW.addDays = function (s, n) { const d = MW.parseDate(s); d.setDate(d.getDate() + n); return MW.dateStr(d); };
  MW.weekdayCN = function (s) { return '周' + '日一二三四五六'[MW.parseDate(s).getDay()]; };
  MW.monthStr = function (s) { return s.slice(0, 7); };
  MW.monthLabel = function (m) { return m.slice(0, 4) + '年' + parseInt(m.slice(5, 7), 10) + '月'; };

  /* ---------- 存取 ---------- */
  let db = null;
  MW.getDB = function () { return db; };
  MW.save = function () {
    try {
      /* 存一份「这份数据最后改动的时间戳」。用于多标签页互不覆盖：
         另一个标签页可能已经把库更新过了，这时本页内存里的就是旧数据，
         卸载前不该再写回去把新数据冲掉。 */
      db.__t = Date.now();
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      /* ---------- 浏览器插件数据桥接 ----------
         插件的后台提醒读不到网页的 localStorage，save 之后顺路广播一份
         提醒必需字段：iframe 场景（侧边栏）由父页面收，标签页场景由注入的
         content script 收。不得把 AI 密钥、X 经历或草稿随整库送进插件。
         非插件环境下没有监听方，这条消息无人接收，无任何副作用。 */
      try {
        const syncDb = {
          contents: (db.contents || []).map(function (c) {
            return { id: c.id, title: c.title, date: c.date, time: c.time, status: c.status, pf: c.platform };
          }),
          todos: (db.todos || []).map(function (t) {
            return { id: t.id, title: t.title, date: t.date, time: t.time, done: t.done };
          }),
          sources: (db.sources || []).map(function (s) { return { id: s.id, name: s.name }; })
        };
        const syncMsg = { source: 'mw-workbench', type: 'mw-sync', db: syncDb };
        if (window.parent && window.parent !== window) window.parent.postMessage(syncMsg, '*');
        window.postMessage(syncMsg, '*');
      } catch (e) { /* 桥接失败不影响主流程 */ }
      return true;
    } catch (e) {
      console.warn('保存失败', e);
      if (typeof MW.toast === 'function') MW.toast('本地保存失败，请导出备份并检查存储空间', 'error');
      return false;
    }
  };

  /* 本页内存里的数据是否已经被别处替换/更新过。
     beforeunload 用它决定「还能不能写」——true 表示不能，别覆盖别人。
     判据按可靠度从高到低：
       1. 内容不同但本页没改过任何东西 → 磁盘被别人换了，本页内存是旧的，必须让位；
       2. 内容相同 → 随便写都一样，直接放行；
       3. 内容不同且本页动过 → 按时间戳判断谁更新（>1 天的差当时钟漂移处理）。
     纯看时间戳不够：老备份没有 __t，会被误判成本页最新而把新数据冲掉。 */
  MW.isStale = function () {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return false;
      const disk = JSON.parse(raw);
      const strip = function (o) {
        const c = Object.assign({}, o || {});
        delete c.__t;
        return JSON.stringify(c);
      };
      if (strip(disk) === strip(db)) return false;/* 内容一样，写不写无所谓 */

      const diskT = +(disk && disk.__t) || 0;
      const memT = +(db && db.__t) || 0;
      /* 磁盘完全没有 __t（老备份 / 外部直接塞进去的）→ 本页内存不算最新 */
      if (!diskT) return true;
      const gap = diskT - memT;
      if (gap <= 0) return false;
      /* 差值过大（>1 天）多半是时钟被调过或手改文件，不能永久锁死写入 */
      return gap < 86400000;
    } catch (e) { return false; }
  };
  MW.resetDemo = function () {
    db = seed();
    MW.save();
    MW.render();
    MW.toast('已恢复示例数据');
  };
  /* 最长公共子串：用于「这段文字跟这个方向像不像」的模糊判断 */
  MW.lcsLen = function (a, b) {
    a = String(a || ''); b = String(b || '');
    if (!a || !b) return { len: 0, seg: '' };
    let prev = new Array(b.length + 1).fill(0);
    let best = 0, seg = '';
    for (let i = 1; i <= a.length; i++) {
      const cur = new Array(b.length + 1).fill(0);
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          cur[j] = prev[j - 1] + 1;
          if (cur[j] > best) { best = cur[j]; seg = a.slice(i - cur[j], i); }
        }
      }
      prev = cur;
    }
    return { len: best, seg: seg };
  };

  /* 判断一条内容与某个聚焦方向是否相关（含模糊匹配，用于回填历史数据） */
  MW.focusHit = function (focus, title) {
    const a = String(focus || ''), b = String(title || '');
    if (!a || !b) return false;
    if (a === b || b.indexOf(a) >= 0) return true;
    const r = MW.lcsLen(a, b);
    if (!r.len) return false;
    return /[\u4e00-\u9fa5]/.test(r.seg) ? r.len >= 2 : r.len >= 3;
  };

  /* 老数据升级 v2→v3：给已有内容/选题回填「所属方向」，v1 的先补快照 */
  function migrate(d) {
    if (!d || !d.version || d.version < 2) {
      (d.accounts || []).forEach(function (a) {
        if (!a.cadence) a.cadence = 3;
        if (!a.snapshots || !a.snapshots.length) {
          a.snapshots = [
            { date: a.createdAt || MW.dateStr(), followers: Math.round((+a.followers || 0) * 0.75) },
            { date: MW.dateStr(), followers: +a.followers || 0 }
          ];
        }
      });
      d.version = 2;
    }
    if (!d.version || d.version < 3) {
      const focusOf = function (accId) {
        const a = (d.accounts || []).find(function (x) { return x.id === accId; });
        return (a && a.focus) || [];
      };
      const guess = function (item) {
        if (item.focus !== undefined) return;
        const fs = focusOf(item.accountId);
        let hit = '';
        fs.forEach(function (f) { if (!hit && MW.focusHit(f, item.title)) hit = f; });
        item.focus = hit;
      };
      (d.contents || []).forEach(guess);
      (d.topics || []).forEach(guess);
      d.version = 3;
    }
    /* v4：仅占位版本号（原经历库模块已移除，保留版本位避免老库反复跑迁移） */
    if (!d.version || d.version < 4) d.version = 4;
    /* v5：AI 接口配置（OpenAI 兼容 chat/completions），老库补空配置 */
    if (!d.version || d.version < 5) {
      d.settings = d.settings || {};
      d.settings.ai = d.settings.ai || { baseUrl: '', apiKey: '', model: '', provider: '' };
      d.version = 5;
    }
    /* v6：素材库改本地文件夹模式。这里只存「索引 + 标注」，
       文件内容一律不进来（localStorage 只有约 5MB，存不下也存不该）。
       文件夹句柄和缩略图 Blob 在 IndexedDB 里，见 js/assets-store.js。 */
    if (!d.version || d.version < 6) {
      d.settings = d.settings || {};
      d.settings.ai = d.settings.ai || { baseUrl: '', apiKey: '', model: '', provider: '' };
      d.settings.assets = d.settings.assets || {
        onboarded: false, list: [], meta: {}, autoFolder: true, pending: false, lastSync: 0
      };
      /* 老版本的 assets 是「素材笔记」，字段是 name/type/tags/accountId/note，
         没有 fileRel，属于笔记而不是文件，不搬进文件索引 */
      d.version = 6;
    }
    /* v7：转载来源库——关注外部账号，记录对方更新，一键转成带署名信息的选题 */
    if (!d.version || d.version < 7) {
      d.sources = d.sources || [];
      d.version = 7;
    }
    /* v8：关于与联系——settings.about 存联系方式（随安装包分发/备份），
       settings.license 存授权码（本地校验，不锁功能，只做正版标识） */
    if (!d.version || d.version < 8) {
      d.settings = d.settings || {};
      d.settings.about = d.settings.about || { contactLabel: '', contactValue: '', contactNote: '' };
      if (!d.settings.license) d.settings.license = null;
      d.version = 8;
    }
    /* v10：分发卖家信息——本机没有联系方式时，把 js/seller-info.js 里的
       卖家联系方式写进「关于与联系」（已填的不覆盖，只补一次） */
    if (!d.version || d.version < 10) {
      d.settings = d.settings || {};
      if (!d.settings.about || !d.settings.about.contactValue) {
        d.settings.about = sellerAbout();
      }
      d.version = 10;
    }
    return d;
  }
  /* 给外部（导入 / 手工修复）用 */
  MW.migrate = migrate;

  MW.load = function () {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        db = migrate(JSON.parse(raw));
        /* 迁移后校验：老库可能缺表，缺了就补，避免视图取属性时炸。
           这里只补空数组，不动已有数据。 */
        ['competitors', 'inspirations', 'hotspots', 'topics', 'contents', 'todos',
          'rituals', 'finance', 'assets', 'drafts', 'sources'].forEach(function (k) {
          if (!Array.isArray(db[k])) db[k] = [];
        });
        if (!db.ritualLog || typeof db.ritualLog !== 'object') db.ritualLog = {};
        if (!db.settings || typeof db.settings !== 'object') db.settings = {};
        if (!db.settings.ai) db.settings.ai = { baseUrl: '', apiKey: '', model: '', provider: '' };
        if (!db.xWorkbench || typeof db.xWorkbench !== 'object') db.xWorkbench = { accountId: '', experiences: [], drafts: [] };
        if (!Array.isArray(db.xWorkbench.experiences)) db.xWorkbench.experiences = [];
        if (!Array.isArray(db.xWorkbench.drafts)) db.xWorkbench.drafts = [];
        if (!db.settings.assets) {
          db.settings.assets = { onboarded: false, list: [], meta: {}, autoFolder: true, pending: false, lastSync: 0 };
        }
        /* 盖上「本次载入时间」。没有它的话，外部替换过整个库（比如刚导入备份）
           之后本页内存会被判成最新，卸载时反把刚导入的数据冲掉。 */
        db.__t = Date.now();
        MW.save();
        return;
      }
    } catch (e) {
      /* 读不出来就退回示例数据，但必须留个痕迹——
         静默 catch 会让人以为数据还在，实际已经被覆盖了。 */
      console.error('读取本机数据失败，已回落到示例数据：', e);
      try {
        const raw2 = localStorage.getItem(DB_KEY);
        if (raw2) console.error('原始数据已保留在 localStorage 里，可手动导出找回：', raw2.slice(0, 200) + (raw2.length > 200 ? '…' : ''));
      } catch (e2) { /* 连原始数据都读不到就算了 */ }
    }
    db = seed();
    MW.save();
  };

  /* ---------- 营销节点查询 ---------- */
  MW.nodesOn = function (dateStr) {
    return MW.MARKETING.filter(function (n) {
      if (n.end) return n.date <= dateStr && dateStr <= n.end;
      return n.date === dateStr;
    });
  };

  /* ============================================================
     当前账号视角：运营者是按「账号」思考的，不是按模块
     ============================================================ */
  const ACC_KEY = 'mw_cur_acc_v1';
  let curAcc = 'all';
  MW.curAcc = function () {
    if (curAcc !== 'all' && !MW.getDB().accounts.some(function (a) { return a.id === curAcc; })) curAcc = 'all';
    return curAcc;
  };
  MW.setCurAcc = function (id) {
    curAcc = (id && id !== 'all') ? id : 'all';
    try { localStorage.setItem(ACC_KEY, curAcc); } catch (e) { /* 忽略 */ }
    MW.render();
  };
  MW.loadAcc = function () {
    try { const v = localStorage.getItem(ACC_KEY); if (v) curAcc = v; } catch (e) { /* 忽略 */ }
  };
  /* 当前视角下是否可见 */
  MW.inAcc = function (it) { return MW.curAcc() === 'all' || it.accountId === MW.curAcc(); };
  MW.accOf = function (id) { return MW.getDB().accounts.find(function (a) { return a.id === id; }); };
  MW.accName = function (id) { const a = MW.accOf(id); return a ? a.name : ''; };

  /* ============================================================
     发布管理：把「排期 → 已发布」中间那段执行过程做实
     ------------------------------------------------------------
     数据不另起炉灶，就长在 contents 上（checks / url / publishedAt），
     这样日历排的期、这里执行的动作、复盘看的数据是同一批记录。
     ============================================================ */

  /* 一条内容的发布就绪度：检查项勾了几项 / 共几项。
     老数据没有 checks 字段，按全未勾选处理——不能因为字段缺失就当成已就绪。 */
  MW.checksOf = function (c) {
    const ck = (c && c.checks) || {};
    const all = MW.PUB_CHECKS;
    const done = all.filter(function (x) { return !!ck[x.key]; });
    return { done: done.length, total: all.length, all: all, map: ck, ready: done.length === all.length };
  };

  /* 今天该发 / 逾期未发 / 待回填，三个发布管理最关心的桶 */
  MW.pubBuckets = function (accId) {
    const db = MW.getDB();
    const t = MW.dateStr();
    const inView = function (c) { return !accId || accId === 'all' || c.accountId === accId; };

    const today = db.contents.filter(function (c) {
      return c.status === 'scheduled' && c.date === t && inView(c);
    }).sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); });

    const overdue = db.contents.filter(function (c) {
      return c.status === 'scheduled' && c.date < t && inView(c);
    }).sort(function (a, b) { return a.date.localeCompare(b.date); });

    /* 未来 7 天（不含今天），按日期分组 */
    const upcoming = [];
    for (let i = 1; i <= 7; i++) {
      const ds = MW.addDays(t, i);
      const list = db.contents.filter(function (c) {
        return c.status === 'scheduled' && c.date === ds && inView(c);
      }).sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); });
      if (list.length) upcoming.push({ date: ds, list: list });
    }

    /* 已发布但没数据的：发完 1 天以上还没回填，数据就凉了 */
    const needMetrics = db.contents.filter(function (c) {
      if (c.status !== 'published' || !inView(c)) return false;
      if (c.metrics && +c.metrics.views > 0) return false;
      return MW.daysBetween(c.date, t) >= 1;
    }).sort(function (a, b) { return a.date.localeCompare(b.date); });

    return { today: today, overdue: overdue, upcoming: upcoming, needMetrics: needMetrics };
  };

  /* 发布节奏：每个账号本周该发多少、实发多少。
     cadence 在账号里是「每周几更」，乘 7 会和真实意图对不上，
     所以直接拿 cadence 当周目标。 */
  MW.cadenceOf = function (acc) {
    const db = MW.getDB();
    const t = MW.dateStr();
    const start = MW.addDays(t, -6);
    const goal = Math.max(1, +acc.cadence || 1) * 1;   /* cadence = 每周篇数 */
    const done = db.contents.filter(function (c) {
      return c.accountId === acc.id && c.status === 'published' &&
        c.date >= start && c.date <= t;
    }).length;
    const planned = db.contents.filter(function (c) {
      return c.accountId === acc.id && c.status === 'scheduled' &&
        c.date >= start && c.date <= MW.addDays(t, 7);
    }).length;
    return { goal: goal, done: done, planned: planned, pct: goal ? Math.min(100, Math.round(done / goal * 100)) : 0 };
  };

  /* 素材库里这个号能用多少个素材——用于「封面素材」检查项的智能提示。
     拿不到（没连文件夹）就返回 -1，调用方据此不显示数字，别谎报 0。 */
  MW.assetCountFor = function (accId) {
    const db = MW.getDB();
    const s = (db.settings && db.settings.assets) || {};
    const list = s.list || [];
    if (!list.length) return 0;
    /* 标注过归属该账号的优先；没标注过就按「通用素材」算可用 */
    const meta = s.meta || {};
    const mine = list.filter(function (f) {
      const m = meta[f.rel] || {};
      return m.accountId === accId;
    }).length;
    const general = list.filter(function (f) {
      const m = meta[f.rel] || {};
      return !m.accountId;
    }).length;
    return mine + general;
  };

  /* ============================================================
     素材 ↔ 内容 双向关联
     ------------------------------------------------------------
     以前素材和内容之间只有账号级统计（「这个号有 N 个素材」），
     回答不了「这条内容到底用了哪几张图」「这张图还被谁用过」。
     关联就长在 contents.assetIds 上（素材 key 数组），不新建表：
       - 文件夹文件：用相对路径当 key（图片/封面.png）
       - 登记/笔记条目：用 db.assets 的 id（as1）
     老数据没有这个字段 → 空数组，天然兼容。
     ============================================================ */
  MW.assetIdsOf = function (c) {
    return (c && c.assetIds) || [];
  };

  /* key → 统一素材描述。文件夹文件优先走相对路径，db.assets 走 id。 */
  MW.assetByKey = function (key) {
    const db = MW.getDB();
    const inDb = (db.assets || []).find(function (a) { return a.id === key; });
    if (inDb) return { key: key, name: inDb.name, type: inDb.type, src: 'note' };
    const s = (db.settings && db.settings.assets) || {};
    const f = (s.list || []).find(function (x) { return x.rel === key; });
    if (f) return {
      key: key, name: f.name || f.rel, rel: f.rel, src: 'folder',
      kind: f.kind || (MW.assets && MW.assets.kindOf ? MW.assets.kindOf(f.name, f.mime) : 'other')
    };
    return null;
  };

  MW.assetLabel = function (key) {
    const a = MW.assetByKey(key);
    return a ? a.name : key;
  };

  /* 反查：这个素材被哪些内容用了（发布页绑定、素材页展示共用） */
  MW.contentUses = function (key) {
    const db = MW.getDB();
    return db.contents.filter(function (c) { return MW.assetIdsOf(c).indexOf(key) >= 0; });
  };

  /* ============================================================
     记账（订单式）
     ------------------------------------------------------------
     一笔订单只记一行：收了多少（amount）、本钱多少（cost）、赚了多少（amount-cost）。
     做生意的人本来就是这么算账的——「收入一条、支出一条」那种流水账
     永远看不出单笔订单赚不赚，也没有客户的概念。
     真正的运营支出（工具订阅、投放、分成）仍单独记一行（type=expense）。
     ============================================================ */
  MW.FIN_PROJECTS = ['品牌商单', '带货佣金', 'AI绘图·产品图', 'AI模特', 'AI建模·3D打印', '账号服务',
    'AI会员充值', '内容代运营', '网站·系统开发', '咨询陪跑', '课程资料', '其他收入'];
  MW.FIN_EXPENSE_CATS = ['工具订阅', 'API·算力', '素材版权', '设备', '投放', '团队分成', '物流·耗材', '其他支出'];
  MW.FIN_SOURCES = ['小红书', '公众号', '朋友圈', '私域转介绍', '朋友介绍', 'X / Twitter', '外贸社媒', '其他'];
  MW.FIN_CHANNELS = ['微信', '支付宝', '银行卡', '对公转账', 'PayPal', '现金', '其他'];

  /* 一笔订单的成本。老数据没有 cost 字段 → 当作 0，
     利润就等于金额，不会凭空算出一个负数。 */
  MW.orderCost = function (f) { return +((f && f.cost) || 0); };

  /* 一笔订单的利润 = 金额 − 成本。支出流水不适用，返回 0。 */
  MW.orderProfit = function (f) {
    if (!f || f.type !== 'income') return 0;
    return (+f.amount || 0) - MW.orderCost(f);
  };

  /* 汇总一组账目。net = 毛利 − 运营支出，这才是「这个月到底到手多少」。
     毛利率分母是营收，营收为 0 时给 0，不返回 NaN。 */
  MW.finSummary = function (rows) {
    const s = { revenue: 0, cost: 0, gross: 0, expense: 0, net: 0, orders: 0, expCount: 0, margin: 0 };
    (rows || []).forEach(function (f) {
      if (f && f.type === 'income') {
        s.revenue += +f.amount || 0;
        s.cost += MW.orderCost(f);
        s.orders++;
      } else if (f) {
        s.expense += +f.amount || 0;
        s.expCount++;
      }
    });
    s.gross = s.revenue - s.cost;
    s.net = s.gross - s.expense;
    s.margin = s.revenue ? s.gross / s.revenue * 100 : 0;
    return s;
  };

  /* ============================================================
     运营健康度：涨粉 / 断更 / 库存 / 待补数据
     ============================================================ */
  MW.daysBetween = function (from, to) {
    return Math.round((MW.parseDate(to) - MW.parseDate(from)) / 86400000);
  };

  /* 涨粉：对比 days 天前的快照 */
  MW.growth = function (acc, days) {
    const sn = (acc.snapshots || []).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    const now = +acc.followers || 0;
    if (!sn.length) return { delta: 0, pct: 0, from: now };
    const target = MW.addDays(MW.dateStr(), -days);
    let base = sn[0];
    sn.forEach(function (s) { if (s.date <= target) base = s; });
    const from = +base.followers || 0;
    const delta = now - from;
    return { delta: delta, pct: from ? delta / from * 100 : 0, from: from };
  };

  /* 粉丝走势序列（补齐当前值） */
  MW.snapValues = function (acc, n) {
    const sn = (acc.snapshots || []).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    const vs = sn.map(function (s) { return +s.followers || 0; });
    const last = sn.length ? sn[sn.length - 1].date : '';
    if (last !== MW.dateStr()) vs.push(+acc.followers || 0);
    return n ? vs.slice(-n) : vs;
  };
  MW.snapLabels = function (acc, n) {
    const sn = (acc.snapshots || []).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    const ls = sn.map(function (s) { return s.date.slice(5).replace('-', '/'); });
    const last = sn.length ? sn[sn.length - 1].date : '';
    if (last !== MW.dateStr()) ls.push('今天');
    return n ? ls.slice(-n) : ls;
  };

  /* 记录一次粉丝快照（同一天覆盖） */
  MW.pushSnapshot = function (accId, followers) {
    const db = MW.getDB();
    const a = db.accounts.find(function (x) { return x.id === accId; });
    if (!a) return;
    a.snapshots = a.snapshots || [];
    a.followers = +followers || 0;
    const t = MW.dateStr();
    const hit = a.snapshots.find(function (s) { return s.date === t; });
    if (hit) hit.followers = +followers || 0;
    else a.snapshots.push({ date: t, followers: +followers || 0 });
  };

  /* 该账号最后一次发布日期 */
  MW.lastPublish = function (accId) {
    const db = MW.getDB();
    const t = MW.dateStr();
    let last = '';
    db.contents.forEach(function (c) {
      if (c.accountId !== accId || c.status !== 'published') return;
      if (c.date <= t && (!last || c.date > last)) last = c.date;
    });
    return last;
  };

  /* 断更天数（从未发布则按创建日算） */
  MW.silentDays = function (acc) {
    const lp = MW.lastPublish(acc.id);
    const base = lp || acc.createdAt || MW.dateStr();
    return MW.daysBetween(base, MW.dateStr());
  };

  /* 弹药库存：还没发出去的选题 */
  MW.stockCount = function (accId) {
    return MW.getDB().topics.filter(function (x) {
      if (accId !== 'all' && x.accountId !== accId) return false;
      return x.stage !== 'published' && x.stage !== 'retro';
    }).length;
  };

  /* ============================================================
     IP 规范：账号信息不是档案，是内容生产的输入
     audience 目标受众 / mix 内容配比 / tone 表达风格
     这三项和 positioning/style/focus 一起，构成喂给 AI 的完整上下文。
     ============================================================ */
  MW.DEFAULT_MIX = { case: 60, method: 20, tool: 10, review: 10 };

  /* 读账号配比。老账号没有 mix 字段 → 回落默认 6:2:1:1，
     并补齐缺的类型（用户手改过数据结构也不炸）。 */
  MW.accMix = function (acc) {
    const out = {};
    const m = (acc && acc.mix) || {};
    MW.TOPIC_TYPE_LIST.forEach(function (t) {
      const v = +m[t.key];
      out[t.key] = isFinite(v) && v >= 0 ? Math.round(v) : MW.DEFAULT_MIX[t.key];
    });
    return out;
  };

  /* 配比合计。给表单做「必须 100%」的提示 */
  MW.mixTotal = function (mix) {
    return MW.TOPIC_TYPE_LIST.reduce(function (s, t) { return s + (+mix[t.key] || 0); }, 0);
  };

  /* 某个账号实际发出来的内容类型分布。
     让「我说要做 60% 案例」和「实际发了多少案例」能对上——
     对不上就是配比失真，比空着字段更有信息量。 */
  MW.mixStat = function (accId) {
    const db = MW.getDB();
    const st = {};
    MW.TOPIC_TYPE_LIST.forEach(function (t) { st[t.key] = 0; });
    let total = 0;
    db.contents.forEach(function (c) {
      if (c.accountId !== accId || c.status !== 'published') return;
      /* 老数据的 type 可能是空或野值 → 归入案例，别让计数落到 undefined 上 */
      const k = MW.TOPIC_TYPES[c.type] ? c.type : 'case';
      st[k]++; total++;
    });
    MW.TOPIC_TYPE_LIST.forEach(function (t) {
      st[t.key + '_pct'] = total ? Math.round(st[t.key] / total * 100) : 0;
    });
    st.total = total;
    return st;
  };

  /* 已发布但没录数据的内容 */
  MW.pendingMetrics = function (accId) {
    return MW.getDB().contents.filter(function (c) {
      if (c.status !== 'published' || c.metrics) return false;
      if (accId && accId !== 'all' && c.accountId !== accId) return false;
      return MW.daysBetween(c.date, MW.dateStr()) >= 1;
    });
  };

  /* 预警清单：博主打开工作台应该先看到的东西 */
  /* 转载来源库里还没处理的更新条数（侧栏角标 + 今日预警共用） */
  MW.pendingReposts = function () {
    const db = MW.getDB();
    let n = 0;
    (db.sources || []).forEach(function (s) {
      (s.posts || []).forEach(function (p) { if (p.status === 'new') n++; });
    });
    return n;
  };

  MW.alerts = function () {
    const db = MW.getDB();
    const out = [];
    const lowStock = [];
    const neverPub = [];
    db.accounts.forEach(function (a) {
      if (a.status !== 'active') return;
      const lp = MW.lastPublish(a.id);
      const silent = MW.silentDays(a);
      const limit = (a.cadence ? Math.ceil(7 / a.cadence) : 3) + 2;
      if (!lp) { neverPub.push(a); return; }   /* 新号合并成一条，不叠加库存警告 */
      if (silent >= limit) {
        out.push({ level: 'danger', icon: 'flame', acc: a.id,
          text: a.name + ' 已 ' + silent + ' 天没更新', action: '去排期', goto: '#/calendar' });
        return;   /* 一个账号只报最严重的那条，别刷屏 */
      }
      const st = MW.stockCount(a.id);
      if (st < 3) lowStock.push(a.name + ' ' + st + ' 个');
    });
    if (neverPub.length) {
      out.unshift({ level: 'warn', icon: 'flag', acc: neverPub.length === 1 ? neverPub[0].id : '',
        accs: neverPub.map(function (a) { return a.id; }),
        text: neverPub.map(function (a) { return a.name; }).join('、') + ' 还没发过内容，先发一条破个 0',
        action: '去排期', goto: '#/calendar' });
    }
    if (lowStock.length) {
      out.push({ level: 'warn', icon: 'bulb', acc: '',
        text: lowStock.join('、') + ' 选题库存不足（不到 3 个）', action: '补选题', goto: '#/ideas' });
    }
    const rp = MW.pendingReposts();
    if (rp) {
      out.push({ level: 'info', icon: 'paste', acc: '',
        text: rp + ' 条来源账号更新待处理，越早转载越及时', action: '去处理', goto: '#/reposts' });
    }
    const pm = MW.pendingMetrics(MW.curAcc());
    if (pm.length) {
      out.push({ level: 'info', icon: 'chart', acc: pm[0].accountId,
        text: pm.length + ' 条已发布内容还没录数据，复盘会失真', action: '去补录', goto: '#/review' });
    }
    return out;
  };

  /* ============================================================
     行动提醒：把「逾期的 / 今日待办 / 未来 3 天预计的」摊成一张清单
     bucket: overdue 已逾期 · today 今日 · upcoming 未来 3 天
     每条都带可执行操作，点完就消失，不做看了也没用的提醒
     ============================================================ */
  MW.reminders = function () {
    const db = MW.getDB();
    const t = MW.dateStr();
    const cur = MW.curAcc();
    const now = new Date();
    const nowHM = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
    const out = [];
    /* 账号视角过滤：待办这类不挂账号的事，任何视角都显示 */
    function inView(accId) { return cur === 'all' || !accId || accId === cur; }
    function stageOf(id) {
      const s = MW.STAGES.find(function (x) { return x.id === id; });
      return s || { id: id, name: id || '未设置', color: '#9aa0b4' };
    }
    function accColor(accId) {
      const a = MW.accOf(accId);
      return a ? MW.pfOf(a).color : '#9aa0b4';
    }
    function accName(accId) {
      const a = MW.accOf(accId);
      return a ? a.name : '未指定账号';
    }
    /* 同类拖账太多时只列最老的几条，其余折叠成一条，避免提醒区自己变成噪音 */
    const CAP = 3;
    function more(n, text, goto) {
      return {
        bucket: 'overdue', level: 'info', icon: 'right', color: '#9aa0b4',
        title: '还有 ' + n + ' 条' + text, who: '',
        sub: '建议先处理上方条目，其余可前往对应页面批量操作',
        ops: [{ label: '去处理', on: 'MW.goto(\'' + goto + '\')' }]
      };
    }

    /* ---------- ① 逾期：排期日过了还没发 ---------- */
    const lateContents = db.contents.filter(function (c) {
      return c.status === 'scheduled' && c.date < t && inView(c.accountId);
    }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    lateContents.slice(0, CAP).forEach(function (c) {
      const d = MW.daysBetween(c.date, t);
      out.push({
        bucket: 'overdue', level: 'danger', icon: 'calendar', color: accColor(c.accountId),
        title: c.title, who: accName(c.accountId),
        sub: '计划 ' + c.date.slice(5) + (c.time ? ' ' + c.time : '') + ' 发布 · 已逾期 ' + d + ' 天' + (d >= 3 ? '，建议尽快补发或调整排期' : ''),
        ops: [
          { label: '标记发布', on: 'MW.act.markPublished(\'' + c.id + '\')', primary: true },
          { label: '调整至今日', on: 'MW.act.contentToToday(\'' + c.id + '\')' },
          { label: '调整排期', on: 'MW.act.openContentModal(\'' + c.id + '\')' }
        ]
      });
    });
    if (lateContents.length > CAP) out.push(more(lateContents.length - CAP, '逾期未发的内容', '#/calendar'));

    /* ---------- ② 逾期：选题截止日过了 ---------- */
    const lateTopics = db.topics.filter(function (x) {
      return x.due && x.due < t && x.stage !== 'published' && x.stage !== 'retro' && inView(x.accountId);
    }).sort(function (a, b) { return a.due.localeCompare(b.due); });
    lateTopics.slice(0, CAP).forEach(function (x) {
      const d = MW.daysBetween(x.due, t);
      const st = stageOf(x.stage);
      out.push({
        bucket: 'overdue', level: 'warn', icon: 'flag', color: st.color,
        title: x.title, who: accName(x.accountId),
        sub: '截止 ' + x.due.slice(5) + ' · 已逾期 ' + d + ' 天，当前阶段「' + st.name + '」',
        ops: [
          { label: '排至今日', on: 'MW.act.scheduleToday(\'' + x.id + '\')', primary: true },
          { label: '撰写文案', on: 'MW.act.aiFromTopic(\'' + x.id + '\')' },
          { label: '调整截止', on: 'MW.act.openTopicModal(\'' + x.id + '\')' }
        ]
      });
    });
    if (lateTopics.length > CAP) out.push(more(lateTopics.length - CAP, '已逾期的选题', '#/board'));

    /* ---------- ③ 逾期：待办没做（不挂账号，任何视角都显示） ---------- */
    const lateTodos = db.todos.filter(function (x) {
      return !x.done && x.date && x.date < t;
    }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    lateTodos.slice(0, CAP).forEach(function (x) {
      const d = MW.daysBetween(x.date, t);
      out.push({
        bucket: 'overdue', level: 'warn', icon: 'checksq', color: '#f59e0b',
        title: x.title, who: x.owner || '我',
        sub: '原定 ' + x.date.slice(5) + ' · 已逾期 ' + d + ' 天',
        ops: [
          { label: '已完成', on: 'MW.act.toggleTodo(\'' + x.id + '\')', primary: true },
          { label: '调整至今日', on: 'MW.act.todoToToday(\'' + x.id + '\')' },
          { label: '删除', on: 'MW.act.delTodo(\'' + x.id + '\')' }
        ]
      });
    });
    if (lateTodos.length > CAP) out.push(more(lateTodos.length - CAP, '逾期的待办', '#/todos'));

    /* ---------- ④ 逾期：发了但没录数据 ---------- */
    const pendM = MW.pendingMetrics(cur).sort(function (a, b) { return a.date.localeCompare(b.date); });
    pendM.slice(0, CAP).forEach(function (c) {
      const d = MW.daysBetween(c.date, t);
      out.push({
        bucket: 'overdue', level: 'info', icon: 'chart', color: accColor(c.accountId),
        title: c.title, who: accName(c.accountId),
        sub: '已发布 ' + d + ' 天，数据尚未回填',
        ops: [{ label: '回填数据', on: 'MW.act.quickMetrics(\'' + c.id + '\')', primary: true }]
      });
    });
    if (pendM.length > CAP) out.push(more(pendM.length - CAP, '已发布但未回填数据的内容', '#/review'));

    /* ---------- ⑤ 今天：排期（过点未发的逐条列，没到点的合成一条预告） ---------- */
    const todaySched = db.contents.filter(function (c) {
      return c.date === t && c.status === 'scheduled' && inView(c.accountId);
    }).sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); });
    todaySched.forEach(function (c) {
      /* 没到点的下面清单里看得到，这里不重复刷屏 */
      if (!c.time || c.time > nowHM) return;
      out.push({
        bucket: 'today', level: 'warn', icon: 'clock', color: accColor(c.accountId),
        title: c.title, who: accName(c.accountId), badge: c.time + ' 已过时',
        sub: '计划 ' + c.time + ' 发布，已过发布时点',
        ops: [
          { label: '撰写文案', on: 'MW.act.aiFromContent(\'' + c.id + '\')' },
          { label: '标记发布', on: 'MW.act.markPublished(\'' + c.id + '\')', primary: true }
        ]
      });
    });
    const later = todaySched.filter(function (c) { return c.time && c.time > nowHM; });
    if (later.length) {
      out.push({
        bucket: 'today', level: 'info', icon: 'clock', color: '#2f6fed',
        title: '今日另有 ' + later.length + ' 条待发布',
        who: later.map(function (c) { return (c.time || '') + ' ' + accName(c.accountId); }).join('、'),
        badge: '预计发布',
        sub: later.map(function (c) { return c.time; }).join(' · ') + '，尚未到发布时点',
        ops: [
          { label: '先撰写下一条', on: 'MW.act.aiFromContent(\'' + later[0].id + '\')', primary: true },
          { label: '排期至明日', on: 'MW.act.aiWeekPlanModal()' }
        ]
      });
    }

    /* ---------- ⑥ 今天：选题今天截止 ---------- */
    db.topics.filter(function (x) {
      return x.due === t && x.stage !== 'published' && x.stage !== 'retro' && inView(x.accountId);
    }).forEach(function (x) {
      const st = stageOf(x.stage);
      out.push({
        bucket: 'today', level: 'warn', icon: 'flag', color: st.color,
        title: x.title, who: accName(x.accountId), badge: '今天截止',
        sub: '今天到期 · 现在在「' + st.name + '」',
        ops: [
          { label: '排今天', on: 'MW.act.scheduleToday(\'' + x.id + '\')', primary: true },
          { label: '写文案', on: 'MW.act.aiFromTopic(\'' + x.id + '\')' }
        ]
      });
    });

    /* ---------- ⑦ 今天：按节奏该发但今天还没排（多个号合成一条，别刷屏） ---------- */
    const noSched = [];
    db.accounts.forEach(function (a) {
      if (a.status !== 'active' || !inView(a.id)) return;
      if (!(+a.cadence || 0)) return;
      const n = db.contents.filter(function (c) { return c.accountId === a.id && c.date === t; }).length;
      if (n === 0) noSched.push(a);
    });
    if (noSched.length) {
      out.push({
        bucket: 'today', level: 'warn', icon: 'bolt', color: '#f59e0b',
        title: noSched.length === 1
          ? noSched[0].name + ' 今天还没有排期'
          : noSched.length + ' 个账号今天还没有排期',
        who: noSched.map(function (a) { return a.name; }).join('、'),
        badge: '今天',
        sub: '依据更新节奏今日应有内容，目前排期为空',
        ops: [
          { label: '排一条', on: 'MW.act.openContentModal(null, \'' + t + '\')', primary: true },
          { label: 'AI 补排期', on: 'MW.act.aiWeekPlanModal()' }
        ]
      });
    }

    /* ---------- ⑧ 接下来：未来 3 天的排期（预计发） ---------- */
    const upto = MW.addDays(t, 3);
    db.contents.filter(function (c) {
      return c.status === 'scheduled' && c.date > t && c.date <= upto && inView(c.accountId);
    }).sort(function (a, b) { return a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''); })
      .slice(0, 4).forEach(function (c) {
        const d = MW.daysBetween(t, c.date);
        out.push({
          bucket: 'upcoming', level: 'info', icon: 'calendar', color: accColor(c.accountId),
          title: c.title, who: accName(c.accountId), badge: c.date.slice(5).replace('-', '/') + (c.time ? ' ' + c.time : ''),
          sub: (d === 1 ? '明天' : (d === 2 ? '后天' : d + ' 天后')) + '预计发',
          ops: [
            { label: '提前写', on: 'MW.act.aiFromContent(\'' + c.id + '\')' },
            { label: '改期', on: 'MW.act.openContentModal(\'' + c.id + '\')' }
          ]
        });
      });

    /* ---------- ⑨ 接下来：2 天内截止的选题 ---------- */
    const due2 = MW.addDays(t, 2);
    db.topics.filter(function (x) {
      return x.due && x.due > t && x.due <= due2 && x.stage !== 'published' && x.stage !== 'retro' && inView(x.accountId);
    }).sort(function (a, b) { return a.due.localeCompare(b.due); }).slice(0, 3).forEach(function (x) {
      const d = MW.daysBetween(t, x.due);
      const st = stageOf(x.stage);
      out.push({
        bucket: 'upcoming', level: 'info', icon: 'flag', color: st.color,
        title: x.title, who: accName(x.accountId), badge: x.due.slice(5).replace('-', '/') + ' 截止',
        sub: (d === 1 ? '明天' : d + ' 天后') + '到期 · 现在在「' + st.name + '」',
        ops: [
          { label: '现在写', on: 'MW.act.aiFromTopic(\'' + x.id + '\')', primary: true },
          { label: '排上', on: 'MW.act.scheduleToday(\'' + x.id + '\')' }
        ]
      });
    });

    /* ---------- ⑩ 接下来：营销节点临近（提前准备借势内容） ---------- */
    const nodeEnd = MW.addDays(t, 10);
    const nearNodes = MW.MARKETING.filter(function (n) {
      return n.date >= t && n.date <= nodeEnd && (!n.end || n.end >= t);
    }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (nearNodes.length) {
      const n = nearNodes[0];
      const d = MW.daysBetween(t, n.date);
      out.push({
        bucket: 'upcoming', level: d <= 3 ? 'warn' : 'info', icon: 'flame', color: '#f59e0b',
        title: n.name + (d === 0 ? ' 就是今天' : ' 还有 ' + d + ' 天'),
        who: n.cat + (nearNodes.length > 1 ? ' · 之后还有 ' + (nearNodes.length - 1) + ' 个节点' : ''),
        badge: n.date.slice(5).replace('-', '/'),
        sub: '借势内容要提前做，别等到当天才想',
        ops: [
          { label: '建选题', on: 'MW.act.openTopicModal()', primary: true },
          { label: '看节点库', on: 'MW.goto(\'#/calendar\')' }
        ]
      });
    }

    return out;
  };

  /* 按桶分组，便于视图渲染 */
  MW.reminderGroups = function () {
    const all = MW.reminders();
    return {
      all: all,
      overdue: all.filter(function (x) { return x.bucket === 'overdue'; }),
      today: all.filter(function (x) { return x.bucket === 'today'; }),
      upcoming: all.filter(function (x) { return x.bucket === 'upcoming'; })
    };
  };

  /* ============================================================
     示例数据（首次打开自动载入，可一键重置）
     ============================================================ */
  /* 卖家信息：js/seller-info.js 提供（window.MW_SELLER），没有则空联系方式 */
  function sellerAbout() {
    const s = (typeof MW_SELLER !== 'undefined') && MW_SELLER && MW_SELLER.about;
    if (!s || !s.contactValue) return { contactLabel: '', contactValue: '', contactNote: '' };
    return {
      contactLabel: s.contactLabel || '联系',
      contactValue: s.contactValue,
      contactNote: s.contactNote || ''
    };
  }

  function seed() {
    return {
      version: 10,
      accounts: [
        { id: 'acc_xhs1', platform: 'xhs', accountId: 'yanqiang_ai', name: '烟枪先森-AI搞钱', style: '干货实操',
          positioning: '用 AI 开发产品和业务系统的实战创业者', focus: ['AI工具实操', '独立站', '外贸CRM', '电商增长'],
          audience: '想用 AI 做副业或创业的开发者与电商人',
          mix: { case: 60, method: 20, tool: 10, review: 10 },
          tone: '第一人称实战记录，数据截图佐证，口语化',
          followers: 1860, goalFollowers: 5000, goalPosts: 12, status: 'active', createdAt: '2026-09-12',
          cadence: 3,
          snapshots: [{ date: '2026-09-14', followers: 1420 }, { date: '2026-09-21', followers: 1560 },
            { date: '2026-09-28', followers: 1688 }, { date: '2026-10-05', followers: 1780 }, { date: '2026-10-12', followers: 1860 }] },
        { id: 'acc_xhs2', platform: 'xhs', accountId: 'luna_ai_lab', name: 'Luna AI 造物所', style: '轻教程 · 实验记录',
          positioning: 'AI 造物实验田，记录副号从 0 到 1', focus: ['AI模特', '产品视觉', '副业实验'],
          audience: '对 AI 生成视觉好奇、想动手试的初学者',
          mix: { case: 50, method: 30, tool: 15, review: 5 },
          tone: '轻松的实验笔记，多图少字，允许翻车',
          followers: 106, goalFollowers: 1000, goalPosts: 8, status: 'active', createdAt: '2026-09-20',
          cadence: 2,
          snapshots: [{ date: '2026-09-21', followers: 42 }, { date: '2026-09-28', followers: 61 },
            { date: '2026-10-05', followers: 88 }, { date: '2026-10-12', followers: 106 }] },
        { id: 'acc_gzh', platform: 'gzh', accountId: 'yanqiang_ai', name: '烟枪先森（公众号）', style: '深度长文',
          positioning: 'AI 商业实战深度复盘与方法论', focus: ['创业复盘', 'CRM', '方法论'],
          audience: '已经下场做事、需要深度参考的创业者与技术决策者',
          mix: { case: 40, method: 35, tool: 5, review: 20 },
          tone: '冷静第三人称复盘，讲清决策链与代价，少形容词',
          followers: 860, goalFollowers: 3000, goalPosts: 8, status: 'active', createdAt: '2026-09-12',
          cadence: 2,
          snapshots: [{ date: '2026-09-14', followers: 640 }, { date: '2026-09-21', followers: 700 },
            { date: '2026-09-28', followers: 762 }, { date: '2026-10-05', followers: 815 }, { date: '2026-10-12', followers: 860 }] },
        { id: 'acc_x', platform: 'x', accountId: 'aihustle_cn', name: 'AI Hustle 观察', style: '短平快观点',
          positioning: 'AI + 跨境电商的一线观察', focus: ['AI', '跨境电商', '增长'],
          audience: '跨境卖家与增长从业者，刷时间线找机会',
          mix: { case: 30, method: 20, tool: 40, review: 10 },
          tone: '观点先行，一两句说完，带数据或链接',
          followers: 320, goalFollowers: 2000, goalPosts: 20, status: 'active', createdAt: '2026-09-15',
          cadence: 5,
          snapshots: [{ date: '2026-09-21', followers: 210 }, { date: '2026-09-28', followers: 248 },
            { date: '2026-10-05', followers: 288 }, { date: '2026-10-12', followers: 320 }] },
        { id: 'acc_li', platform: 'li', accountId: '3dprinter-pro', name: '3D Printer Pro', style: '专业向 · 工厂实拍',
          positioning: '3D 打印机与耗材供应商，链接全球买家', focus: ['3D打印机', '耗材', '外贸获客'],
          audience: '海外采购商、渠道商与 3D 打印农场主',
          mix: { case: 45, method: 15, tool: 10, review: 30 },
          tone: '专业供应商口吻，实拍图配参数，英文为主',
          followers: 540, goalFollowers: 2000, goalPosts: 12, status: 'active', createdAt: '2026-09-18',
          cadence: 2,
          snapshots: [{ date: '2026-09-21', followers: 390 }, { date: '2026-09-28', followers: 442 },
            { date: '2026-10-05', followers: 496 }, { date: '2026-10-12', followers: 540 }] },
        { id: 'acc_tt', platform: 'tt', accountId: 'factorydirect3d', name: 'Factory Direct 3D', style: '工厂实拍 · 英文短剧',
          positioning: '3D 打印工厂直销，内容服务海外小 B 买家', focus: ['工厂实拍', '耗材', '外贸获客'],
          audience: '海外小批发商、3D 打印农场主与创客空间',
          mix: { case: 45, method: 15, tool: 10, review: 30 },
          tone: '英文为主，实拍配参数，突出产能与交期',
          followers: 210, goalFollowers: 1000, goalPosts: 16, status: 'active', createdAt: '2026-09-22',
          cadence: 4,
          snapshots: [{ date: '2026-09-28', followers: 96 }, { date: '2026-10-05', followers: 148 },
            { date: '2026-10-12', followers: 210 }] }
      ],
      competitors: [
        { id: 'cp1', platform: 'xhs', name: 'AI 实操派', accountId: 'ai_shicaopai', category: 'AI工具', followers: 52300, freq: '日更',
          strategy: '每天一个工具实测加横评，封面统一大字报风格，评论区引导「进群领模板」',
          snapshots: [{ date: '2026-09-14', followers: 49800 }, { date: '2026-09-28', followers: 51200 }, { date: '2026-10-12', followers: 52300 }], updatedAt: '2026-10-12' },
        { id: 'cp2', platform: 'gzh', name: '增长研究所', accountId: 'growth_lab', category: '增长方法', followers: 38600, freq: '周3更',
          strategy: '深度长文加案例拆解，文末固定「工具箱」栏目引流私域',
          snapshots: [{ date: '2026-09-14', followers: 37400 }, { date: '2026-09-28', followers: 38000 }, { date: '2026-10-12', followers: 38600 }], updatedAt: '2026-10-12' },
        { id: 'cp3', platform: 'dy', name: '3D 打印工坊', accountId: '3d_workshop', category: '3D打印', followers: 126000, freq: '日更',
          strategy: '沉浸式打印过程视频加成品展示，直播挂车卖耗材',
          snapshots: [{ date: '2026-09-14', followers: 118000 }, { date: '2026-09-28', followers: 122500 }, { date: '2026-10-12', followers: 126000 }], updatedAt: '2026-10-12' },
        { id: 'cp4', platform: 'yt', name: 'CrossBorder Wang', accountId: 'cbwang', category: '外贸跨境', followers: 8600, freq: '周2更',
          strategy: '工厂实拍加避坑指南，标题带数字，简介埋独立站链接',
          snapshots: [{ date: '2026-09-14', followers: 8100 }, { date: '2026-09-28', followers: 8400 }, { date: '2026-10-12', followers: 8600 }], updatedAt: '2026-10-12' }
      ],
      sources: [
        { id: 'src1', name: '数字生命卡兹克', platform: 'gzh', accountId: 'Kaslimi',
          tags: ['AI工具', '前沿资讯'],
          note: 'AI 圈头部号，转载需后台留言授权，通过后开双勾转载并注明来源',
          lastCheckedAt: '2026-10-18', createdAt: '2026-09-20', updatedAt: '2026-10-18',
          posts: [
            { id: 'sp1', title: 'Claude 4.5 实测：写代码真的到交付水平了', link: 'https://mp.weixin.qq.com/s/demo1', publishedAt: '2026-10-17', capturedAt: '2026-10-18', status: 'new', note: '' },
            { id: 'sp2', title: '我用 AI 三天做了个出海小工具，完整复盘', link: 'https://mp.weixin.qq.com/s/demo2', publishedAt: '2026-10-09', capturedAt: '2026-10-10', status: 'planned', note: '已转成选题，等排期' }
          ] },
        { id: 'src2', name: '3D 打印资源库', platform: 'gzh', accountId: '3d-res',
          tags: ['3D打印', '行业动态'],
          note: '行业资讯号，资讯类转载注明来源即可，模型文件注意看对方授权声明',
          lastCheckedAt: '2026-10-16', createdAt: '2026-10-02', updatedAt: '2026-10-16',
          posts: [
            { id: 'sp3', title: '2026 桌面级 3D 打印机横评：耗材成本差 3 倍', link: 'https://mp.weixin.qq.com/s/demo3', publishedAt: '2026-10-15', capturedAt: '2026-10-16', status: 'new', note: '' }
          ] }
      ],
      inspirations: [
        { id: 'is1', title: '用 AI 把 1688 详情页重做一遍，转化率提升多少？', source: '竞品评论区', accountId: 'acc_xhs1', tags: ['AI工具实操', '电商增长'], note: '有人问工具链，需求真实', createdAt: '2026-10-11' },
        { id: 'is2', title: 'NAS 部署 CRM 的完整成本清单', source: '自己的项目', accountId: 'acc_gzh', tags: ['CRM'], createdAt: '2026-10-10' },
        { id: 'is3', title: 'TPU 耗材打印避坑：温度墙那些事', source: '客户咨询', accountId: 'acc_li', tags: ['耗材', '3D打印机'], createdAt: '2026-10-09' }
      ],
      hotspots: [
        { id: 'hs1', title: 'Sora 2 实测：一句话生成完整短片', category: 'AI工具', platform: 'dy', heat: 96, note: '适合做工具横评二创', createdAt: '2026-10-12' },
        { id: 'hs2', title: 'AI 数字人直播带货成本再降', category: 'AI电商', platform: 'xhs', heat: 88, note: '可结合外贸直播场景讲', createdAt: '2026-10-12' },
        { id: 'hs3', title: '3D 打印建筑技术规范出台', category: '3D打印', platform: 'wb', heat: 74, note: '蹭政策热点，专业解读向', createdAt: '2026-10-11' },
        { id: 'hs4', title: 'AI 客服替代潮：中小企业实测报告', category: 'AI职场', platform: 'zhihu', heat: 69, note: 'CRM 场景可以结合', createdAt: '2026-10-11' },
        { id: 'hs5', title: '双 11 商家 AI 素材生成量翻 3 倍', category: 'AI电商', platform: 'xhs', heat: 82, note: '电商人必看，案例向', createdAt: '2026-10-10' },
        { id: 'hs6', title: 'TikTok 工厂直销内容玩法盘点', category: '外贸跨境', platform: 'tt', heat: 79, note: '适合做工厂实拍二创', createdAt: '2026-10-11' }
      ],
      topics: [
        { id: 'tp1', title: '外贸 CRM 第 3 次重构，我踩过的 7 个坑', accountId: 'acc_xhs1', type: 'case', stage: 'idea', priority: 'high', due: '', owner: '我', focus: '外贸CRM', note: '结合 NAS 部署成本数据讲', createdAt: '2026-10-10' },
        { id: 'tp2', title: 'AI 模特换装实测：5 个工具横评', accountId: 'acc_xhs2', type: 'tool', stage: 'idea', priority: 'mid', due: '', owner: '我', focus: 'AI模特', createdAt: '2026-10-11' },
        { id: 'tp3', title: '2 人团队如何用 AI 扛起 5 个渠道的日更', accountId: 'acc_xhs1', type: 'method', stage: 'review', priority: 'high', due: '2026-10-15', owner: '我', focus: 'AI工具实操', note: '正好配合工作台上线', createdAt: '2026-10-08' },
        { id: 'tp4', title: '3D 打印耗材选购指南：PLA / PETG / TPU 怎么选', accountId: 'acc_li', type: 'method', stage: 'review', priority: 'mid', due: '2026-10-16', owner: '合伙人', focus: '耗材', createdAt: '2026-10-09' },
        { id: 'tp5', title: 'AI 生成产品图工作流：从拍摄到上架全流程', accountId: 'acc_xhs1', type: 'method', stage: 'scheduled', priority: 'high', due: '2026-10-14', owner: '我', focus: 'AI工具实操', createdAt: '2026-10-07' },
        { id: 'tp6', title: '我把 CRM 搬上了 NAS：成本降了 80%', accountId: 'acc_gzh', type: 'case', stage: 'producing', priority: 'high', due: '2026-10-15', owner: '我', focus: 'CRM', createdAt: '2026-10-06' },
        { id: 'tp7', title: 'AI 模特实操案例：详情页成本从 500 降到 15', accountId: 'acc_xhs2', type: 'case', stage: 'published', priority: 'high', due: '2026-10-10', owner: '我', focus: 'AI模特', createdAt: '2026-09-28' },
        { id: 'tp8', title: '小红书起号 30 天：从 0 到 1860 粉复盘', accountId: 'acc_xhs1', type: 'review', stage: 'retro', priority: 'high', due: '', owner: '我', focus: '电商增长', note: '已产出复盘笔记，沉淀到方法论', createdAt: '2026-09-25' },
        { id: 'tp9', title: '3D 打印机海外询盘转化：话术模板开源', accountId: 'acc_li', type: 'case', stage: 'idea', priority: 'high', due: '2026-10-20', owner: '合伙人', focus: '外贸获客', createdAt: '2026-10-11' },
        { id: 'tp10', title: '耗材外贸报价单怎么做才专业（附模板）', accountId: 'acc_li', type: 'tool', stage: 'idea', priority: 'mid', due: '', owner: '我', focus: '外贸获客', createdAt: '2026-10-08' },
        { id: 'tp11', title: 'AI 时代，外贸业务员还值钱吗', accountId: 'acc_x', type: 'case', stage: 'idea', priority: 'mid', due: '', owner: '我', focus: 'AI', createdAt: '2026-10-09' },
        { id: 'tp12', title: '一周出海信号：我关注的 5 个变化', accountId: 'acc_x', type: 'method', stage: 'idea', priority: 'high', due: '', owner: '我', focus: '跨境电商', createdAt: '2026-10-12' },
        { id: 'tp13', title: 'TikTok 工厂号冷启动：第一条拍什么', accountId: 'acc_tt', type: 'method', stage: 'idea', priority: 'mid', due: '', owner: '我', focus: '工厂实拍', note: '参考同行对标 CrossBorder Wang 的拍法', createdAt: '2026-10-11' }
      ],
      contents: [
        { id: 'ct1', title: '5 个 AI 抠图工具横评，第 3 个免费还能打', accountId: 'acc_xhs1', platform: 'xhs', date: '2026-10-12', time: '18:00', status: 'scheduled', topicId: '', focus: 'AI工具实操', metrics: null, note: '封面用 A 版', createdAt: '2026-10-10' },
        { id: 'ct2', title: '日更 30 天，我悟到了一个道理', accountId: 'acc_xhs1', platform: 'xhs', date: '2026-10-12', time: '21:00', status: 'scheduled', topicId: '', focus: '电商增长', metrics: null, note: '', createdAt: '2026-10-11' },
        { id: 'ct3', title: '3D 打印耗材选购指南（LinkedIn 长文版）', accountId: 'acc_li', platform: 'li', date: '2026-10-13', time: '09:00', status: 'scheduled', topicId: 'tp4', focus: '耗材', metrics: null, note: '', createdAt: '2026-10-09' },
        { id: 'ct4', title: 'AI 生成产品图工作流：全流程拆解', accountId: 'acc_xhs1', platform: 'xhs', date: '2026-10-14', time: '12:00', status: 'scheduled', topicId: 'tp5', focus: 'AI工具实操', metrics: null, note: '', createdAt: '2026-10-07' },
        { id: 'ct5', title: '同一个选题，公众号深度版', accountId: 'acc_gzh', platform: 'gzh', date: '2026-10-14', time: '20:00', status: 'scheduled', topicId: 'tp5', focus: '方法论', metrics: null, note: '', createdAt: '2026-10-07' },
        { id: 'ct6', title: '我把 CRM 搬上了 NAS：成本降了 80%', accountId: 'acc_gzh', platform: 'gzh', date: '2026-10-15', time: '20:00', status: 'scheduled', topicId: 'tp6', focus: 'CRM', metrics: null, note: '', createdAt: '2026-10-06' },
        { id: 'ct7', title: 'AI 模特实操案例：成本从 500 到 15', accountId: 'acc_xhs2', platform: 'xhs', date: '2026-10-10', time: '12:00', status: 'published', topicId: 'tp7', focus: 'AI模特',
          metrics: { views: 12400, likes: 936, comments: 128, collects: 452, shares: 63, newFollowers: 96 }, note: '', createdAt: '2026-09-28' },
        { id: 'ct8', title: 'AI 抠图工具横评（图文版）', accountId: 'acc_xhs1', platform: 'xhs', date: '2026-10-08', time: '18:00', status: 'published', topicId: '', focus: 'AI工具实操',
          metrics: { views: 8600, likes: 512, comments: 74, collects: 301, shares: 41, newFollowers: 52 }, note: '', createdAt: '2026-10-05' },
        { id: 'ct9', title: '为什么我把外贸 CRM 搬到了 NAS', accountId: 'acc_gzh', platform: 'gzh', date: '2026-10-06', time: '20:00', status: 'published', topicId: '', focus: 'CRM',
          metrics: { views: 2100, likes: 86, comments: 19, collects: 97, shares: 12, newFollowers: 14 }, note: '', createdAt: '2026-10-03' },
        { id: 'ct10', title: 'AI 模特换装：3 分钟出图实操', accountId: 'acc_xhs2', platform: 'xhs', date: '2026-10-05', time: '12:00', status: 'published', topicId: '', focus: 'AI模特',
          metrics: { views: 980, likes: 64, comments: 11, collects: 38, shares: 6, newFollowers: 9 }, note: '', createdAt: '2026-10-02' },
        { id: 'ct11', title: 'Print farm tour: 20 printers in one room', accountId: 'acc_tt', platform: 'tt', date: '2026-10-13', time: '19:00', status: 'scheduled', topicId: 'tp13', focus: '工厂实拍', metrics: null, note: '英文字幕，结尾放询盘链接', createdAt: '2026-10-11' }
      ],
      todos: [
        { id: 'td1', title: '回复今天发布内容的评论', date: '2026-10-12', time: '10:00', status: 'todo', owner: '我', priority: 'high', done: true, createdAt: '2026-10-12' },
        { id: 'td2', title: '整理选题库：把竞品爆款转成 5 个选题', date: '2026-10-12', time: '14:00', status: 'todo', owner: '我', priority: 'mid', done: false, createdAt: '2026-10-12' },
        { id: 'td3', title: '拍摄 3D 打印耗材演示视频', date: '2026-10-12', time: '16:00', status: 'edit', owner: '合伙人', priority: 'high', done: false, createdAt: '2026-10-11' },
        { id: 'td4', title: '和合伙人过一遍下周排期', date: '2026-10-13', time: '11:00', status: 'todo', owner: '我', priority: 'mid', done: false, createdAt: '2026-10-12' },
        { id: 'td5', title: '导出 9 月财务数据对账', date: '2026-10-13', time: '15:00', status: 'todo', owner: '合伙人', priority: 'low', done: false, createdAt: '2026-10-12' },
        { id: 'td6', title: '更新竞品库粉丝快照', date: '2026-10-14', time: '09:30', status: 'todo', owner: '我', priority: 'low', done: false, createdAt: '2026-10-12' },
        { id: 'td7', title: '写「外贸 CRM 落地实录」正文', date: '2026-10-14', time: '10:00', status: 'write', owner: '我', priority: 'high', done: false, createdAt: '2026-10-13' },
        { id: 'td8', title: '剪「AI 模特换装」短视频', date: '2026-10-14', time: '16:00', status: 'edit', owner: '合伙人', priority: 'mid', done: false, createdAt: '2026-10-13' },
        { id: 'td9', title: '小红书今日笔记发布', date: '2026-10-14', time: '18:30', status: 'post', owner: '我', priority: 'high', done: false, createdAt: '2026-10-14' }
      ],
      rituals: [
        { id: 'rt1', name: '刷 30 分钟对标账号找灵感', icon: 'eye' },
        { id: 'rt2', name: '记录昨日内容数据', icon: 'chart' },
        { id: 'rt3', name: '收集 3 个选题入库', icon: 'bulb' },
        { id: 'rt4', name: '回复评论和私信', icon: 'check' },
        { id: 'rt5', name: '复盘今日发布数据', icon: 'refresh' }
      ],
      ritualLog: {
        '2026-10-06': ['rt1', 'rt2', 'rt3', 'rt4', 'rt5'],
        '2026-10-07': ['rt1', 'rt2', 'rt3', 'rt4', 'rt5'],
        '2026-10-08': ['rt1', 'rt2', 'rt3', 'rt5'],
        '2026-10-09': ['rt1', 'rt2', 'rt3', 'rt4', 'rt5'],
        '2026-10-10': ['rt1', 'rt3', 'rt4', 'rt5'],
        '2026-10-11': ['rt1', 'rt2', 'rt4', 'rt5'],
        '2026-10-12': ['rt1', 'rt3']
      },
      /* 记账：type=income 的是订单（带客户/成本/渠道，利润自动算），type=expense 的是运营支出流水。
         老版本记的收入行没有这些字段，照样能用——利润按「金额 − 0」算，不会乱。 */
      finance: [
        { id: 'fn1', type: 'income', date: '2026-10-05', customer: '某 AI 工具商', category: '品牌商单', orderNo: '20261005-001', amount: 3800, cost: 0, detail: '小红书图文植入 1 篇', source: '小红书', channel: '对公转账', owner: '我', accountId: 'acc_xhs1', note: 'AI 工具商单，含 3 天返图' },
        { id: 'fn2', type: 'income', date: '2026-10-08', customer: '李同学', category: 'AI会员充值', orderNo: '20261008-001', amount: 1260, cost: 980, detail: 'GPT + MJ 会员代充 4 单', source: '私域转介绍', channel: '微信', owner: '我', accountId: 'acc_xhs2', note: 'AI 工具分销' },
        { id: 'fn3', type: 'expense', date: '2026-09-28', category: '工具订阅', amount: 398, cost: 0, owner: '我', accountId: '', note: 'AI 工具年费分摊' },
        { id: 'fn4', type: 'expense', date: '2026-10-02', category: '素材版权', amount: 299, cost: 0, owner: '我', accountId: '', note: '字体加图片素材' },
        { id: 'fn5', type: 'expense', date: '2026-10-10', category: '设备', amount: 2199, cost: 0, owner: '我', accountId: '', note: '补光灯加背景布' },
        { id: 'fn6', type: 'income', date: '2026-09-20', customer: '王姐', category: '咨询陪跑', orderNo: '20260920-001', amount: 1500, cost: 0, detail: '1v1 咨询 2 单', source: '朋友圈', channel: '微信', owner: '合伙人', accountId: '', note: '老朋友介绍' },
        { id: 'fn7', type: 'income', date: '2026-09-16', customer: '某建材厂', category: '品牌商单', orderNo: '20260916-001', amount: 2200, cost: 0, detail: '产品图 5 张 + 短视频 1 条', source: '小红书', channel: '银行卡', owner: '我', accountId: 'acc_xhs1', note: '9 月商单' },
        { id: 'fn8', type: 'expense', date: '2026-10-01', category: '团队分成', amount: 1800, cost: 0, owner: '合伙人', accountId: '', note: '9 月分成结算' },
        { id: 'fn9', type: 'income', date: '2026-09-25', customer: '公众号读者', category: '课程资料', amount: 680, cost: 0, detail: '提示词模板包', source: '公众号', channel: '支付宝', owner: '我', accountId: 'acc_gzh', note: '模板包' },
        { id: 'fn10', type: 'expense', date: '2026-10-07', category: '投放', amount: 500, cost: 0, owner: '我', accountId: 'acc_xhs2', note: '薯条测试' }
      ],
      assets: [
        { id: 'as1', name: '小红书封面模板 v3（大字报）', type: '模板', tags: ['封面', '小红书'], accountId: 'acc_xhs1', note: 'Canva 链接见收藏夹', createdAt: '2026-10-05' },
        { id: 'as2', name: '口播稿结构模板', type: '文案', tags: ['模板', '口播'], accountId: '', note: '钩子 - 痛点 - 案例 - 行动号召', createdAt: '2026-10-03' },
        { id: 'as3', name: '爆款标题库 100 条', type: '文案', tags: ['标题', '灵感'], accountId: '', note: '按行业分类，持续补充', createdAt: '2026-09-28' },
        { id: 'as4', name: '3D 打印机产品图原图包', type: '图片', tags: ['产品图', '3D打印机'], accountId: 'acc_li', note: '素材盘/产品图/打印机', createdAt: '2026-09-20' }
      ],
      drafts: [],
      xWorkbench: { accountId: '', experiences: [], drafts: [] },
      /* AI 接口（OpenAI 兼容）：不配置则所有 AI 功能走本地降级方案 */
      settings: {
        ai: { baseUrl: '', apiKey: '', model: '' },
        /* 素材库：只存索引与标注，文件在用户硬盘上（v6） */
        assets: { onboarded: false, list: [], meta: {}, autoFolder: true, pending: false, lastSync: 0 },
        /* 关于与联系：联系方式随安装包/备份分发，license 为授权码（v8）；
           有卖家信息（js/seller-info.js）时新用户首次启动自动带上（v10） */
        about: sellerAbout(),
        license: null
      }
    };
  }

  MW.load();
  MW.loadAcc();
})();
