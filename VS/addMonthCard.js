/* ============================================================
 * 增加月卡页面脚本 addMonthCard.js
 * 职责：
 *   1. 读取 URL 参数 id：无 id=新增模式(表单清空)；有 id=编辑模式(回填)
 *   2. 读取 localStorage 月卡数据源
 *   3. 表单校验：必填、手机号正则、车牌正则、金额正数、结束日期不早于开始日期
 *   4. 自动计算 remainDay 剩余天数、自动判断 status 状态
 *   5. 确定：组装对象(Date.now() 生成唯一 id)，新增 push / 编辑替换下标，
 *      调用保存函数写 localStorage，成功跳转回 monthCard.html
 *   6. 重置：清空全部表单与校验提示；返回按钮跳回 monthCard.html
 * ------------------------------------------------------------
 * 本文件涉及知识：
 *   · URL 参数读取：getQueryParam('id') 内部用 URLSearchParams 解析 ?id=xxx
 *   · 新增/编辑复用：editId 为 null=新增(push)，非 null=编辑(按下标替换)
 *   · 事件绑定：onclick/onchange 属性赋值；箭头函数与 function 兼容
 *   · 表单取值：.value 取值；.trim() 去空格；校验返回错误对象
 *   · 自动计算：onchange 触发 autoCalc，调用 calcRemainDay/calcStatus
 *   · 数组方法：push 新增；for+break 按下标查找；cards[i]=c 替换
 *   · 跳转：location.href 赋值即跳转回列表页
 *   · 短路 && ：if (start && end) 两日期都填才计算
 * ============================================================ */

/* 当前编辑模式 id（null 表示新增） */
var editId = null;
var cards = []; // 月卡数据源（来自 localStorage）

/* 字段 id 列表 */
var FIELDS = ['ownerName', 'phone', 'cardNumber', 'vehicleType',
  'payAmount', 'payMethod', 'startDate', 'endDate', 'remainDay', 'status'];

/* ---------- 1. 初始化 ---------- */
function initForm() {
  // 填充下拉
  fillSelect('vehicleType', VEHICLE_TYPES);
  fillSelect('payMethod', PAY_METHODS);

  cards = loadMonthCards(); // 读取本地数据源

  // URL 参数读取：getQueryParam 内部用 URLSearchParams 解析 ?id=xxx
  // 条件分支：有 id = 编辑模式；无 id = 新增模式
  var id = getQueryParam('id');
  if (id) {
    // 编辑模式：根据 id 查询并回填
    editId = id;
    var card = findCardById(cards, id);
    if (card) {
      backfill(card);
      // textContent：修改标题文字
      document.getElementById('pageTitle').textContent = '编辑月卡';
      document.getElementById('headTitle').textContent = '编辑月卡';
    } else {
      alert('未找到该月卡记录，转为新增模式');
      editId = null;
    }
  } else {
    // 新增模式：表单全部清空
    editId = null;
  }

  bindEvents();
}

// map + join：生成 <option> 标签字符串并拼成一整段
function fillSelect(id, arr) {
  var sel = document.getElementById(id);
  sel.innerHTML = '<option value="">请选择</option>' +
    arr.map(function (t) { return '<option>' + t + '</option>'; }).join('');
}

/* 编辑模式回填表单 */
// || ''：字段为 undefined/null 时用空串，避免显示 'undefined'
function backfill(c) {
  document.getElementById('ownerName').value = c.ownerName || '';
  document.getElementById('phone').value = c.phone || '';
  document.getElementById('cardNumber').value = c.cardNumber || '';
  document.getElementById('vehicleType').value = c.vehicleType || '';
  document.getElementById('payAmount').value = c.payAmount || '';
  document.getElementById('payMethod').value = c.payMethod || '';
  document.getElementById('startDate').value = c.startDate || '';
  document.getElementById('endDate').value = c.endDate || '';
  document.getElementById('remainDay').value = c.remainDay;
  document.getElementById('status').value = statusText(c.status);
}

/* ---------- 2. 事件绑定 ---------- */
function bindEvents() {
  document.getElementById('btnBack').onclick = function () {
    location.href = 'monthCard.html';     // location.href：返回月卡管理页面
  };
  document.getElementById('btnSave').onclick = onSave;
  document.getElementById('btnReset').onclick = onReset;
  // 日期变化 -> 自动计算剩余天数、状态
  document.getElementById('startDate').onchange = autoCalc;
  document.getElementById('endDate').onchange = autoCalc;
}

/* ---------- 3. 自动计算剩余天数、状态 ---------- */
function autoCalc() {
  var start = document.getElementById('startDate').value;
  var end = document.getElementById('endDate').value;
  // 短路 && ：两个日期都填才计算，避免 NaN
  if (start && end) {
    // 计算开始/结束日期时间戳差值 -> 剩余有效天数
    document.getElementById('remainDay').value = calcRemainDay(end);
    // 对比结束日期与当前时间 -> 自动判断月卡状态
    document.getElementById('status').value = statusText(calcStatus(end));
  }
}

/* ---------- 4. 表单校验 ---------- */
// 对象字面量返回：一次性取所有字段值组装对象，便于校验
function getFormValues() {
  return {
    ownerName: document.getElementById('ownerName').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    cardNumber: document.getElementById('cardNumber').value.trim(),
    vehicleType: document.getElementById('vehicleType').value,
    payAmount: document.getElementById('payAmount').value.trim(),
    payMethod: document.getElementById('payMethod').value,
    startDate: document.getElementById('startDate').value,
    endDate: document.getElementById('endDate').value
  };
}

function showErrors(errors) {
  clearErrors();
  // Object.keys + forEach：遍历错误对象的每个字段，写入提示容器
  Object.keys(errors).forEach(function (k) {
    var tip = document.querySelector('.error-tip[data-field="' + k + '"]');
    if (tip) tip.textContent = errors[k];
  });
}
function clearErrors() {
  document.querySelectorAll('.error-tip').forEach(function (e) { e.textContent = ''; });
}

/* ---------- 5. 保存 ---------- */
function onSave() {
  var c = getFormValues();
  // 校验：必填、手机号正则、车牌正则、金额正数、结束日期不早于开始日期
  var errors = validateCard(c, []);   // 新增/编辑：无只读字段
  showErrors(errors);
  // 阻止提交：校验不通过直接 return，不执行后续保存逻辑
  if (Object.keys(errors).length) return;

  // 自动计算剩余天数、状态
  c.remainDay = calcRemainDay(c.endDate);
  c.status = calcStatus(c.endDate);

  if (editId) {
    // 编辑模式：找到对应下标替换数组对象（保留原 id）
    for (var i = 0; i < cards.length; i++) {
      if (Number(cards[i].id) === Number(editId)) {
        c.id = Number(editId);
        cards[i] = c;                 // 按下标替换对象
        break;
      }
    }
  } else {
    // 新增模式：Date.now() 生成唯一 id，push 到月卡数组
    c.id = genId();                   // genId 内部用 Date.now()+随机数
    cards.push(c);                   // push：数组末尾追加元素
  }

  saveMonthCards(cards);               // 调用保存函数写入 localStorage
  alert(editId ? '保存成功' : '新增成功');
  location.href = 'monthCard.html';   // 保存成功跳转：回到月卡管理页面
}

/* ---------- 6. 重置 ---------- */
function onReset() {
  // 清空全部表单输入框
  // 数组字面量 + forEach：批量清空多个输入框
  ['ownerName', 'phone', 'cardNumber', 'payAmount', 'startDate', 'endDate',
   'remainDay', 'status'].forEach(function (id) {
    document.getElementById(id).value = '';
  });
  document.getElementById('vehicleType').value = '';
  document.getElementById('payMethod').value = '';
  // 同时清除页面校验错误提示文字
  clearErrors();
}

/* ---------- 启动 ---------- */
window.onload = initForm;
