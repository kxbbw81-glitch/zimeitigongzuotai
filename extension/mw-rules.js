/* 社媒工作台 · 插件提醒规则引擎
   纯函数、无浏览器 API 依赖——后台 service worker 与弹窗共用，
   Node 环境可直接 import 做单元测试。

   口径与站内保持一致（改站内规则时这里要同步）：
   - 内容「未发布」= status !== 'published'（与发布页 pubMark 同）
   - 逾期内容   = 未发布且 date < 今天（与发布页「逾期」同）
   - 待办「未完成」= !done（与待办页筛选同）
   数据来自网页版 store.js 的桥接快照（chrome.storage.mw_sync）。 */

/* 本地时区的 YYYY-MM-DD（与站内 MW.dateStr 同口径，不依赖 Intl） */
export function todayStr(d) {
  const t = d || new Date();
  const p = function (n) { return String(n).padStart(2, '0'); };
  return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
}

/* 两个 YYYY-MM-DD 之间差几天（b - a，正数表示 b 更晚） */
export function daysBetween(a, b) {
  const pa = Date.parse(a + 'T00:00:00');
  const pb = Date.parse(b + 'T00:00:00');
  if (isNaN(pa) || isNaN(pb)) return 0;
  return Math.round((pb - pa) / 86400000);
}

/* 平台名映射（与站内 MW.PLATFORMS 的 name 一致，避免规则引擎依赖全局） */
const PLATFORM_NAMES = {
  xhs: '小红书', dy: '抖音', gzh: '公众号', bili: 'B站',
  sph: '视频号', x: 'X', li: 'LinkedIn', zhihu: '知乎',
  wb: '微博', yt: 'YouTube', other: '其他'
};
export function platformName(key) {
  return PLATFORM_NAMES[key] || '未指定';
}

/* 从桥接快照里捞出今天要关注的事。
   返回 { today, late, dueToday, dueNow, overdueTodos, todayTodos }：
   - late          逾期未发的内容（date < 今天）
   - dueToday      今天要发的内容（date = 今天，未发布）
   - dueNow        今天已到发布时点但还没标「发了」的（time <= 当前时分）
   - overdueTodos 逾期未完成的待办
   - todayTodos    今天到期的待办 */
export function collect(db, now) {
  now = now || new Date();
  const today = todayStr(now);
  const hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const out = { today: today, late: [], dueToday: [], dueNow: [], overdueTodos: [], todayTodos: [] };
  if (!db) return out;

  (db.contents || []).forEach(function (c) {
    if (!c || c.status === 'published' || !c.date) return;
    const item = { id: c.id, title: c.title || '(无标题)', date: c.date, time: c.time || '', pf: platformName(c.pf) };
    if (c.date < today) {
      item.days = daysBetween(c.date, today);
      out.late.push(item);
    } else if (c.date === today) {
      out.dueToday.push(item);
      /* 有发布时点且已到点 → 该催了；没填时点的不催（不能替用户假设） */
      if (item.time && item.time <= hm) out.dueNow.push(item);
    }
  });

  (db.todos || []).forEach(function (t) {
    if (!t || t.done || !t.date) return;
    const item = { id: t.id, title: t.title || '(无标题)', date: t.date, time: t.time || '' };
    if (t.date < today) {
      item.days = daysBetween(t.date, today);
      out.overdueTodos.push(item);
    } else if (t.date === today) {
      out.todayTodos.push(item);
    }
  });

  return out;
}

/* 工具栏角标数：今天需要动手的事的总量（不含已到点重复计） */
export function badgeCount(r) {
  return r.late.length + r.dueToday.length + r.overdueTodos.length;
}

/* 生成要发的系统通知清单（文案在这里定，通知机制在 background.js）。
   每条带 dedupeKey——background 用它去重，同一天同一条只响一次。
   优先级：到点 > 逾期内容 > 逾期待办。 */
export function notifications(r) {
  const list = [];
  r.dueNow.forEach(function (c) {
    list.push({
      dedupeKey: 'due:' + c.id + ':' + r.today,
      title: '该发了：' + c.title,
      message: c.pf + ' · 原定 ' + (c.time || '今天') + (c.time ? ' 发布' : '')
    });
  });
  if (r.late.length) {
    const first = r.late[0];
    list.push({
      dedupeKey: 'late:' + r.today,
      title: r.late.length + ' 条内容已逾期未发',
      message: '最近一条：' + first.title + '（' + first.pf + ' · 逾期 ' + first.days + ' 天）'
    });
  }
  if (r.overdueTodos.length) {
    list.push({
      dedupeKey: 'todo:' + r.today,
      title: r.overdueTodos.length + ' 条待办已逾期',
      message: '最近一条：' + r.overdueTodos[0].title + '（逾期 ' + r.overdueTodos[0].days + ' 天）'
    });
  }
  return list;
}
