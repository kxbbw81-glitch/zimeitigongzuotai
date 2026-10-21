/* ============================================================
   视图 · 关于与联系（软件信息 / 卖家联系方式 / 授权状态）
   - 自用：填自己的联系方式，导出备份时一并带走
   - 销售：安装包分发时这里展示卖家信息，买家随时能找到人
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});

  /* 软件版本号：随安装包一起分发，买家反馈问题时先看这里 */
  MW.VERSION = '1.0.3';
  MW.REPO_URL = 'https://github.com/kxbbw81-glitch/zimeitigongzuotai';

  /* ---------- 授权码（轻量本地校验） ----------
     格式 MW-XXXX-XXXX-XXXX：前 8 位是随机基数，后 4 位是校验码。
     校验 = 把前 8 位做散列转 base36，与后 4 位比对。
     本地校验只为「正版标识 + 优先支持」——不锁任何功能，
     数据在买家本机，锁功能既挡不住也伤体验。 */
  MW.about = {};

  MW.about.codeHash = function (base) {
    let h = 0;
    const s = String(base || '').toUpperCase();
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) % 1679616; /* 36^4 */
    }
    let out = '';
    let n = h;
    for (let i = 0; i < 4; i++) {
      out = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[n % 36] + out;
      n = Math.floor(n / 36);
    }
    return out;
  };

  /* 生成一个有效授权码：seed 建议用买家标识（手机号/邮箱/订单号） */
  MW.about.genCode = function (seed) {
    let s = String(seed || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    while (s.length < 8) s += '0';
    const base = (s.slice(0, 4) + '-' + s.slice(4, 8)).replace(/-/g, '');
    const check = MW.about.codeHash(base);
    return 'MW-' + base.slice(0, 4) + '-' + base.slice(4, 8) + '-' + check;
  };

  MW.about.codeValid = function (code) {
    const m = String(code || '').trim().toUpperCase().match(/^MW-([0-9A-Z]{4})-([0-9A-Z]{4})-([0-9A-Z]{4})$/);
    if (!m) return false;
    return MW.about.codeHash(m[1] + m[2]) === m[3];
  };

  MW.about.licensed = function () {
    const db = MW.getDB();
    const lic = db.settings && db.settings.license;
    return !!(lic && lic.code && MW.about.codeValid(lic.code));
  };

  /* ---------- 打开关于弹窗 ---------- */
  MW.act.aboutApp = function () {
    const db = MW.getDB();
    const ab = (db.settings && db.settings.about) || {};
    const licensed = MW.about.licensed();
    const contactTypes = [
      { v: 'wechat', t: '微信' }, { v: 'qq', t: 'QQ' }, { v: 'email', t: '邮箱' },
      { v: 'phone', t: '电话' }, { v: 'site', t: '网站' }, { v: 'other', t: '其他' }
    ];

    const body =
      /* 软件介绍 */
      '<div class="ab-intro">' +
        '<div class="ab-app">' +
          '<div class="ab-logo">' + MW.icon('sparkles', 22) + '</div>' +
          '<div><b>社媒工作台</b><span>外贸社媒 · 自媒体一体化</span></div>' +
          '<em class="ab-ver">v' + MW.VERSION + '</em>' +
        '</div>' +
        '<p>选题灵感、转载跟踪、发布日历、数据复盘、素材库、待办与账本——一个本机软件全部搞定。数据存在本机浏览器，不经过任何服务器。</p>' +
      '</div>' +

      /* 联系方式 */
      '<div class="ab-sec-title">' + MW.icon('at', 14) + ' 联系方式</div>' +
      '<div class="ab-contact' + (ab.contactValue ? '' : ' empty') + '" id="ab-contact-card">' +
        (ab.contactValue
          ? '<div class="ab-contact-line"><b>' + MW.esc(ab.contactLabel || '联系') + '</b><span>' + MW.esc(ab.contactValue) + '</span></div>' +
            (ab.contactNote ? '<div class="ab-contact-note">' + MW.esc(ab.contactNote) + '</div>' : '')
          : '<div class="ab-contact-empty">尚未填写联系方式——点下方「编辑」填上，自用填自己，随安装包分发时买家就能看到。</div>') +
      '</div>' +
      '<button class="btn sm" id="ab-edit-btn" style="margin-top:8px">' + MW.icon('edit', 13) + (ab.contactValue ? '修改联系方式' : '填写联系方式') + '</button>' +

      /* 授权 */
      '<div class="ab-sec-title">' + MW.icon('checksq', 14) + ' 授权状态</div>' +
      (licensed
        ? '<div class="ab-license ok">' + MW.icon('check', 15) +
            '<div><b>已激活</b><span>感谢支持，正版用户享受更新与答疑。授权码：' + MW.esc(db.settings.license.code) + '</span></div></div>'
        : '<div class="ab-license">' + MW.icon('flag', 15) +
            '<div><b>试用版</b><span>功能全部可用。购买后填入授权码可激活正版标识，享受优先答疑。</span></div></div>' +
            '<div class="ab-license-form">' +
              MW.ui.row('授权码', '<input id="ab-license-input" placeholder="MW-XXXX-XXXX-XXXX" style="text-transform:uppercase">') +
              '<button class="btn sm primary" id="ab-license-btn">激活</button>' +
            '</div>') +

      /* 帮助 */
      '<div class="ab-sec-title">' + MW.icon('help', 14) + ' 使用帮助</div>' +
      '<div class="ab-help">' +
        '<button class="ab-help-item" id="ab-changelog-btn">' + MW.icon('note', 14) + '<div><b>更新日志</b><span>查看各版本新增与修复</span></div>' + MW.icon('right', 14) + '</button>' +
        '<button class="ab-help-item" id="ab-backup-btn">' + MW.icon('download', 14) + '<div><b>导出备份</b><span>换电脑、重装前先导一份，数据不丢</span></div>' + MW.icon('right', 14) + '</button>' +
      '</div>' +
      '<div class="ab-foot-note">数据全部存放在本机浏览器（localStorage），不上传任何服务器；清除浏览器数据前请先导出备份。</div>';

    MW.modal({
      title: '关于与联系',
      sub: '软件信息 · 联系方式 · 授权状态',
      body: body,
      footer: false
    });

    /* 编辑联系方式 */
    document.getElementById('ab-edit-btn').onclick = function () {
      const cur = (MW.getDB().settings && MW.getDB().settings.about) || {};
      const typeOpts = contactTypes.map(function (t) {
        return { v: t.v, t: t.t };
      });
      MW.modal({
        title: '编辑联系方式',
        sub: '随安装包分发时，买家在「关于与联系」里看到的就是这些信息',
        body:
          MW.ui.row('类型', MW.ui.select('ab-c-type', typeOpts, cur.contactLabel || 'wechat')) +
          MW.ui.row('联系方式', '<input id="ab-c-value" placeholder="微信号 / 邮箱 / 网址……" value="' + MW.esc(cur.contactValue || '') + '">') +
          MW.ui.row('备注', '<input id="ab-c-note" placeholder="例如：添加时请备注「社媒工作台」" value="' + MW.esc(cur.contactNote || '') + '">',
            '可留空。这里的信息会随备份一起导出，换电脑不丢失。'),
        okText: '保存',
        onOk: function () {
          const label = document.getElementById('ab-c-type');
          const db2 = MW.getDB();
          db2.settings = db2.settings || {};
          db2.settings.about = {
            contactLabel: label.options[label.selectedIndex].text,
            contactValue: (document.getElementById('ab-c-value').value || '').trim(),
            contactNote: (document.getElementById('ab-c-note').value || '').trim()
          };
          MW.save();
          MW.toast('联系方式已保存');
          MW.act.aboutApp();
          return false;
        }
      });
    };

    /* 激活授权码 */
    const licBtn = document.getElementById('ab-license-btn');
    if (licBtn) licBtn.onclick = function () {
      const input = document.getElementById('ab-license-input');
      const code = (input.value || '').trim().toUpperCase();
      if (!code) { MW.toast('请先输入授权码', 'error'); return; }
      if (!MW.about.codeValid(code)) { MW.toast('授权码不正确，请检查后重试', 'error'); return; }
      const db2 = MW.getDB();
      db2.settings = db2.settings || {};
      db2.settings.license = { code: code, activatedAt: new Date().toISOString() };
      MW.save();
      MW.toast('激活成功，感谢支持');
      MW.act.aboutApp();
    };

    /* 更新日志 */
    document.getElementById('ab-changelog-btn').onclick = function () {
      MW.modal({
        title: '更新日志',
        sub: 'v' + MW.VERSION,
        body:
          '<div class="ab-changelog">' +
            '<div class="ab-cl-item"><b>v1.0.3</b><span>「关于与联系」自动带上卖家联系方式——新安装与更新均生效，买家随时可联系到人</span></div>' +
            '<div class="ab-cl-item"><b>v1.0.2</b><span>AI 接口支持一键导入（扫描本机 Codex 配置 / 粘贴导入）</span></div>' +
            '<div class="ab-cl-item"><b>v1.0.1</b><span>新增转载模块：关注来源账号、记录对方更新、一键转带署名选题；浏览器插件支持公众号文章页捕获</span></div>' +
            '<div class="ab-cl-item"><b>v1.0.0</b><span>首个正式版：选题看板、发布日历、数据复盘、素材库、待办、账本、账号管理</span></div>' +
          '</div>' +
          '<div class="form-hint" style="margin-top:10px">完整更新记录在 GitHub 仓库可查。</div>',
        okText: '知道了'
      });
    };

    /* 导出备份 */
    document.getElementById('ab-backup-btn').onclick = function () {
      MW.closeModal();
      MW.act.exportData();
    };
  };
})();
