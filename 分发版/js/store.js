/* ============================================================
   社媒工作台 · 分发版 · 数据层
   定位：一稿多发——同一份母稿，按各平台账号定位改写成多平台版本
   与旗舰版（mw_db_v1）数据格式兼容：本版是旗舰版 contents/accounts 的子集，
   两边导出的备份可互相导入（旗舰版数据导入时自动只取本版所需表）。
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  const DB_KEY = 'mw_lite_db_v1';

  /* ---------- 平台配置 ----------
     region 决定账号表单里下拉怎么分组：cn 国内平台 / global 国外平台。
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
     这四项是临门一脚最常出问题的地方：文案没定稿、封面没做、
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
    fb:   '原生视频优先，封面带文字，群组分享比主页曝光高',
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
     只有 key 的场景用 MW.pfName(key, 对象)。 */
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

  /* ---------- 内容类型 ---------- */
  MW.TOPIC_TYPES = {
    case:   { name: '案例', color: '#4f46e5', desc: '真实项目跑通的过程，最能建立信任' },
    method: { name: '方法', color: '#0ea5a4', desc: '可复用的做法与 SOP，利于收藏和长尾' },
    tool:   { name: '工具', color: '#f59e0b', desc: '工具测评与横评，标题最容易出爆款' },
    review: { name: '复盘', color: '#e5484d', desc: '踩坑与反思，沉淀人设和老粉' }
  };
  MW.TOPIC_TYPE_LIST = Object.keys(MW.TOPIC_TYPES).map(function (k) {
    return Object.assign({ key: k }, MW.TOPIC_TYPES[k]);
  });

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

  /* 新增内容时自动归属「内容聚焦」方向：
     没有显式指定时，用标题去匹配该账号的方向列表，猜不到就留空。 */
  MW.guessFocus = function (accId, title, explicit) {
    if (explicit !== undefined && explicit !== null && explicit !== '') return explicit;
    const acc = MW.accOf(accId);
    const fs = (acc && acc.focus) || [];
    const t = String(title || '');
    let best = '', bestLen = 0;
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

  /* ---------- 日期工具 ---------- */
  MW.uid = function () {
    return 'id' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  };
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
  MW.daysBetween = function (from, to) {
    return Math.round((MW.parseDate(to) - MW.parseDate(from)) / 86400000);
  };

  /* ---------- 存取 ---------- */
  let db = null;
  MW.getDB = function () { return db; };
  MW.save = function () {
    try {
      /* 存一份「这份数据最后改动的时间戳」。用于多标签页互不覆盖。 */
      db.__t = Date.now();
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      console.warn('保存失败', e);
      if (typeof MW.toast === 'function') MW.toast('本地保存失败，请导出备份并检查存储空间', 'error');
      return false;
    }
  };

  /* 本页内存里的数据是否已经被别处替换/更新过。 */
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
      if (strip(disk) === strip(db)) return false;
      const diskT = +(disk && disk.__t) || 0;
      const memT = +(db && db.__t) || 0;
      if (!diskT) return true;
      const gap = diskT - memT;
      if (gap <= 0) return false;
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
  MW.focusHit = function (focus, title) {
    const a = String(focus || ''), b = String(title || '');
    if (!a || !b) return false;
    if (a === b || b.indexOf(a) >= 0) return true;
    const r = MW.lcsLen(a, b);
    if (!r.len) return false;
    return /[\u4e00-\u9fa5]/.test(r.seg) ? r.len >= 2 : r.len >= 3;
  };

  /* 老数据升级（旗舰版 v1-v10 的老库导入本版时逐段补字段） */
  function migrate(d) {
    if (!d || typeof d !== 'object') d = {};
    if (!d.version || d.version < 2) {
      (d.accounts || []).forEach(function (a) { if (!a.cadence) a.cadence = 3; });
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
      d.version = 3;
    }
    /* v8：关于与联系——settings.about 存联系方式，settings.license 存授权码 */
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
  MW.migrate = migrate;

  MW.load = function () {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        db = migrate(JSON.parse(raw));
        /* 迁移后校验：老库可能缺表，缺了就补空数组，避免视图取属性时炸。
           只补空数组，不动已有数据。 */
        if (!Array.isArray(db.accounts)) db.accounts = [];
        if (!Array.isArray(db.contents)) db.contents = [];
        if (!db.settings || typeof db.settings !== 'object') db.settings = {};
        if (!db.settings.ai) db.settings.ai = { baseUrl: '', apiKey: '', model: '', provider: '' };
        if (!db.settings.about) db.settings.about = sellerAbout();
        if (!db.settings.license) db.settings.license = null;
        db.__t = Date.now();
        MW.save();
        return;
      }
    } catch (e) {
      /* 读不出来就退回示例数据，但必须留个痕迹——
         静默 catch 会让人以为数据还在，实际已经被覆盖了。 */
      console.error('读取本机数据失败，已回落到示例数据：', e);
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
  const ACC_KEY = 'mw_lite_cur_acc_v1';
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
  MW.inAcc = function (it) { return MW.curAcc() === 'all' || it.accountId === MW.curAcc(); };
  MW.accOf = function (id) { return MW.getDB().accounts.find(function (a) { return a.id === id; }); };
  MW.accName = function (id) { const a = MW.accOf(id); return a ? a.name : ''; };

  /* ============================================================
     发布管理：把「排期 → 已发布」中间那段执行过程做实
     ------------------------------------------------------------
     数据不另起炉灶，就长在 contents 上（checks / url / publishedAt），
     日历排的期、这里执行的动作是同一批记录。
     ============================================================ */
  MW.checksOf = function (c) {
    const ck = (c && c.checks) || {};
    const all = MW.PUB_CHECKS;
    const done = all.filter(function (x) { return !!ck[x.key]; });
    return { done: done.length, total: all.length, all: all, map: ck, ready: done.length === all.length };
  };

  /* 今天该发 / 逾期未发 / 未来 7 天，三个发布管理最关心的桶 */
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

  /* 发布节奏：每个账号本周该发多少、实发多少。cadence = 每周几更 */
  MW.cadenceOf = function (acc) {
    const db = MW.getDB();
    const t = MW.dateStr();
    const start = MW.addDays(t, -6);
    const goal = Math.max(1, +acc.cadence || 1);
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

  /* ============================================================
     母稿与多平台适配版本（一稿多发）
     ------------------------------------------------------------
     母稿 = 一条标记 master:true 的 content，body 存完整初稿；
     适配版本 = masterId 指向母稿的 content，按目标账号的定位生成。
     关系只靠这两个字段表达，不新建表——适配版本复用 contents 的
     账号/平台/排期/检查项/发布记录，和普通内容走同一条动线。
     老数据没有这两个字段 → 普通内容，天然兼容。
     ============================================================ */
  MW.adaptationsOf = function (masterId) {
    if (!masterId) return [];
    return MW.getDB().contents.filter(function (c) { return c.masterId === masterId; });
  };
  MW.masterOf = function (c) {
    if (!c || !c.masterId) return null;
    return MW.getDB().contents.find(function (x) { return x.id === c.masterId }) || null;
  };
  MW.masters = function () {
    const db = MW.getDB();
    return db.contents.filter(function (c) { return c.master; })
      .sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
  };

  /* 该账号最后一次发布日期 / 断更天数（账号卡用） */
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
  MW.silentDays = function (acc) {
    const lp = MW.lastPublish(acc.id);
    const base = lp || acc.createdAt || MW.dateStr();
    return MW.daysBetween(base, MW.dateStr());
  };

  /* ---------- 卖家信息（随安装包/网页分发，买家首次启动自动带上） ---------- */
  function sellerAbout() {
    const s = (typeof MW_SELLER !== 'undefined') && MW_SELLER && MW_SELLER.about;
    if (!s || !s.contactValue) return { contactLabel: '', contactValue: '', contactNote: '' };
    return {
      contactLabel: s.contactLabel || '联系',
      contactValue: s.contactValue,
      contactNote: s.contactNote || ''
    };
  }

  /* ---------- 示例数据 ----------
     演示场景围绕「一稿多发」：一条母稿改写成 3 个平台的版本。
     买家打开就能看到完整动线，不需要先自己造数据。 */
  function seed() {
    const t = MW.dateStr();
    const d1 = MW.addDays(t, 1), d2 = MW.addDays(t, 2), d3 = MW.addDays(t, 3);
    const mId = 'ct_master_demo';
    return {
      version: 10,
      accounts: [
        { id: 'acc_xhs', platform: 'xhs', accountId: 'acha_kitchen', name: '阿茶的手作厨房', style: '温暖实用风',
          positioning: '手作教程与厨房好物分享，教普通人用零碎时间做点小东西',
          focus: ['手作教程', '厨房好物', '节日改造'],
          audience: '25-40 岁喜欢动手、想给生活添点乐趣的女性用户',
          tone: '第一人称分享，像闺蜜聊天，步骤图要多',
          followers: 3200, status: 'active', createdAt: MW.addDays(t, -60), cadence: 4 },
        { id: 'acc_gzh', platform: 'gzh', accountId: 'acha_notes', name: '阿茶的成长笔记', style: '深度长文',
          positioning: '生活方式与自我提升，把手作里的耐心讲成生活态度',
          focus: ['生活方式', '自我提升'],
          audience: '愿意读长文、关注生活质量的上班族',
          tone: '温和有沉淀，讲清来龙去脉，少用网络热词',
          followers: 860, status: 'active', createdAt: MW.addDays(t, -60), cadence: 2 },
        { id: 'acc_dy', platform: 'dy', accountId: 'acha_make', name: '阿茶手作', style: '快节奏教程',
          positioning: '一分钟手作短视频，完播率优先',
          focus: ['手作教程', '好物分享'],
          audience: '刷视频找乐子、看到感兴趣会跟着做的年轻用户',
          tone: '节奏快、指令清晰，前 3 秒必须看到成品',
          followers: 1500, status: 'active', createdAt: MW.addDays(t, -30), cadence: 5 },
        { id: 'acc_x', platform: 'x', accountId: 'cha_making', name: "Cha's Making", style: '英文短帖',
          positioning: 'Handmade projects and maker life, English only',
          focus: ['Handmade', 'Maker Life'],
          audience: 'Global makers and DIY lovers scrolling for ideas',
          tone: 'Short and visual, one idea per post, 1-2 hashtags',
          followers: 240, status: 'active', createdAt: MW.addDays(t, -20), cadence: 5 }
      ],
      contents: [
        { id: mId, title: '中秋月饼盒改造：3 个思路让废盒子变成收纳神器', accountId: 'acc_xhs', platform: 'xhs',
          date: d1, time: '18:00', status: 'scheduled', topicId: '', focus: '节日改造', metrics: null,
          master: true, checks: {},
          body: '【母稿】中秋月饼盒改造：3 个思路让废盒子变成收纳神器\n\n钩子：每年中秋后家里都堆着一摞月饼盒，扔了可惜，留着占地方。今年我把 5 个盒子全改成了收纳件，最满意的那个现在放在玄关装钥匙。\n\n思路一：单层盒改抽屉分隔。按 3.5 寸软盘的高度裁硬纸板，插成九宫格，放纽扣、耳钉、U 盘这类小零碎。\n\n思路二：带盖圆盒改首饰盘。盒盖垫一层不织布，项链手链平铺不放缠绕；盒身倒扣当展示台。\n\n思路三：提篮式礼盒改桌面收纳。去掉内部塑料托，裁一块瓦楞纸横插成两层，上层放笔，下层放胶带剪刀。\n\n材料：美工刀、直尺、热熔胶、包装纸。全程不用买新工具，成本为零。\n\n行动号召：你家还有没拆的月饼盒吗？评论区聊聊你打算改什么。',
          note: '母稿：所有平台版本都从这一份改写', createdAt: t },
        { id: 'ct_av_gzh', title: '月饼盒、快递箱与旧铁盒：一场关于「舍不得扔」的整理实验', accountId: 'acc_gzh', platform: 'gzh',
          date: d2, time: '20:00', status: 'scheduled', topicId: '', focus: '生活方式', metrics: null,
          masterId: mId, checks: {},
          body: '（公众号长文版）从 5 个月饼盒开始的整理实验。中秋过后，我开始认真对待那些「舍不得扔又用不上」的盒子……（正文按公众号排版展开，配过程图）',
          note: '适配自母稿「中秋月饼盒改造：3 个思路让废盒子变成收纳神器」', createdAt: t },
        { id: 'ct_av_dy', title: '月饼盒别扔！30 秒改成钥匙收纳', accountId: 'acc_dy', platform: 'dy',
          date: d2, time: '12:00', status: 'scheduled', topicId: '', focus: '手作教程', metrics: null,
          masterId: mId, checks: {},
          body: '（短视频脚本版）0-3 秒：成品特写——玄关钥匙全进盒。3-8 秒：裁纸板插九宫格。8-25 秒：热熔胶固定。25-30 秒：字幕「材料：月饼盒+硬纸板」。',
          note: '适配自母稿「中秋月饼盒改造：3 个思路让废盒子变成收纳神器」', createdAt: t },
        { id: 'ct_av_x', title: 'Turn your mooncake box into a drawer organizer', accountId: 'acc_x', platform: 'x',
          date: d3, time: '09:00', status: 'scheduled', topicId: '', focus: 'Handmade', metrics: null,
          masterId: mId, checks: {},
          body: '（X 短帖版）5 mooncake boxes, 3 organizers, zero cost. Cardboard grid + hot glue = perfect for keys, earrings and USB drives. #Handmade #Upcycling',
          note: '适配自母稿「中秋月饼盒改造：3 个思路让废盒子变成收纳神器」', createdAt: t },
        { id: 'ct_plain1', title: '秋天第一杯桂花酿，厨房飘了三天香', accountId: 'acc_xhs', platform: 'xhs',
          date: d3, time: '18:00', status: 'scheduled', topicId: '', focus: '厨房好物', metrics: null, checks: {},
          note: '', createdAt: t },
        { id: 'ct_pub1', title: '旧 T 恤改环保袋：10 分钟不用针线', accountId: 'acc_xhs', platform: 'xhs',
          date: MW.addDays(t, -3), time: '18:00', status: 'published', topicId: '', focus: '手作教程',
          metrics: { views: 8600, likes: 512, comments: 74, collects: 301, shares: 41, newFollowers: 52 },
          checks: { copy: true, asset: true, tag: true, time: true }, url: '', publishedAt: MW.addDays(t, -3),
          note: '', createdAt: MW.addDays(t, -8) }
      ],
      settings: {
        ai: { baseUrl: '', apiKey: '', model: '', provider: '' },
        about: sellerAbout(),
        license: null
      }
    };
  }

  MW.load();
  MW.loadAcc();
})();
