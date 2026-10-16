/* ============================================================
   视图 · 素材库（文件真的存在你自己的硬盘里）
   ------------------------------------------------------------
   这一页有三条通路，按浏览器能力自动降级：
     ① 连接文件夹  —— Chromium：扫描 / 导入 / 重命名 / 删除，最完整
     ② 拖进来      —— Chromium：一步到位，不用弹选择框
     ③ 手动登记    —— 任何浏览器：只记路径，功能不中断
   文件永远在用户硬盘上，本页不复制、不转存任何文件内容。
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  const AS = MW.assets || {};
  MW.act = MW.act || {};
  MW.views = MW.views || {};

  /* ---------- 页面状态 ---------- */
  let keyword = '';
  let kindFilter = 'all';
  let viewMode = 'list';       /* list（行式，默认）| grid（缩略图网格） */
  let sortBy = 'time';         /* time（新→旧）| name | size | kind */
  let dirHandle = null;          /* 内存里的目录句柄，页面刷新后从 IDB 恢复 */
  let listing = [];              /* 扫描结果（带 handle 的活对象） */
  let sidecar = { v: 1, items: {} }; /* 文件夹里的 .mw-assets.json */
  let scanState = 'idle';        /* idle | scanning | ok | error */
  let scanMsg = '';
  let lastSync = 0;
  let onboardingSeen = false;
  let dragDepth = 0;

  /* ---------- 数据存取：索引落localStorage，标注以旁车文件为准 ---------- */
  function conf() {
    const db = MW.getDB();
    db.settings = db.settings || {};
    db.settings.assets = db.settings.assets || {};
    const s = db.settings.assets;
    if (!s.onboarded) s.onboarded = false;
    if (!s.list) s.list = [];
    if (!s.meta) s.meta = {};
    if (s.autoFolder === undefined) s.autoFolder = true;
    if (s.rootPath === undefined) s.rootPath = '';
    return s;
  }
  /* 用户填的完整路径。File System Access API 有个硬限制：目录句柄只能拿到
     文件夹名（handle.name），拿不到 D:\这种绝对路径——这是浏览器的安全设计，
     没有任何 API 能绕。所以路径必须让用户自己填一次，我们负责保存、复用、
     拿去拼每个文件的完整路径。填了才能「打开文件夹」「复制完整路径」。 */
  function rootPath() {
    return conf().rootPath || '';
  }
  function setRootPath(p) {
    conf().rootPath = String(p || '').replace(/[\\/]+$/, '');
    MW.save();
  }
  /* 单个文件的完整路径 */
  function fullPathOf(rel) {
    const root = rootPath();
    if (!root) return '';
    return root + '\\' + String(rel).replace(/\//g, '\\');
  }
  /* 只留轻量字段进localStorage：句柄和 Blob 都不进来 */
  function persistList() {
    const s = conf();
    s.list = listing.map(function (f) {
      return {
        rel: f.rel, name: f.name, sub: f.sub || '',
        size: f.size, mtime: f.mtime,
        kind: AS.kindOf(f.name, f.mime),
        date: AS.dateOf(f)
      };
    });
    s.lastSync = lastSync;
    MW.save();
  }

  /* 侧车优先（跟着文件夹走），localStorage 兜底（连不上时也能用） */
  function metaOf(rel) {
    const it = sidecar && sidecar.items && sidecar.items[rel];
    if (it) return it;
    const s = conf();
    return s.meta[rel] || {};
  }
  function setMeta(rel, patch) {
    const cur = JSON.parse(JSON.stringify(metaOf(rel) || {}));
    Object.assign(cur, patch);
    conf().meta[rel] = cur;
    if (sidecar && sidecar.items) sidecar.items[rel] = cur;
    MW.save();
    if (dirHandle) {
      AS.writeSidecar(dirHandle, sidecar).catch(function () { /* 写失败不阻断 */ });
    }
  }

  /* ---------------- 首次向导 ---------------- */
  /* 目标：任何人第一次打开，都知道要干什么、知道文件夹会长什么样，
     而不是面对一个空白的「添加素材」表单。 */

  function openWizard() {
    const s = conf();
    const kinds = AS.KINDS.filter(function (k) { return k.key !== 'other'; });
    const body =
      '<div class="wiz-step">' +
        '<div class="wiz-num">1</div>' +
        '<div><b>选一个文件夹</b>' +
        '<div class="wiz-text">素材文件放在你自己的电脑上，工作台不复制、不上传。建议单独建一个，比如 <code>D:\\自媒体素材库</code>。</div></div>' +
      '</div>' +
      '<div class="wiz-step">' +
        '<div class="wiz-num">2</div>' +
        '<div><b>自动生成类型文件夹</b>' +
        '<div class="wiz-text">连上以后自动建好这 ' + kinds.length + ' 个子文件夹，新素材按类型自动归位：</div>' +
        '<div class="wiz-kinds">' + kinds.map(function (k) {
          return '<span class="wiz-kind">' + MW.icon(k.icon, 12) + ' ' + k.label + '</span>';
        }).join('') + '</div></div>' +
      '</div>' +
      '<div class="wiz-step">' +
        '<div class="wiz-num">3</div>' +
        '<div><b>自动标日期</b>' +
        '<div class="wiz-text">文件名里有日期的（比如 <code>2026-10-13</code>、<code>20261013</code>）优先用文件名，没有就用文件修改时间。</div></div>' +
      '</div>' +
      '<div class="wiz-note">' +
        (AS.supported()
          ? '点「选择文件夹」会弹出系统窗口，授权一次即可。文件夹里的东西永远在你电脑上。'
          : AS.supportHint()) +
      '</div>' +
      (AS.supported() ? '' :
        '<div class="wiz-fallback"><b>现在也能用：</b>点「手动登记路径」记录文件位置，等换成Chrome / Edge 再连接文件夹即可，登记过的记录不会丢。</div>');

    MW.modal({
      title: '三步设置素材库',
      sub: '大概 30 秒，之后再不用管',
      size: 'lg',
      body: body,
      okText: AS.supported() ? '选择文件夹' : '知道了',
      onOk: function () {
        s.onboarded = true;
        MW.save();
        if (AS.supported()) setTimeout(function () { pickFolder(); }, 120);
        else MW.goto('#/assets');
      }
    });
    const foot = document.querySelector('#modal-root .modal-foot');
    if (foot && !AS.supported()) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = '手动登记路径';
      b.onclick = function () { MW.closeModal(); openManualRegister(); };
      foot.insertBefore(b, foot.firstChild);
    }
  }

  /* ---------------- 连接 / 重连 ---------------- */

  async function pickFolder() {
    if (!AS.supported()) {
      MW.toast(AS.supportHint(), 'error');
      return;
    }
    try {
      const h = await window.showDirectoryPicker({ mode: 'readwrite', id: 'mwAssets' });
      dirHandle = h;
      await AS.saveHandle(h);
      conf().onboarded = true;
      /* 连上以后先把类型子文件夹建好，这样一进来就能看到
         图片 / 视频 / 音频 / 文章 / 模板，不用手动整理 */
      const made = await ensureKindDirs(h);
      await sync(true);
      /* 首次连接引导填一下完整路径——浏览器只给文件夹名，不填就没有「打开文件夹」
         和完整路径复制。已经有路径就不打扰。 */
      if (!rootPath()) {
        MW.render();
        setTimeout(function () {
          const el = document.getElementById('as-root');
          if (el) { el.focus(); el.select(); }
          MW.toast('请补充文件夹完整路径，以便后续一键打开');
        }, 220);
      }
      MW.render();
      if (made.length) {
        MW.toast('已连接，并建好 ' + made.join('、') + ' 文件夹');
      } else {
        MW.toast('已连接 · ' + listing.length + ' 个文件');
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return; /* 用户自己取消了，不是错误 */
      MW.toast('连接失败：' + (e && e.message ? e.message : e), 'error');
    }
  }

  /* 自动生成类型子文件夹。已存在的跳过，所以重复连接不会有副作用。
     失败不阻断连接——用户已有整理好的目录结构时不该被强行塞进子文件夹。 */
  async function ensureKindDirs(h) {
    const made = [];
    for (const k of AS.KINDS) {
      if (k.key === 'other') continue;/* 「其他」不建，杂项混放反而乱 */
      const label = AS.labelOfKind(k.key);
      try {
        await h.getDirectoryHandle(label, { create: true });
        made.push(label);
      } catch (e) { /* 单个目录建不出来就跳过 */ }
    }
    return made;
  }

  /* 页面启动时尝试恢复上次的文件夹。permission 是 'prompt' 时不能静默
     重新授权（浏览器要求用户手势），所以显示「点此授权」按钮而不是自动恢复。 */
  async function restore() {
    if (dirHandle) return;
    const h = await AS.loadHandle();
    if (!h) return;
    const p = await AS.permState(h);
    if (p === 'granted') {
      dirHandle = h;
      await sync(true);
    } else {
      /*句柄留着但权限待授予，界面显示重连卡片 */
      dirHandle = null;
      pendingHandle = h;
    }
    if (MW.getDB().settings.assets) MW.getDB().settings.assets.pending = !!pendingHandle;
    MW.save();
  }
  let pendingHandle = null;

  async function regrant() {
    if (!pendingHandle) return;
    const p = await AS.regrant(pendingHandle);
    if (p === 'granted') {
      dirHandle = pendingHandle;
      pendingHandle = null;
      conf().pending = false;
      MW.save();
      await ensureKindDirs(dirHandle);
      await sync(true);
      MW.render();
    } else {
      MW.toast('没有拿到授权，浏览器需要你亲自确认一次', 'error');
    }
  }

  async function disconnect() {
    /* 注意：这里只清「扫文件夹扫出来的条目」，**手动登记的必须留着**。
       手动登记是给 Safari / Firefox 这类连不上文件夹的浏览器用的，用户
       在那儿辛辛苦苦登记了几十条路径，点一下「断开」全没了的话就是数据丢失。
       所以过滤掉非manual 的，剩下的当作「离线清单」继续可搜可看。 */
    const kept = conf().list.filter(function (f) { return f.manual; });
    MW.confirm(kept.length
      ? '断开后工作台不再读取这个文件夹，文件夹和里面的文件完全不受影响，随时可以再连回来。你手动登记的 ' +
        kept.length + ' 条记录会保留。'
      : '断开后工作台不再读取这个文件夹。文件夹和里面的文件完全不受影响，随时可以再连回来。',
      async function () {
        await AS.clearHandle();
        dirHandle = null;
        listing = [];
        sidecar = { v: 1, items: {} };
        conf().list = kept;
        conf().lastSync = 0;
        MW.save();
        MW.render();
        MW.toast(kept.length ? '已断开，文件夹没动过 · 手动登记的 ' + kept.length + ' 条还在' : '已断开，文件夹没动过');
      }, { title: '断开文件夹', okText: '断开' });
  }

  /* ---------------- 扫描 ---------------- */

  async function sync(silent) {
    if (!dirHandle) return;
    scanState = 'scanning';
    scanMsg = '';
    if (!silent) MW.render();
    try {
      sidecar = await AS.readSidecar(dirHandle);
      const files = await AS.scan(dirHandle);
      listing = files;
      scanState = 'ok';
      lastSync = Date.now();
      persistList();
      /* 顺手清一部分过期缩略图，别让 IndexedDB 无限长 */
      const keep = new Set(listing.map(function (f) {
        return AS.thumbKey(f.rel, f.mtime, f.size);
      }));
      AS.pruneThumbs(keep, 300);
      if (!silent) { MW.render(); MW.toast('已同步 ' + files.length + ' 个文件'); }
    } catch (e) {
      scanState = 'error';
      scanMsg = (e && e.message) || String(e);
      if (!silent) { MW.render(); MW.toast('读取文件夹失败：' + scanMsg, 'error'); }
    }
  }

  /* 导入文件：按类型自动落到对应子文件夹 */
  function importFiles() {
    if (!dirHandle) { pickFolder(); return; }
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.onchange = async function () {
      const files = Array.from(inp.files || []);
      if (!files.length) return;
      let ok = 0;
      for (const f of files) {
        try {
          const kind = AS.kindOf(f.name, f.type);
          const label = AS.labelOfKind(kind);
          await AS.writeFile(dirHandle, label, f.name, f);
          ok += 1;
        } catch (e) { /* 单个失败不中断整批 */ }
      }
      await sync(true);
      MW.render();
      MW.toast(ok === files.length
        ? '已导入 ' + ok + ' 个文件到本地文件夹'
        : '导入 ' + ok + '/' + files.length + ' 个，部分文件被占用或重名');
    };
    inp.click();
  }

  /* 拖拽：文件夹或文件都收 */
  async function onDrop(e) {
    e.preventDefault();
    dragDepth = 0;
    document.body.classList.remove('dragging');
    const items = Array.from((e.dataTransfer && e.dataTransfer.items) || []);
    const entries = [];
    for (const it of items) {
      /* 优先用 getAsFileSystemHandle —— 能拿到可写句柄，连文件夹一起收 */
      if (typeof it.getAsFileSystemHandle === 'function') {
        try {
          const h = await it.getAsFileSystemHandle();
          if (h) { entries.push(h); continue; }
        } catch (err) { /* 落到下面的 files */ }
      }
      const f = it.getAsFile && it.getAsFile();
      if (f) entries.push(f);
    }
    if (!entries.length) return;
    if (!dirHandle) { pickFolder(); return; }

    let n = 0;
    for (const h of entries) {
      if (h.kind === 'directory') {
        n += await importDir(h);
      } else if (h instanceof File) {
        try {
          await AS.writeFile(dirHandle, AS.labelOfKind(AS.kindOf(h.name, h.type)), h.name, h);
          n += 1;
        } catch (err) { /* 忽略 */ }
      }
    }
    if (n) {
      await sync(true);
      MW.render();
      MW.toast('已收进文件夹 ' + n + ' 个文件');
    }
  }

  /* 递归接收拖进来的文件夹 */
  async function importDir(dh, prefix) {
    let n = 0;
    let sub = prefix || '';
    try {
      for await (const pair of dh.entries()) {
        const name = pair[0], h = pair[1];
        if (name.charAt(0) === '.') continue;
        if (h.kind === 'directory') {
          n += await importDir(h, sub ? sub + '/' + name : name);
        } else {
          const kind = AS.labelOfKind(AS.kindOf(name, ''));
          /* 保留拖进来时原本的子目录结构 */
          const target = sub ? sub + '/' + kind : kind;
          const f = await h.getFile();
          await AS.writeFile(dirHandle, target, name, f);
          n += 1;
        }
      }
    } catch (e) { /* 单个子树失败不影响其他 */ }
    return n;
  }

  /* ---------------- 缩略图 ---------------- */
  /* 关键点：不能用 file:/// 读别的 file:// 路径（会被拦），也不能存 base64
     进 localStorage（5MB 一撑就爆）。走 IDB 缓存 Blob + createObjectURL。 */

  const urlPool = [];
  function loadThumb(node, entry) {
    if (!entry.handle || !entry.mime || entry.mime.indexOf('image/') !== 0) return;
    const key = AS.thumbKey(entry.rel, entry.mtime, entry.size);
    AS.getThumb(key).then(async function (blob) {
      if (blob) { paint(node, blob, key); return; }
      try {
        const f = await entry.handle.getFile();
        AS.putThumb(key, f);
        paint(node, f, key);
      } catch (e) { /* 无缩略图，保持占位 */ }
    });
  }
  function paint(node, blob, key) {
    const url = URL.createObjectURL(blob);
    urlPool.push(url);
    node.style.backgroundImage = 'url("' + url + '")';
    node.classList.add('has-thumb');
  }

  /* ---------------- 文件标注 ---------------- */
  function openMeta(rel) {
    const entry = findEntry(rel);
    if (!entry) return;
    const m = metaOf(rel);
    const db = MW.getDB();
    const full = fullPathOf(rel);
    const body =
      '<div class="meta-path">' + MW.icon('folder', 13) + ' ' + MW.esc(full || entry.rel) +
        (full ? '' : '<span class="meta-path-tip">（没填完整路径，先只显示相对位置）</span>') + '</div>' +
      '<div class="meta-facts">' +
        '<span>' + MW.icon(AS.iconOfKind(AS.kindOf(entry.name, entry.mime)), 12) + ' ' + AS.labelOfKind(AS.kindOf(entry.name, entry.mime)) + '</span>' +
        '<span>' + AS.fileSize(entry.size) + '</span>' +
        '<span>' + AS.relTime(entry.mtime) + '</span>' +
      '</div>' +
      MW.ui.row('归属账号', MW.ui.select('fm-acc', [{ v: '', t: '通用素材' }].concat(db.accounts.map(function (a) {
        return { v: a.id, t: a.name };
      })), m.accountId || '')) +
      MW.ui.row('标签', '<textarea id="fm-tags" rows="2" placeholder="每行一个，或用逗号分隔" style="min-height:48px">' +
        MW.esc((m.tags || []).join('\n')) + '</textarea>') +
      MW.ui.row('用途备注', '<textarea id="fm-note" rows="2" placeholder="这条素材准备用在哪儿">' + MW.esc(m.note || '') + '</textarea>') +
      '<div class="meta-ops">' +
        '<button class="btn sm" onclick="MW.act.asCopyPath(\'' + MW.esc(rel).replace(/'/g, '') + '\')">' + MW.icon('copy', 13) + ' 复制路径</button>' +
        '<button class="btn sm" onclick="MW.act.asOpenFile(\'' + MW.esc(rel).replace(/'/g, '') + '\')">' + MW.icon('eye', 13) + ' 打开文件</button>' +
      '</div>';

    MW.modal({
      title: entry.name,
      sub: '标注只存在文件夹里，换电脑也跟着走',
      body: body,
      okText: '保存标注',
      onOk: function (root) {
        setMeta(rel, {
          accountId: root.querySelector('#fm-acc').value || '',
          tags: MW.parseTags(root.querySelector('#fm-tags').value),
          note: root.querySelector('#fm-note').value.trim()
        });
        MW.render();
        MW.toast('标注已保存到文件夹');
      }
    });
  }

  /* ---------------- 删除：语义分离 ---------------- */

  /* 默认只从清单移除，硬盘文件不动。这是唯一安全的默认值。 */
  function removeFromList(rel) {
    MW.confirm('只从清单里移除「' + rel + '」，硬盘上的文件完全不动。',
      function () {
        listing = listing.filter(function (f) { return f.rel !== rel; });
        const s = conf();
        s.list = s.list.filter(function (f) { return f.rel !== rel; });
        delete s.meta[rel];
        if (sidecar && sidecar.items) delete sidecar.items[rel];
        MW.save();
        if (dirHandle) AS.writeSidecar(dirHandle, sidecar);
        MW.render();
        MW.toast('已从清单移除，文件还在');
      }, { title: '从清单移除', okText: '移除' });
  }

  /* 真删硬盘文件：必须显式确认，且文案说清不可恢复。 */
  function deleteOnDisk(rel) {
    MW.confirm('会永久删除硬盘上的「' + rel + '」，删除后无法恢复。确定吗？',
      async function () {
        try {
          if (dirHandle) await deleteRel(dirHandle, rel);
          listing = listing.filter(function (f) { return f.rel !== rel; });
          const s = conf();
          s.list = s.list.filter(function (f) { return f.rel !== rel; });
          MW.save();
          MW.render();
          MW.toast('文件已删除');
        } catch (e) {
          MW.toast('删除失败：' + (e && e.message ? e.message : e), 'error');
        }
      }, { title: '删除硬盘文件', okText: '永久删除' });
  }

  async function deleteRel(root, rel) {
    const parts = rel.split('/');
    const fileName = parts.pop();
    let dir = root;
    for (const p of parts) dir = await dir.getDirectoryHandle(p);
    await dir.removeEntry(fileName);
  }

  /* ---------------- 手动登记（非 Chromium 降级） ---------------- */
  function openManualRegister() {
    const body =
      '<div class="wiz-note" style="margin-bottom:12px">在资源管理器里找到文件 → 右键 → 复制文件地址，粘到下面。' +
      '工作台只记住这个位置，不复制文件。</div>' +
      MW.ui.row('素材名称', '<input id="mr-name" placeholder="例如：开箱实拍视频">') +
      MW.ui.row('文件路径', '<input id="mr-path" placeholder="D:\\素材\\开箱.mp4">') +
      MW.ui.row('类型', MW.ui.select('mr-kind', AS.KINDS.map(function (k) { return { v: k.key, t: k.label }; }), 'image')) +
      MW.ui.row('标签', '<textarea id="mr-tags" rows="2" placeholder="每行一个，或用逗号分隔" style="min-height:48px"></textarea>');
    MW.modal({
      title: '手动登记素材',
      sub: '不连接文件夹也能用',
      body: body,
      okText: '登记',
      onOk: function (root) {
        const name = root.querySelector('#mr-name').value.trim();
        const path = root.querySelector('#mr-path').value.trim();
        if (!name && !path) { MW.toast('至少填名称或路径', 'error'); return false; }
        const s = conf();
        s.list.unshift({
          rel: path || name,
          name: name || path.replace(/[\\/]+$/, '').split(/[\\/]/).pop(),
          sub: '', size: 0, mtime: Date.now(),
          kind: root.querySelector('#mr-kind').value,
          date: AS.dateOf({ name: name || path, mtime: Date.now() }),
          manual: true
        });
        setMeta(path || name, {
          tags: MW.parseTags(root.querySelector('#mr-tags').value)
        });
        MW.save();
        MW.render();
        MW.toast('已登记');
      }
    });
  }

  /* ---------------- 动作导出 ---------------- */

  /* 在线时 listing 带 handle（能真打开文件），离线时只有 s.list。
     所有按 rel 找条目的地方都走这里，避免离线场景下 find 返回 undefined。 */
  function findEntry(rel) {
    const a = listing.find(function (f) { return f.rel === rel; });
    if (a) return a;
    return conf().list.find(function (f) { return f.rel === rel; }) || null;
  }

  MW.act.asPickFolder = pickFolder;
  MW.act.asRegrant = regrant;
  MW.act.asDisconnect = disconnect;
  MW.act.asImport = importFiles;
  MW.act.asSync = function () { sync(false); };
  MW.act.asOpenWizard = openWizard;
  MW.act.asManual = openManualRegister;
  MW.act.asMeta = openMeta;
  MW.act.asRemove = removeFromList;
  MW.act.asDeleteFile = deleteOnDisk;
  MW.act.asSetKind = function (v) { kindFilter = v; MW.render(); };
  MW.act.asSetKeyword = function (v) { keyword = v; MW.render(); };
  MW.act.asSetView = function (v) { viewMode = v; MW.render(); };
  MW.act.asSetSort = function (v) { sortBy = v; MW.render(); };

  /* 保存用户填的根路径。填了才能开文件夹、复制完整路径，所以要提示为什么填。 */
  MW.act.asSaveRoot = function () {
    const el = document.getElementById('as-root');
    if (!el) return;
    const v = el.value.trim();
    if (v && !/[\\/]$/.test(v)) {
      /* 顺手纠正：用户爱在末尾敲 / 或 \ */
      el.value = v;
    }
    setRootPath(v);
    MW.render();
    MW.toast(v ? '路径已记住 · 复制路径和打开文件夹都能用了' : '已清空路径');
  };

  /* 打开文件夹：先用 file:// 直接开（Chromium 下多数能用），被拦就退回复制路径。
     不谎报成功——打不开就说打不开。 */
  MW.act.asOpenRoot = function () {
    const p = rootPath();
    if (!p) { MW.toast('先在上面填一下素材文件夹的完整路径', 'error'); return; }
    try {
      const w = window.open('file:///' + p.replace(/\\/g, '/'), '_blank');
      if (w) return;
    } catch (e) { /* 落到复制 */ }
    MW.copy(p);
    MW.toast('浏览器不让直接打开，路径已复制，粘到资源管理器地址栏即可', 'error');
  };

  MW.act.asCopyRoot = function () {
    const p = rootPath();
    if (!p) { MW.toast('先在上面填一下素材文件夹的完整路径', 'error'); return; }
    MW.copy(p);
  };

  MW.act.asCopyPath = function (rel) {
    const e = findEntry(rel);
    const p = fullPathOf(rel) || (e && e.path) || rel;
    MW.copy(p);
    if (!rootPath()) {
      MW.toast('只复制了文件名 · 填一下完整路径后就能复制整条路径了', 'error');
    }
  };

  MW.act.asOpenFile = async function (rel) {
    const e = findEntry(rel);
    if (!e) { MW.toast('这条记录已不在清单里，试试重新扫描', 'error'); return; }
    const r = await AS.openEntry(e, rootPath());
    if (r === 'copied') MW.toast('浏览器拦截了直接打开，路径已复制，粘到资源管理器即可');
    else if (r === false) {
      if (!dirHandle) {
        MW.toast('当前是离线清单，连上文件夹才能直接打开；可以先用「复制路径」', 'error');
      } else {
        MW.toast('打不开这个文件，试试「复制路径」', 'error');
      }
    }
  };

  MW.act.asUseAsAsset = function (rel) {
    /* 把文件登记成一条传统「素材」记录，方便挂到内容上复用 */
    const e = findEntry(rel);
    if (!e) return;
    const db = MW.getDB();
    const m = metaOf(rel);
    db.assets.unshift({
      id: MW.uid(),
      name: e.name,
      type: AS.labelOfKind(AS.kindOf(e.name, e.mime)),
      accountId: m.accountId || '',
      tags: m.tags || [],
      note: (m.note ? m.note + ' · ' : '') + e.rel,
      fileRel: rel,
      createdAt: MW.dateStr()
    });
    MW.save();
    MW.toast('已加入素材清单，可在内容里引用');
  };

  /* ---------------- 渲染 ---------------- */

  MW.views['assets'] = {
    id: 'assets', name: '素材库', icon: 'folder',
    sub: '文件在你自己的硬盘里，工作台只做索引和标注',
    render: function (root) {
      const s = conf();
      const db = MW.getDB();
      const hint = AS.supportHint();
      /* 有没有任何索引数据。注意要看「内存 listing + 落盘 s.list」两者——
         断开连接后 listing 会清空，但 s.list 还在，这时不该退回欢迎态。 */
      const hasAny = listing.length || s.list.length;

      /* 第一次进来：直接弹向导，把路径讲清楚 */
      if (!s.onboarded && !dirHandle && !hasAny) {
        onboardingSeen = true;
        setTimeout(openWizard, 60);
      }

      /* 未连接且一条索引都没有：给一张清晰的引导卡，而不是空表格 */
      if (!dirHandle && !hasAny) {
        root.innerHTML = renderWelcome(s, hint);
        const b = document.getElementById('as-main-btn');
        if (b) b.onclick = AS.supported() ? pickFolder : openManualRegister;
        const w = document.getElementById('as-wizard-btn');
        if (w) w.onclick = openWizard;
        const mb = document.getElementById('as-manual-btn');
        if (mb) mb.onclick = openManualRegister;
        bindNoteQuick(root);
        bindDrag(root);
        return;
      }

      /* 已连接或有清单：正常浏览。
         在线时 listing 带handle（活对象），离线时只剩 s.list（轻量索引），
         两条路径都要能正常渲染与筛选。 */
      const source = listing.length
        ? listing.map(function (f) {
          return Object.assign({}, f, { kind: AS.kindOf(f.name, f.mime), date: AS.dateOf(f) });
        })
        : s.list.map(function (f) {
          return Object.assign({}, f, { kind: f.kind || AS.kindOf(f.name, f.mime) });
        });

      const items = sortItems(source.filter(function (f) {
        if (kindFilter !== 'all' && f.kind !== kindFilter) return false;
        if (!keyword) return true;
        const k = keyword.toLowerCase();
        const m = metaOf(f.rel);
        return (f.rel + ' ' + (m.note || '') + ' ' + (m.tags || []).join(' ')).toLowerCase().indexOf(k) >= 0;
      }));

      const counts = {};
      AS.KINDS.forEach(function (k) { counts[k.key] = 0; });
      let totalSize = 0;
      source.forEach(function (f) {
        const k = f.kind || AS.kindOf(f.name, f.mime);
        counts[k] = (counts[k] || 0) + 1;
        totalSize += (+f.size || 0);
      });
      const total = source.length;

      let html = '<div class="page-head"><div class="page-title">素材库</div>' +
        '<div class="page-sub">' +
        (total ? total + ' 个文件 · ' + AS.fileSize(totalSize) + ' · 都在你的硬盘上，好素材复用一次省一次时间'
               : '文件存在你自己的硬盘上，工作台不复制、不上传，只做索引和标注') +
        '</div></div>';

      /* ① 素材文件夹卡：路径明晃晃摆出来，能复制、能直接打开。
            这一张是整个页面的地基——用户得随时知道「我的素材到底在硬盘哪儿」。 */
      html += renderRootCard(s, hint);

      /* ② 类型统计：一眼看到库存结构，不用点筛选才知道有什么 */
      if (total) {
        html += '<div class="asset-stats">' +
          '<div class="asset-stat total" onclick="MW.act.asSetKind(\'all\')"' +
            (kindFilter === 'all' ? ' data-on="1"' : '') + '>' +
            '<span class="asset-stat-l">全部</span>' +
            '<span class="asset-stat-v">' + total + '</span>' +
            '<span class="asset-stat-s">' + AS.fileSize(totalSize) + '</span></div>' +
          AS.KINDS.filter(function (k) { return counts[k.key]; }).map(function (k) {
            const n = counts[k.key];
            return '<div class="asset-stat k-' + k.color + '" onclick="MW.act.asSetKind(\'' + k.key + '\')"' +
              (kindFilter === k.key ? ' data-on="1"' : '') + '>' +
              '<span class="asset-stat-l">' + MW.icon(k.icon, 12) + ' ' + k.label + '</span>' +
              '<span class="asset-stat-v">' + n + '</span>' +
              '<span class="asset-stat-s">个文件</span></div>';
          }).join('') +
          '</div>';
      }

      /* ③ 状态提示：只在异常/待授权时才占地方，正常状态已并进文件夹卡 */
      const status = renderStatusCard(s, hint);
      if (status) html += status;

      /* ④ 工具条：筛选 + 搜索 + 排序 + 视图切换 */
      html += '<div class="asset-toolbar">' +
        '<div class="seg">' +
        ['all'].concat(AS.KINDS.map(function (k) { return k.key; })).map(function (k) {
          const label = k === 'all' ? '全部' : AS.labelOfKind(k);
          const n = k === 'all' ? total : (counts[k] || 0);
          if (k !== 'all' && !n) return '';
          return '<button class="seg-btn' + (kindFilter === k ? ' active' : '') + '" onclick="MW.act.asSetKind(\'' + k + '\')">' +
            label + ' <span class="seg-n">' + n + '</span></button>';
        }).join('') +
        '</div>' +
        '<div class="asset-tool-right">' +
        '<div class="search-box">' + MW.icon('search', 14) +
        '<input id="asset-search" placeholder="搜索文件名、标签、备注……" value="' + MW.esc(keyword) + '"></div>' +
        '<div class="seg small">' +
        [['time', '最近更新'], ['name', '文件名'], ['size', '体积'], ['kind', '类型']].map(function (o) {
          return '<button class="seg-btn' + (sortBy === o[0] ? ' active' : '') + '" onclick="MW.act.asSetSort(\'' + o[0] + '\')">' + o[1] + '</button>';
        }).join('') + '</div>' +
        '<div class="view-switch">' +
        '<button class="icon-btn' + (viewMode === 'list' ? ' active' : '') + '" title="列表（看得快）" onclick="MW.act.asSetView(\'list\')">' + MW.icon('layers', 14) + '</button>' +
        '<button class="icon-btn' + (viewMode === 'grid' ? ' active' : '') + '" title="缩略图（看得清）" onclick="MW.act.asSetView(\'grid\')">' + MW.icon('image', 14) + '</button>' +
        '</div>' +
        '</div>' +
        '</div>';

      /* ⑤ 文件列表 */
      if (!items.length) {
        html += '<div class="asset-drop" id="asset-drop">' +
          MW.ui.empty(keyword ? '未找到匹配的文件' : '文件夹中暂无素材',
            keyword ? '换个关键词试试' : '把文件或整个文件夹拖进来，或点上面的「导入文件」') +
          '</div>';
      } else if (viewMode === 'grid') {
        html += '<div class="asset-grid" id="asset-drop">';
        items.slice(0, 200).forEach(function (f) { html += renderCard(f); });
        html += '</div>';
        if (items.length > 200) html += '<div class="asset-more">还有 ' + (items.length - 200) + ' 个文件，用搜索缩小范围</div>';
      } else {
        html += '<div class="asset-list card" id="asset-drop">';
        items.slice(0, 400).forEach(function (f) { html += renderRow(f); });
        html += '</div>';
        if (items.length > 400) html += '<div class="asset-more">还有 ' + (items.length - 400) + ' 个文件，用搜索缩小范围</div>';
      }

      /* ⑥ 素材笔记：行内直接写一条就进去，不用弹窗——这类东西加得频繁 */
      html += renderNotes(db);

      root.innerHTML = html;

      /* 缩略图异步加载（两种视图共用） */
      root.querySelectorAll('.asset-thumb[data-rel]').forEach(function (node) {
        const e = listing.find(function (f) { return f.rel === node.getAttribute('data-rel'); });
        if (e) loadThumb(node, e);
      });

      bindSearch(root);
      bindDrag(root);
      bindRootCard(root);
      bindRowClick(root);
      bindNoteQuick(root);
    }
  };

  /* 行式列表：点整行直接打开文件（最常见的动作），按钮自己拦下冒泡。 */
  function bindRowClick(root) {
    root.querySelectorAll('.asset-row').forEach(function (row) {
      row.addEventListener('click', function () {
        MW.act.asOpenFile(row.getAttribute('data-rel'));
      });
    });
  }

  /* 笔记速记：三个输入框都能回车提交，不用去点按钮 */
  function bindNoteQuick(root) {
    ['nq-name', 'nq-link', 'nq-note'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        /* 回车后光标留在下一个还没填的框里，连着填完再回车 */
        const order = ['nq-name', 'nq-link', 'nq-note'];
        const cur = id;
        if (!el.value.trim()) {
          const next = order.slice(order.indexOf(cur) + 1).map(function (x) { return document.getElementById(x); })
            .filter(Boolean)[0];
          if (next) { next.focus(); return; }
        }
        MW.act.noteQuickAdd();
      });
    });
  }

  /* 排序：素材库最常问的是「最近的有哪些」，所以时间默认倒序 */
  function sortItems(arr) {
    const a = arr.slice();
    if (sortBy === 'name') a.sort(function (x, y) { return String(x.name).localeCompare(String(y.name), 'zh'); });
    else if (sortBy === 'size') a.sort(function (x, y) { return (+y.size || 0) - (+x.size || 0); });
    else if (sortBy === 'kind') {
      a.sort(function (x, y) {
        if (x.kind !== y.kind) return String(x.kind).localeCompare(String(y.kind));
        return (y.mtime || 0) - (x.mtime || 0);
      });
    } else a.sort(function (x, y) { return (y.mtime || 0) - (x.mtime || 0); });
    return a;
  }

  /* ---------- 素材文件夹卡 ----------
     这一张替代原来那条窄窄的状态条。三个信息必须同屏可见：
     ① 我连的是哪个文件夹（且知道它在硬盘的什么位置）② 现在能不能读写
     ③ 我能对它做什么（连 / 导入 / 同步 / 登记）。
     路径为什么用输入框而不是纯文字：浏览器出于安全**不告诉网页目录的绝对路径**
     （目录句柄只有文件夹名，没有 D:\ 这种路径），所以只能让用户自己填一次，
     我们存下来复用。有了它才能「打开文件夹」和复制完整路径。 */
function renderRootCard(s, hint) {
    const p = rootPath();
    const connected = !!dirHandle;
    const pending = s.pending || pendingHandle;
    return '<div class="card asset-root-card' + (connected ? ' connected' : '') + '">' +
      '<div class="asset-root-head">' +
        '<div class="asset-root-title">' + MW.icon('folder', 15) + ' 本地素材文件夹</div>' +
        '<div class="asset-root-state">' +
          (connected
            ? '<span class="dot-ok"></span>已连接 · ' + listing.length + ' 个文件'
            : pending
              ? '<span class="dot-warn"></span>等你授权'
              : '<span class="dot-warn"></span>未连接') +
        '</div>' +
      '</div>' +

      '<div class="asset-root-path">' +
        '<input id="as-root" value="' + MW.esc(p) + '" placeholder="素材文件夹的完整路径，例：D:\\自媒体素材库">' +
        '<button class="btn sm" onclick="MW.act.asSaveRoot()">记住路径</button>' +
        '<button class="btn sm" onclick="MW.act.asOpenRoot()" title="在资源管理器里打开这个文件夹">' + MW.icon('folder', 13) + ' 打开文件夹</button>' +
        '<button class="btn sm ghost" onclick="MW.act.asCopyRoot()" title="复制文件夹路径">' + MW.icon('copy', 13) + '</button>' +
      '</div>' +
      '<div class="asset-root-hint">' + (p
        ? '路径已记住 · 复制文件路径、打开文件夹都能用'
        : '<b>填一次完整路径</b>，之后就能一键打开文件夹、复制文件的完整路径（浏览器不会告诉网页文件夹在哪，只能你填）') +
      '</div>' +

      '<div class="asset-root-ops">' +
        (pending
          ? '<button class="btn primary" onclick="MW.act.asRegrant()">' + MW.icon('check', 14) + ' 点此授权</button>'
          : '<button class="btn' + (connected ? '' : ' primary') + '" onclick="MW.act.asPickFolder()">' +
            MW.icon('folder', 14) + (connected ? ' 换一个文件夹' : ' 连接本文件夹') + '</button>') +
        (connected ? '<button class="btn" onclick="MW.act.asImport()">' + MW.icon('upload', 14) + ' 导入文件到文件夹</button>' : '') +
        '<button class="btn" onclick="MW.act.asSync()">' + MW.icon('refresh', 14) + ' 同步清单</button>' +
        '<button class="btn" onclick="MW.act.asManual()">' + MW.icon('edit', 14) + ' 手动登记文件</button>' +
        (connected ? '<button class="btn sm ghost" onclick="MW.act.asDisconnect()">断开</button>' : '') +
      '</div>' +

      '<div class="asset-root-note">' + (connected
        ? '已连接：导入的文件会直接写进这个文件夹。你在电脑上往里放文件后，点「同步清单」就能刷出来。'
        : (hint || '点「连接本文件夹」授权一次（Chrome / Edge 支持），之后就能把文件直接导入本地文件夹并自动分类。' +
          '浏览器不支持也没关系：把文件放进文件夹 → 点「同步清单」，或用「手动登记文件」记录路径。')) +
      '</div>' +
    '</div>';
  }

  /* 回车即保存路径：用户填完路径最自然的一个动作是敲回车 */
  function bindRootCard(root) {
    const el = document.getElementById('as-root');
    if (!el) return;
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); MW.act.asSaveRoot(); }
    });
  }

  /* ---------- 行式文件行 ----------
     素材库的第一任务是「找东西」，不是「欣赏图」。行式一屏能看 20+ 个文件，
     找文件的效率远高于大卡片网格。缩略图仍保留在左侧做快速识别。 */
  function renderRow(f) {
    const m = metaOf(f.rel);
    const kind = f.kind || AS.kindOf(f.name, f.mime);
    const acc = m.accountId ? MW.accOf(m.accountId) : null;
    const rel = MW.esc(f.rel).replace(/'/g, '');
    const uses = MW.contentUses(f.rel);
    return '<div class="asset-row" data-rel="' + MW.esc(f.rel) + '">' +
      '<div class="asset-thumb sm" data-rel="' + MW.esc(f.rel) + '">' +
        '<span class="asset-thumb-fallback">' + MW.icon(AS.iconOfKind(kind), 15) + '</span>' +
      '</div>' +
      '<div class="asset-row-main">' +
        '<div class="asset-row-name" title="' + MW.esc(f.rel) + '">' + MW.esc(f.name) +
          (f.sub ? '<span class="asset-row-sub">' + MW.esc(f.sub) + '</span>' : '') + '</div>' +
        '<div class="asset-row-meta">' +
          '<span class="asset-row-kind k-' + AS.colorOfKind(kind) + '">' + AS.labelOfKind(kind) + '</span>' +
          '<span>' + (f.size ? AS.fileSize(f.size) : '—') + '</span>' +
          '<span>' + AS.relTime(f.mtime) + '</span>' +
          (f.date && f.date !== AS.dateOf({ mtime: f.mtime }) ? '<span class="asset-date">' + MW.esc(f.date) + '</span>' : '') +
          (acc ? '<span class="asset-acc">' + MW.icon('flag', 10) + ' ' + MW.esc(acc.name) + '</span>' : '') +
          (m.tags || []).map(function (t) { return MW.ui.tag(t); }).join('') +
          (m.note ? '<span class="asset-row-note">' + MW.esc(m.note) + '</span>' : '') +
          (uses.length
            ? '<button class="asset-use" title="查看被哪些内容使用" onclick="event.stopPropagation();MW.act.asShowUses(\'' + rel + '\')">' +
              MW.icon('link', 10) + ' ' + uses.length + ' 条内容在用</button>'
            : '') +
        '</div>' +
      '</div>' +
      '<div class="asset-row-ops">' +
        '<button class="icon-btn sm" title="打开" onclick="event.stopPropagation();MW.act.asOpenFile(\'' + rel + '\')">' + MW.icon('eye', 13) + '</button>' +
        '<button class="icon-btn sm" title="标注" onclick="event.stopPropagation();MW.act.asMeta(\'' + rel + '\')">' + MW.icon('edit', 13) + '</button>' +
        '<button class="icon-btn sm" title="复制路径" onclick="event.stopPropagation();MW.act.asCopyPath(\'' + rel + '\')">' + MW.icon('copy', 13) + '</button>' +
        '<button class="icon-btn sm" title="从清单移除（不动文件）" onclick="event.stopPropagation();MW.act.asRemove(\'' + rel + '\')">' + MW.icon('x', 13) + '</button>' +
        '<button class="icon-btn sm danger" title="永久删除硬盘文件" onclick="event.stopPropagation();MW.act.asDeleteFile(\'' + rel + '\')">' + MW.icon('trash', 13) + '</button>' +
      '</div>' +
    '</div>';
  }

  /* ---------- 素材笔记区 ----------
     文案模板、金句、工具链接这类东西加得很频繁，所以给一条行内表单直接写，
     不想填全就只填名称 + 回车，不逼人开弹窗。完整编辑（标签、账号）仍在弹窗里。 */
  function renderNotes(db) {
    const types = ['文案模板', '封面模板', 'BGM', '字体', '工具', '金句', '其他'];
    let html = '<div class="card asset-notes">' +
      '<div class="card-head"><div class="card-title">' + MW.icon('note', 15) + ' 素材笔记</div>' +
      '<div class="card-sub">文案模板 / 工具链接 / 金句 —— 不用存成文件的东西</div>' +
      '<button class="btn sm" onclick="MW.act.openAssetModal()">' + MW.icon('plus', 13) + ' 详细添加</button></div>';

    /* 行内速记 */
    html += '<div class="note-quick">' +
      MW.ui.select('nq-type', types.map(function (t) { return { v: t, t: t }; }), '文案模板', 'nq-type') +
      '<input id="nq-name" placeholder="名称，例：高能开头钩子 20 句">' +
      '<input id="nq-link" placeholder="链接 https://…（选填）">' +
      '<input id="nq-note" placeholder="备注（选填）">' +
      '<button class="btn primary" onclick="MW.act.noteQuickAdd()">' + MW.icon('plus', 13) + ' 添加</button>' +
    '</div>';

    if (!db.assets.length) {
      html += MW.ui.empty('暂无素材笔记', '在上方填写名称即可保存，链接与备注可后续补充');
    } else {
      html += '<div class="asset-note-list">' + db.assets.map(function (a) {
        const uses = MW.contentUses(a.id);
        return '<div class="asset-note-row">' +
          '<span class="asset-type">' + MW.esc(a.type) + '</span>' +
          '<div class="grow"><b>' + MW.esc(a.name) + '</b>' +
          (a.note ? '<div class="muted">' + MW.esc(a.note) + '</div>' : '') +
          (a.link ? '<div class="muted">' + MW.icon('link', 11) + ' ' + MW.esc(a.link) + '</div>' : '') +
          '<div class="asset-tags">' + (a.tags || []).map(function (t) { return MW.ui.tag(t); }).join('') +
          (uses.length
            ? '<button class="asset-use" title="查看被哪些内容使用" onclick="MW.act.asShowUses(\'' + a.id + '\')">' +
              MW.icon('link', 10) + ' ' + uses.length + ' 条内容在用</button>'
            : '') + '</div></div>' +
          '<button class="icon-btn sm" onclick="MW.act.openAssetModal(\'' + a.id + '\')">' + MW.icon('edit', 13) + '</button>' +
          '<button class="icon-btn sm" onclick="MW.act.delAsset(\'' + a.id + '\')">' + MW.icon('trash', 13) + '</button>' +
        '</div>';
      }).join('') + '</div>';
    }
    return html + '</div>';
  }

  /* 反查：这个素材被哪些内容用了。
     关联必须双向可见——只让内容挑素材、素材页看不见被谁用，
     这个关联就是半透明的，用两次就会被当成不存在。 */
  MW.act.asShowUses = function (key) {
    const a = MW.assetByKey(key);
    const uses = MW.contentUses(key);
    MW.modal({
      title: '被哪些内容使用',
      sub: a ? a.name : key,
      body: uses.length
        ? '<div class="uses-list">' + uses.map(function (c) {
            const st = MW.STAGES.find(function (x) { return x.id === c.status; }) || { name: c.status, color: '#9aa0b4' };
            const acc = MW.accOf(c.accountId);
            return '<div class="uses-row">' +
              '<span class="uses-date">' + MW.esc(c.date.slice(5)) + '</span>' +
              '<div class="uses-title"><b>' + MW.esc(c.title) + '</b>' +
              '<span class="uses-sub">' + MW.esc(acc ? acc.name : '未指定账号') + '</span></div>' +
              '<span class="uses-st" style="color:' + st.color + '">' + MW.esc(st.name) + '</span>' +
              '</div>';
          }).join('') + '</div>'
        : MW.ui.empty('暂无内容绑定该素材', '可在发布管理为内容绑定素材'),
      footer: false
    });
  };

  /* 笔记速记：只填名称也能加，其余有就填。回车即提交。 */
  MW.act.noteQuickAdd = function () {
    const db = MW.getDB();
    const v = function (id) { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    const name = v('nq-name');
    if (!name) { MW.toast('至少写个名称', 'error'); const e = document.getElementById('nq-name'); if (e) e.focus(); return; }
    db.assets.unshift({
      id: MW.uid(), name: name, type: v('nq-type') || '其他',
      accountId: '', tags: [], note: v('nq-note'), link: v('nq-link'),
      createdAt: MW.dateStr()
    });
    MW.save(); MW.render();
    MW.toast('已加入素材笔记');
  };

  function renderWelcome(s, hint) {
    return '<div class="page-head"><div class="page-title">素材库</div>' +
      '<div class="page-sub">文件存在你自己的硬盘上，工作台不复制、不上传，只做索引和标注</div></div>' +
      '<div class="card welcome-card">' +
        '<div class="welcome-title">' + MW.icon('folder', 18) + ' 先选一个素材文件夹</div>' +
        '<div class="welcome-sub">建议单独建一个，比如 <code>D:\\自媒体素材库</code>。连上以后会自动建好类型子文件夹，新素材按类型自动归位、日期自动标好。</div>' +
        '<div class="wiz-kinds big">' + AS.KINDS.filter(function (k) { return k.key !== 'other'; }).map(function (k) {
          return '<span class="wiz-kind">' + MW.icon(k.icon, 13) + ' ' + k.label + '</span>';
        }).join('') + '</div>' +
        (hint ? '<div class="wiz-fallback">' + MW.esc(hint) + '</div>' : '') +
        '<div class="welcome-ops">' +
          '<button class="btn primary" id="as-main-btn">' + MW.icon('folder', 14) + (AS.supported() ? ' 选择文件夹' : ' 手动登记路径') + '</button>' +
          '<button class="btn" id="as-wizard-btn">' + MW.icon('help', 14) + ' 三步说明</button>' +
          /* 不支持 FSA 的浏览器，唯一能记文件位置的办法就是手动登记，
             必须在第一屏就给出来，不然用户会以为这功能跟自己无关 */
          (AS.supported() ? '<button class="btn" id="as-manual-btn">' + MW.icon('edit', 14) + ' 手动登记文件</button>' : '') +
        '</div>' +
        '<div class="welcome-note">文件夹里的文件永远在你电脑上。工作台只保存一份索引，清缓存、换电脑都不影响文件本身。</div>' +
      '</div>' +
      '<div class="asset-drop" id="asset-drop">' + MW.ui.empty('尚未连接文件夹', '也可将文件夹直接拖入此区域') + '</div>' +
      renderNotes(MW.getDB());
  }

  /* 状态卡：正常/已连接状态已经并进「素材文件夹卡」了，
     这里只留需要用户动手处理的两种异常，避免同一件事说两遍。 */
  function renderStatusCard(s, hint) {
    if (scanState === 'error') {
      return '<div class="asset-status pending">' +
        '<span class="dot-warn"></span>' +
        '<div class="grow"><b>读取文件夹出错</b><span class="muted">' + MW.esc(scanMsg) + '</span></div>' +
        '<button class="btn sm" onclick="MW.act.asSync()">' + MW.icon('refresh', 13) + ' 重试</button>' +
        '</div>';
    }
    if (!dirHandle && (s.pending || pendingHandle)) {
      return '<div class="asset-status pending">' +
        '<span class="dot-warn"></span>' +
        '<div class="grow"><b>上次连的文件夹还在</b><span class="muted">浏览器要求你亲自点一下确认授权（安全限制，不能自动恢复）</span></div>' +
        '<button class="btn sm ghost" onclick="MW.act.asDisconnect()">不连了</button>' +
        '</div>';
    }
    if (!dirHandle && s.list.length) {
      return '<div class="asset-status">' +
        '<span class="dot-warn"></span>' +
        '<div class="grow"><b>当前是离线清单</b><span class="muted">' + s.list.length +
        ' 条索引还在，可以搜索和查看标注；连上文件夹后恢复直接打开、导入、删除</span></div>' +
        '</div>';
    }
    return '';
  }

  function renderCard(f) {
    const m = metaOf(f.rel);
    const kind = f.kind || AS.kindOf(f.name, f.mime);
    const acc = m.accountId ? MW.accOf(m.accountId) : null;
    return '<div class="asset-card card file-card">' +
      '<div class="asset-thumb" data-rel="' + MW.esc(f.rel) + '">' +
        '<span class="asset-thumb-fallback">' + MW.icon(AS.iconOfKind(kind), 18) + '</span>' +
        '<span class="asset-kind-chip k-' + AS.colorOfKind(kind) + '">' + AS.labelOfKind(kind) + '</span>' +
      '</div>' +
      '<div class="asset-name" title="' + MW.esc(f.rel) + '">' + MW.esc(f.name) + '</div>' +
      '<div class="asset-sub">' + MW.esc(f.sub || '根目录') + '</div>' +
      '<div class="asset-facts">' +
        '<span>' + (f.size ? AS.fileSize(f.size) : '—') + '</span>' +
        '<span>' + AS.relTime(f.mtime) + '</span>' +
      '</div>' +
      (acc ? '<div class="asset-acc">' + MW.icon('flag', 11) + ' ' + MW.esc(acc.name) + '</div>' : '') +
      '<div class="asset-foot">' +
        '<div class="asset-tags">' +
          (m.tags || []).map(function (t) { return MW.ui.tag(t); }).join('') +
          '<span class="asset-date">' + MW.esc(f.date || '') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="asset-ops">' +
        '<button class="icon-btn sm" title="标注" onclick="MW.act.asMeta(\'' + MW.esc(f.rel).replace(/'/g, '') + '\')">' + MW.icon('edit', 13) + '</button>' +
        '<button class="icon-btn sm" title="打开" onclick="MW.act.asOpenFile(\'' + MW.esc(f.rel).replace(/'/g, '') + '\')">' + MW.icon('eye', 13) + '</button>' +
        '<button class="icon-btn sm" title="从清单移除（不动文件）" onclick="MW.act.asRemove(\'' + MW.esc(f.rel).replace(/'/g, '') + '\')">' + MW.icon('x', 13) + '</button>' +
        '<button class="icon-btn sm danger" title="永久删除硬盘文件" onclick="MW.act.asDeleteFile(\'' + MW.esc(f.rel).replace(/'/g, '') + '\')">' + MW.icon('trash', 13) + '</button>' +
      '</div>' +
      '</div>';
  }

  /* 拖拽：整页都能接 */
  function bindDrag(root) {
    const zone = root.querySelector('#asset-drop') || root;
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) {
        e.preventDefault();
        dragDepth += 1;
        zone.classList.add('drop-active');
        document.body.classList.add('dragging');
      });
    });
    zone.addEventListener('dragleave', function (e) {
      e.preventDefault();
      dragDepth -= 1;
      if (dragDepth <= 0) { zone.classList.remove('drop-active'); document.body.classList.remove('dragging'); }
    });
    zone.addEventListener('drop', function (e) { onDrop(e); });
  }

  function bindSearch(root) {
    const el = document.getElementById('asset-search');
    if (!el) return;
    let timer = null, composing = false;
    const flush = function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        const v = el.value;
        if (v === keyword) return;
        keyword = v;
        MW.render();
        const e2 = document.getElementById('asset-search');
        if (e2) { e2.focus(); e2.setSelectionRange(v.length, v.length); }
      }, 300);
    };
    el.addEventListener('compositionstart', function () { composing = true; });
    el.addEventListener('compositionend', function () { composing = false; flush(); });
    el.addEventListener('input', function () { if (!composing) flush(); });
  }

  /* 页面进入时恢复连接状态 */
  MW.views['assets'].onEnter = function () {
    if (!AS.supported()) return;
    AS.loadHandle().then(function (h) {
      if (h && !dirHandle) restore();
    });
  };

  /* ---------- 传统素材记录：保留原逻辑（笔记类无需文件） ---------- */

  MW.act.openAssetModal = function (id) {
    const db = MW.getDB();
    const a = id ? db.assets.find(function (x) { return x.id === id; }) : null;
    const types = ['文案', '模板', '工具', '金句', '其他'];
    const body =
      MW.ui.row('名称', '<input id="as-name" placeholder="例如：高能开头钩子 20 句" value="' + MW.esc(a ? a.name : '') + '">') +
      '<div class="form-2col">' +
        MW.ui.row('类型', MW.ui.select('as-type', types.map(function (t) { return { v: t, t: t }; }), a ? a.type : '文案')) +
        MW.ui.row('归属账号', MW.ui.select('as-account', [{ v: '', t: '通用' }].concat(db.accounts.map(function (x) {
          return { v: x.id, t: x.name };
        })), a ? a.accountId : '')) +
      '</div>' +
      MW.ui.row('标签', '<textarea id="as-tags" rows="2" placeholder="每行一个，或用逗号分隔" style="min-height:48px">' + MW.esc(a ? (a.tags || []).join('\n') : '') + '</textarea>') +
      MW.ui.row('链接 / 说明', '<textarea id="as-note" rows="2" placeholder="网盘链接，或使用说明">' + MW.esc(a ? a.note : '') + '</textarea>');

    MW.modal({
      title: a ? '编辑笔记' : '添加素材笔记',
      sub: '不需要存成文件的东西放这里',
      body: body,
      okText: '保存',
      onOk: function (root) {
        const v = function (id2) { return (root.querySelector('#' + id2).value || '').trim(); };
        const name = v('as-name');
        if (!name) { MW.toast('请填写名称', 'error'); return false; }
        const obj = {
          name: name, type: v('as-type'), accountId: v('as-account'),
          tags: MW.parseTags(v('as-tags')),
          note: v('as-note')
        };
        if (a) Object.assign(a, obj);
        else db.assets.unshift(Object.assign({ id: MW.uid(), createdAt: MW.dateStr() }, obj));
        MW.save(); MW.render();
        MW.toast(a ? '已更新' : '已添加');
      }
    });
  };

  MW.act.delAsset = function (id) {
    MW.confirm('删除这条素材笔记？（不影响硬盘上的文件）', function () {
      const db = MW.getDB();
      db.assets = db.assets.filter(function (x) { return x.id !== id; });
      MW.save(); MW.render(); MW.closeModal();
      MW.toast('已删除');
    });
  };
})();