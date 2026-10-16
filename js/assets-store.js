/* ============================================================
   素材库 · 本地文件夹存储层
   ------------------------------------------------------------
   设计原则（这是整个功能的地基，改之前先读）：
   1. 文件永远在用户硬盘上，工作台一个字节都不复制、不转存。
   2. 浏览器里只存三类东西：目录句柄（IndexedDB）、缩略图缓存
      （IndexedDB，Blob 不是 base64）、索引与标注（localStorage）。
   3. localStorage 只有约 5MB，**绝不能存图片/视频内容**，否则
      几���图就撑爆。所以缩略图一律走 IndexedDB。
   4. 元数据（标签/归属/备注）写成文件夹里的 .mw-assets.json 旁车
      文件，跟着文件夹走：换电脑、清缓存、换浏览器都不丢。
   5. 删索引 ≠ 删文件。默认只从清单移除，删硬盘文件必须显式二次确认。
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  const AS = (MW.assets = MW.assets || {});

  /* 素材类型定义：key 用于文件夹名与内部判断，label 用于界面 */
  const KINDS = [
    { key: 'image', label: '图片', icon: 'image', color: 'purple' },
    { key: 'video', label: '视频', icon: 'video', color: 'blue' },
    { key: 'audio', label: '音频', icon: 'note', color: 'teal' },
    { key: 'doc', label: '文章', icon: 'file', color: 'amber' },
    { key: 'template', label: '模板', icon: 'layers', color: 'green' },
    { key: 'other', label: '其他', icon: 'folder', color: 'gray' }
  ];

  /* 扩展名 → 类型。MIME 兜底在kindOf 里（无扩展名时按 mime 前缀判）。
     设计取舍：psd / ai / sketch 这类设计源文件归到「图片」而不是「模板」，
     因为用户找「3D 打印机产品图原图」时一定会先去图片文件夹翻，
     把源文件单独扔进模板会让人找不到。真正需要复用的版式（prproj/fig 模板、
     capcut 工程）才归模板。 */
  const EXT_MAP = {
    /* 图片（含设计源文件） */
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
    bmp: 'image', heic: 'image', avif: 'image', tif: 'image', tiff: 'image',
    psd: 'image', ai: 'image', sketch: 'image', fig: 'image', cdr: 'image',
    raw: 'image', cr2: 'image', nef: 'image', arw: 'image',
    /* 视频 */
    mp4: 'video', mov: 'video', avi: 'video', mkv: 'video', flv: 'video',
    wmv: 'video', webm: 'video', m4v: 'video', prproj: 'video',
    /* 音频 */
    mp3: 'audio', wav: 'audio', m4a: 'audio', aac: 'audio', flac: 'audio', ogg: 'audio',
    /* 文章 / 文案 */
    md: 'doc', txt: 'doc', doc: 'doc', docx: 'doc', pdf: 'doc',
    rtf: 'doc', pages: 'doc', xls: 'doc', xlsx: 'doc', csv: 'doc', ppt: 'doc', pptx: 'doc',
    /* 模板 */
    capcut: 'template', aep: 'template', zip: 'other'
  };

  const KIND_BY_KEY = {};
  KINDS.forEach(function (k) { KIND_BY_KEY[k.key] = k; });

  /* ---------------- 类型与日期推断 ---------------- */

  /* 按扩展名判定素材类型。拿不到扩展名时回退到 MIME，再不行归other。
     注意：日期类文件夹（.2026-10-13 之类）不算文档，归 other。 */
  function kindOf(name, mime) {
    const m = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,6})$/);
    if (m && EXT_MAP[m[1]]) return EXT_MAP[m[1]];
    if (mime) {
      const t = String(mime).toLowerCase();
      if (t.indexOf('image/') === 0) return 'image';
      if (t.indexOf('video/') === 0) return 'video';
      if (t.indexOf('audio/') === 0) return 'audio';
      if (t.indexOf('text/') === 0) return 'doc';
    }
    return 'other';
  }
  AS.kindOf = kindOf;
  AS.KINDS = KINDS;
  AS.KIND_BY_KEY = KIND_BY_KEY;
  AS.labelOfKind = function (key) { return (KIND_BY_KEY[key] || KIND_BY_KEY.other).label; };
  AS.iconOfKind = function (key) { return (KIND_BY_KEY[key] || KIND_BY_KEY.other).icon; };
  AS.colorOfKind = function (key) { return (KIND_BY_KEY[key] || KIND_BY_KEY.other).color; };

  /* 从文件名里捞日期。支持 2026-10-13 / 2026_10_13 / 20261013 / 2026.10.13
     / 2026年10月13日 这类写法。捞不到就返回空串，交给调用方用修改时间兜底。
     注意：必须用 new Date 真实校验，2月31日 / 13月 这类会被JS 自动进位，
     只查 1-12 / 1-31 的范围拦不住「2026-02-31」这种。 */
  function validYMD(y, mo, d) {
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
    const dt = new Date(y, mo - 1, d);
    /* 进位检查：写 2-31 会变成 3-3，所以对不上就是非法日期 */
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return '';
    return y + '-' + pad(mo) + '-' + pad(d);
  }
  function dateFromName(name) {
    const n = String(name || '');
    let m = n.match(/(20\d{2})[-_.年/](\d{1,2})[-_.月/](\d{1,2})/);
    if (m) {
      const r = validYMD(+m[1], +m[2], +m[3]);
      if (r) return r;
    }
    m = n.match(/(20\d{2})(\d{2})(\d{2})/);
    if (m) {
      const r = validYMD(+m[1], +m[2], +m[3]);
      if (r) return r;
    }
    return '';
  }
  function pad(x) { return (x < 10 ? '0' : '') + x; }
  AS.dateFromName = dateFromName;

  /* 素材日期：文件名里的日期优先（那是拍摄/制作的真实日期），
     没有就用文件修改时间。 */
  function dateOf(entry) {
    return dateFromName(entry.name) || MW.dateStr(new Date(entry.mtime || Date.now()));
  }
  AS.dateOf = dateOf;

  /* ---------------- 浏览器能力探测 ---------------- */

  function supported() { return typeof window.showDirectoryPicker === 'function'; }
  AS.supported = supported;

  /* 给非 Chromium 浏览器的说明文案，统一口径避免各页面各写一遍 */
  AS.supportHint = function () {
    if (supported()) return '';
    if (typeof window.showOpenFilePicker === 'function') {
      return '当前浏览器只支持读取、不能直接写入文件夹，建议用 Chrome 或 Edge 打开本工作台';
    }
    return '当前浏览器不支持直接读写本地文件夹（需要 Chrome / Edge），' +
      '你仍然可以用「手动登记」记录文件位置，功能不会中断';
  };

  /* ---------------- IndexedDB 封装 ---------------- */
  /* 一个库两个 store：
     handles —— 目录句柄等结构化对象（结构化克隆要求必须走 IDB，不能进 localStorage）
     thumbs  —— 缩略图 Blob（localStorage 放不下，这是存Blob 的关键理由） */

  const IDB_NAME = 'mw_assets_db';
  let idbPromise = null;

  function openDB() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise(function (resolve, reject) {
      let req;
      try { req = indexedDB.open(IDB_NAME, 1); }
      catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        const d = req.result;
        if (!d.objectStoreNames.contains('handles')) d.createObjectStore('handles');
        if (!d.objectStoreNames.contains('thumbs')) d.createObjectStore('thumbs');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB 打开失败')); };
    });
    return idbPromise;
  }

  function tx(store, mode, fn) {
    return openDB().then(function (d) {
      return new Promise(function (resolve, reject) {
        const t = d.transaction(store, mode);
        const s = t.objectStore(store);
        let out;
        try { fn(s); } catch (e) { reject(e); return; }
        t.oncomplete = function () { resolve(out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('事务中断')); };
      });
    });
  }

  function idbGet(store, key) {
    return openDB().then(function (d) {
      return new Promise(function (resolve) {
        const q = d.transaction(store, 'readonly').objectStore(store).get(key);
        q.onsuccess = function () { resolve(q.result === undefined ? null : q.result); };
        q.onerror = function () { resolve(null); };
      });
    }).catch(function () { return null; });
  }

  function idbSet(store, key, val) {
    return tx(store, 'readwrite', function (s) { s.put(val, key); })
      .then(function () { return true; })
      .catch(function () { return false; });
  }

  function idbDel(store, key) {
    return tx(store, 'readwrite', function (s) { s.delete(key); })
      .then(function () { return true; })
      .catch(function () { return false; });
  }

  AS.idbReady = function () {
    return openDB().then(function () { return true; }).catch(function () { return false; });
  };

  /* ---------------- 目录句柄：保存与恢复 ---------------- */

  const HANDLE_KEY = 'assetDir';

  AS.saveHandle = function (handle) { return idbSet('handles', HANDLE_KEY, handle); };
  AS.loadHandle = function () { return idbGet('handles', HANDLE_KEY); };
  AS.clearHandle = function () { return idbDel('handles', HANDLE_KEY); };

  /* 权限状态：'granted' 拿到了 / 'prompt' 需要用户再点一下授权 / 'denied' 被拒 */
  AS.permState = async function (handle) {
    if (!handle || !handle.queryPermission) return 'denied';
    try {
      const opt = { mode: 'readwrite' };
      let p = await handle.queryPermission(opt);
      if (p !== 'granted' && handle.requestPermission) {
        /* requestPermission 必须由用户手势触发，所以只在这里准备一个入口，
           真正的调用放在 bindReconnect 里由点击事件直接执行。 */
        p = await handle.queryPermission(opt);
      }
      return p || 'prompt';
    } catch (e) { return 'denied'; }
  };

  /* 用户点「重新授权」时调用（必须在点击事件栈内直接调，否则浏览器拒绝） */
  AS.regrant = async function (handle) {
    if (!handle || !handle.requestPermission) return 'denied';
    try { return await handle.requestPermission({ mode: 'readwrite' }); }
    catch (e) { return 'denied'; }
  };

  /* ---------------- 缩略图缓存 ---------------- */
  /* 缓存键用「相对路径 + mtime + size」，文件一改就自动失效，
     不用手动清缓存。value 是 Blob。 */

  function thumbKey(rel, mtime, size) { return rel + '|' + (mtime || 0) + '|' + (size || 0); }
  AS.thumbKey = thumbKey;

  AS.getThumb = function (key) { return idbGet('thumbs', key); };
  AS.putThumb = function (key, blob) { return idbSet('thumbs', key, blob); };

  /* 只保留最近 N 个缩略图，防止 IndexedDB 无限膨胀 */
  AS.pruneThumbs = async function (keepKeys, max) {
    max = max || 300;
    if (!keepKeys || keepKeys.size <= max) return 0;
    try {
      const d = await openDB();
      const all = await new Promise(function (resolve) {
        const q = d.transaction('thumbs', 'readonly').objectStore('thumbs').getAllKeys();
        q.onsuccess = function () { resolve(q.result || []); };
        q.onerror = function () { resolve([]); };
      });
      const drop = all.filter(function (k) { return !keepKeys.has(k); }).slice(0, all.length - max);
      if (!drop.length) return 0;
      await tx('thumbs', 'readwrite', function (s) {
        drop.forEach(function (k) { s.delete(k); });
      });
      return drop.length;
    } catch (e) { return 0; }
  };

  /* ---------------- 扫描文件夹 ---------------- */

  /* 递归扫描。depth 限制是为了防止 symlink 环把浏览器卡死。
     跳过隐藏文件和 .mw-assets.json 自己。 */
  async function walk(dirHandle, prefix, depth, out) {
    if (depth > 4) return;
    for await (const pair of dirHandle.entries()) {
      const name = pair[0];
      const h = pair[1];
      if (name.charAt(0) === '.') continue;
      if (h.kind === 'directory') {
        await walk(h, prefix ? prefix + '/' + name : name, depth + 1, out);
      } else if (h.kind === 'file') {
        let f = null;
        try { f = await h.getFile(); } catch (e) { continue; }
        out.push({
          rel: (prefix ? prefix + '/' : '') + name,
          name: name,
          sub: prefix || '',
          size: f.size,
          mtime: f.lastModified,
          mime: f.type || '',
          handle: h
        });
      }
    }
  }

  /* 扫描整个素材根目录。结果写进调用方给的数组。 */
  AS.scan = async function (dirHandle) {
    const files = [];
    await walk(dirHandle, '', 0, files);
    /* 有了句柄以后就不需要 name/size/mtime 之外的冗余，落库时剥掉 handle */
    files.sort(function (a, b) { return (b.mtime || 0) - (a.mtime || 0); });
    return files;
  };

  /* ---------------- 元数据旁车文件 ---------------- */
  /* .mw-assets.json 存：{ v:1, items:{ "相对路径": {tags,accountId,note,kind,date} } }
     跟着文件夹走，是这份数据真正的家。localStorage 里那份只是缓存。 */

  const SIDECAR = '.mw-assets.json';

  AS.readSidecar = async function (dirHandle) {
    try {
      const fh = await dirHandle.getFileHandle(SIDECAR);
      const f = await fh.getFile();
      if (!f.size) return { v: 1, items: {} };
      const j = JSON.parse(await f.text());
      if (!j || typeof j !== 'object' || !j.items) return { v: 1, items: {} };
      j.items = j.items || {};
      return j;
    } catch (e) {
      return { v: 1, items: {} };
    }
  };

  AS.writeSidecar = async function (dirHandle, data) {
    const fh = await dirHandle.getFileHandle(SIDECAR, { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(data || { v: 1, items: {} }, null, 2));
    await w.close();
    return true;
  };

  /* ---------------- 文件写入 ---------------- */

  /* 往子目录写一个文件；子目录不存在会先建。返回写入后的相对路径。 */
  AS.writeFile = async function (dirHandle, subDir, fileName, blob) {
    let target = dirHandle;
    if (subDir) {
      target = await dirHandle.getDirectoryHandle(subDir, { create: true });
    }
    /* 同名文件自动加 (1)(2)，绝不静默覆盖用户已有素材 */
    const safe = String(fileName).replace(/[\/\\:*?"<>|]/g, '_');
    let finalName = safe;
    const dot = safe.lastIndexOf('.');
    const stem = dot > 0 ? safe.slice(0, dot) : safe;
    const ext = dot > 0 ? safe.slice(dot) : '';
    let n = 1;
    for (;;) {
      try {
        await target.getFileHandle(finalName);
        finalName = stem + '(' + n + ')' + ext;
        n += 1;
        if (n > 999) break;
      } catch (e) { break; }
    }
    const fh = await target.getFileHandle(finalName, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    return (subDir ? subDir + '/' : '') + finalName;
  };

  /* ---------------- 打开文件 ---------------- */
  /* window.open('file:///') 常被浏览器拦截，所以策略是：
     拿到 File 后先尝试用 Blob URL 打开（走系统默认程序关联），
     失败则退回复制路径。离线清单没有句柄时返回 false，
     由调用方提示「连上文件夹才能打开」——不谎报成功。 */
  AS.openEntry = async function (entry, rootPath) {
    if (entry && entry.handle) {
      try {
        const f = await entry.handle.getFile();
        const url = URL.createObjectURL(f);
        const w = window.open(url, '_blank');
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        if (w) return true;
      } catch (e) { /* 落到复制路径 */ }
    }
    const p = entry && entry.path ? entry.path
      : (rootPath ? rootPath.replace(/[\\/]+$/, '') + '\\' + (entry ? String(entry.rel).replace(/\//g, '\\') : '') : '');
    if (p) { MW.copy(p); return 'copied'; }
    return false;
  };

  /* ---------------- 人类可读的体积 ---------------- */
  AS.fileSize = function (n) {
    n = +n || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  };

  /* 相对时间：今天/昨天/N 天前/日期 */
  AS.relTime = function (ts) {
    if (!ts) return '—';
    const d = MW.parseDate(MW.dateStr(new Date(ts)));
    const today = MW.parseDate(MW.dateStr());
    const diff = Math.round((today - d) / 86400000);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    if (diff > 1 && diff < 7) return diff + ' 天前';
    if (diff < 0) return '今天';
    return MW.dateStr(new Date(ts)).slice(5);
  };
})();