const hedgeChannels = ["QFII2", "Mock", "CMS_QFII", "CMS_SC", "HTSC", "CICC", "IB"];
const tradingMarkets = ["A股", "港股", "美股", "境内商品", "境内股指", "境外期货"];
const assetTypes = ["股票", "可转债", "ETF", "商品期货", "股指期货"];
const directions = ["买入", "卖出", "买开", "卖平", "卖开", "买平"];
const businessTypes = ["普通交易", "空头交易"];

let sequenceTemplates = [
  {
    id: "seq-1",
    name: "test",
    remark: "默认权益渠道顺序",
    routes: [
      { order: 1, channel: "QFII2" },
      { order: 2, channel: "Mock" },
      { order: 3, channel: "CMS_QFII" },
      { order: 4, channel: "CMS_SC" },
      { order: 5, channel: "HTSC" },
    ],
  },
  {
    id: "seq-2",
    name: "test_1",
    remark: "港股备用渠道顺序",
    routes: [
      { order: 1, channel: "CMS_SC" },
      { order: 2, channel: "HTSC" },
    ],
  },
  {
    id: "seq-3",
    name: "test_2",
    remark: "期货优先渠道顺序",
    routes: [
      { order: 1, channel: "CICC" },
      { order: 2, channel: "IB" },
    ],
  },
];

let productTemplates = [
  {
    id: "tpl-1",
    name: "权益综合模板",
    remark: "股票、可转债、ETF 组合模板",
    rules: [
      { businessType: "普通交易", tradingMarket: "A股", assetTypes: ["股票", "ETF"], direction: "买入", sequenceName: "test" },
      { businessType: "普通交易", tradingMarket: "A股", assetTypes: ["可转债"], direction: "买入", sequenceName: "test_1" },
    ],
  },
  {
    id: "tpl-2",
    name: "跨境交易模板",
    remark: "港股、美股使用",
    rules: [
      { businessType: "普通交易", tradingMarket: "港股", assetTypes: ["股票", "ETF"], direction: "卖出", sequenceName: "test_1" },
      { businessType: "普通交易", tradingMarket: "美股", assetTypes: ["股票", "ETF"], direction: "买入", sequenceName: "test" },
    ],
  },
  {
    id: "tpl-3",
    name: "空头交易模板",
    remark: "商品和股指期货使用",
    rules: [
      { businessType: "空头交易", tradingMarket: "境内商品", assetTypes: ["商品期货"], direction: "卖开", sequenceName: "test_2" },
      { businessType: "空头交易", tradingMarket: "境内股指", assetTypes: ["股指期货"], direction: "买平", sequenceName: "test_2" },
    ],
  },
];

let accountBindings = [
  { account: "T10000011", templateName: "权益综合模板" },
  { account: "T10000013", templateName: "跨境交易模板" },
  { account: "T10000019", templateName: "空头交易模板" },
];

const expandedSequences = new Set(["seq-1"]);
const expandedProductTemplates = new Set(["tpl-1"]);
const editingSequences = new Set();
const editingProductTemplates = new Set();
const editingProductRules = new Set();
let sequenceSeed = 4;
let productTemplateSeed = 4;
let bindingAccountFilter = "";
let draggedRoute = null;

const $ = (id) => document.getElementById(id);
const findSequence = (id) => sequenceTemplates.find((template) => template.id === id);
const findProductTemplate = (id) => productTemplates.find((template) => template.id === id);

const showToast = (message) => {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
};

const renderSelectOptions = (values, selectedValue) =>
  values.map((value) => `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${value}</option>`).join("");

const renderAssetTags = (values) => values.map((value) => `<span class="badge">${value}</span>`).join("");

const renderMultiSelect = (values, selectedValues, action, templateId, index) => `
  <select class="inline-select multi-inline-select" multiple data-action="${action}" data-template-id="${templateId}" data-index="${index}">
    ${values.map((value) => `<option value="${value}" ${selectedValues.includes(value) ? "selected" : ""}>${value}</option>`).join("")}
  </select>
`;

const normalizeRouteOrders = (template) => {
  template.routes.forEach((route, index) => {
    route.order = index + 1;
  });
};

const renderSequenceChild = (template) => {
  const rows = template.routes
    .map(
      (route, index) => `
        <tr draggable="true" data-action="drag-route" data-template-id="${template.id}" data-index="${index}">
          <td class="drag-col" title="拖动排序">⋮⋮</td>
          <td>${route.order}</td>
          <td>
            <select class="inline-select" data-action="change-channel" data-template-id="${template.id}" data-index="${index}">
              ${renderSelectOptions(hedgeChannels, route.channel)}
            </select>
          </td>
          <td class="operation-cell">
            <button class="link-btn danger" data-action="delete-route" data-template-id="${template.id}" data-index="${index}">删除</button>
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <div class="child-panel">
      <table class="child-table">
        <thead>
          <tr>
            <th class="drag-col"></th>
            <th>报单排序</th>
            <th>对冲渠道</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td class="add-row-cell" colspan="4">
              <button class="add-row-btn" data-action="add-route" data-template-id="${template.id}">新增一行</button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
};

const renderSequenceTable = () => {
  $("sequenceSummary").textContent = `共 ${sequenceTemplates.length} 个顺序模板`;
  $("sequenceTable").innerHTML = sequenceTemplates
    .map((template) => {
      const expanded = expandedSequences.has(template.id);
      const editing = editingSequences.has(template.id);
      return `
        <tr class="account-row ${expanded ? "active" : ""}" data-action="toggle-sequence" data-template-id="${template.id}">
          <td class="expand-col"><button class="expand-btn">${expanded ? "-" : "+"}</button></td>
          <td>${editing ? `<input class="inline-input" data-action="change-sequence-name" data-template-id="${template.id}" value="${template.name}" />` : template.name}</td>
          <td>${editing ? `<input class="inline-input" data-action="change-sequence-remark" data-template-id="${template.id}" value="${template.remark || ""}" />` : template.remark || "-"}</td>
          <td class="operation-cell">
            <button class="link-btn" data-action="${editing ? "save-sequence" : "edit-sequence"}" data-template-id="${template.id}">${editing ? "保存" : "编辑"}</button>
            <button class="link-btn danger" data-action="delete-sequence" data-template-id="${template.id}">删除</button>
          </td>
        </tr>
        ${expanded ? `<tr><td class="child-cell" colspan="4">${renderSequenceChild(template)}</td></tr>` : ""}
      `;
    })
    .join("");
};

const renderProductTemplateChild = (template) => {
  const sequenceNames = sequenceTemplates.map((item) => item.name);
  const rows = template.rules
    .map((rule, index) => {
      const rowKey = `${template.id}-${index}`;
      const editing = editingProductRules.has(rowKey);
      return `
        <tr>
          <td>${editing ? `<select class="inline-select" data-action="change-business-type" data-template-id="${template.id}" data-index="${index}">${renderSelectOptions(businessTypes, rule.businessType)}</select>` : rule.businessType}</td>
          <td>${editing ? `<select class="inline-select" data-action="change-market" data-template-id="${template.id}" data-index="${index}">${renderSelectOptions(tradingMarkets, rule.tradingMarket)}</select>` : rule.tradingMarket}</td>
          <td>${editing ? renderMultiSelect(assetTypes, rule.assetTypes, "change-assets", template.id, index) : renderAssetTags(rule.assetTypes)}</td>
          <td>${editing ? `<select class="inline-select" data-action="change-direction" data-template-id="${template.id}" data-index="${index}">${renderSelectOptions(directions, rule.direction)}</select>` : rule.direction}</td>
          <td>${editing ? `<select class="inline-select" data-action="change-sequence-name" data-template-id="${template.id}" data-index="${index}">${renderSelectOptions(sequenceNames, rule.sequenceName)}</select>` : rule.sequenceName}</td>
          <td class="operation-cell">
            <button class="link-btn" data-action="${editing ? "save-template-rule" : "edit-template-rule"}" data-template-id="${template.id}" data-index="${index}">${editing ? "保存" : "编辑"}</button>
            <button class="link-btn danger" data-action="delete-template-rule" data-template-id="${template.id}" data-index="${index}">删除</button>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="child-panel">
      <table class="child-table">
        <thead>
          <tr>
            <th>交易类型</th>
            <th>交易市场</th>
            <th>交易品种</th>
            <th>交易方向</th>
            <th>顺序名称</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td class="add-row-cell" colspan="6">
              <button class="add-row-btn" data-action="add-template-rule" data-template-id="${template.id}">新增一行</button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
};

const renderProductTemplateTable = () => {
  $("productTemplateSummary").textContent = `共 ${productTemplates.length} 个交易模板`;
  $("productTemplateTable").innerHTML = productTemplates
    .map((template) => {
      const expanded = expandedProductTemplates.has(template.id);
      const editing = editingProductTemplates.has(template.id);
      return `
        <tr class="account-row ${expanded ? "active" : ""}" data-action="toggle-product-template" data-template-id="${template.id}">
          <td class="expand-col"><button class="expand-btn">${expanded ? "-" : "+"}</button></td>
          <td>${editing ? `<input class="inline-input" data-action="change-product-template-name" data-template-id="${template.id}" value="${template.name}" />` : template.name}</td>
          <td>${editing ? `<input class="inline-input" data-action="change-product-template-remark" data-template-id="${template.id}" value="${template.remark || ""}" />` : template.remark || "-"}</td>
          <td class="operation-cell">
            <button class="link-btn" data-action="${editing ? "save-product-template" : "edit-product-template"}" data-template-id="${template.id}">${editing ? "保存" : "编辑"}</button>
            <button class="link-btn danger" data-action="delete-product-template" data-template-id="${template.id}">删除</button>
          </td>
        </tr>
        ${expanded ? `<tr><td class="child-cell" colspan="4">${renderProductTemplateChild(template)}</td></tr>` : ""}
      `;
    })
    .join("");
};

const renderBindingFilter = () => {
  const accounts = [...new Set(accountBindings.map((binding) => binding.account).filter(Boolean))];
  $("bindingAccountFilter").innerHTML = `
    <option value="">请选择</option>
    ${accounts.map((account) => `<option value="${account}" ${account === bindingAccountFilter ? "selected" : ""}>${account}</option>`).join("")}
  `;
};

const renderBindingTable = () => {
  const templateNames = productTemplates.map((template) => template.name);
  const rows = accountBindings
    .map((binding, index) => ({ binding, index }))
    .filter(({ binding }) => !bindingAccountFilter || binding.account === bindingAccountFilter);

  $("bindingSummary").textContent = `共 ${rows.length} 个绑定关系`;
  $("bindingTable").innerHTML = rows
    .map(
      ({ binding, index }) => `
        <tr>
          <td><input class="inline-input" data-action="change-binding-account" data-index="${index}" value="${binding.account}" /></td>
          <td><select class="inline-select" data-action="change-binding-template" data-index="${index}">${renderSelectOptions(templateNames, binding.templateName)}</select></td>
          <td class="operation-cell"><button class="link-btn danger" data-action="delete-binding" data-index="${index}">删除</button></td>
        </tr>
      `,
    )
    .join("");
};

const renderBindingArea = () => {
  renderBindingFilter();
  renderBindingTable();
};

const refreshAll = () => {
  renderSequenceTable();
  renderProductTemplateTable();
  renderBindingArea();
};

const handleClick = (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;

  const action = actionTarget.dataset.action;
  const templateId = actionTarget.dataset.templateId;
  const index = Number(actionTarget.dataset.index);

  if (action === "toggle-sequence") {
    expandedSequences.has(templateId) ? expandedSequences.delete(templateId) : expandedSequences.add(templateId);
    renderSequenceTable();
    return;
  }

  if (action === "edit-sequence" || action === "save-sequence") {
    event.stopPropagation();
    action === "edit-sequence" ? editingSequences.add(templateId) : editingSequences.delete(templateId);
    renderSequenceTable();
    return;
  }

  if (action === "delete-sequence") {
    event.stopPropagation();
    const template = findSequence(templateId);
    if (!confirm(`确认删除顺序模板“${template.name}”吗？`)) return;
    sequenceTemplates = sequenceTemplates.filter((item) => item.id !== templateId);
    expandedSequences.delete(templateId);
    refreshAll();
    return;
  }

  if (action === "add-route") {
    const template = findSequence(templateId);
    template.routes.push({ order: template.routes.length + 1, channel: hedgeChannels[0] });
    renderSequenceTable();
    return;
  }

  if (action === "delete-route") {
    const template = findSequence(templateId);
    template.routes.splice(index, 1);
    normalizeRouteOrders(template);
    renderSequenceTable();
    return;
  }

  if (action === "toggle-product-template") {
    expandedProductTemplates.has(templateId)
      ? expandedProductTemplates.delete(templateId)
      : expandedProductTemplates.add(templateId);
    renderProductTemplateTable();
    return;
  }

  if (action === "edit-product-template" || action === "save-product-template") {
    event.stopPropagation();
    action === "edit-product-template" ? editingProductTemplates.add(templateId) : editingProductTemplates.delete(templateId);
    refreshAll();
    return;
  }

  if (action === "delete-product-template") {
    event.stopPropagation();
    const template = findProductTemplate(templateId);
    if (!confirm(`确认删除交易模板“${template.name}”吗？`)) return;
    productTemplates = productTemplates.filter((item) => item.id !== templateId);
    expandedProductTemplates.delete(templateId);
    refreshAll();
    return;
  }

  if (action === "add-template-rule") {
    const template = findProductTemplate(templateId);
    template.rules.push({
      businessType: businessTypes[0],
      tradingMarket: tradingMarkets[0],
      assetTypes: [assetTypes[0]],
      direction: directions[0],
      sequenceName: sequenceTemplates[0]?.name || "",
    });
    renderProductTemplateTable();
    return;
  }

  if (action === "edit-template-rule" || action === "save-template-rule") {
    const rowKey = `${templateId}-${index}`;
    action === "edit-template-rule" ? editingProductRules.add(rowKey) : editingProductRules.delete(rowKey);
    renderProductTemplateTable();
    return;
  }

  if (action === "delete-template-rule") {
    findProductTemplate(templateId).rules.splice(index, 1);
    renderProductTemplateTable();
    return;
  }

  if (action === "delete-binding") {
    accountBindings.splice(index, 1);
    renderBindingArea();
  }
};

const handleChange = (event) => {
  const target = event.target;
  const action = target.dataset.action;
  if (!action) return;

  const templateId = target.dataset.templateId;
  const index = Number(target.dataset.index);

  if (action === "change-channel") {
    findSequence(templateId).routes[index].channel = target.value;
    return;
  }

  if (action === "change-sequence-name") {
    findSequence(templateId).name = target.value;
    return;
  }

  if (action === "change-sequence-remark") {
    findSequence(templateId).remark = target.value;
    return;
  }

  if (action === "change-product-template-name") {
    findProductTemplate(templateId).name = target.value;
    renderBindingArea();
    return;
  }

  if (action === "change-product-template-remark") {
    findProductTemplate(templateId).remark = target.value;
    return;
  }

  const productActions = {
    "change-business-type": "businessType",
    "change-market": "tradingMarket",
    "change-direction": "direction",
    "change-sequence-name": "sequenceName",
  };

  if (productActions[action]) {
    findProductTemplate(templateId).rules[index][productActions[action]] = target.value;
    return;
  }

  if (action === "change-assets") {
    findProductTemplate(templateId).rules[index].assetTypes = [...target.selectedOptions].map((option) => option.value);
    return;
  }

  if (action === "change-binding-account") {
    accountBindings[index].account = target.value;
    renderBindingFilter();
    return;
  }

  if (action === "change-binding-template") {
    accountBindings[index].templateName = target.value;
  }
};

const bindDragEvents = () => {
  document.addEventListener("dragstart", (event) => {
    const row = event.target.closest('[data-action="drag-route"]');
    if (!row) return;
    draggedRoute = { templateId: row.dataset.templateId, index: Number(row.dataset.index) };
    row.classList.add("dragging");
  });

  document.addEventListener("dragover", (event) => {
    if (!event.target.closest('[data-action="drag-route"]')) return;
    event.preventDefault();
  });

  document.addEventListener("drop", (event) => {
    const row = event.target.closest('[data-action="drag-route"]');
    if (!row || !draggedRoute) return;
    event.preventDefault();

    const targetTemplateId = row.dataset.templateId;
    const targetIndex = Number(row.dataset.index);
    if (targetTemplateId !== draggedRoute.templateId || targetIndex === draggedRoute.index) return;

    const template = findSequence(targetTemplateId);
    const [moved] = template.routes.splice(draggedRoute.index, 1);
    template.routes.splice(targetIndex, 0, moved);
    normalizeRouteOrders(template);
    draggedRoute = null;
    renderSequenceTable();
  });

  document.addEventListener("dragend", () => {
    document.querySelectorAll(".dragging").forEach((row) => row.classList.remove("dragging"));
    draggedRoute = null;
  });
};

const bindEvents = () => {
  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
  bindDragEvents();

  $("addSequenceBtn").addEventListener("click", () => {
    const id = `seq-${sequenceSeed++}`;
    sequenceTemplates.push({ id, name: `新顺序_${sequenceSeed - 1}`, remark: "", routes: [{ order: 1, channel: hedgeChannels[0] }] });
    expandedSequences.add(id);
    renderSequenceTable();
  });

  $("expandAllSequencesBtn").addEventListener("click", () => {
    const allExpanded = expandedSequences.size === sequenceTemplates.length;
    expandedSequences.clear();
    if (!allExpanded) sequenceTemplates.forEach((template) => expandedSequences.add(template.id));
    $("expandAllSequencesBtn").textContent = allExpanded ? "全部展开" : "全部收起";
    renderSequenceTable();
  });

  $("addProductTemplateBtn").addEventListener("click", () => {
    const id = `tpl-${productTemplateSeed++}`;
    productTemplates.push({
      id,
      name: `新交易模板_${productTemplateSeed - 1}`,
      remark: "",
      rules: [{ businessType: businessTypes[0], tradingMarket: tradingMarkets[0], assetTypes: [assetTypes[0]], direction: directions[0], sequenceName: sequenceTemplates[0]?.name || "" }],
    });
    expandedProductTemplates.add(id);
    renderProductTemplateTable();
  });

  $("expandAllProductTemplatesBtn").addEventListener("click", () => {
    const allExpanded = expandedProductTemplates.size === productTemplates.length;
    expandedProductTemplates.clear();
    if (!allExpanded) productTemplates.forEach((template) => expandedProductTemplates.add(template.id));
    $("expandAllProductTemplatesBtn").textContent = allExpanded ? "全部展开" : "全部收起";
    renderProductTemplateTable();
  });

  $("addBindingBtn").addEventListener("click", () => {
    accountBindings.push({ account: "", templateName: productTemplates[0]?.name || "" });
    renderBindingArea();
    showToast("已新增客户模板绑定行");
  });

  $("searchBindingBtn").addEventListener("click", () => {
    bindingAccountFilter = $("bindingAccountFilter").value;
    renderBindingArea();
  });

  $("resetBindingBtn").addEventListener("click", () => {
    bindingAccountFilter = "";
    renderBindingArea();
  });
};

bindEvents();
refreshAll();
