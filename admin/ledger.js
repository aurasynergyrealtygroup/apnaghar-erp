// ============================================================
// ApnaGhar Admin — ledger.js
// ============================================================

let allEntries = [], filteredEntries = [], ledgerChart = null;

document.addEventListener("DOMContentLoaded", () => {
  loadLedger();
  document.getElementById("ledDate").value = new Date().toISOString().split("T")[0];
});

async function loadLedger() {
  const result = await API.admin.getLedger();
  if (!result.success) { showToast("Error loading ledger", "error"); return; }
  allEntries = (result.data || []).sort((a, b) => new Date(a.transaction_date || 0) - new Date(b.transaction_date || 0));

  const income = allEntries.filter(e => e.transaction_type === "Income").reduce((s, e) => s + Number(e.amount || 0), 0);
  const expense = allEntries.filter(e => e.transaction_type === "Expense").reduce((s, e) => s + Number(e.amount || 0), 0);
  const balance = income - expense;

  const now = new Date();
  const thisMonthEntries = allEntries.filter(e => e.transaction_date && new Date(e.transaction_date).getMonth() === now.getMonth() && new Date(e.transaction_date).getFullYear() === now.getFullYear());
  const thisMonthIncome = thisMonthEntries.filter(e => e.transaction_type === "Income").reduce((s, e) => s + Number(e.amount || 0), 0);
  const thisMonthExpense = thisMonthEntries.filter(e => e.transaction_type === "Expense").reduce((s, e) => s + Number(e.amount || 0), 0);

  document.getElementById("ledIncome").textContent = fmt(income);
  document.getElementById("ledExpense").textContent = fmt(expense);
  document.getElementById("ledBalance").textContent = fmt(balance);
  document.getElementById("ledBalance").style.color = balance >= 0 ? "var(--green)" : "var(--red)";
  document.getElementById("ledThisMonth").textContent = fmt(thisMonthIncome - thisMonthExpense);

  renderLedgerChart();
  renderRunningBalance();
  filterLedger();
}

function renderLedgerChart() {
  if (ledgerChart) { ledgerChart.destroy(); ledgerChart = null; }
  const months = getLast6Months();
  const incomeData = months.map(m => allEntries.filter(e => e.transaction_type === "Income" && e.transaction_date && matchMonth(e.transaction_date, m)).reduce((s, e) => s + Number(e.amount || 0), 0));
  const expenseData = months.map(m => allEntries.filter(e => e.transaction_type === "Expense" && e.transaction_date && matchMonth(e.transaction_date, m)).reduce((s, e) => s + Number(e.amount || 0), 0));

  const ctx = document.getElementById("ledgerChart").getContext("2d");
  ledgerChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: "Income", data: incomeData, backgroundColor: "rgba(39,174,96,0.85)", borderRadius: 6 },
        { label: "Expense", data: expenseData, backgroundColor: "rgba(231,76,60,0.85)", borderRadius: 6 },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true, ticks: { callback: v => "₹" + (v/1000).toFixed(0) + "K" } } } },
  });
}

function renderRunningBalance() {
  let running = 0;
  const last10 = allEntries.slice(-10).reverse();
  const container = document.getElementById("runningBalance");
  container.innerHTML = last10.map(e => {
    const amt = Number(e.amount || 0);
    if (e.transaction_type === "Income") running += amt;
    else running -= amt;
    const isIncome = e.transaction_type === "Income";
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--gray-100)">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text)">${e.description || "—"}</div>
          <div style="font-size:10px;color:var(--text-light)">${fmtDate(e.transaction_date)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:700;color:${isIncome ? "var(--green)" : "var(--red)"}">${isIncome ? "+" : "-"}${fmt(amt)}</div>
        </div>
      </div>`;
  }).join("") || `<div style="text-align:center;padding:24px;color:var(--text-light)">No entries yet</div>`;
}

function filterLedger() {
  const q = document.getElementById("ledSearch").value.toLowerCase();
  const type = document.getElementById("ledTypeFilter").value;
  const ref = document.getElementById("ledRefFilter").value;

  filteredEntries = allEntries.filter(e => {
    const matchQ = !q || (e.description || "").toLowerCase().includes(q) || (e.reference_type || "").toLowerCase().includes(q);
    return matchQ && (!type || e.transaction_type === type) && (!ref || e.reference_type === ref);
  });

  renderLedgerTable();
}

function renderLedgerTable() {
  const tbody = document.getElementById("ledgerTbody");
  document.getElementById("ledFooterInfo").textContent = `${filteredEntries.length} entries`;

  if (!filteredEntries.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-light)">No entries found</td></tr>`;
    return;
  }

  let runningBal = 0;
  // Calculate running balance from all entries
  const sortedAll = [...allEntries].sort((a, b) => new Date(a.transaction_date || 0) - new Date(b.transaction_date || 0));
  const balanceMap = {};
  sortedAll.forEach(e => {
    const amt = Number(e.amount || 0);
    if (e.transaction_type === "Income") runningBal += amt;
    else runningBal -= amt;
    balanceMap[e.ledger_id] = runningBal;
  });

  const sorted = [...filteredEntries].sort((a, b) => new Date(b.transaction_date || 0) - new Date(a.transaction_date || 0));
  tbody.innerHTML = sorted.map(e => {
    const isIncome = e.transaction_type === "Income";
    const bal = balanceMap[e.ledger_id] || 0;
    return `
      <tr>
        <td><span style="font-size:12px">${fmtDate(e.transaction_date)}</span></td>
        <td><span class="badge ${isIncome ? "badge-success" : "badge-danger"}">${e.transaction_type}</span></td>
        <td><span style="font-size:12px">${e.reference_type || "—"}</span></td>
        <td><span style="font-size:13px">${e.description || "—"}</span></td>
        <td><span style="font-size:12px">${e.payment_mode || "—"}</span></td>
        <td style="font-weight:600;color:var(--green)">${isIncome ? fmt(e.amount) : "—"}</td>
        <td style="font-weight:600;color:var(--red)">${!isIncome ? fmt(e.amount) : "—"}</td>
        <td style="font-weight:700;color:${bal >= 0 ? "var(--navy)" : "var(--red)"}">${fmt(Math.abs(bal))} ${bal < 0 ? "(Dr)" : "(Cr)"}</td>
      </tr>`;
  }).join("");
}

function openAddLedgerModal() {
  document.getElementById("ledTxnType").value = "Income";
  document.getElementById("ledAmount").value = "";
  document.getElementById("ledRefType").value = "Rent";
  document.getElementById("ledMode").value = "UPI";
  document.getElementById("ledDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("ledDesc").value = "";
  openModal("ledgerModal");
}

async function saveLedgerEntry() {
  const amount = document.getElementById("ledAmount").value;
  const desc = document.getElementById("ledDesc").value.trim();
  if (!amount || !desc) { showToast("Amount आणि Description आवश्यक आहे", "error"); return; }

  const btn = document.getElementById("saveLedgerBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  const result = await API.admin.addLedgerEntry({
    transaction_type: document.getElementById("ledTxnType").value,
    amount, reference_type: document.getElementById("ledRefType").value,
    payment_mode: document.getElementById("ledMode").value,
    transaction_date: document.getElementById("ledDate").value,
    description: desc,
    created_by: getAdminUser()?.full_name || "Admin",
  });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Entry';

  if (result.success) { showToast("Entry added!", "success"); closeModal("ledgerModal"); loadLedger(); }
  else showToast(result.error || "Error", "error");
}

function exportLedgerCSV() {
  const headers = ["Date", "Type", "Reference", "Description", "Mode", "Amount"];
  const rows = filteredEntries.map(e => [e.transaction_date, e.transaction_type, e.reference_type, e.description, e.payment_mode, e.amount]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v || ""}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = `ApnaGhar_Ledger_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast("Exported!", "success");
}

function getLast6Months() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }) });
  }
  return months;
}
function matchMonth(dateStr, m) {
  const d = new Date(dateStr);
  return d.getMonth() === m.month && d.getFullYear() === m.year;
}
