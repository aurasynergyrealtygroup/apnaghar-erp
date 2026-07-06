// ============================================================
// ApnaGhar Admin — expenses.js
// ============================================================

let allExpenses = [], filteredExpenses = [], propsCache = [];

document.addEventListener("DOMContentLoaded", () => {
  loadExpenses();
  loadPropsDropdown();
});

async function loadPropsDropdown() {
  const r = await API.getProperties({ limit: 500 });
  propsCache = r.success ? r.data : [];
  document.getElementById("expPropertyId").innerHTML = '<option value="">No Specific Property</option>' +
    propsCache.map(p => `<option value="${p.property_id}">${p.title}</option>`).join("");
}

function getPropTitle(id) {
  const p = propsCache.find(x => String(x.property_id) === String(id));
  return p ? p.title.slice(0, 22) : (id || "General");
}

async function loadExpenses() {
  const result = await API.admin.getExpenses();
  if (!result.success) { showToast("Error loading", "error"); return; }
  allExpenses = result.data || [];

  const now = new Date();
  const thisMonth = now.getMonth(), thisYear = now.getFullYear();

  const total = allExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const monthly = allExpenses.filter(e => e.expense_date && new Date(e.expense_date).getMonth() === thisMonth && new Date(e.expense_date).getFullYear() === thisYear)
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const marketing = allExpenses.filter(e => e.expense_type === "Marketing").reduce((s, e) => s + Number(e.amount || 0), 0);
  const maintenance = allExpenses.filter(e => e.expense_type === "Maintenance").reduce((s, e) => s + Number(e.amount || 0), 0);

  document.getElementById("expTotal").textContent = fmt(total);
  document.getElementById("expThisMonth").textContent = fmt(monthly);
  document.getElementById("expMarketing").textContent = fmt(marketing);
  document.getElementById("expMaintenance").textContent = fmt(maintenance);

  // Category breakdown
  const categories = {};
  allExpenses.forEach(e => { const t = e.expense_type || "Other"; categories[t] = (categories[t] || 0) + Number(e.amount || 0); });
  const maxVal = Math.max(...Object.values(categories), 1);
  document.getElementById("categoryBreakdown").innerHTML = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">
          <span style="font-weight:600">${k}</span><span style="color:var(--text-light)">${fmt(v)}</span>
        </div>
        <div style="background:var(--gray-200);border-radius:8px;height:8px;overflow:hidden">
          <div style="background:var(--navy);width:${Math.round((v/maxVal)*100)}%;height:100%;border-radius:8px"></div>
        </div>
      </div>`).join("");

  // Recent 5
  const recent = [...allExpenses].sort((a, b) => new Date(b.expense_date || 0) - new Date(a.expense_date || 0)).slice(0, 5);
  document.getElementById("recentExpenses").innerHTML = recent.map(e => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-bottom:1px solid var(--gray-100)">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--navy)">${e.expense_type || "—"}</div>
        <div style="font-size:11px;color:var(--text-light)">${e.paid_to || "—"} • ${fmtDate(e.expense_date)}</div>
      </div>
      <span style="font-size:14px;font-weight:700;color:var(--red)">-${fmt(e.amount)}</span>
    </div>`).join("");

  // Month filter
  const months = [...new Set(allExpenses.map(e => e.expense_date ? e.expense_date.slice(0, 7) : null).filter(Boolean))].sort().reverse();
  document.getElementById("expMonthFilter").innerHTML = '<option value="">All Months</option>' +
    months.map(m => `<option value="${m}">${m}</option>`).join("");

  filterExpenses();
}

function filterExpenses() {
  const q = document.getElementById("expSearch").value.toLowerCase();
  const type = document.getElementById("expTypeFilter").value;
  const month = document.getElementById("expMonthFilter").value;

  filteredExpenses = allExpenses.filter(e => {
    const matchQ = !q || (e.expense_type || "").toLowerCase().includes(q) || (e.paid_to || "").toLowerCase().includes(q) || (e.remark || "").toLowerCase().includes(q);
    return matchQ && (!type || e.expense_type === type) && (!month || (e.expense_date || "").startsWith(month));
  });

  const tbody = document.getElementById("expensesTbody");
  document.getElementById("expFooterInfo").textContent = `${filteredExpenses.length} expenses`;

  if (!filteredExpenses.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-light)">No expenses found</td></tr>`;
    return;
  }

  const sorted = [...filteredExpenses].sort((a, b) => new Date(b.expense_date || 0) - new Date(a.expense_date || 0));
  tbody.innerHTML = sorted.map(e => `
    <tr>
      <td style="font-size:11px;font-weight:700;color:var(--navy)">${e.expense_id}</td>
      <td><span style="font-size:12px">${getPropTitle(e.property_id)}</span></td>
      <td><span class="badge badge-info">${e.expense_type || "—"}</span></td>
      <td style="font-weight:700;color:var(--red)">-${fmt(e.amount)}</td>
      <td><span style="font-size:12px">${e.paid_to || "—"}</span></td>
      <td><span style="font-size:12px;color:var(--text-light)">${fmtDate(e.expense_date)}</span></td>
      <td><span style="font-size:12px;color:var(--text-light)">${e.remark || "—"}</span></td>
      <td>
        <button class="btn btn-sm btn-primary btn-icon" onclick="editExpense('${e.expense_id}')"><i class="fas fa-edit"></i></button>
      </td>
    </tr>`).join("");
}

function openAddExpenseModal() {
  document.getElementById("expModalTitle").innerHTML = '<i class="fas fa-receipt"></i> Add Expense';
  document.getElementById("editExpenseId").value = "";
  document.getElementById("expPropertyId").value = "";
  document.getElementById("expType").value = "Marketing";
  document.getElementById("expAmount").value = "";
  document.getElementById("expDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("expPaidTo").value = "";
  document.getElementById("expRemark").value = "";
  openModal("expenseModal");
}

function editExpense(id) {
  const e = allExpenses.find(x => String(x.expense_id) === String(id));
  if (!e) return;
  document.getElementById("expModalTitle").innerHTML = '<i class="fas fa-edit"></i> Edit Expense';
  document.getElementById("editExpenseId").value = e.expense_id;
  document.getElementById("expPropertyId").value = e.property_id || "";
  document.getElementById("expType").value = e.expense_type || "Other";
  document.getElementById("expAmount").value = e.amount || "";
  document.getElementById("expDate").value = e.expense_date ? e.expense_date.split("T")[0] : "";
  document.getElementById("expPaidTo").value = e.paid_to || "";
  document.getElementById("expRemark").value = e.remark || "";
  openModal("expenseModal");
}

async function saveExpense() {
  const amount = document.getElementById("expAmount").value;
  if (!amount) { showToast("Amount आवश्यक आहे", "error"); return; }

  const id = document.getElementById("editExpenseId").value;
  const data = {
    property_id: document.getElementById("expPropertyId").value,
    expense_type: document.getElementById("expType").value,
    amount, expense_date: document.getElementById("expDate").value,
    paid_to: document.getElementById("expPaidTo").value,
    remark: document.getElementById("expRemark").value,
  };

  const btn = document.getElementById("saveExpenseBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  const result = id
    ? await API.post("updateExpense", { ...data, expense_id: id })
    : await API.admin.addExpense(data);
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save';

  if (result.success) { showToast(id ? "Updated!" : "Expense added!", "success"); closeModal("expenseModal"); loadExpenses(); }
  else showToast(result.error || "Error", "error");
}

function exportExpensesCSV() {
  const headers = ["ID", "Property", "Type", "Amount", "Paid To", "Date", "Remark"];
  const rows = filteredExpenses.map(e => [e.expense_id, getPropTitle(e.property_id), e.expense_type, e.amount, e.paid_to, e.expense_date, e.remark]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v || ""}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = `ApnaGhar_Expenses_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast("Exported!", "success");
}
