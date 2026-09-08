/* ============================================================
 * 公共脚本：园区后台管理系统 - 月卡管理模块
 * 作用：
 *   1. localStorage 数据层（key=monthCardData）：加载 / 保存 / 默认模拟数据
 *   2. 通用工具：金额千分位格式化、状态文案、日期工具、唯一 id
 *   3. 公共布局交互：侧边栏折叠、子菜单展开、当前菜单高亮
 * 说明：纯原生 JS，不依赖任何框架；三个页面共用本文件
 * ------------------------------------------------------------
 * 本文件涉及的 JS 基础知识：
 *   1. 变量声明：var（函数作用域）/ let / const 区别；本项目统一用 var 兼容老浏览器
 *   2. 数据类型：Number/String/Boolean/Object/Array；typeof 判断
 *   3. 作用域：函数作用域、全局作用域；为什么变量定义在函数外
 *   4. 闭包：addEventListener 内部回调访问外层 sidebar 变量
 *   5. DOM API：getElementById / querySelector / querySelectorAll 区别
 *   6. localStorage：getItem/setItem；JSON.stringify/parse 序列化；只能存字符串
 *   7. 数组方法：filter / forEach / map / slice / indexOf / push / splice
 *   8. 正则：/^...$/、^ $ 锚点、\d、{n,m}、[] 字符集、test() 方法
 *   9. Date 对象：new Date()、getTime() 时间戳毫秒、86400000 = 1 天毫秒
 *  10. 三元运算符：条件 ? A : B；短路逻辑 && / || / !c.ownerName
 *  11. 事件：onclick 属性赋值 vs addEventListener；DOMContentLoaded
 *  12. this 指向：onchange = function(){ this.value } 这里 this 指向元素
 *  13. URLSearchParams：解析 ?id=xxx 查询串
 * ============================================================ */

/* ---------- 1. 常量定义 ---------- */
// localStorage 存储键名（首页与月卡列表、新增页共用同一份数据源）
var STORAGE_KEY = 'monthCardData';

// 月卡状态枚举：0=可用，1=已过期
var STATUS_USABLE = 0;
var STATUS_EXPIRED = 1;

/* ---------- 2. 默认模拟数据 ---------- */
// 本地无数据时加载该默认数组，并同步写入 localStorage
// 对象数组：月卡数据由多个对象组成数组，每个对象用字面量 {k:v} 创建
var DEFAULT_MONTH_CARDS = [
  {
    id: 1694000000001, ownerName: '张伟', phone: '13800138001', cardNumber: '京A12345',
    vehicleType: '小型车', payAmount: 300, payMethod: '微信支付',
    startDate: '2026-09-01', endDate: '2026-10-01', remainDay: 24, status: STATUS_USABLE
  },
  {
    id: 1694000000002, ownerName: '李娜', phone: '13900139002', cardNumber: '沪B67890',
    vehicleType: '小型车', payAmount: 480, payMethod: '支付宝',
    startDate: '2026-08-15', endDate: '2026-09-15', remainDay: 8, status: STATUS_USABLE
  },
  {
    id: 1694000000003, ownerName: '王强', phone: '13700137003', cardNumber: '粤A99999',
    vehicleType: 'SUV', payAmount: 600, payMethod: '银行卡',
    startDate: '2026-07-10', endDate: '2026-08-10', remainDay: -28, status: STATUS_EXPIRED
  },
  {
    id: 1694000000004, ownerName: '赵敏', phone: '13600136004', cardNumber: '川A54321',
    vehicleType: '小型车', payAmount: 360, payMethod: '微信支付',
    startDate: '2026-09-03', endDate: '2026-10-03', remainDay: 26, status: STATUS_USABLE
  },
  {
    id: 1694000000005, ownerName: '刘洋', phone: '13500135005', cardNumber: '京AD12345',
    vehicleType: '新能源', payAmount: 200, payMethod: '支付宝',
    startDate: '2026-06-20', endDate: '2026-07-20', remainDay: -49, status: STATUS_EXPIRED
  }
];

/* ---------- 3. 数据层：加载 / 保存 ---------- */
/**
 * 从 localStorage 读取月卡数组
 * 优先读取本地数据；本地无数据（或解析失败）时加载默认模拟数据并回写本地
 * @returns {Array} 月卡对象数组
 */
function loadMonthCards() {
  // localStorage.getItem：按 key 读取本地存储；返回字符串或 null
  var raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    // try...catch：JSON.parse 可能抛异常（数据被篡改），需捕获
    try {
      // JSON.parse：把 JSON 字符串还原为 JS 对象/数组
      var arr = JSON.parse(raw);
      // Array.isArray：判断是否数组；防止本地存的是别的类型
      if (Array.isArray(arr)) return arr;
    } catch (e) { /* 解析失败则走默认数据 */ }
  }
  // 本地无数据，写入默认模拟数据
  saveMonthCards(DEFAULT_MONTH_CARDS);
  // 深拷贝默认数据返回，避免外部直接修改常量
  // 深拷贝技巧：JSON.parse(JSON.stringify()) 实现对象/数组的深拷贝
  return JSON.parse(JSON.stringify(DEFAULT_MONTH_CARDS));
}

/**
 * 将月卡数组序列化后保存到 localStorage
 * @param {Array} arr 月卡对象数组
 */
function saveMonthCards(arr) {
  // JSON.stringify：把对象/数组序列化为 JSON 字符串
  // localStorage.setItem：只能存字符串；对象必须先序列化
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

/**
 * 根据 id 查询单条月卡
 */
function findCardById(arr, id) {
  id = Number(id);    // Number() 把字符串 id 转数字，便于 === 比较
  // filter：按条件过滤数组，返回新数组（不改变原数组）
  // || null：filter 返回数组，[0] 取第一条，没有则 undefined，再 || null
  return arr.filter(function (c) { return Number(c.id) === id; })[0] || null;
}

/* ---------- 4. 通用工具方法 ---------- */
/**
 * 金额千分位格式化（整数部分三位一组用逗号分隔）
 * @param {Number|String} num 金额数值
 * @returns {String} 形如 "1,234,567"
 */
function formatMoney(num) {
  // 短路求值 ||：num 为空/未定义时用 0
  // Number()：把字符串转数字，便于 toLocaleString 处理
  var n = Number(num || 0);
  // toLocaleString：按地区格式化数字，'zh-CN' 自动加千分位逗号
  return n.toLocaleString('zh-CN');
}

/**
 * 状态数字 -> 文案
 */
function statusText(s) {
  // 三元运算符：条件 ? 真值 : 假值，比 if-else 简洁
  return Number(s) === STATUS_USABLE ? '可用' : '已过期';
}

/**
 * 生成唯一 id（时间戳 + 随机数，避免同一毫秒冲突）
 */
function genId() {
  // Date.now()：返回自 1970-01-01 到现在的毫秒数
  // Math.floor/Math.random：随机 0-999，避免同一毫秒生成重复 id
  return Date.now() + Math.floor(Math.random() * 1000);
}

/**
 * 计算两个日期字符串之间的天数差（end - start，向下取整，可为负）
 * @param {String} start 形如 2026-09-01
 * @param {String} end   形如 2026-10-01
 * @returns {Number} 相差天数
 */
function diffDays(start, end) {
  if (!start || !end) return 0;
  // new Date()：把日期字符串转为 Date 对象
  // +T00:00:00：指定本地 0 点，避免时区偏差
  // getTime()：返回时间戳毫秒数
  var t1 = new Date(start + 'T00:00:00').getTime();
  var t2 = new Date(end + 'T00:00:00').getTime();
  // isNaN：无效日期 getTime 返回 NaN，isNaN 判断非法
  if (isNaN(t1) || isNaN(t2)) return 0;
  // 86400000 = 24*60*60*1000 = 1 天的毫秒数
  return Math.floor((t2 - t1) / 86400000);
}

/**
 * 根据结束日期判断月卡状态
 * 结束日期 >= 当天 0点 => 可用(0)；否则 已过期(1)
 */
function calcStatus(endDate) {
  if (!endDate) return STATUS_USABLE;
  var end = new Date(endDate + 'T23:59:59').getTime();   // 结束日当天末尾
  var now = Date.now();                                  // 当前时间戳
  // 比较运算符 >=：时间戳直接比较大小
  return end >= now ? STATUS_USABLE : STATUS_EXPIRED;
}

/**
 * 计算剩余有效天数 = 结束日期 0点 - 今天 0点（向下取整）
 */
function calcRemainDay(endDate) {
  if (!endDate) return 0;
  var end0 = new Date(endDate + 'T00:00:00').getTime();
  var now0 = new Date(); now0.setHours(0, 0, 0, 0);     // setHours 清零时分秒，得到今日 0 点
  return Math.floor((end0 - now0.getTime()) / 86400000);
}

/**
 * 读取 URL 查询参数
 * @param {String} key 参数名
 * @returns {String|null}
 */
function getQueryParam(key) {
  // window.location.search：返回 ? 开头的查询串，如 ?id=123
  // URLSearchParams：浏览器内置 API，解析查询串；get(key) 取参数值
  var params = new URLSearchParams(window.location.search);
  var v = params.get(key);
  // == null 同时判断 null 和 undefined（== 宽松相等）
  return v == null ? null : v;
}

/* ---------- 6. 表单校验（首页弹窗 / 新增页共用） ---------- */
// 正则字面量：/^...$/ 用斜杠包裹正则；^ $ 表示字符串首尾锚点
// 手机号正则：中国大陆 11 位，1 开头第二位 3-9
//   ^1        以 1 开头
//   [3-9]     第二位是 3-9 中任一字符
//   \d{9}     再出现 9 位数字
//   $         字符串结束
var PHONE_REGEX = /^1[3-9]\d{9}$/;
// 国内车牌正则：省份汉字 + 字母 + 4~6 位字母数字（兼容新能源 8 位车牌，如京AD12345）
//   [京津...]   字符集，匹配省份汉字中任一
//   [A-Z]       字母
//   [A-Z0-9]{4,6} 字母数字出现 4~6 次
var PLATE_REGEX = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-Z][A-Z0-9]{4,6}$/;
// 车辆类型可选项
var VEHICLE_TYPES = ['小型车', 'SUV', '新能源', '货车'];
// 支付方式可选项
var PAY_METHODS  = ['微信支付', '支付宝', '银行卡', '现金'];

/**
 * 校验月卡对象各字段，返回错误信息对象（字段名->错误文案）
 * @param {Object} c 月卡对象
 * @param {Array} readonlyFields 续费模式下只读字段数组（跳过其校验）
 * @returns {Object} errors，为空对象表示校验通过
 */
function validateCard(c, readonlyFields) {
  var errors = {};
  var ro = {};
  // forEach：遍历数组；把只读字段名做成查找对象 ro[field]=true
  (readonlyFields || []).forEach(function (f) { ro[f] = true; });

  // 短路逻辑：!ro.ownerName 先判断字段非只读，再 && !c.ownerName 判断为空
  if (!ro.ownerName && !c.ownerName) errors.ownerName = '请输入车主姓名';
  if (!ro.phone) {
    if (!c.phone) errors.phone = '请输入手机号';
    // 正则 test：正则.test(字符串) 返回 true/false
    else if (!PHONE_REGEX.test(c.phone)) errors.phone = '手机号格式不正确';
  }
  if (!ro.cardNumber) {
    if (!c.cardNumber) errors.cardNumber = '请输入车牌号';
    else if (!PLATE_REGEX.test(c.cardNumber)) errors.cardNumber = '车牌号格式不正确（例：京A12345）';
  }
  if (!ro.vehicleType && !c.vehicleType) errors.vehicleType = '请选择车辆类型';
  if (!ro.payMethod && !c.payMethod) errors.payMethod = '请选择支付方式';

  // 支付金额：正数
  // == 宽松相等：c.payAmount == null 同时匹配 null 和 undefined
  // isNaN：isNaN(Number(x)) 判断是否非数字
  if (ro.payAmount) { /* 续费时也允许改金额 */ }
  if (c.payAmount === '' || c.payAmount == null) errors.payAmount = '请输入支付金额';
  else if (isNaN(Number(c.payAmount)) || Number(c.payAmount) <= 0) errors.payAmount = '支付金额需为正数';

  // 日期校验
  if (!c.startDate) errors.startDate = '请选择开始日期';
  if (!c.endDate) errors.endDate = '请选择结束日期';
  // Date 对象比较：new Date(字符串) 转 Date 后可直接 < > 比较
  if (c.startDate && c.endDate && new Date(c.endDate) < new Date(c.startDate)) {
    errors.endDate = '结束日期不能早于开始日期';
  }
  return errors;
}

/* ---------- 5. 公共布局交互 ---------- */
/**
 * 初始化公共布局：菜单折叠、子菜单展开、当前页高亮
 * 需在各页面 DOMContentLoaded 后调用（本文件末尾自动执行）
 */
function initLayout() {
  // querySelector：CSS 选择器查元素，返回第一个；无则 null
  var sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;   // 防御性判断：无侧边栏的页面直接返回

  // (1) 折叠按钮：切换 .collapsed 控制 width
  var collapseBtn = document.querySelector('.collapse-btn');
  if (collapseBtn) {
    // addEventListener：绑定事件，'click' 为事件类型
    // 闭包：回调函数内访问外层 sidebar 变量，形成闭包
    collapseBtn.addEventListener('click', function () {
      // classList.toggle：切换类名，有则去、无则加
      sidebar.classList.toggle('collapsed');
    });
  }

  // (2) 父菜单点击：展开/收起子菜单（控制 .open -> max-height 过渡）
  // querySelectorAll + >：查找所有匹配元素，> 表示直接子级
  var parents = document.querySelectorAll('.menu-item.has-sub > .menu-title');
  parents.forEach(function (title) {
    title.addEventListener('click', function () {
      // 折叠状态下不响应（无文字不可点子菜单）
      // classList.contains：判断是否含某类名，返回布尔值
      if (sidebar.classList.contains('collapsed')) return;
      // parentElement：访问父节点；切换 .open 触发 CSS max-height 过渡
      title.parentElement.classList.toggle('open');
    });
  });

  // (3) 菜单高亮：根据当前页面文件名匹配对应 a.active
  highlightCurrentMenu();
}

/**
 * 根据 location.pathname 的文件名，给对应菜单项加 active 高亮
 * 1. 子菜单 a：href 等于当前文件名 -> 高亮
 * 2. 顶层菜单标题（如"工作台"）：onclick 跳转地址等于当前文件名 -> 高亮
 */
function highlightCurrentMenu() {
  // window.location.pathname：返回当前页面路径，如 /VS/index.html
  // toLowerCase：统一转小写，避免大小写不一致导致匹配失败
  var path = window.location.pathname.toLowerCase();
  // substring + lastIndexOf：截取最后 / 之后的部分，得到文件名
  var file = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

  // 子菜单链接
  var links = document.querySelectorAll('.submenu a');
  links.forEach(function (a) {
    // getAttribute：读取元素属性值
    var href = (a.getAttribute('href') || '').toLowerCase();
    if (href && href === file) a.classList.add('active');
    else a.classList.remove('active');
  });

  // 顶层菜单标题（onclick 跳转）
  var titles = document.querySelectorAll('.menu-item > .menu-title');
  titles.forEach(function (t) {
    var onclick = t.getAttribute('onclick') || '';
    // 正则 match：用正则从 onclick 字符串里提取 href 跳转地址
    // () 捕获分组，m[1] 是第一个括号匹配到的内容
    var m = onclick.match(/href\s*=\s*['"]([^'"]+)['"]/i) || onclick.match(/location\.href\s*=\s*['"]([^'"]+)['"]/i);
    if (m && m[1] && m[1].toLowerCase() === file) t.classList.add('active');
    else t.classList.remove('active');
  });
}

// DOMContentLoaded 事件：DOM 树构建完成即触发，早于 onload（等图片）
// 此处注册公共布局初始化，三个页面引入 common.js 后都会自动执行
document.addEventListener('DOMContentLoaded', initLayout);
