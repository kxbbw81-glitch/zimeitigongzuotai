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
  const PF_TIME = { xhs: '18:00', dy: '19:00', gzh: '20:00', bili: '20:00', sph: '21:00', x: '21:00', li: '09:00', zhihu: '20:00', wb: '12:00', yt: '21:00', other: '20:00',
    tt: '19:00', ins: '12:00', fb: '15:00', pin: '21:00', th: '09:00', rd: '09:30', tg: '12:00', wa: '10:00' };
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

    /* 自定义平台：平台名快照进草稿，账号改名 / 删号后草稿箱仍显示对 */
    const platformName = platform === 'custom' ? (acc && acc.platformName) || '' : '';
    return {
      id: MW.uid(), accountId: acc ? acc.id : '', topic: topic, type: type, platform: platform,
      platformName: platformName,
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
    if (!acc) return '你是资深社媒运营策划，兼顾外贸社媒与国内自媒体。\n';
    return '你是社媒账号「' + (acc.name || '') + '」（平台：' + MW.pfOf(acc).name + '）的运营策划。\n'
      + '【账号定位】' + (acc.positioning || '无') + '\n'
      + '【目标受众】' + (acc.audience || '无') + '\n'
      + '【内容风格】' + (acc.style || '无') + '\n'
      + '【表达风格】' + (acc.tone || '无') + '\n'
      + '【内容聚焦】' + ((acc.focus || []).join('、') || '未设置') + '\n'
      + '请严格按上述定位、受众与语气产出，不要输出与定位无关的内容。\n';
  };

  /* ============================================================
     一稿多发：母稿 → 按账号定位适配成各平台版本
     ------------------------------------------------------------
     Easel 式流程落在工作台里的样子：母稿存原始素材，
     每个目标账号按自己的定位/受众/语气/平台规范各生成一版。
     接了大模型走 MW.ai.chat；没接就用本地 gen 产出可改的初稿，
     两条路都返回 { title, body, local }，调用方无感。
     注意：适配版是「初稿」不是「定稿」——发布前的核实是人工的，
     所以生成的内容一律以未就绪状态进排期（检查项不预勾）。
     ============================================================ */
  MW.ai.adaptPrompt = function (master, acc) {
    const pf = MW.pfOf(acc).name;
    const body = (master.body || '').trim() || master.title;
    return MW.ai.accountBrief(acc)
      + '\n【任务】把下面这篇母稿改写成适合「' + pf + '」平台的发布版本。\n'
      + '【母稿标题】' + master.title + '\n'
      + '【母稿正文】\n' + body.slice(0, 4000) + '\n'
      + '【平台规范】' + (PLATFORM_TIPS[acc.platform] || PLATFORM_TIPS.other) + '\n'
      + '【改写要求】保留母稿的核心事实、数据与结论，不得编造；标题、开头、结构、语气、长度按平台规范与账号定位重写；若母稿语言与账号受众语言不一致，需完整翻译并本地化。\n'
      + '【输出格式】第一行输出适配后的标题，空一行后输出正文，不要输出任何解释。';
  };

  /* 本地兜底：没接大模型时，用账号定位 + 平台规范组装可改的初稿 */
  MW.ai.adaptLocal = function (master, acc) {
    const d = MW.ai.gen({
      accountId: acc.id, topic: master.title,
      type: master.type || MW.ai.guessType(master.title),
      platform: acc.platform, kws: ''
    });
    return { title: d.titles[0], body: MW.ai.draftText(d), local: true };
  };

  /* 解析模型输出：第一行当标题，其余当正文 */
  MW.ai.parseAdapt = function (txt) {
    const lines = String(txt || '').split(/\r?\n/);
    let i = 0;
    while (i < lines.length && !lines[i].trim()) i++;
    const title = (lines[i] || '').trim().replace(/^[#>\s*-]+/, '').slice(0, 80) || '未命名适配版';
    const body = lines.slice(i + 1).join('\n').trim();
    return { title: title, body: body, local: false };
  };

  MW.ai.adapt = function (masterId, accountId) {
    const db = MW.getDB();
    const master = db.contents.find(function (c) { return c.id === masterId; });
    const acc = MW.accOf(accountId);
    if (!master || !acc) return Promise.resolve(null);
    if (MW.ai.aiReady()) {
      return MW.ai.chat(MW.ai.adaptPrompt(master, acc)).then(function (txt) {
        if (!txt) return MW.ai.adaptLocal(master, acc);
        const r = MW.ai.parseAdapt(txt);
        /* 模型只回了一行（没正文）→ 退回本地初稿，别存个空壳 */
        return r.body ? r : MW.ai.adaptLocal(master, acc);
      }).catch(function () { return MW.ai.adaptLocal(master, acc); });
    }
    return Promise.resolve(MW.ai.adaptLocal(master, acc));
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

  /* ---------- AI 接口：一键导入本机配置 ---------- */

  /* 服务商猜测：按接口域名认领。认不出来一律归「自定义」——不硬填，避免张冠李戴 */
  MW.ai.guessProvider = function (baseUrl) {
    const u = String(baseUrl || '').toLowerCase();
    if (!u) return '';
    const rules = [
      ['open.bigmodel.cn', 'zhipu'], ['api.deepseek.com', 'deepseek'],
      ['dashscope.aliyuncs.com', 'qwen'], ['api.moonshot.cn', 'kimi'],
      ['ark.volces.com', 'doubao'], ['volces.com', 'doubao'],
      ['hunyuan.cloud.tencent.com', 'hunyuan'], ['qianfan.baidubce.com', 'ernie'],
      ['api.minimax.chat', 'minimax'], ['xf-yun.com', 'spark'],
      ['api.siliconflow.cn', 'siliconflow'], ['api.openai.com', 'openai'],
      ['api.anthropic.com', 'claude'], ['generativelanguage.googleapis.com', 'gemini'],
      ['api.x.ai', 'grok'], ['api.mistral.ai', 'mistral'],
      ['api.groq.com', 'groq'], ['openrouter.ai', 'openrouter'],
      ['localhost:11434', 'ollama'], ['127.0.0.1:11434', 'ollama'],
      ['localhost:1234', 'lmstudio'], ['127.0.0.1:1234', 'lmstudio'],
      ['localhost:8000', 'vllm'], ['127.0.0.1:8000', 'vllm'],
      ['localhost:8080', 'localai'], ['127.0.0.1:8080', 'localai']
    ];
    for (let i = 0; i < rules.length; i++) {
      if (u.indexOf(rules[i][0]) !== -1) return rules[i][1];
    }
    return '';
  };

  /* 补全成 chat/completions 全地址：环境变量与 Codex 的 base_url 常只写到 /v1 */
  MW.ai.normalizeUrl = function (u) {
    let s = String(u || '').trim().replace(/\/+$/, '');
    if (!s) return '';
    if (!/chat\/completions$/i.test(s)) s += '/chat/completions';
    return s;
  };

  /* 粘贴导入解析，接受三种形态：
     ① Codex auth.json 的 JSON；② key=value / KEY: value 行；③ 裸密钥 */
  MW.ai.parseImport = function (text) {
    const s = String(text || '').trim();
    if (!s) return null;
    if (s.charAt(0) === '{') {
      try {
        const d = JSON.parse(s);
        const key = d.OPENAI_API_KEY || d.apiKey || d.api_key || d.key || '';
        const base = d.OPENAI_BASE_URL || d.baseUrl || d.base_url || '';
        const model = d.model || '';
        if (key) return { apiKey: String(key).trim(), baseUrl: String(base || '').trim(), model: String(model || '').trim() };
      } catch (e) { /* 不是合法 JSON，落到行解析 */ }
    }
    let key = '', base = '', model = '';
    s.split(/\r?\n/).forEach(function (ln) {
      const m = ln.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*[=:]\s*(.+?)\s*$/);
      if (!m) return;
      const k = m[1].toLowerCase();
      const v = m[2].replace(/^["']+|["']+$/g, '');
      if (k === 'openai_api_key' || k === 'api_key' || k === 'apikey' || k === 'key') key = v;
      else if (k === 'openai_base_url' || k === 'base_url' || k === 'baseurl') base = v;
      else if (k === 'model') model = v;
    });
    if (key) return { apiKey: key, baseUrl: base, model: model };
    const first = s.split(/\s+/)[0];
    if (/^(sk-|pk_|ak-|AIza)[A-Za-z0-9_-]{8,}$/.test(first)) {
      return { apiKey: first, baseUrl: '', model: '' };
    }
    return null;
  };

  /* 密钥打码：只留前 4 后 4，列表展示用 */
  MW.ai.maskKey = function (k) {
    const s = String(k || '');
    if (s.length <= 10) return s.slice(0, 2) + '****';
    return s.slice(0, 4) + '****' + s.slice(-4);
  };

  /* 把一条扫描/解析结果填进表单：先切服务商刷新预设，再用导入值覆盖 */
  MW.act.aiApplyImport = function (item) {
    const prov = MW.ai.guessProvider(item.baseUrl) || item.provider || '';
    const sel = document.getElementById('ai-provider');
    if (sel) sel.value = prov;
    MW.act.aiPickProvider(prov); /* 刷新提示与推荐模型（预设默认值随后被覆盖） */
    const url = document.getElementById('ai-url');
    const key = document.getElementById('ai-key');
    const model = document.getElementById('ai-model');
    if (url && item.baseUrl) url.value = MW.ai.normalizeUrl(item.baseUrl);
    if (key && item.apiKey) key.value = item.apiKey;
    if (model && item.model) model.value = item.model;
    const out = document.getElementById('ai-import-out');
    if (out) {
      out.innerHTML = '<div class="ai-import-ok">已填入「' + MW.esc(item.label || '导入配置')
        + '」' + (item.baseUrl ? '' : '（未提供接口地址，请补全）') + '，检查无误后点保存即可生效。</div>';
    }
    MW.toast('已填入，点「保存」生效');
  };

  /* 扫描本机配置（仅桌面版可读本机文件；网页版用粘贴导入） */
  MW.act.aiScanLocal = function () {
    const out = document.getElementById('ai-import-out');
    const btn = document.getElementById('ai-scan-btn');
    if (!window.mwDesktop || !window.mwDesktop.scanAiConfig) {
      if (out) {
        out.innerHTML = '<div class="ai-import-tip">'
          + (window.mwDesktop
              ? '当前桌面版较旧，暂不支持扫描本机——请用「粘贴导入」，或重装 1.0.2 获得扫描能力。'
              : '网页版读取不到本机文件——请用「粘贴导入」。')
          + '</div>';
      }
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = '扫描中…'; }
    window.mwDesktop.scanAiConfig().then(function (r) {
      if (btn) { btn.disabled = false; btn.textContent = '扫描本机配置'; }
      if (!out) return;
      if (r && r.error) {
        out.innerHTML = '<div class="ai-import-tip">扫描失败：' + MW.esc(r.error) + '</div>';
        return;
      }
      const items = (r && r.items) || [];
      if (items.length) {
        out.innerHTML = '<div class="ai-import-found">本机发现 ' + items.length + ' 项可用配置：</div>'
          + items.map(function (it, i) {
              return '<div class="ai-import-item">'
                + '<div class="ai-import-item-main"><b>' + MW.esc(it.label) + '</b>'
                + '<span class="ai-import-key">' + MW.esc(MW.ai.maskKey(it.apiKey)) + '</span>'
                + (it.baseUrl
                    ? '<span class="ai-import-url">' + MW.esc(it.baseUrl) + '</span>'
                    : '<span class="ai-import-url warn">未提供接口地址，填入后需补全</span>')
                + (it.model ? '<span class="ai-import-url">模型 ' + MW.esc(it.model) + '</span>' : '')
                + '</div>'
                + '<button class="btn sm" id="ai-import-fill-' + i + '">填入</button>'
                + '</div>';
            }).join('');
        items.forEach(function (it, i) {
          const b = document.getElementById('ai-import-fill-' + i);
          if (b) b.onclick = function () { MW.act.aiApplyImport(it); };
        });
        return;
      }
      /* 没有可用密钥——按 Codex 登录方式给针对性说明 */
      if (r && r.codexExists && r.codexMode === 'chatgpt') {
        out.innerHTML = '<div class="ai-import-tip">检测到本机 Codex（<b>ChatGPT 账号登录</b>）——该登录方式不产生 API Key，'
          + '其令牌只能给 Codex 自己使用，无法导入。<br>想一键导入：在 Codex 里改用 <b>API Key 登录</b>'
          + '（或配置环境变量）后再扫一次；也可以直接在下方选服务商——<b>智谱 GLM 的 glm-4-flash 有免费额度</b>，注册即用。</div>';
        return;
      }
      out.innerHTML = '<div class="ai-import-tip">本机未发现可用配置（没有 Codex API Key，环境变量里也没有常见密钥）。'
        + '直接在下方选服务商即可——智谱 GLM 免费额度个人够用。</div>';
    }).catch(function (e) {
      if (btn) { btn.disabled = false; btn.textContent = '扫描本机配置'; }
      if (out) out.innerHTML = '<div class="ai-import-tip">扫描出错：' + MW.esc(String((e && e.message) || e)) + '</div>';
    });
  };

  /* 粘贴导入：第一次点展开输入框，第二次点解析并填入 */
  MW.act.aiPasteImport = function () {
    const box = document.getElementById('ai-paste-box');
    const ta = document.getElementById('ai-paste-ta');
    if (!box || !ta) return;
    if (box.style.display === 'none') {
      box.style.display = 'block';
      ta.focus();
      return;
    }
    const r = MW.ai.parseImport(ta.value);
    if (!r) {
      MW.toast('没解析出密钥——支持粘贴 auth.json 内容、OPENAI_API_KEY=sk-… 或裸密钥', 'error');
      return;
    }
    r.label = '粘贴的配置';
    MW.act.aiApplyImport(r);
    box.style.display = 'none';
    ta.value = '';
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
      /* 快捷导入：桌面版可扫描本机 Codex 配置与环境变量；所有版本都能粘贴导入 */
      + '<div class="ai-import">'
      + '<div class="ai-import-head"><b>快捷导入</b><span>本机已有配置可一键填入；没有就手动选服务商</span></div>'
      + '<div class="ai-import-ops">'
      + (window.mwDesktop
          ? '<button class="btn sm" id="ai-scan-btn" onclick="MW.act.aiScanLocal()">扫描本机配置</button>'
          : '')
      + '<button class="btn sm primary-ghost" id="ai-paste-btn" onclick="MW.act.aiPasteImport()">粘贴导入</button>'
      + '</div>'
      + '<div id="ai-import-out"></div>'
      + '<div id="ai-paste-box" style="display:none">'
      + '<textarea id="ai-paste-ta" rows="3" placeholder="粘贴 ~/.codex/auth.json 的内容，或 OPENAI_API_KEY=sk-…，或直接粘密钥"></textarea>'
      + '</div>'
      + '</div>'
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

})();
