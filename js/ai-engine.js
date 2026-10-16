/* ============================================================
   AI 引擎：一处生成，处处可用
   所有模块（今日 / 看板 / 日历 / 灵感 / 复盘 / 文案台）
   共用同一套生成逻辑，接真实大模型时只改本文件的 MW.ai.gen
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  MW.ai = {};
  MW.act = MW.act || {};

  /* ---------- 各平台建议发布时段 ---------- */
  const PF_TIME = { xhs: '18:00', dy: '19:00', gzh: '20:00', bili: '20:00', sph: '21:00', x: '21:00', li: '09:00', zhihu: '20:00', wb: '12:00', yt: '21:00', other: '20:00' };
  MW.ai.pfTime = function (p) { return PF_TIME[p] || '20:00'; };

  const PLATFORM_TIPS = {
    xhs: '小红书：工作日 12:00 / 18:00 / 21:00 三档流量高峰；封面 3:4 竖图，标题 20 字内，正文前 3 行决定打开率。',
    dy: '抖音：18:00-20:00 流量高峰；前 3 秒钩子决定完播率，口播稿控制在 45-60 秒。',
    gzh: '公众号：7:30-8:30 或 20:00-22:00 阅读高峰；标题决定打开率，摘要 54 字内讲清价值。',
    bili: 'B站：周末晚间流量好；中长视频，前 30 秒必须抛出核心看点。',
    sph: '视频号：依托微信生态，转发是关键，结尾加一句引导转发的话。',
    x: 'X：9:00 / 21:00（北京时间）在线高峰；观点先行，配图或数据截图提升转发。',
    li: 'LinkedIn：工作日 8:00-10:00 发布；专业向长文，结尾加 CTA 引导建联。',
    zhihu: '知乎：长尾流量平台，回答式标题更容易被搜索到，开头直接给结论。',
    wb: '微博：蹭话题标签，正文 140 字内讲清一个点，评论区持续互动。',
    yt: 'YouTube：Shorts 引流 + 长视频沉淀；标题含关键词，简介放链接。',
    other: '发布前确认平台规范，标题和封面按平台尺寸适配。'
  };

  function buildOutlines(type, topic) {
    return {
      case: [
        '【背景】当时我遇到的问题是：……用 2-3 句交代真实场景，越具体越有代入感。',
        '【过程】完整做法分 4 步：第一步……第二步……关键决策点在这里展开讲。',
        '【结果】前后对比：时间从 X 降到 Y，成本从 X 降到 Y，附后台截图更有说服力。',
        '【方法】可复用的 3 个要点：①……②……③……结尾引导评论区交流。'
      ],
      method: [
        '【痛点】为什么大多数人做不好「' + topic + '」？因为……点出真实困境。',
        '【方法】核心思路一句话：……先给结论，再展开论证。',
        '【案例】我是怎么用的：……贴自己的数据和结果，建立可信度。',
        '【步骤】照着做的 5 步流程：①……②……③……④……⑤……'
      ],
      tool: [
        '【场景】什么情况下必须用工具做「' + topic + '」？……先锁定人群。',
        '【横评】我测了 3 个工具：A 适合……B 强在……C 胜在……附对比表。',
        '【上手】10 分钟跑通教程：……分步骤，可配截图。',
        '【避坑】我踩过的 3 个坑：……真实教训最值钱，也最容易被收藏。'
      ],
      review: [
        '【数据】先亮成绩单：……核心数字放最前面。',
        '【做对了什么】3 个关键决策：……讲清当时的判断依据。',
        '【做错了什么】2 个弯路：……敢于讲失败，反而更涨粉。',
        '【下一步】接下来怎么打：……给读者一个期待。'
      ]
    }[type] || [];
  }

  /* ============================================================
     核心：生成一篇内容的初稿
     opt: { accountId, topic, type, platform, kws }
     接真实大模型时，把这里换成 fetch 调用即可，其余模块无需改动
     ============================================================ */
  MW.ai.gen = function (opt) {
    opt = opt || {};
    const db = MW.getDB();
    const acc = MW.accOf(opt.accountId) || db.accounts[0] || null;
    const topic = (opt.topic || '').trim();
    const type = opt.type || 'case';
    const platform = opt.platform || (acc ? acc.platform : 'xhs');
    const kws = (opt.kws || '').trim();
    const focus = (acc && acc.focus && acc.focus.length) ? acc.focus : ['AI 提效'];
    const f0 = focus[0];
    const typeName = (MW.TOPIC_TYPES[type] || MW.TOPIC_TYPES.case).name;

    const titles = [
      topic + '｜我跑通了全流程，方法直接抄',
      '别再瞎折腾了！' + topic + ' 的正确打开方式',
      topic + ' 实操复盘：数据、坑和结论都在这',
      '90% 的人做「' + topic + '」，第 1 步就错了',
      '从 0 到 1 做「' + topic + '」：完整 SOP（建议收藏）'
    ];
    if (kws) titles.unshift('「' + kws + '」' + topic + '：一次讲透');

    /* 语气走 tone（表达风格），没填才回落到 style。
       这两个字段分开是有意的：style 是「内容是什么类型」，tone 是「怎么说」。 */
    const voice = (acc && (acc.tone || acc.style)) || '实战';
    const hook = '先说结论：' + topic + '这件事，我用「' + voice + '」的方式完整跑了一遍。' +
      '这篇没有虚的，从思路到数据全部摊开' + (f0 ? '，尤其是关注' + f0 + '的朋友' : '') + '，建议先收藏再看。';

    const tags = [];
    function pushTag(t) { if (t && tags.indexOf(t) < 0 && tags.length < 6) tags.push(t); }
    pushTag(f0);
    pushTag(focus[1]);
    if (kws) kws.split(/[,，\s]+/).forEach(pushTag);
    pushTag(topic.length > 8 ? topic.slice(0, 8) : topic);
    pushTag(typeName + '向');
    pushTag('干货分享');

    const tips = (PLATFORM_TIPS[platform] || PLATFORM_TIPS.other) +
      '<br>本篇为「' + typeName + '」型内容，围绕「' + focus.join('、') + '」展开，符合账号内容聚焦' +
      (acc ? '（' + acc.positioning + '）' : '') + '。' +
      (acc && acc.audience ? '<br>目标受众：' + MW.esc(acc.audience) + '，用词和案例请对着这群人讲。' : '');

    return {
      id: MW.uid(), accountId: acc ? acc.id : '', topic: topic, type: type, platform: platform,
      titles: titles, hook: hook, outline: buildOutlines(type, topic), tags: tags, tips: tips,
      createdAt: MW.dateStr()
    };
  };

  MW.ai.draftText = function (d) {
    let s = '【标题候选】\n';
    d.titles.forEach(function (t, i) { s += (i + 1) + '. ' + t + '\n'; });
    s += '\n【开头钩子】\n' + d.hook + '\n\n【正文大纲】\n';
    d.outline.forEach(function (o, i) { s += (i + 1) + '. ' + o + '\n'; });
    s += '\n【推荐标签】\n' + d.tags.join(' ');
    return s;
  };

  /* ============================================================
     选题生成：按账号内容聚焦 + 6:2:1:1 配比造选题
     ============================================================ */
  const TYPE_REASON = {
    case: '案例型 · 真实项目跑通的过程，最能建立信任',
    method: '方法型 · 可复用的做法，利于收藏和长尾搜索',
    tool: '工具型 · 测评横评，标题最容易出爆款',
    review: '复盘型 · 踩坑与反思，沉淀人设和老粉'
  };
  const TITLE_TPL = {
    case: [
      '我把 {f} 完整跑了一遍：流程、成本和坑都在这',
      '{f} 实战记录：从 0 到 1，我到底花了多久',
      '用 {f} 帮客户省了多少钱？一次真实拆解',
      '{f} 落地 30 天：数据前后的对比长这样'
    ],
    method: [
      '{f}的 3 个关键判断，第 1 步就错的人最多',
      '别再瞎折腾：{f} 的正确顺序',
      '{f} 完整 SOP：照着做就能跑通（建议收藏）',
      '90% 的人做 {f} 都忽略了这一步'
    ],
    tool: [
      '{f} 工具横评：我测了 5 个，只有 2 个能打',
      '{f} 好用的 3 个工具，最后一个还免费',
      '10 分钟上手：{f} 工具实操教程',
      '{f} 工具避坑：我踩过的 3 个雷'
    ],
    review: [
      '一周复盘：{f} 这条线，我做对了什么',
      '{f} 踩坑复盘：3 个决策失误和补救办法',
      '30 天复盘：{f} 到底值不值得做',
      '把 {f} 从头复盘一遍：哪些动作可以复制'
    ]
  };

  /* 按配比挑下一个内容类型。
     做法：每一轮都算「这个类型理论上该出到第几条了」，挑落后最多的。
     固定序列（配 60% 就排 3 个案例再排 1 个方法）在小批量下会失真——
     只要取前 5 条，就只覆盖到序列开头那一小截，配比完全看不出来。
     这种「按差距补」的取法，出 5 条和出 50 条都能反映配比。 */
  MW.ai.pickType = function (acc, made) {
    const mix = MW.accMix(acc);
    const total = MW.mixTotal(mix) || 100;
    let best = 'case', bestGap = -1;
    MW.TOPIC_TYPE_LIST.forEach(function (t) {
      const pct = mix[t.key] / total;                 /* 合计不是 100 也按比例归一化 */
      const target = (made.total + 1) * pct;          /* 这一轮理论上该出到第几条 */
      const gap = target - (made[t.key] || 0);
      if (gap > bestGap + 1e-9) { bestGap = gap; best = t.key; }
    });
    return best;
  };

  MW.ai.ideas = function (accId, n, opt) {
    opt = opt || {};
    const db = MW.getDB();
    const acc = MW.accOf(accId) || db.accounts[0];
    if (!acc) return [];
    const focus = (acc.focus && acc.focus.length) ? acc.focus : ['这个方向'];
    const used = {};
    db.topics.forEach(function (t) { used[t.title] = 1; });
    db.contents.forEach(function (c) { used[c.title] = 1; });
    if (opt.exclude) opt.exclude.forEach(function (t) { used[t] = 1; });

    /* 类型跟账号配比走；老账号没有 mix → accMix 回落默认 6:2:1:1 */
    const made = { total: 0 };
    MW.TOPIC_TYPE_LIST.forEach(function (t) { made[t.key] = 0; });
    const out = [];
    let g = 0;
    while (out.length < n && g < 300) {
      g++;
      const f = focus[g % focus.length];
      const type = MW.ai.pickType(acc, made);
      const tpls = TITLE_TPL[type];
      const tpl = tpls[Math.floor(g / focus.length) % tpls.length];
      const title = tpl.replace(/\{f\}/g, f);
      if (used[title]) continue;
      used[title] = 1;
      made[type]++; made.total++;
      out.push({ title: title, type: type, focus: f, reason: TYPE_REASON[type] });
    }
    return out;
  };

  /* 营销节点借势选题 */
  MW.ai.nodeIdea = function (accId, node) {
    const db = MW.getDB();
    const acc = MW.accOf(accId) || db.accounts[0];
    if (!acc || !node) return null;
    const f = (acc.focus && acc.focus[0]) || '这个方向';
    return {
      title: '「' + node.name + '」节点：' + f + ' 该怎么提前布局',
      type: 'method', focus: f,
      reason: '营销节点借势：' + node.name + '（' + node.date.slice(5) + '）'
    };
  };

  /* ============================================================
     一周排期：用库存填空档，不够的 AI 现造
     opt: { days }  返回 { items, need, busy, node, msg }
     ============================================================ */
  MW.ai.weekPlan = function (accId, opt) {
    opt = opt || {};
    const db = MW.getDB();
    const acc = MW.accOf(accId) || db.accounts[0];
    if (!acc) return { items: [], msg: '先在账号矩阵添加账号' };
    const days = opt.days || 7;
    const t = MW.dateStr();
    const cadence = +acc.cadence || 3;

    /* 区间内已排的日期（避免一天堆太多） */
    const busy = {};
    db.contents.forEach(function (c) {
      if (c.accountId !== acc.id || c.date <= t) return;
      if (c.date > MW.addDays(t, days)) return;
      busy[c.date] = (busy[c.date] || 0) + 1;
    });
    let already = 0;
    Object.keys(busy).forEach(function (k) { already += busy[k]; });

    const need = Math.max(0, Math.round(cadence * days / 7) - already);
    const dayList = [];
    for (let i = 1; i <= days; i++) dayList.push(MW.addDays(t, i));
    dayList.sort(function (a, b) { return (busy[a] || 0) - (busy[b] || 0) || a.localeCompare(b); });

    /* 区间内的营销节点 */
    let node = null;
    MW.MARKETING.forEach(function (n) {
      const d = n.date;
      if (!node && d > t && d <= MW.addDays(t, days)) node = n;
    });

    const items = [];

    /* 先用库存里还没排期的选题 */
    const PRIO = { high: 0, mid: 1, low: 2 };
    const stock = db.topics.filter(function (x) {
      if (x.accountId !== acc.id) return false;
      if (x.stage === 'published' || x.stage === 'retro') return false;
      return !db.contents.some(function (c) { return c.topicId === x.id; });
    }).sort(function (a, b) {
      return (PRIO[a.priority] || 1) - (PRIO[b.priority] || 1) || (a.due || '9').localeCompare(b.due || '9');
    });

    const genList = MW.ai.ideas(acc.id, Math.max(0, need - stock.length), { exclude: stock.map(function (s) { return s.title; }) });
    let si = 0, gi = 0;
    let pending = [];
    if (node && need > 0) pending.push(MW.ai.nodeIdea(acc.id, node));

    for (let k = 0; k < need; k++) {
      const date = dayList[k % dayList.length];
      if (si < stock.length) {
        const tp = stock[si++];
        items.push({
          date: date, time: MW.ai.pfTime(acc.platform), title: tp.title, type: tp.type,
          source: 'stock', topicId: tp.id,
          reason: '库存选题 · ' + ({ high: '高优先级', mid: '中优先级', low: '低优先级' }[tp.priority] || '中')
        });
      } else if (pending.length) {
        const it = pending.shift();
        items.push({
          date: node.date > t ? node.date : date, time: MW.ai.pfTime(acc.platform),
          title: it.title, type: it.type, source: 'node', topicId: '', reason: it.reason
        });
      } else if (gi < genList.length) {
        const it = genList[gi++];
        items.push({
          date: date, time: MW.ai.pfTime(acc.platform),
          title: it.title, type: it.type, source: 'ai', topicId: '', reason: it.reason
        });
      }
    }
    items.sort(function (a, b) { return a.date.localeCompare(b.date) || a.time.localeCompare(b.time); });

    let msg = '';
    if (!need) msg = '未来 ' + days + ' 天已排满（' + already + ' 篇），不用补';
    else if (!items.length) msg = '库存和生成都没有可用选题';
    return { items: items, need: need, already: already, node: node, msg: msg };
  };

  /* ============================================================
     热点二创角度
     ============================================================ */
  MW.ai.hotAngles = function (hot, accId) {
    const db = MW.getDB();
    const acc = MW.accOf(accId) || db.accounts[0];
    const f = (acc && acc.focus && acc.focus[0]) || '这个方向';
    if (!hot) return [];
    return [
      { title: hot.title + '｜我实测了一遍，结论和传闻不一样', type: 'case',
        note: '蹭时效：48 小时内发，标题带原热点关键词' },
      { title: hot.title + '，对' + f + '意味着什么', type: 'method',
        note: '换视角：把热点拉回自己的账号定位' },
      { title: '别被「' + hot.title + '」带偏：3 个冷静判断', type: 'review',
        note: '反着说：观点文更容易被转发和讨论' }
    ];
  };

  /* ============================================================
     数据诊断：把数字翻译成下一步动作
     ============================================================ */
  MW.ai.retro = function (c) {
    const db = MW.getDB();
    const m = c.metrics || {};
    const num = function (k) { return +m[k] || 0; };
    const views = num('views');
    const inter = num('likes') + num('comments') + num('collects') + num('shares');
    const eng = views ? inter / views * 100 : 0;

    const peers = db.contents.filter(function (x) {
      return x.accountId === c.accountId && x.status === 'published' && x.metrics && +x.metrics.views > 0;
    });
    const avgV = peers.length ? peers.reduce(function (s, x) { return s + (+x.metrics.views || 0); }, 0) / peers.length : 0;
    const avgE = peers.length ? peers.reduce(function (s, x) {
      const mm = x.metrics, v = +mm.views || 0;
      return s + (v ? ((+mm.likes || 0) + (+mm.comments || 0) + (+mm.collects || 0) + (+mm.shares || 0)) / v * 100 : 0);
    }, 0) / peers.length : 0;

    let verdict = '还没有数据，发布后回来补录', level = 'info';
    if (views) {
      if (avgV && views >= avgV * 1.8) { verdict = '爆款（浏览是同账号均值的 ' + (views / avgV).toFixed(1) + ' 倍）'; level = 'hot'; }
      else if (avgV && views >= avgV) { verdict = '高于同账号均值'; level = 'good'; }
      else if (avgV) { verdict = '低于均值（是均值的 ' + Math.round(views / avgV * 100) + '%）'; level = 'low'; }
      else { verdict = '首篇数据，先跑出基准线'; level = 'info'; }
    }

    const lines = [];
    const cr = views ? num('collects') / views * 100 : 0;
    const lr = views ? num('likes') / views * 100 : 0;
    const cmr = views ? num('comments') / views * 100 : 0;
    const fr = views ? num('newFollowers') / views * 100 : 0;

    if (views) {
      if (cr >= 2 && cr >= lr * 0.5) lines.push('收藏率 ' + cr.toFixed(1) + '% 偏高：说明这是「资料/工具型」内容，值得做成系列，或改成清单体再发一次。');
      else if (lr > 0 && cr < lr * 0.2) lines.push('点赞高、收藏低：情绪共鸣有了，但「可复用价值」不足。下次加一份模板、清单或数据表。');
      if (fr < 0.5) lines.push('涨粉转化 ' + fr.toFixed(2) + '% 偏低（健康约 0.5%-1%）：结尾缺「关注理由」，加一句「下期讲 X」或资料引导。');
      else if (fr > 1.5) lines.push('涨粉转化 ' + fr.toFixed(2) + '% 很好：这条结构值得复用，建议拆成模板存进素材库。');
      if (cmr < 0.3) lines.push('评论率 ' + cmr.toFixed(2) + '% 偏低：结尾加一个开放式问题（「你踩过哪个坑」）能明显拉互动。');
      if (avgE) lines.push('互动率 ' + eng.toFixed(1) + '%，同账号均值 ' + avgE.toFixed(1) + '%' +
        (eng >= avgE ? '：高于均值，标题和人群是对上的。' : '：低于均值，重点怀疑标题/封面没对上目标人群。'));
    }

    const next = [];
    if (level === 'hot') {
      next.push('同一个选题换角度再发一次（同号二改 + 跨平台改写），爆款要榨干');
      next.push('把它做成系列，标题沿用这次的高点击结构');
    } else if (level === 'low') {
      next.push('保留正文，只换标题和封面再测一次');
      next.push('检查发布时间是否错过该平台流量高峰：' + MW.ai.pfTime(c.platform));
    } else if (level === 'good') {
      next.push('把这次的有效钩子固化成模板，存进素材库');
    } else {
      next.push('发布 24 小时后回来补录数据，才能出结论');
    }
    return { verdict: verdict, level: level, eng: eng, avgE: avgE, avgV: avgV, lines: lines, next: next };
  };

  /* ============================================================
     UI：AI 补排期（今日 / 日历 / 文案台共用）
     ============================================================ */
  let wpPlan = null;

  function wpBody(accId, days) {
    const db = MW.getDB();
    if (!db.accounts.length) return '<div class="form-hint">先在账号矩阵添加账号</div>';
    const plan = MW.ai.weekPlan(accId, { days: days });
    wpPlan = plan;
    const acc = MW.accOf(accId) || db.accounts[0];

    let h = '<div class="wp-form">' +
      '<div class="wp-field"><label>账号</label>' +
      MW.ui.select('wp-acc', db.accounts.map(function (a) { return { v: a.id, t: a.name + '（' + MW.PLATFORMS[a.platform].name + '）' }; }), acc.id, 'wp-acc-sel') +
      '</div>' +
      '<div class="wp-field"><label>排期范围</label>' +
      MW.ui.select('wp-days', [{ v: '7', t: '未来 7 天' }, { v: '14', t: '未来 14 天' }], String(days), 'wp-days-sel') +
      '</div></div>';

    h += '<div class="wp-summary">周更目标 <b>' + (acc.cadence || 3) + ' 篇</b> · 已排 <b>' + plan.already +
      ' 篇</b> · 本次补 <b>' + plan.need + ' 篇</b>' +
      (plan.node ? ' · 区间内有节点 <b>' + plan.node.name + '</b>' : '') + '</div>';

    if (plan.msg) h += '<div class="wp-msg">' + MW.esc(plan.msg) + '</div>';
    if (!plan.items.length) return h;

    h += '<div class="wp-list">' + plan.items.map(function (it, i) {
      const ty = MW.TOPIC_TYPES[it.type] || MW.TOPIC_TYPES.case;
      const srcCls = it.source === 'stock' ? 'stock' : (it.source === 'node' ? 'node' : 'ai');
      const srcTxt = it.source === 'stock' ? '库存' : (it.source === 'node' ? '节点' : 'AI');
      return '<label class="wp-row">' +
        '<input type="checkbox" id="wp-' + i + '" checked>' +
        '<span class="wp-date">' + it.date.slice(5) + ' ' + MW.weekdayCN(it.date) + '<i>' + it.time + '</i></span>' +
        '<span class="wp-main"><span class="wp-title">' + MW.esc(it.title) + '</span>' +
        '<span class="wp-reason">' + MW.esc(it.reason) + '</span></span>' +
        '<span class="wp-type" style="--tc:' + ty.color + '">' + ty.name + '</span>' +
        '<span class="wp-src ' + srcCls + '">' + srcTxt + '</span>' +
        '</label>';
    }).join('') + '</div>';
    h += '<div class="form-hint">默认已按周更节奏铺开，可直接改；创建后去内容日历拖拽微调时间。</div>';
    return h;
  }

  MW.act.aiWeekPlanModal = function (accId, days) {
    const db = MW.getDB();
    if (!db.accounts.length) { MW.toast('先在账号矩阵添加账号', 'error'); return; }
    const cur = MW.curAcc();
    if (!accId) accId = (cur !== 'all' ? cur : (db.accounts[0] ? db.accounts[0].id : ''));
    days = days || 7;

    MW.modal({
      title: 'AI 补排期', size: 'lg',
      sub: '按周更节奏铺开，先用库存选题填空档，不够的按内容聚焦现造',
      body: '<div id="wp-box">' + wpBody(accId, days) + '</div>',
      okText: '创建排期',
      onOk: function (root) {
        const plan = wpPlan;
        if (!plan || !plan.items.length) { MW.toast('没有需要补的排期'); return; }
        let n = 0;
        plan.items.forEach(function (it, i) {
          const cb = root.querySelector('#wp-' + i);
          if (!cb || !cb.checked) return;
          let tid = it.topicId;
          if (!tid) {
            const tp = {
              id: MW.uid(), title: it.title, accountId: accId, type: it.type,
              stage: 'scheduled', priority: 'mid', due: it.date, owner: '我',
              focus: MW.guessFocus(accId, it.title),
              note: 'AI 补排期生成：' + it.reason, createdAt: MW.dateStr()
            };
            db.topics.push(tp);
            tid = tp.id;
          } else {
            const tp = db.topics.find(function (x) { return x.id === tid; });
            if (tp) { tp.stage = 'scheduled'; if (!tp.due) tp.due = it.date; if (!tp.focus) tp.focus = MW.guessFocus(accId, it.title); }
          }
          db.contents.push({
            id: MW.uid(), title: it.title, accountId: accId, platform: (MW.accOf(accId) || {}).platform || 'other',
            date: it.date, time: it.time, status: 'scheduled', topicId: tid,
            focus: MW.guessFocus(accId, it.title),
            metrics: null, note: 'AI 补排期', createdAt: MW.dateStr()
          });
          n++;
        });
        MW.save(); MW.render();
        MW.toast(n ? '已创建 ' + n + ' 条排期，去日历可拖拽微调' : '没有勾选任何条目');
        if (n) setTimeout(function () { MW.goto('#/calendar'); }, 400);
      }
    });

    const accSel = document.getElementById('wp-acc');
    const daySel = document.getElementById('wp-days');
    function refresh() {
      const box = document.getElementById('wp-box');
      if (!box) return;
      accId = accSel ? accSel.value : accId;
      days = daySel ? +(daySel.value) || 7 : 7;
      box.innerHTML = wpBody(accId, days);
      bind();
    }
    function bind() {
      const a = document.getElementById('wp-acc'); if (a) a.onchange = refresh;
      const d = document.getElementById('wp-days'); if (d) d.onchange = refresh;
    }
    bind();
  };

  /* ============================================================
     UI：AI 补选题（看板 / 灵感页用）
     ============================================================ */
  MW.act.aiFillIdeas = function (accId, n) {
    const db = MW.getDB();
    const cur = MW.curAcc();
    if (!accId) accId = (cur !== 'all' ? cur : (db.accounts[0] ? db.accounts[0].id : ''));
    if (!accId) { MW.toast('先在账号矩阵添加账号', 'error'); return; }
    n = n || 3;
    const list = MW.ai.ideas(accId, n);
    if (!list.length) { MW.toast('没有可生成的选题', 'error'); return; }

    MW.modal({
      title: 'AI 补 ' + list.length + ' 个选题',
      sub: '按账号内容聚焦 + 6:2:1:1 配比生成，可直接勾选入库',
      body: '<div class="wp-list">' + list.map(function (it, i) {
        const ty = MW.TOPIC_TYPES[it.type];
        return '<label class="wp-row">' +
          '<input type="checkbox" id="fi-' + i + '" checked>' +
          '<span class="wp-main"><span class="wp-title">' + MW.esc(it.title) + '</span>' +
          '<span class="wp-reason">' + MW.esc(it.reason) + '</span></span>' +
          '<span class="wp-type" style="--tc:' + ty.color + '">' + ty.name + '</span></label>';
      }).join('') + '</div>',
      okText: '入库',
      onOk: function (root) {
        let n2 = 0;
        list.forEach(function (it, i) {
          const cb = root.querySelector('#fi-' + i);
          if (!cb || !cb.checked) return;
          db.topics.push({
            id: MW.uid(), title: it.title, accountId: accId, type: it.type, stage: 'idea',
            priority: 'mid', due: '', owner: '我', focus: MW.guessFocus(accId, it.title),
            note: 'AI 生成（' + it.reason + '）', createdAt: MW.dateStr()
          });
          n2++;
        });
        MW.save(); MW.render();
        MW.toast(n2 ? '已入库 ' + n2 + ' 个选题，在「灵感池」' : '没有勾选任何选题');
      }
    });
  };

  /* ============================================================
     UI：灵感 / 热点 AI 扩写
     ============================================================ */
  MW.act.aiExpandIdea = function (id) {
    const db = MW.getDB();
    const it = db.inspirations.find(function (x) { return x.id === id; });
    if (!it) return;
    const accId = it.accountId || (db.accounts[0] ? db.accounts[0].id : '');
    const d = MW.ai.gen({ accountId: accId, topic: it.title, type: 'case' });
    const acc = MW.accOf(accId);
    MW.modal({
      title: 'AI 扩写灵感', size: 'lg',
      sub: (acc ? acc.name + ' · ' : '') + it.title,
      body: '<div class="ai-mini">' +
        '<div class="ai-mini-sec"><b>标题候选</b>' + d.titles.map(function (t) {
          return '<div class="ai-mini-line">' + MW.esc(t) + '</div>';
        }).join('') + '</div>' +
        '<div class="ai-mini-sec"><b>开头钩子</b><div class="ai-mini-line">' + MW.esc(d.hook) + '</div></div>' +
        '<div class="ai-mini-sec"><b>正文大纲</b>' + d.outline.map(function (o, i) {
          return '<div class="ai-mini-line">' + (i + 1) + '. ' + MW.esc(o) + '</div>';
        }).join('') + '</div>' +
        '<div class="ai-mini-sec"><b>推荐标签</b><div class="ai-mini-line">' + d.tags.join(' · ') + '</div></div>' +
        '</div>',
      okText: '存为选题',
      onOk: function () {
        db.topics.push({
          id: MW.uid(), title: d.titles[0], accountId: accId, type: 'case', stage: 'review',
          priority: 'mid', due: MW.addDays(MW.dateStr(), 3), owner: '我',
          focus: MW.guessFocus(accId, d.titles[0] + ' ' + it.title),
          note: 'AI 扩写自灵感「' + it.title + '」', createdAt: MW.dateStr()
        });
        db.inspirations = db.inspirations.filter(function (x) { return x.id !== id; });
        MW.save(); MW.render();
        MW.toast('已存为选题，去「待评审」看看');
      }
    });
  };

  MW.act.aiHotAngles = function (id) {
    const db = MW.getDB();
    const hs = db.hotspots.find(function (x) { return x.id === id; });
    if (!hs) return;
    /* 与「热点转选题」用同一套挑选逻辑，保证热点落到对的号上 */
    const accId = MW.pickAcc(hs.title + ' ' + (hs.category || ''), hs.platform);
    if (!accId) { MW.toast('先在账号矩阵添加账号', 'error'); return; }
    const angles = MW.ai.hotAngles(hs, accId);
    MW.modal({
      title: '热点二创角度', sub: hs.title + ' · 热度 ' + hs.heat,
      body: '<div class="wp-list">' + angles.map(function (a, i) {
        const ty = MW.TOPIC_TYPES[a.type];
        return '<label class="wp-row">' +
          '<input type="checkbox" id="ha-' + i + '"' + (i === 0 ? ' checked' : '') + '>' +
          '<span class="wp-main"><span class="wp-title">' + MW.esc(a.title) + '</span>' +
          '<span class="wp-reason">' + MW.esc(a.note) + '</span></span>' +
          '<span class="wp-type" style="--tc:' + ty.color + '">' + ty.name + '</span></label>';
      }).join('') + '</div>' +
        '<div class="form-hint">热点 48 小时内发才有流量，选中后直接进「待评审」。</div>',
      okText: '转为选题',
      onOk: function (root) {
        let n = 0;
        angles.forEach(function (a, i) {
          const cb = root.querySelector('#ha-' + i);
          if (!cb || !cb.checked) return;
          db.topics.push({
            id: MW.uid(), title: a.title, accountId: accId, type: a.type, stage: 'review',
            priority: 'high', due: MW.addDays(MW.dateStr(), 2), owner: '我',
            focus: MW.guessFocus(accId, a.title + ' ' + (hs.category || '')),
            note: '热点二创：' + hs.title + '（' + a.note + '）', createdAt: MW.dateStr()
          });
          n++;
        });
        MW.save(); MW.render();
        MW.toast(n ? '已转 ' + n + ' 个选题，快发' : '没有勾选任何角度');
      }
    });
  };

  /* ============================================================
     账号资料 AI 识别
     把任意 AI 平台写好的账号描述整段粘贴进来，抽成结构化字段。
     纯本地规则 + 启发式，不联网；接真实大模型时把 MW.ai.parseAccount
     换成 API 调用即可，调用方无需改动。
     ============================================================ */

  /* 字段别名表：同一个信息 AI 可能写成十几种叫法，按长度优先匹配 */
  const ACC_LABELS = {
    platform:      ['发布平台', '所在平台', '主阵地', '主平台', '平台选择', '平台', 'platform'],
    name:          ['账号名称', '账号名字', '账号昵称', '昵称建议', '推荐昵称', '账号名', '昵称', '名称', '名字', '名称建议', 'account name', 'name'],
    accountId:     ['账号id', '小红书号', '抖音号', '公众号id', '主页链接', '账号链接', '主页地址', '主页', '链接', 'handle', 'accountid', 'id', '账号'],
    positioning:   ['账号定位', '一句话定位', '定位语', '账号简介', '简介文案', '人设定位', '人设', '定位', '简介', '账号描述', 'bio', 'positioning'],
    style:         ['内容风格', '风格调性', '文案调性', '调性', '文风', '风格', 'style'],
    audience:      ['目标受众', '受众', '目标人群', '人群画像', '面向人群', '读者画像', '给谁看', '面向', '读者', 'audience'],
    tone:          ['表达风格', '叙述风格', '叙述方式', '语气', '人称', '怎么说', 'voice', 'tone'],
    focus:         ['内容聚焦', '聚焦方向', '内容方向', '选题方向', '内容领域', '内容主题', '主题方向', '内容栏目', '赛道定位', '标签建议', '聚焦', '方向', '赛道', '栏目', '标签', '领域', '主题', 'tags', 'tag'],
    followers:     ['当前粉丝', '现有粉丝', '粉丝数量', '粉丝基数', '粉丝数', '粉丝量', '粉丝', 'followers', 'fans'],
    goalFollowers: ['涨粉目标', '粉丝目标', '目标粉丝数', '粉丝数目标', '目标粉丝', '涨粉'],
    cadence:       ['周更频率', '更新频率', '发布频率', '更新频次', '更新节奏', '每周更新', '周更', '频率', '节奏'],
    goalPosts:     ['月更目标', '月更新目标', '每月发布目标', '月更数量', '月更']
  };

  /* 平台别名：长词在前，避免「微信公众号」被「公众号」抢掉 */
  const PF_ALIAS = [
    ['微信公众号', 'gzh'], ['微信视频号', 'sph'], ['rednote', 'xhs'], ['red note', 'xhs'],
    ['小红书', 'xhs'], ['douyin', 'dy'], ['tiktok', 'dy'], ['抖音', 'dy'],
    ['bilibili', 'bili'], ['b站', 'bili'], ['视频号', 'sph'], ['公众号', 'gzh'],
    ['linkedin', 'li'], ['领英', 'li'], ['知乎', 'zhihu'], ['weibo', 'wb'], ['微博', 'wb'],
    ['youtube', 'yt'], ['油管', 'yt'], ['twitter', 'x'], ['推特', 'x'], ['即刻', 'other']
  ];

  /* 把标签名洗干净：去 markdown 符号、括号补充说明、emoji、空格 */
  function normLabel(s) {
    return String(s || '')
      .replace(/[（(][^）)]{0,20}[）)]/g, '')
      .replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '')
      .toLowerCase();
  }

  /* 一行文本去装饰：井号、引用符、项目符号、序号 */
  function cleanLine(s) {
    return String(s || '')
      .replace(/^\s*>+/, '')
      .replace(/^\s*[-*•·]+\s*/, '')
      .replace(/^\s*\d+[.、)）:：](?=\s|$)/, '')     /* 去掉序号，但不误伤「1.2万」这类小数 */
      .replace(/^\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '')
      .replace(/^\s*[【\[]\s*/, '')                      /* 【字段】是 AI 输出小标题最常见的写法，要剥掉 */
      .replace(/\s*[】\]]\s*$/, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .trim();
  }

  /* 取值去首尾修饰：引号、方括号、序号、句末标点 */
  function cleanVal(s) {
    return String(s || '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/^\s*[-•·]\s*/, '')
      .replace(/^\s*\d+[.、)）](?=\s|$)/, '')        /* 同上：别把 1.2 拆成 2 */
      .replace(/^\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '')
      .replace(/^\s*[【\[]\s*/, '')                      /* 同上 */
      .replace(/\s*[】\]]\s*$/, '')
      .replace(/[，、;；]\s*$/, '')
      .replace(/^[\s"'“”‘’「」『』【】\[\]]+|[\s"'“”‘’「」『』【】\[\]]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* 标签归属到字段：先精确等长匹配，再包含匹配 */
  function labelKey(raw) {
    const n = normLabel(raw);
    if (!n || n.length > 16) return '';
    let best = '', bestLen = 0, i, j, a;
    for (i in ACC_LABELS) {
      for (j = 0; j < ACC_LABELS[i].length; j++) {
        a = ACC_LABELS[i][j].replace(/\s+/g, '');
        if (n === a && a.length > bestLen) { best = i; bestLen = a.length; }
      }
    }
    if (best) return best;
    /* 包含匹配：允许「内容聚焦建议从这三个方向走」这种带尾巴的说法 */
    for (i in ACC_LABELS) {
      for (j = 0; j < ACC_LABELS[i].length; j++) {
        a = ACC_LABELS[i][j].replace(/\s+/g, '');
        if (a.length < 3) continue;                                     /* 两字太泛，只在完全相等时认 */
        if (n.indexOf(a) >= 0 && n.length <= a.length + 12 && a.length > bestLen) { best = i; bestLen = a.length; }
      }
    }
    return best;
  }

  /* 句子式写法：「账号名称我建议叫 xxx」「风格上建议做成 xxx」——没有冒号也能认 */
  const SENT_TRG = {
    name: ['账号名称', '账号名', '昵称建议', '推荐昵称', '昵称', '名称', '名字'],
    accountId: ['账号id', '小红书号', '抖音号', '主页链接', '主页'],
    positioning: ['账号定位', '一句话定位', '定位', '人设'],
    style: ['内容风格', '风格调性', '文案调性', '调性', '风格', '文风'],
    focus: ['内容聚焦', '聚焦方向', '内容方向', '选题方向', '内容领域', '内容主题', '聚焦'],
    followers: ['当前粉丝', '现有粉丝', '粉丝数', '粉丝量', '粉丝'],
    cadence: ['周更频率', '更新频率', '发布频率', '更新频次', '周更'],
    goalFollowers: ['涨粉目标', '粉丝目标', '目标粉丝'],
    platform: ['发布平台', '所在平台', '主阵地', '平台']
  };
  const SENT_LEAD = {
    name: '(?:我)?(?:建议|推荐|可以|不妨|考虑|觉得)?(?:叫|叫做|叫成|取名|起名为|起名|定为|改成|用|设为|是|为)?',
    positioning: '(?:一句话)?(?:可以|建议|推荐|应该)?(?:是|为|写成|定为|做成|走|放在|聚焦在|围绕)?',
    style: '(?:上|方面)?(?:建议|推荐|可以)?(?:做成|走|偏|偏向|采用|用|是|保持|定位为|定为|为)?',
    accountId: '(?:是|为|:|：)?',
    followers: '(?:大概|大约|约|目前|现在|当前)?(?:是|为|有|在|大概)?',
    platform: '(?:建议|可以|选择|放在|主做|选)?(?:是|为|放在|深耕|选)?',
    defaultLead: '(?:建议|推荐|可以|应该)?(?:是|为|放在|定为)?'
  };

  /* 一行以哪个触发词开头就归哪个字段：长的优先，避免「粉丝目标」被当成「粉丝」 */
  function triggerKey(cl) {
    let best = '', bestLen = 0;
    for (const k in SENT_TRG) {
      for (let i = 0; i < SENT_TRG[k].length; i++) {
        const t = SENT_TRG[k][i];
        if (cl.indexOf(t) === 0 && t.length > bestLen) { best = k; bestLen = t.length; }
      }
    }
    return best;
  }

  function fromSentence(cl, key) {
    let trg = '';
    SENT_TRG[key].forEach(function (t) { if (cl.indexOf(t) === 0 && t.length > trg.length) trg = t; });
    if (!trg) return '';
    let s = cl.slice(trg.length)
      .replace(new RegExp('^' + (SENT_LEAD[key] || SENT_LEAD.defaultLead)), '')
      .replace(/^[:：\s，,、的是还是]+/, '')
      .replace(/^[是为于到]+\s*/, '');
    s = s.split(/[，,。；;！!？?\n（(]/)[0].trim();
    s = cleanVal(s);
    if (key === 'followers' || key === 'goalFollowers') return String(parseNum(s) || '');
    if (key === 'cadence') {
      const n = parseNum(s);
      if (n) return String(n);
      if (/日更|每天/.test(s)) return '7';
      return '';
    }
    const max = { name: 30, positioning: 60, style: 24, accountId: 40, focus: 20, platform: 10 }[key] || 30;
    if (!s || s.length < 1 || s.length > max) return '';
    return s;
  }

  /* 带单位的数字：1.8万 / 5k / 12,000 */
  function parseNum(s) {
    if (s == null) return null;
    const m = String(s).replace(/[,，\s]/g, '').match(/(\d+(?:\.\d+)?)\s*(万|w|W|千|k|K)?/);
    if (!m) return null;
    let n = parseFloat(m[1]);
    const u = m[2];
    if (u === '万' || u === 'w' || u === 'W') n *= 10000;
    else if (u === '千' || u === 'k' || u === 'K') n *= 1000;
    return Math.round(n);
  }

  /* 平台：按出现次数取胜，同次数取靠前的 */
  function scanPlatform(txt) {
    const low = String(txt || '').toLowerCase();
    const score = {};
    PF_ALIAS.forEach(function (p) {
      const al = p[0].toLowerCase();
      if (al.length < 2) return;
      let idx = low.indexOf(al), n = 0, first = -1;
      while (idx >= 0) { if (first < 0) first = idx; n++; idx = low.indexOf(al, idx + al.length); }
      if (!n) return;
      if (!score[p[1]] || n > score[p[1]].n) score[p[1]] = { n: n, first: first };
    });
    let bestKey = '', best = null;
    Object.keys(score).forEach(function (k) {
      if (!best || score[k].n > best.n || (score[k].n === best.n && score[k].first < best.first)) { best = score[k]; bestKey = k; }
    });
    return bestKey;
  }

  /* 平台值单独判断：允许单独的 X / 其它兜底 */
  function platformOf(v) {
    const low = String(v || '').toLowerCase().trim();
    if (!low) return '';
    const hit = scanPlatform(low);
    if (hit) return hit;
    if (/^x$/.test(low) || /(^|[^a-z])x([^a-z]|$)/.test(low)) return 'x';
    return '';
  }

  /* 从主页链接里抠出 ID */
  function extractId(v) {
    let s = String(v || '').trim();
    const md = s.match(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
    if (md) s = md[1];
    const q = s.match(/[?&](?:id|uid|user_id|mid)=([A-Za-z0-9_.-]{2,40})/);
    if (q) return q[1];
    const pathOnly = s.split(/[?#]/)[0];
    if (/^https?:\/\//i.test(pathOnly) || /[\w-]+\.[a-z]{2,}\//i.test(pathOnly)) {
      const segs = pathOnly.split('/').filter(Boolean);
      for (let i = segs.length - 1; i >= 0; i--) {
        const seg = segs[i];
        if (/=/.test(seg) || /\.(html?|php|aspx?)$/i.test(seg)) continue;
        if (/^(https?|www|com|cn|net|user|profile|home|index|space|u|p|channel|c)$/i.test(seg)) continue;
        if (seg.length >= 2 && seg.length <= 40) return seg;
      }
    }
    return s.replace(/^@/, '').replace(/\s+/g, '').slice(0, 40);
  }

  /* 列表型值：换行 / 顿号 / 逗号 / 数组写法都认 */
  function parseList(val) {
    const raw = String(val || '');
    let items = null;
    const quoted = raw.match(/["“'']([^"”'']{1,24})["”'']/g);
    if (quoted && quoted.length >= 2) {
      items = quoted.map(function (s) { return s.replace(/["“”'']/g, '').trim(); });
    }
    if (!items) {
      items = raw.split(/[\n、,，;；/｜|]+/)
        .map(cleanVal)
        .filter(Boolean);
    }
    const out = [];
    items.forEach(function (it) {
      let s = String(it)
        .replace(/[（(]\s*\d+%?\s*[）)]/g, '')      // 去掉 (40%) 这类配比标注
        .replace(/[：:].*$/, '')                     // 「AI工具：xxx」只取前半段
        .replace(/^\d+[.、)](?=\s|$)/, '')
        .trim();
      if (!s || s.length > 20 || s.length < 1) return;
      if (/[。？?！!]$/.test(s)) return;             // 像句子的丢掉
      if (out.indexOf(s) < 0) out.push(s);
    });
    return out.slice(0, 8);
  }

  /* 标量：只取第一句，避免把整段话塞进短字段 */
  function shortText(v, max) {
    const s = String(v || '').split(/[\n。！；;]/).map(function (x) { return cleanVal(x); }).filter(Boolean)[0] || '';
    return s.length > max ? s.slice(0, max) : s;
  }

  /* markdown 表格：表头能认出字段时，取第一行数据 */
  function parseTable(lines) {
    const rows = [];
    lines.forEach(function (l) {
      const t = l.trim();
      if (t.indexOf('|') < 0) return;
      rows.push(t.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }));
    });
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].length < 2 || rows[i].length !== rows[i - 1].length) continue;
      const isSep = rows[i].every(function (c) { return /^:?-{2,}:?$/.test(c); });
      if (!isSep) continue;
      const head = rows[i - 1];
      const named = head.map(function (h) { return labelKey(h); });
      const res = {};
      /* 表头是「字段 / 内容」这种通用两列表 → 每行当成一个「键：值」 */
      if (head.length === 2 && !named[0] && !named[1]) {
        for (let j = i + 1; j < rows.length; j++) {
          if (rows[j].length < 2) continue;
          const k = labelKey(rows[j][0]);
          if (k && rows[j][1] && !res[k]) res[k] = cleanVal(rows[j][1]);
        }
      } else {
        for (let j = i + 1; j < rows.length; j++) {
          if (rows[j].length !== head.length) continue;
          if (!rows[j].some(function (c) { return c; })) continue;
          head.forEach(function (h, k) {
            if (named[k] && rows[j][k] && !res[named[k]]) res[named[k]] = cleanVal(rows[j][k]);
          });
          break;
        }
      }
      return Object.keys(res).length ? res : null;
    }
    return null;
  }

  MW.ai.parseAccount = function (text) {
    const raw = String(text || '').replace(/\r/g, '');
    const lines = raw.split('\n');
    const got = {};          /* key -> 原始值字符串 */
    let focusLines = [];
    let order = [];          /* 保持「谁先识别到」的顺序，用于回显 */

    function set(k, v) {
      const val = String(v == null ? '' : v).trim();
      if (!val) return;
      if (order.indexOf(k) < 0) order.push(k);
      if (k === 'focus') focusLines = focusLines.concat(val.split('\n'));
      else if (!got[k]) got[k] = val;
    }

    /* 1) 表格优先 */
    const tbl = parseTable(lines);
    if (tbl) Object.keys(tbl).forEach(function (k) { set(k, tbl[k]); });

    /* 2) 逐行扫描：支持「标签：值」「**标签**：值」「## 标签 + 下方多行列项」*/
    let cur = '', curBuf = [];
    const flush = function () {
      if (!cur) { curBuf = []; return; }
      const body = curBuf.filter(function (s) { return String(s).trim(); }).map(cleanVal).join('\n').trim();
      if (body) set(cur, body);
      cur = ''; curBuf = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().indexOf('|') === 0) continue;          /* 表格行已在上面处理 */
      const cl = cleanLine(line);
      if (!cl) { flush(); continue; }
      if (/^[:：\-—=*\s]+$/.test(cl)) continue;              /* 分隔线 */

      const m = cl.match(/^(.{1,16}?)[:：]\s*(.*)$/);
      let key = '', val = '';
      if (m) { key = labelKey(m[1]); val = m[2]; }
      if (key) {
        flush();
        val = cleanVal(val);
        if (val) set(key, val);
        else { cur = key; curBuf = []; }
        continue;
      }
      /* 没有冒号：可能是句子式写法「账号名称我建议叫 xxx」，也可能是小标题 */
      const trig = triggerKey(cl);
      if (trig && trig !== cur) {
        flush();
        const sv = fromSentence(cl, trig);
        if (sv) set(trig, sv);
        else if (cl.length <= 16) { cur = trig; curBuf = []; }
        else if (trig === 'focus') { cur = trig; curBuf = []; }
        continue;
      }
      /* 无冒号的小标题，例如「## 内容聚焦」后面跟一堆列项 */
      const hk = labelKey(cl);
      if (hk && cl.length <= 16) { flush(); cur = hk; curBuf = []; continue; }
      if (cur) { curBuf.push(cl); }
    }
    flush();

    /* 3) 兜底：还没抓到的字段，再做一次句子级 / 全文扫描 */
    const byTrigger = function (key) {
      const ls = raw.split('\n');
      for (let i = 0; i < ls.length; i++) {
        const cl = cleanLine(ls[i]);
        if (!cl || triggerKey(cl) !== key) continue;
        const sv = fromSentence(cl, key);
        if (sv && String(sv).length >= (key === 'followers' || key === 'goalFollowers' ? 1 : 2)) return sv;
      }
      return '';
    };
    const mark = function (k, v) {
      got[k] = v;
      if (order.indexOf(k) < 0) order.push(k);
    };

    if (!got.name || got.name.length > 26) {
      const v = byTrigger('name');
      if (v) mark('name', v);
    }
    if (!got.style) { const v = byTrigger('style'); if (v) mark('style', v); }
    if (!got.positioning) { const v = byTrigger('positioning'); if (v) mark('positioning', v); }
    if (!got.platform) {
      /* 优先看明确写着「平台」的那一行 */
      let pf = platformOf(byTrigger('platform'));
      if (!pf) {
        for (let i = 0; i < lines.length && !pf; i++) {
          const cl = cleanLine(lines[i]);
          const m = cl.match(/^(.{0,10}(?:平台|阵地|主阵地)[^:：]{0,4})[:：]\s*(.+)$/);
          if (m) pf = platformOf(m[2]);
        }
      }
      if (!pf) pf = scanPlatform(raw);
      if (pf) mark('platform', MW.PLATFORMS[pf].name);
    }
    if (!got.followers) {
      const m1 = raw.match(/(\d[\d,.]*\s*(?:万|w|W|千|k|K)?)\s*\+?\s*(?:个)?\s*(?:粉丝|粉|fans|followers)/i);
      const m2 = raw.match(/(?:粉丝|粉|fans|followers)[^\d\n]{0,8}(\d[\d,.]*\s*(?:万|w|W|千|k|K)?)/i);
      const n = parseNum(m1 ? m1[1] : (m2 ? m2[1] : ''));
      if (n) mark('followers', String(n));
    }
    if (!got.goalFollowers) {
      const mg = raw.match(/(?:涨粉目标|粉丝目标|目标粉丝|目标先冲|先冲|冲到|目标定在|希望在|目标)[^\d\n]{0,6}(\d[\d,.]*\s*(?:万|w|W|千|k|K)?)/);
      const n = parseNum(mg ? mg[1] : '');
      if (n && n >= 10) mark('goalFollowers', String(n));
    }
    if (!got.cadence) {
      const v = byTrigger('cadence');
      let cad = v ? parseNum(v) : 0;
      if (!cad) {
        const mw = raw.match(/(?:周更|每周|一周)[^\d\n]{0,4}(\d+)\s*(?:篇|条|更|次)?/);
        if (mw) cad = +mw[1];
        else if (/日更|每天一?[更篇条]|天?天更/.test(raw)) cad = 7;
        else if (/隔天更|两天一更|两天一?篇/.test(raw)) cad = 3;
      }
      if (cad > 0) mark('cadence', String(cad));
    }
    if (!got.goalPosts) {
      const mm = raw.match(/月更[^\d\n]{0,4}(\d+)\s*(?:篇|条)?/);
      if (mm) mark('goalPosts', mm[1]);
    }
    if (!got.accountId) {
      const v = byTrigger('accountId');
      if (v) mark('accountId', v);
      else {
        const at = raw.match(/(?:^|\s)@([A-Za-z0-9_.-]{3,30})/);
        if (at) mark('accountId', at[1]);
      }
    }
    if (!focusLines.length) {
      /* 一行被顿号/逗号串起来的短词组，多半就是方向清单 */
      for (let i = 0; i < lines.length; i++) {
        const cl = cleanLine(lines[i]);
        if (!cl || cl.indexOf('：') >= 0 || cl.indexOf(':') >= 0) continue;
        if (got.name && cl === got.name) continue;
        if (/[。！？!?]$/.test(cl)) continue;             /* 一整句话不算清单 */
        const parts = cl.split(/[、，,／\/|｜]+/).map(cleanVal).filter(Boolean);
        if (parts.length >= 2 && cl.length <= 60 && parts.every(function (x) { return x.length <= 10; })) {
          focusLines = parts;
          break;
        }
      }
    }
    if (!got.name) {
      /* 最后兜底：第一行短标题，且不像一句话 */
      const first = cleanVal(cleanLine(lines[0] || ''));
      const junk = /^(好的|当然|以下是|下面|这是|为您|一份|账号方案|规划|定位|分析|\|)/;
      const looksSentence = /[，,、；;。！？?!：:]/.test(first);
      if (first && first.length >= 2 && first.length <= 20 && !junk.test(first) && !looksSentence && first.indexOf('|') < 0) {
        mark('name', first);
      }
    }

    /* 4) 归一化成表单字段 */
    const focus = parseList(focusLines.length ? focusLines.join('\n') : (got.focus || ''));
    const fields = {
      platform: platformOf(got.platform || ''),
      accountId: got.accountId ? extractId(got.accountId) : '',
      name: shortText(got.name, 30),
      style: shortText(got.style, 24),
      tone: shortText(got.tone, 40),
      positioning: shortText(got.positioning, 60),
      audience: shortText(got.audience, 40),
      focus: focus,
      followers: parseNum(got.followers) || 0,
      goalFollowers: parseNum(got.goalFollowers) || 0,
      cadence: parseNum(got.cadence) || 0,
      goalPosts: parseNum(got.goalPosts) || 0,
      status: /(暂停|停更|暂不运营|停止更新)/.test(raw) ? 'paused' : ''
    };

    /* 5) 回执：告诉用户认出了哪些、哪些还得手填 */
    const LABEL_CN = {
      platform: '平台', accountId: '账号 ID', name: '账号名称', style: '内容风格', tone: '表达风格',
      positioning: '定位', audience: '目标受众', focus: '内容聚焦', followers: '当前粉丝', goalFollowers: '涨粉目标',
      cadence: '周更频率', goalPosts: '月更目标', status: '状态'
    };
    const hits = [], missed = [];
    ['platform', 'name', 'accountId', 'positioning', 'audience', 'style', 'tone', 'focus', 'followers', 'goalFollowers', 'cadence', 'goalPosts'].forEach(function (k) {
      const v = fields[k];
      const empty = Array.isArray(v) ? !v.length : (v === '' || v === 0 || v == null);
      if (empty) { missed.push(k); return; }
      hits.push({
        k: k, label: LABEL_CN[k],
        text: Array.isArray(v) ? v.join('、') : (k === 'platform' ? MW.PLATFORMS[v].name : String(v))
      });
    });
    return { fields: fields, hits: hits, missed: missed };
  };

  /* 给「AI 识别」输入框用的示例，顺便告诉用户支持哪些格式 */
  MW.ai.accountSample =
    '账号名称：烟枪先森-AI搞钱\n' +
    '平台：小红书\n' +
    '账号 ID：yanqiang_ai\n' +
    '定位：用 AI 开发产品和业务系统的实战创业者\n' +
    '风格：干货实操\n' +
    '内容聚焦：\n' +
    '- AI工具实操\n' +
    '- 独立站\n' +
    '- 外贸CRM\n' +
    '更新频率：每周 3 篇\n' +
    '粉丝数：1860';

  /* ============================================================
     UI：单条内容 AI 诊断（复盘页用）
     ============================================================ */
  MW.act.aiRetro = function (id) {
    const db = MW.getDB();
    const c = db.contents.find(function (x) { return x.id === id; });
    if (!c) return;
    const r = MW.ai.retro(c);
    const lvColor = { hot: 'var(--red)', good: 'var(--teal)', low: 'var(--amber)', info: 'var(--text3)' }[r.level] || 'var(--text3)';
    let body = '<div class="retro-ai-head"><span class="retro-ai-verdict" style="--vc:' + lvColor + '">' + MW.esc(r.verdict) + '</span>' +
      '<span class="retro-ai-eng">互动率 ' + r.eng.toFixed(1) + '%（同账号均值 ' + r.avgE.toFixed(1) + '%）</span></div>';
    if (r.lines.length) {
      body += '<div class="retro-ai-sec"><b>看到的问题</b>' +
        r.lines.map(function (l) { return '<div class="retro-ai-line">' + MW.esc(l) + '</div>'; }).join('') + '</div>';
    }
    body += '<div class="retro-ai-sec"><b>下一步</b>' +
      r.next.map(function (l) { return '<div class="retro-ai-line">' + MW.icon('bolt', 12) + ' ' + MW.esc(l) + '</div>'; }).join('') + '</div>';

    MW.modal({
      title: 'AI 数据诊断', sub: c.title, body: body, okText: '知道了',
      onOk: function () { }
    });
  };

  /* ============================================================
     AI 接口（OpenAI 兼容 chat/completions）：选题工厂 / AI 复盘共用
     不配置也能用——所有 AI 功能都有本地降级方案

     服务商预设：国内常用 / 国外 / 本地模型 三大类。
     所有条目都走同一套 OpenAI 兼容协议，选一个即自动填好
     接口地址和推荐模型——不需要自己拼 URL。
     本地模型（Ollama / LM Studio 等）不校验密钥。
     ============================================================ */
  MW.AI_REGIONS = [
    { key: 'cn', name: '国内常用' },
    { key: 'global', name: '国外' },
    { key: 'local', name: '本地模型' }
  ];

  MW.AI_PROVIDERS = [
    /* ---------- 国内常用 ---------- */
    { key: 'zhipu', name: '智谱 GLM', region: 'cn',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      models: ['glm-4-flash', 'glm-4-air', 'glm-4-plus'], def: 'glm-4-flash',
      note: 'glm-4-flash 有免费额度，个人用够了', keyUrl: 'https://open.bigmodel.cn/' },
    { key: 'deepseek', name: 'DeepSeek', region: 'cn',
      baseUrl: 'https://api.deepseek.com/chat/completions',
      models: ['deepseek-chat', 'deepseek-reasoner'], def: 'deepseek-chat',
      note: '按量计费，价格低', keyUrl: 'https://platform.deepseek.com/api_keys' },
    { key: 'qwen', name: '通义千问', region: 'cn',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      models: ['qwen-plus', 'qwen-turbo', 'qwen-max'], def: 'qwen-plus',
      note: '阿里云百帆开通，新用户有免费额度', keyUrl: 'https://bailian.console.aliyun.com/' },
    { key: 'kimi', name: 'Kimi（月之暗面）', region: 'cn',
      baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
      models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'], def: 'moonshot-v1-8k',
      note: '长文本是强项', keyUrl: 'https://platform.moonshot.cn/' },
    { key: 'doubao', name: '豆包（火山方舟）', region: 'cn',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      models: ['doubao-pro-32k', 'doubao-lite-32k'], def: 'doubao-pro-32k',
      note: '模型名用你创建的「推理接入点」ID', keyUrl: 'https://console.volcengine.com/ark' },
    { key: 'hunyuan', name: '腾讯混元', region: 'cn',
      baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
      models: ['hunyuan-turbos-latest', 'hunyuan-lite'], def: 'hunyuan-turbos-latest',
      note: '', keyUrl: 'https://console.cloud.tencent.com/hunyuan' },
    { key: 'ernie', name: '文心一言（千帆）', region: 'cn',
      baseUrl: 'https://qianfan.baidubce.com/v2/chat/completions',
      models: ['ernie-4.5-turbo', 'ernie-speed'], def: 'ernie-4.5-turbo',
      note: '', keyUrl: 'https://console.bash.baidu.com/' },
    { key: 'minimax', name: 'MiniMax', region: 'cn',
      baseUrl: 'https://api.minimax.chat/v1/chat/completions',
      models: ['abab6.5s-chat', 'MiniMax-Text-01'], def: 'abab6.5s-chat',
      note: '', keyUrl: 'https://platform.minimaxi.com/' },
    { key: 'spark', name: '讯飞星火', region: 'cn',
      baseUrl: 'https://spark-api-open.xf-yun.com/v1/chat/completions',
      models: ['lite', 'generalv3', 'pro-128k'], def: 'lite',
      note: '', keyUrl: 'https://console.xfyun.cn/' },
    { key: 'siliconflow', name: '硅基流动', region: 'cn',
      baseUrl: 'https://api.siliconflow.cn/v1/chat/completions',
      models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-7B-Instruct', 'THUDM/glm-4-9b-chat'], def: 'deepseek-ai/DeepSeek-V3',
      note: '一个密钥用遍各家开源模型，注册送额度', keyUrl: 'https://cloud.siliconflow.cn/' },

    /* ---------- 国外 ---------- */
    { key: 'openai', name: 'OpenAI', region: 'global',
      baseUrl: 'https://api.openai.com/v1/chat/completions',
      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'o4-mini'], def: 'gpt-4o-mini',
      note: '需可访问 OpenAI 的网络环境', keyUrl: 'https://platform.openai.com/api-keys' },
    { key: 'claude', name: 'Anthropic Claude', region: 'global',
      baseUrl: 'https://api.anthropic.com/v1/chat/completions',
      models: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1'], def: 'claude-sonnet-4-5',
      note: '这是 Anthropic 的 OpenAI 兼容端点', keyUrl: 'https://console.anthropic.com/settings/keys' },
    { key: 'gemini', name: 'Google Gemini', region: 'global',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'], def: 'gemini-2.5-flash',
      note: 'aistudio 免费额度足够试手', keyUrl: 'https://aistudio.google.com/apikey' },
    { key: 'grok', name: 'xAI Grok', region: 'global',
      baseUrl: 'https://api.x.ai/v1/chat/completions',
      models: ['grok-4', 'grok-3-mini'], def: 'grok-3-mini',
      note: '', keyUrl: 'https://console.x.ai/' },
    { key: 'mistral', name: 'Mistral', region: 'global',
      baseUrl: 'https://api.mistral.ai/v1/chat/completions',
      models: ['mistral-small-latest', 'mistral-medium-latest'], def: 'mistral-small-latest',
      note: '', keyUrl: 'https://console.mistral.ai/api-keys' },
    { key: 'groq', name: 'Groq', region: 'global',
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
      models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'], def: 'llama-3.3-70b-versatile',
      note: '推理速度极快，有免费额度', keyUrl: 'https://console.groq.com/keys' },
    { key: 'openrouter', name: 'OpenRouter', region: 'global',
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      models: ['deepseek/deepseek-chat', 'anthropic/claude-sonnet-4.5', 'openrouter/auto'], def: 'openrouter/auto',
      note: '一个密钥调用几百个模型，国内网络多数可用', keyUrl: 'https://openrouter.ai/keys' },

    /* ---------- 本地模型 ---------- */
    { key: 'ollama', name: 'Ollama', region: 'local', noKey: true,
      baseUrl: 'http://localhost:11434/v1/chat/completions',
      models: ['qwen2.5', 'llama3.1', 'deepseek-r1'], def: 'qwen2.5',
      note: '装好 Ollama 后执行 ollama pull qwen2.5；无需密钥，完全离线', keyUrl: 'https://ollama.com/' },
    { key: 'lmstudio', name: 'LM Studio', region: 'local', noKey: true,
      baseUrl: 'http://localhost:1234/v1/chat/completions',
      models: ['本地已加载的模型名'], def: '',
      note: 'LM Studio 里加载模型并开启 Local Server；无需密钥，完全离线', keyUrl: 'https://lmstudio.ai/' },
    { key: 'vllm', name: 'vLLM', region: 'local', noKey: true,
      baseUrl: 'http://localhost:8000/v1/chat/completions',
      models: ['Qwen/Qwen2.5-7B-Instruct', 'meta-llama/Llama-3.1-8B-Instruct'], def: 'Qwen/Qwen2.5-7B-Instruct',
      note: '用 vllm serve 启动后填写对应模型名；无需密钥', keyUrl: 'https://docs.vllm.ai/' },
    { key: 'localai', name: 'LocalAI', region: 'local', noKey: true,
      baseUrl: 'http://localhost:8080/v1/chat/completions',
      models: ['gpt-3.5-turbo'], def: 'gpt-3.5-turbo',
      note: 'Docker 一键起服务；无需密钥，完全离线', keyUrl: 'https://localai.io/' }
  ];

  /* 按 key 找服务商；找不到（比如老配置没有 provider 字段）返回 null */
  MW.ai.provider = function (key) {
    if (!key) return null;
    for (let i = 0; i < MW.AI_PROVIDERS.length; i++) {
      if (MW.AI_PROVIDERS[i].key === key) return MW.AI_PROVIDERS[i];
    }
    return null;
  };

  MW.ai.aiConf = function () {
    const db = MW.getDB();
    return (db.settings && db.settings.ai) || { baseUrl: '', apiKey: '', model: '', provider: '' };
  };
  MW.ai.aiReady = function () {
    const s = MW.ai.aiConf();
    if (!s.baseUrl) return false;
    /* 本地模型不校验密钥——Ollama / LM Studio 们根本没有密钥这一说 */
    const p = MW.ai.provider(s.provider);
    if (p && p.noKey) return true;
    return !!s.apiKey;
  };

  /* 通用对话：返回文本；未配置 / 网络失败 / 返回空 一律返回 null，由调用方降级 */
  MW.ai.chat = function (prompt) {
    const s = MW.ai.aiConf();
    if (!s.baseUrl) return Promise.resolve(null);
    if (!MW.ai.aiReady()) return Promise.resolve(null);
    /* 本地服务商没有密钥也要带一个占位——有些服务端要求必须有
       Authorization 头，空值反而会 400 */
    const p = MW.ai.provider(s.provider);
    const token = s.apiKey || (p && p.noKey ? 'local' : '');
    return fetch(s.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        model: s.model || 'glm-4-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8
      })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      const c = d.choices && d.choices[0] && d.choices[0].message ? d.choices[0].message.content : '';
      return c && c.trim() ? c.trim() : null;
    }).catch(function () { return null; });
  };

  /* 账号简介：喂给大模型的上下文，IP 规范一次说清。
     这里就是「账号信息驱动内容」的落点——账号卡上填的每一项
     都会原样进 prompt，所以那边改一个字，所有生成都跟着变。 */
  MW.ai.accountBrief = function (acc) {
    if (!acc) return '你是资深自媒体策划。\n';
    const mix = MW.accMix(acc);
    const mixTxt = MW.TOPIC_TYPE_LIST.map(function (t) { return t.name + ' ' + mix[t.key] + '%'; }).join(' · ');
    return '你是自媒体账号「' + (acc.name || '') + '」（平台：' + (MW.PLATFORMS[acc.platform] ? MW.PLATFORMS[acc.platform].name : acc.platform) + '）的运营策划。\n'
      + '【账号定位】' + (acc.positioning || '无') + '\n'
      + '【目标受众】' + (acc.audience || '无') + '\n'
      + '【内容风格】' + (acc.style || '无') + '\n'
      + '【表达风格】' + (acc.tone || '无') + '\n'
      + '【内容聚焦】' + ((acc.focus || []).join('、') || '未设置') + '\n'
      + '【内容配比】' + mixTxt + '\n'
      + '请严格按上述定位、受众、语气与配比产出，不要输出与配比无关的内容类型。\n';
  };

  /* 标题猜选题类型：AI 生成的标题没有类型标注，入库时按 6:2:1:1 归类用 */
  MW.ai.guessType = function (title) {
    const s = String(title || '');
    if (/工具|横评|测评|神器|软件|app|APP|网站|插件/.test(s)) return 'tool';
    if (/复盘|踩坑|教训|翻车|反思|亏了|错了/.test(s)) return 'review';
    if (/方法|SOP|sop|步骤|流程|怎么|如何|指南|技巧|模板|清单/.test(s)) return 'method';
    return 'case';
  };

  /* ---------- UI：AI 接口设置 ---------- */

  /* 服务商下拉：国内 / 国外 / 本地 三组，外加「自定义」。
     选服务商时自动填接口地址、模型和密钥提示。 */
  function providerOptionsHtml(cur) {
    let h = '';
    MW.AI_REGIONS.forEach(function (r) {
      h += '<optgroup label="—— ' + r.name + ' ——">';
      MW.AI_PROVIDERS.forEach(function (p) {
        if (p.region !== r.key) return;
        h += '<option value="' + p.key + '"' + (cur === p.key ? ' selected' : '') + '>' + MW.esc(p.name) + '</option>';
      });
      h += '</optgroup>';
    });
    h += '<option value=""' + (!cur ? ' selected' : '') + '>自定义（已有接口地址）</option>';
    return h;
  }

  /* 切换服务商：填地址 / 模型 / 密钥提示 / 推荐模型列表 / 获取密钥入口 */
  MW.act.aiPickProvider = function (key) {
    const p = MW.ai.provider(key);
    const url = document.getElementById('ai-url');
    const model = document.getElementById('ai-model');
    const keyIn = document.getElementById('ai-key');
    const link = document.getElementById('ai-keylink');
    const dl = document.getElementById('ai-models');
    if (!p) {
      /* 自定义：只改密钥提示，不动用户已填的地址和模型 */
      if (keyIn) keyIn.placeholder = 'sk-...';
      if (dl) dl.innerHTML = '';
      if (link) link.innerHTML = '任意 OpenAI 兼容接口均可（含各类中转网关）';
      return;
    }
    if (url) url.value = p.baseUrl;
    if (model) model.value = p.def || '';
    if (keyIn) keyIn.placeholder = p.noKey ? '本地模型无需密钥' : p.name + ' 的 API Key';
    if (dl) {
      dl.innerHTML = (p.models || []).map(function (m) {
        return '<option value="' + MW.esc(m) + '"></option>';
      }).join('');
    }
    if (link) {
      /* 本地模型没有「密钥」一说，链接文案跟着换 */
      link.innerHTML = (p.note ? MW.esc(p.note) + ' · ' : '')
        + (p.keyUrl ? '<a class="ai-keylink" href="' + MW.esc(p.keyUrl) + '" target="_blank" rel="noopener">'
          + (p.noKey ? '了解 ' + MW.esc(p.name) + ' 安装方法 →' : '去 ' + MW.esc(p.name) + ' 开放平台获取密钥 →') + '</a>' : '');
    }
  };

  MW.act.aiSettings = function () {
    const s = MW.ai.aiConf();
    /* 老配置没有 provider 字段：地址是空的就默认选中智谱（有免费额度），
       已有地址的归到「自定义」，不覆盖人家填好的东西 */
    let cur = s.provider || '';
    if (!cur && !MW.ai.provider(cur) && !s.baseUrl) cur = 'zhipu';
    if (!MW.ai.provider(cur)) cur = '';

    const body =
      '<div class="form-hint" style="line-height:1.8">选一个服务商即自动填好接口——<b>国内常用 / 国外 / 本地模型</b>都支持，全部走 OpenAI 兼容协议。'
      + '<b>不配置也能用</b>：所有功能都有本地降级方案。接口信息只存在本机浏览器。</div>'
      + MW.ui.row('服务商', '<select id="ai-provider" onchange="MW.act.aiPickProvider(this.value)">' + providerOptionsHtml(cur) + '</select>',
          '<span id="ai-keylink"></span>')
      + MW.ui.row('接口地址（chat/completions）', '<input id="ai-url" placeholder="https://api.z.ai/api/paas/v4/chat/completions" value="' + MW.esc(s.baseUrl || '') + '">')
      + MW.ui.row('API Key', '<input id="ai-key" type="password" placeholder="sk-..." value="' + MW.esc(s.apiKey || '') + '">')
      + MW.ui.row('模型名称', '<input id="ai-model" list="ai-models" placeholder="glm-4-flash" value="' + MW.esc(s.model || '') + '">'
          + '<datalist id="ai-models"></datalist>');
    MW.modal({
      title: '⚙️ AI 接口设置', sub: '可选 · 不配置则用本地降级方案', body: body, okText: '保存',
      onOk: function (root) {
        const v = function (id) { return (root.querySelector('#' + id).value || '').trim(); };
        const db = MW.getDB();
        db.settings = db.settings || {};
        db.settings.ai = { provider: v('ai-provider'), baseUrl: v('ai-url'), apiKey: v('ai-key'), model: v('ai-model') };
        MW.save();
        MW.toast(MW.ai.aiReady() ? 'AI 接口已保存 ✅' : '已保存（未填完整，AI 功能继续用本地降级）');
      }
    });
    /* 弹窗是同步渲染的，这里 DOM 已在——按当前选择初始化一遍 */
    MW.act.aiPickProvider(cur);
  };

  /* ---------- UI：AI 结果展示（可复制全文） ---------- */
  MW.act.showAiText = function (title, sub, txt) {
    MW.modal({
      title: title, sub: sub || '', size: 'lg',
      body: '<textarea id="ai-out" rows="14" style="font-size:12.5px;line-height:1.8" readonly>' + MW.esc(txt) + '</textarea>'
        + '<div style="margin-top:10px;text-align:right"><button class="btn sm" onclick="MW.copy(document.getElementById(\'ai-out\').value);MW.toast(\'已复制全文\')">'
        + MW.icon('copy', 13) + ' 复制全文</button></div>',
      okText: '完成'
    });
  };

  /* ============================================================
     整体 AI 复盘：跨内容找规律——哪类选题能打、下次怎么复制
     ============================================================ */
  MW.ai.reviewAll = function () {
    const db = MW.getDB();
    const pubs = db.contents.filter(function (c) {
      return c.status === 'published' && c.metrics && +c.metrics.views > 0;
    }).sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 20);
    if (!pubs.length) return null;
    const stats = pubs.map(function (p) {
      const m = p.metrics;
      const acc = MW.accOf(p.accountId);
      const ty = (MW.TOPIC_TYPES[p.type] || MW.TOPIC_TYPES.case).name;
      return '《' + p.title + '》（' + ty + (p.focus ? ' · ' + p.focus : '') + '）' + (acc ? acc.name : '未分配') + ' ' + p.date
        + '：浏览' + (+m.views || 0) + ' 赞' + (+m.likes || 0) + ' 评' + (+m.comments || 0)
        + ' 藏' + (+m.collects || 0) + ' 转' + (+m.shares || 0) + ' 涨粉' + (+m.newFollowers || 0)
        + (p.note ? '；备注：' + p.note : '');
    }).join('\n');
    return {
      count: pubs.length,
      prompt: '以下是自媒体账号近期的内容数据：\n' + stats
        + '\n\n请做复盘分析：1) 哪类选题/结构表现最好，为什么；2) 哪些内容表现差，可能的原因；3) 给出 3 条下周具体可执行的建议。400 字以内，直接给结论。'
    };
  };

  MW.act.aiReviewAll = function () {
    const r = MW.ai.reviewAll();
    if (!r) { MW.toast('先发布并填写一些数据，AI 才能分析', 'error'); return; }
    if (!MW.ai.aiReady()) {
      MW.copy(r.prompt);
      MW.toast('还没配 AI 接口——提示词已复制，粘贴给任意 AI 即可；配置入口：侧边栏「AI 接口」', 'error');
      return;
    }
    MW.toast('🤖 AI 分析中…');
    MW.ai.chat(r.prompt).then(function (txt) {
      if (txt) { MW.act.showAiText('🤖 AI 复盘分析', '基于最近 ' + r.count + ' 条已发布内容', txt); return; }
      MW.copy(r.prompt);
      MW.toast('AI 调用失败（网络/接口限制），提示词已复制，可粘贴给任意 AI', 'error');
    });
  };
})();
