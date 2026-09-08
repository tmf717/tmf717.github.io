/* ============================================================
 * 月卡管理列表页脚本 monthCard.js
 * 职责：
 *   1. 读取 localStorage(monthCardData) 月卡数据源
 *   2. 封装 renderTable() 动态生成表格 DOM；状态字段格式化（0=可用/1=已过期）
 *   3. 查询筛选（filter 条件过滤，重置页码为 1）/ 重置
 *   4. 弹窗复用：查看(只读) / 编辑(全字段) / 续费(车辆信息只读)
 *   5. 单条删除（confirm 二次确认）/ 批量删除（勾选 id 过滤）
 *   6. 复选框全选 / 前端分页（currentPage、pageSize、slice）
 *   7. 所有增删改同步持久化到 localStorage
 * ------------------------------------------------------------
 * 本文件涉及知识：
 *   · 数组方法：filter 过滤、slice 切片分页、splice 删除、forEach 遍历、indexOf 查找、map 映射
 *   · 字符串拼接：+ 号拼接 HTML；'...' 单引号字符串；转义 \' 输出单引号
 *   · innerHTML：写入 HTML 字符串会被浏览器解析为 DOM（区别 textContent）
 *   · 事件绑定：onclick 属性赋值（覆盖式）；onchange 复选框/下拉变化触发
 *   · this 指向：onchange=function(){this.value} 中 this 指向触发事件的元素
 *   · 模板字符串/拼接生成 onclick：把 c.id 拼到 onclick="openModal('view',id)"
 *   · Math.ceil 向上取整计算总页数；slice(start,start+size) 分页切片
 *   · 短路逻辑 && ：a && b，a 为真才执行 b
 *   · confirm/alert：浏览器原生对话框，用于二次确认与提示
 *   · disabled 属性：true 禁用按钮/输入；style.display='none' 隐藏元素
 * ============================================================ */

/* ---------- 状态变量 ---------- */
var cards = [];        // 月卡原始数据源（来自 localStorage）
var filtered = [];     // 过滤后的数组（查询/重置后变化）
var currentPage = 1;   // 当前页码
var pageSize = 5;       // 每页条数
var modalMode = 'view'; // 弹窗模式：view / edit / renew
var modalCardId = null; // 弹窗当前操作的月卡 id

/* 弹窗字段 id 映射，便于循环处理 */
var F = {
  ownerName: 'mOwner', phone: 'mPhone', cardNumber: 'mCard', vehicleType: 'mType',
  payAmount: 'mAmount', payMethod: 'mMethod', startDate: 'mStart', endDate: 'mEnd',
  remainDay: 'mRemain', status: 'mStatus'
};
// 续费模式下只读字段（车辆信息）
var RENEW_READONLY = ['ownerName', 'phone', 'cardNumber', 'vehicleType'];

/* ---------- 1. 初始化 ---------- */
function initList() {
  // 下拉选项填充
  fillSelect('mType', VEHICLE_TYPES);
  fillSelect('mMethod', PAY_METHODS);

  cards = loadMonthCards();   // 读 localStorage，无数据则写入默认
  filtered = cards.slice();  // slice() 无参：复制整个数组，避免引用同一份数据

  bindEvents();
  renderTable();
}

// map：遍历数组返回新数组（这里生成 <option> 标签字符串）
// join('')：把数组按空字符串拼接成一个字符串
function fillSelect(id, arr) {
  var sel = document.getElementById(id);
  sel.innerHTML = arr.map(function (t) { return '<option>' + t + '</option>'; }).join('');
}

/* ---------- 2. 事件绑定 ---------- */
// onclick 属性赋值：直接给 onclick 赋函数，简单覆盖式绑定
// location.href：赋值即跳转新页面
function bindEvents() {
  document.getElementById('btnSearch').onclick = doFilter;
  document.getElementById('btnReset').onclick = doReset;
  document.getElementById('btnAdd').onclick = function () {
    location.href = 'addMonthCard.html';        // 跳转新增页面
  };
  document.getElementById('btnBatchDel').onclick = batchDelete;
  document.getElementById('checkAll').onchange = toggleCheckAll;   // onchange 复选框状态变化触发

  // 分页
  document.getElementById('btnPrev').onclick = function () {
    if (currentPage > 1) { currentPage--; renderTable(); }    // 边界判断，第 1 页不往前
  };
  document.getElementById('btnNext').onclick = function () {
    var pages = Math.ceil(filtered.length / pageSize) || 1;    // Math.ceil 向上取整得总页数
    if (currentPage < pages) { currentPage++; renderTable(); }
  };
  document.getElementById('pageSize').onchange = function () {
    // this：onchange 的事件处理函数里，this 指向触发事件的 select 元素
    pageSize = Number(this.value); currentPage = 1; renderTable();
  };

  // 弹窗
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('modalCancel').onclick = closeModal;
  document.getElementById('modalSave').onclick = saveModal;
  // 开始/结束日期变化 -> 自动计算剩余天数、状态
  document.getElementById('mStart').onchange = autoCalc;
  document.getElementById('mEnd').onchange = autoCalc;
}

/* ---------- 3. 渲染表格 ---------- */
function renderTable() {
  var tbody = document.getElementById('cardTbody');
  // 分页切片：根据当前页码、每页条数，slice 截取本页要显示的数据
  //   start = (页码-1)*每页数；slice(start, start+size) 取本页切片
  var start = (currentPage - 1) * pageSize;
  var pageData = filtered.slice(start, start + pageSize);

  if (!pageData.length) {
    // colspan="13"：空数据时单元格跨 13 列合并，显示提示
    tbody.innerHTML = '<tr><td colspan="13" class="empty">暂无月卡数据</td></tr>';
  } else {
    // map + join：遍历每条数据生成 <tr> 字符串，再 join 拼成完整 HTML
    // innerHTML：写入 HTML 字符串，浏览器自动解析为 DOM（与 textContent 不同）
    // 字符串拼接：+ 号拼接；\' 转义输出单引号；c.id 拼进 onclick 实现"行内按钮调用函数"
    tbody.innerHTML = pageData.map(function (c, idx) {
      return ''
        + '<tr>'
        + '<td class="col-center"><input type="checkbox" class="row-check" value="' + c.id + '"></td>'
        + '<td>' + (start + idx + 1) + '</td>'          // 序号 = 起始下标 + 当前序 + 1
        + '<td>' + esc(c.ownerName) + '</td>'            // esc 转义：防止输入破坏 HTML
        + '<td>' + esc(c.phone) + '</td>'
        + '<td>' + esc(c.cardNumber) + '</td>'
        + '<td>' + esc(c.vehicleType) + '</td>'
        + '<td>' + formatMoney(c.payAmount) + '</td>'   // 金额千分位
        + '<td>' + esc(c.payMethod) + '</td>'
        + '<td>' + esc(c.startDate) + '</td>'
        + '<td>' + esc(c.endDate) + '</td>'
        + '<td>' + c.remainDay + '</td>'
        + '<td>' + statusTag(c.status) + '</td>'         // 状态标签
        + '<td>'
        // 把 c.id 拼到 onclick 字符串里，点击行内按钮即可调用对应函数
        + '<button class="btn-link" onclick="openModal(\'view\',' + c.id + ')">查看</button>'
        + '<button class="btn-link" onclick="openModal(\'edit\',' + c.id + ')">编辑</button>'
        + '<button class="btn-link" onclick="openModal(\'renew\',' + c.id + ')">续费</button>'
        + '<button class="btn-link danger" onclick="deleteCard(' + c.id + ')">删除</button>'
        + '</td>'
        + '</tr>';
    }).join('');
  }

  // 更新分页信息
  document.getElementById('totalCount').textContent = filtered.length;
  var pages = Math.ceil(filtered.length / pageSize) || 1;   // || 1 防止空数据时 0 页
  if (currentPage > pages) currentPage = pages;             // 越界回退到末页
  document.getElementById('pageNum').textContent = currentPage + ' / ' + pages;
  // 边界禁用：第 1 页禁用上一页，末页禁用下一页
  var btnPrev = document.getElementById('btnPrev');
  var btnNext = document.getElementById('btnNext');
  btnPrev.disabled = currentPage <= 1;          // disabled 属性：true 禁用按钮
  btnNext.disabled = currentPage >= pages;
  document.getElementById('checkAll').checked = false;  // 重渲染后取消全选状态
}

/* 状态 -> 标签 */
// 三元运算符：根据状态返回不同 HTML 标签
function statusTag(s) {
  return Number(s) === STATUS_USABLE
    ? '<span class="tag tag-success">可用</span>'
    : '<span class="tag tag-danger">已过期</span>';
}

/* HTML 转义，防止用户输入破坏表格结构 */
// 正则 replace + /g 全局：把 & < > 替换为实体，防止 XSS 与结构破坏
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------- 4. 查询筛选 / 重置 ---------- */
function doFilter() {
  // String.trim()：去掉输入两端空格，避免空格影响匹配
  var owner = document.getElementById('filterOwner').value.trim();
  var plate = document.getElementById('filterPlate').value.trim();
  var status = document.getElementById('filterStatus').value;

  // filter：按条件过滤原数组，返回满足条件的新数组
  // indexOf：字符串 indexOf 返回子串位置，-1 表示不包含
  // 短路 return false：任一条件不满足即排除该条
  filtered = cards.filter(function (c) {
    if (owner && c.ownerName.indexOf(owner) === -1) return false;
    if (plate && c.cardNumber.indexOf(plate) === -1) return false;
    if (status !== '' && Number(c.status) !== Number(status)) return false;
    return true;
  });
  currentPage = 1;   // 查询后重置为第 1 页
  renderTable();
}

function doReset() {
  document.getElementById('filterOwner').value = '';
  document.getElementById('filterPlate').value = '';
  document.getElementById('filterStatus').value = '';
  filtered = cards.slice(); // slice() 无参复制整个数组，恢复全部原始数据
  currentPage = 1;
  renderTable();
}

/* ---------- 5. 复选框全选 / 批量删除 ---------- */
function toggleCheckAll() {
  var checked = document.getElementById('checkAll').checked;  // 表头复选框当前状态
  // querySelectorAll + :checked：查所有行复选框，forEach 批量设置
  document.querySelectorAll('.row-check').forEach(function (cb) { cb.checked = checked; });
}

function batchDelete() {
  var ids = getCheckedIds();
  // 短路逻辑：!ids.length 为真（空数组）则提示并 return
  if (!ids.length) { alert('请先勾选要删除的月卡记录'); return; }
  // confirm：浏览器原生确认框，返回 true/false
  if (!confirm('确认批量删除选中的 ' + ids.length + ' 条月卡记录？')) return;
  // filter + indexOf：保留 ids 中不存在的 id，即删除勾选项
  cards = cards.filter(function (c) { return ids.indexOf(Number(c.id)) === -1; });
  saveMonthCards(cards);      // 持久化
  filtered = filtered.filter(function (c) { return ids.indexOf(Number(c.id)) === -1; });
  renderTable();
}

function getCheckedIds() {
  var ids = [];
  // :checked 伪类：querySelectorAll('.row-check:checked') 查所有已勾选的行复选框
  document.querySelectorAll('.row-check:checked').forEach(function (cb) {
    ids.push(Number(cb.value));    // value 属性：复选框的 value 取自定义数据（这里是月卡 id）
  });
  return ids;
}

/* ---------- 6. 单条删除 ---------- */
function deleteCard(id) {
  if (!confirm('确认删除该条月卡记录？')) return;  // 浏览器二次确认
  var idx = -1;
  // for 循环 + break：遍历找下标，找到即跳出
  for (var i = 0; i < cards.length; i++) {
    if (Number(cards[i].id) === Number(id)) { idx = i; break; }
  }
  if (idx > -1) {
    // splice：splice(起始下标, 删除个数) 修改原数组，删除指定下标元素
    cards.splice(idx, 1);            // 修改数组
    saveMonthCards(cards);           // 调用保存函数
    // 同步 filtered
    filtered = cardsFilterSync();
    renderTable();
  }
}
/* 重新对 filtered 应用当前筛选条件（删除后保持筛选状态） */
function cardsFilterSync() {
  var owner = document.getElementById('filterOwner').value.trim();
  var plate = document.getElementById('filterPlate').value.trim();
  var status = document.getElementById('filterStatus').value;
  return cards.filter(function (c) {
    if (owner && c.ownerName.indexOf(owner) === -1) return false;
    if (plate && c.cardNumber.indexOf(plate) === -1) return false;
    if (status !== '' && Number(c.status) !== Number(status)) return false;
    return true;
  });
}

/* ---------- 7. 弹窗：查看 / 编辑 / 续费 ---------- */
// 函数复用：同一弹窗根据 mode 参数显示不同模式，避免重复写三套弹窗
function openModal(mode, id) {
  modalMode = mode;
  modalCardId = id;
  var card = findCardById(cards, id);
  if (!card) { alert('未找到该月卡记录'); return; }

  // 标题
  // 对象字面量做映射：用对象 key->value 取对应标题
  var titles = { view: '查看月卡', edit: '编辑月卡', renew: '续费月卡' };
  document.getElementById('modalTitle').textContent = titles[mode];

  // 回填表单：把月卡对象的字段值赋给弹窗输入框
  document.getElementById('mOwner').value  = card.ownerName;
  document.getElementById('mPhone').value  = card.phone;
  document.getElementById('mCard').value   = card.cardNumber;
  document.getElementById('mType').value   = card.vehicleType;
  document.getElementById('mAmount').value = card.payAmount;
  document.getElementById('mMethod').value = card.payMethod;
  document.getElementById('mStart').value  = card.startDate;
  document.getElementById('mEnd').value    = card.endDate;
  document.getElementById('mRemain').value  = card.remainDay;
  document.getElementById('mStatus').value = statusText(card.status);

  // 按模式设置只读
  // Object.keys：获取对象所有 key 数组，便于循环处理
  var allFields = Object.keys(F);
  allFields.forEach(function (k) {
    var el = document.getElementById(F[k]);
    el.disabled = false;             // 先恢复
    el.classList.remove('readonly-input');
  });
  // remainDay/status 始终只读（自动计算）
  document.getElementById('mRemain').disabled = true;
  document.getElementById('mStatus').disabled = true;

  if (mode === 'view') {
    // 查看弹窗：全部只读
    allFields.forEach(function (k) { document.getElementById(F[k]).disabled = true; });
    // style.display='none' 隐藏保存按钮；'inline-flex' 显示
    document.getElementById('modalSave').style.display = 'none';
  } else if (mode === 'renew') {
    // 续费弹窗：车辆信息字段只读，仅允许修改缴费相关、剩余天数（自动）
    RENEW_READONLY.forEach(function (k) { document.getElementById(F[k]).disabled = true; });
    document.getElementById('modalSave').style.display = '';   // 空串恢复默认显示
  } else {
    // 编辑弹窗：全部可修改
    document.getElementById('modalSave').style.display = '';
  }
  clearErrors();
  // classList.add：加 .show 类，CSS 把 display:none 改为 flex 显示弹窗
  document.getElementById('cardModal').classList.add('show');
}

function closeModal() {
  document.getElementById('cardModal').classList.remove('show');   // 去掉 .show 即隐藏
}

/* 日期变化自动计算剩余天数与状态 */
function autoCalc() {
  var start = document.getElementById('mStart').value;
  var end = document.getElementById('mEnd').value;
  if (start && end) {
    document.getElementById('mRemain').value = calcRemainDay(end);
    document.getElementById('mStatus').value = statusText(calcStatus(end));
  }
}

/* 保存弹窗（编辑 / 续费） */
function saveModal() {
  // 对象字面量组装：从弹窗输入框取值组装月卡对象
  var c = {
    ownerName: document.getElementById('mOwner').value.trim(),
    phone: document.getElementById('mPhone').value.trim(),
    cardNumber: document.getElementById('mCard').value.trim(),
    vehicleType: document.getElementById('mType').value,
    payAmount: document.getElementById('mAmount').value.trim(),
    payMethod: document.getElementById('mMethod').value,
    startDate: document.getElementById('mStart').value,
    endDate: document.getElementById('mEnd').value
  };

  // 校验：续费模式下车辆信息只读字段跳过必填校验
  // 三元运算符：续费传 RENEW_READONLY，否则传空数组
  var readonlyFields = modalMode === 'renew' ? RENEW_READONLY : [];
  var errors = validateCard(c, readonlyFields);
  showErrors(errors);
  // Object.keys(errors).length：返回 errors 自有属性数量；0 表示校验通过
  if (Object.keys(errors).length) return; // 校验不通过，阻止提交

  // 自动计算剩余天数、状态
  c.remainDay = calcRemainDay(c.endDate);
  c.status = calcStatus(c.endDate);

  // 找到对应下标替换数组对象
  for (var i = 0; i < cards.length; i++) {
    if (Number(cards[i].id) === Number(modalCardId)) {
      c.id = cards[i].id;            // 保留原 id
      cards[i] = c;                  // 数组按下标替换对象
      break;
    }
  }
  saveMonthCards(cards);             // 调用保存函数写入 localStorage
  filtered = cardsFilterSync();     // 保持筛选状态
  renderTable();
  closeModal();
}

function showErrors(errors) {
  clearErrors();
  // querySelector 属性选择器：按 data-field 属性定位错误提示容器
  Object.keys(errors).forEach(function (k) {
    var tip = document.querySelector('.error-tip[data-field="' + k + '"]');
    if (tip) tip.textContent = errors[k];    // 写入错误文案
  });
}
function clearErrors() {
  // forEach 清空所有错误提示容器的文本
  document.querySelectorAll('.error-tip').forEach(function (e) { e.textContent = ''; });
}

/* ---------- 启动 ---------- */
window.onload = initList;
