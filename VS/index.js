/* ============================================================
 * 工作台首页脚本 index.js
 * 职责：
 *   1. 初始化时读取 localStorage(monthCardData) 月卡数据源
 *   2. 封装渲染函数 renderHomeStat()：渲染 4 个统计卡片
 *   3. 月卡车辆总数 = 月卡数组长度（动态获取，多页面联动）
 *      年度累计收费 / 入驻企业总数 / 一体杆总数 = 模拟固定值
 *   4. 金额数字做千分位格式化
 *   5. 页面 onload 加载完成调用渲染函数
 * ------------------------------------------------------------
 * 本文件涉及知识：
 *   · var 全局变量：cards 定义在函数外，供多个函数共享
 *   · window.onload：页面（含图片）全部加载完才触发，确保 DOM 就绪
 *   · document.getElementById：按 id 查元素；textContent 设置纯文本
 *   · 函数声明 vs 调用：声明提前（hoisting），可先调用后定义
 * ============================================================ */

// 月卡数据源（内存数组，由 localStorage 加载）
// 全局变量：定义在函数外，initHome 与 renderHomeStat 都能访问
var cards = [];

// 模拟固定统计值（其余三项非月卡数量，使用固定值）
var ANNUAL_FEE  = 1286000; // 年度累计收费（元）
var COMPANY_TOTAL = 86;    // 入驻企业总数（家）
var POLE_TOTAL     = 24;   // 一体杆总数（台）

/**
 * 页面初始化：读取数据 -> 调用渲染
 * （window.onload 加载完成后触发，确保 DOM 就绪）
 */
function initHome() {
  cards = loadMonthCards(); // 读 localStorage，无数据时写入默认模拟数据
  renderHomeStat();
}

/**
 * 渲染统计卡片
 * - 月卡车辆总数：读取月卡数组长度动态获取（修改月卡数据后刷新首页会自动同步）
 * - 金额数字做千分位格式化（formatMoney 来自 common.js）
 */
function renderHomeStat() {
  // getElementById：按 id 获取元素
  // textContent：设置元素的文本内容（不会解析 HTML，更安全）
  // 数组 length：月卡车辆总数 = 数组长度，动态联动
  document.getElementById('statCardTotal').textContent = cards.length;

  // 年度累计收费：千分位格式化
  document.getElementById('statAnnualFee').textContent = formatMoney(ANNUAL_FEE);

  // 固定值
  document.getElementById('statCompany').textContent = COMPANY_TOTAL;
  document.getElementById('statPole').textContent = POLE_TOTAL;
}

// window.onload：页面全部资源（含图片）加载完触发，确保 DOM 已就绪
// 对比 common.js 用的 DOMContentLoaded：onload 更晚，这里因无图片两者都可行
window.onload = initHome;
