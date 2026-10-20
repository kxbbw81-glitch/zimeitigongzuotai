/* ============================================================
   社媒工作台 · GitHub 热更新引擎（主进程）
   ------------------------------------------------------------
   机制：
   1) 启动 / 每 4 小时 / 手动菜单，请求 GitHub commits API（带 ETag 条件请求，
      304 不消耗配额），与本地 update.json 的 currentSha 比对；
   2) 不一致 = GitHub 上有新提交 → 通知渲染进程弹「发现新版本」横幅；
   3) 用户点「立即更新」→ 按 commit sha 从 codeload 下载 tar.gz，
      解包校验后落到 userData/versions/<sha>/，切换并重载——
      不重装、不动用户数据（localStorage 在 userData 的另一位置）。
   版本目录按 sha 隔离，Windows 下也不会有文件占用问题；旧版本只留 1 个可回退。
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const REPO = {
  owner: process.env.MW_REPO_OWNER || 'kxbbw81-glitch',
  repo: process.env.MW_REPO_REPO || 'zimeitigongzuotai',
  branch: process.env.MW_REPO_BRANCH || 'main'
};
const API_BASE = 'https://api.github.com/repos/' + REPO.owner + '/' + REPO.repo;
const UA = 'shemei-workbench-desktop-updater';
const CHECK_INTERVAL = 4 * 60 * 60 * 1000;
const API_TIMEOUT = 20000;
const DOWNLOAD_TIMEOUT = 120000;
const KEEP_OLD = 1; // 除当前版本外额外保留几个旧版本（用于回退）

/* 只同步这些条目，更新包里多出来的文件一概不要——应用目录形状必须可控 */
const SYNC_ITEMS = ['index.html', 'plugin-install.html', 'css', 'js'];
const REQUIRED = ['index.html', 'js/app.js', 'js/store.js', 'css/app.css'];

function copyItems(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const item of SYNC_ITEMS) {
    const s = path.join(src, item);
    if (fs.existsSync(s)) fs.cpSync(s, path.join(dest, item), { recursive: true });
  }
}

/* 用系统自带 tar 解压 tar.gz（Windows 10 1803+ / macOS 均内置）。
   桌面壳因此不打包任何第三方运行时依赖——安装后不会出现缺模块崩溃。 */
function extractTarGz(tgz, dest) {
  return new Promise(function (resolve, reject) {
    execFile('tar', ['-xzf', tgz, '-C', dest, '--strip-components=1'], {
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024
    }, function (err) {
      if (err) {
        if (err.code === 'ENOENT') {
          reject(new Error('系统缺少 tar 命令（Windows 10 1803 以上 / macOS 均自带）。请手动下载更新包解压，或重装最新版'));
        } else {
          reject(new Error('解压更新包失败：' + (err.message || err)));
        }
        return;
      }
      resolve();
    });
  });
}

class Updater {
  /**
   * @param {string} userData app.getPath('userData')
   * @param {(msg:string)=>void} log
   */
  constructor(userData, log) {
    this.versionsDir = path.join(userData, 'versions');
    this.stateFile = path.join(userData, 'update.json');
    this.log = log || function () {};
    this.state = this._load();
  }

  _load() {
    try {
      return Object.assign(
        { currentSha: null, etag: null, lastCheckAt: null, lastError: null, available: null },
        JSON.parse(fs.readFileSync(this.stateFile, 'utf8'))
      );
    } catch (e) {
      return { currentSha: null, etag: null, lastCheckAt: null, lastError: null, available: null };
    }
  }

  _save() {
    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2) + '\n');
  }

  versionDir(sha) { return path.join(this.versionsDir, sha); }

  /* 首次启动：把安装包内置种子（resources/app-seed）铺到 versions/<seedSha>/ */
  seed(seedDir) {
    let sha = 'seed';
    try {
      sha = JSON.parse(fs.readFileSync(path.join(seedDir, 'seed.json'), 'utf8')).sha || 'seed';
    } catch (e) { /* 没有种子信息就用兜底 sha */ }
    const dest = this.versionDir(sha);
    if (!fs.existsSync(path.join(dest, 'index.html'))) {
      copyItems(seedDir, dest);
      this.log('seed copied to ' + dest);
    }
    if (!this.state.currentSha) { this.state.currentSha = sha; this._save(); }
    return sha;
  }

  /* ---------- 检查更新 ---------- */
  async check(force) {
    this.state.lastError = null;
    const headers = { 'User-Agent': UA, Accept: 'application/vnd.github+json' };
    if (this.state.etag && !force) headers['If-None-Match'] = this.state.etag;

    let res;
    try {
      res = await fetch(API_BASE + '/commits/' + REPO.branch, {
        headers,
        signal: AbortSignal.timeout(API_TIMEOUT)
      });
    } catch (e) {
      this.state.lastError = '网络不通：' + (e && e.message ? e.message : e);
      this._save();
      return { type: 'error', message: this.state.lastError };
    }

    if (res.status === 304) {
      this.state.lastCheckAt = Date.now();
      this._save();
      return { type: 'up-to-date' };
    }
    if (res.status === 403 || res.status === 429) {
      this.state.lastError = 'GitHub 接口限流，请稍后再试';
      this._save();
      return { type: 'error', message: this.state.lastError };
    }
    if (!res.ok) {
      this.state.lastError = '检查更新失败：HTTP ' + res.status;
      this._save();
      return { type: 'error', message: this.state.lastError };
    }

    const etag = res.headers.get('etag');
    if (etag) this.state.etag = etag;
    const data = await res.json();
    const latest = {
      sha: data.sha,
      message: String((data.commit && data.commit.message) || '').split('\n')[0],
      date: (data.commit && data.commit.author && data.commit.author.date) || '',
      author: (data.commit && data.commit.author && data.commit.author.name) || ''
    };
    this.state.lastCheckAt = Date.now();

    if (latest.sha && latest.sha !== this.state.currentSha) {
      this.state.available = latest;
      this._save();
      return Object.assign({ type: 'available' }, latest);
    }
    this.state.available = null;
    this._save();
    return { type: 'up-to-date' };
  }

  /* ---------- 下载并应用 ---------- */
  async apply(onProgress) {
    const target = this.state.available;
    if (!target || !target.sha) throw new Error('当前没有待安装的更新');
    const sha = target.sha;
    const dest = this.versionDir(sha);
    onProgress = onProgress || function () {};

    /* 已经下载过这个版本（比如上次装到一半）——直接切换 */
    if (fs.existsSync(path.join(dest, 'index.html'))) {
      return this._switch(sha);
    }

    onProgress({ phase: 'downloading', percent: 5 });
    const url = 'https://codeload.github.com/' + REPO.owner + '/' + REPO.repo + '/tar.gz/' + sha;
    let buf;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      buf = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      throw new Error('下载更新包失败：' + (e && e.message ? e.message : e));
    }
    onProgress({ phase: 'extracting', percent: 55 });

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-update-'));
    try {
      const tgz = path.join(tmp, 'repo.tar.gz');
      fs.writeFileSync(tgz, buf);
      const ex = path.join(tmp, 'x');
      fs.mkdirSync(ex);
      await extractTarGz(tgz, ex); // strip 掉 repo-sha/ 顶层目录

      for (const f of REQUIRED) {
        if (!fs.existsSync(path.join(ex, f))) throw new Error('更新包缺少关键文件：' + f);
      }
      const html = fs.readFileSync(path.join(ex, 'index.html'), 'utf8');
      if (html.indexOf('社媒工作台') === -1) throw new Error('更新包内容校验未通过');

      fs.rmSync(dest, { recursive: true, force: true });
      copyItems(ex, dest);
      onProgress({ phase: 'installing', percent: 90 });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }

    return this._switch(sha);
  }

  _switch(sha) {
    const prev = this.state.currentSha;
    this.state.currentSha = sha;
    this.state.available = null;
    this._save();
    this._prune();
    return { type: 'applied', sha: sha, prev: prev };
  }

  /* 只保留当前版本 + 最多 KEEP_OLD 个旧版本，其余删掉 */
  _prune() {
    let names = [];
    try {
      names = fs.readdirSync(this.versionsDir).filter(function (n) {
        return fs.statSync(path.join(this.versionsDir, n)).isDirectory();
      }, this);
    } catch (e) { return; }
    const dirs = names.map(function (n) {
      return { name: n, mtime: fs.statSync(path.join(this.versionsDir, n)).mtimeMs };
    }, this).sort(function (a, b) { return b.mtime - a.mtime; });
    const keep = new Set([this.state.currentSha].filter(Boolean));
    let extra = 0;
    for (const d of dirs) {
      if (keep.has(d.name)) continue;
      if (extra < KEEP_OLD) { keep.add(d.name); extra++; continue; }
      fs.rmSync(path.join(this.versionsDir, d.name), { recursive: true, force: true });
      this.log('pruned old version ' + d.name.slice(0, 7));
    }
  }

  repoUrl() { return 'https://github.com/' + REPO.owner + '/' + REPO.repo; }
}

module.exports = { Updater: Updater, REPO: REPO, CHECK_INTERVAL: CHECK_INTERVAL };
