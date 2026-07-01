// ============================================================
// ApnaGhar Admin — reports.js
// ============================================================

let charts = {};
let allData = {};

document.addEventListener("DOMContentLoaded", loadAllReports);

async function loadAllReports() {
  showToast("Reports loading...", "info");
  const period = document.getElementById("reportPeriod").value;

  const [dashRes, clientsRes, propsRes, dealsRes, paymentsRes, expensesRes, agentsRes] = await Promise.all([
    API.getDashboard(),
    API.admin.getClients(),
    API.getProperties({ limit: 1000 }),
    API.admin.getSaleDeals(),
    API.admin.getRentPayments(),
    API.admin.getExpenses(),
    API.admin.getAgents(),
  ]);

  allData = {
    dash: dashRes.success ? dashRes.data : {},
    clients: clientsRes.success ? clientsRes.data : [],
    props: propsRes.success ? propsRes.data : [],
    deals: dealsRes.success ? dealsRes.data : [],
    payments: paymentsRes.success ? paymentsRes.data : [],
    expenses: expensesRes.success ? expensesRes.data : [],
    agents: agentsRes.success ? agentsRes.data : [],
  };

  const filtered = filterByPeriod(allData, period);
  renderKPIs(filtered);
  renderRevenueChart(filtered);
  renderStatusChart(filtered);
  renderFunnelChart(filtered);
  renderSourceChart(filtered);
  renderTypeChart(filtered);
  renderRentStatusChart(filtered);
  renderAgentPerformance(filtered);
  showToast("Reports loaded!", "success");
}

// ---- PERIOD FILTER ----
function filterByPeriod(data, period) {
  const now = new Date();
  const cutoff = {
    month: new Date(now.getFullYear(), now.getMonth(), 1),
    quarter: new Date(now.getFullYear(), now.getMonth() - 3, 1),
    year: new Date(now.getFullYear(), 0, 1),
    all: new Date("2000-01-01"),
  }[period] || new Date("2000-01-01");

  return {
    ...data,
    deals: data.deals.filter(d => !d.token_date || new Date(d.token_date) >= cutoff),
    payments: data.payments.filter(p => !p.paid_date || new Date(p.paid_date) >= cutoff),
    expenses: data.expenses.filter(e => !e.expense_date || new Date(e.expense_date) >= cutoff),
    clients: data.clients.filter(c => !c.created_at || new Date(c.created_at) >= cutoff),
  };
}

// ---- KPIs ----
function renderKPIs(d) {
  const rentIncome = d.payments.filter(p => p.payment_status === "Paid").reduce((s, p) => s + Number(p.rent_amount || 0), 0);
  const saleRevenue = d.deals.filter(x => x.deal_status === "Registered").reduce((s, x) => s + Number(x.final_price || 0), 0);
  const totalRevenue = rentIncome + saleRevenue;
  const commission = d.deals.reduce((s, x) => s + Number(x.commission_amount || 0), 0);
  const expenses = d.expenses.reduce((s, x) => s + Number(x.amount || 0), 0);
  const dealsClosed = d.deals.filter(x => x.deal_status === "Registered").length;

  document.getElementById("repTotalRevenue").textContent = fmt(totalRevenue);
  document.getElementById("repDealsClosed").textContent = dealsClosed;
  document.getElementById("repCommissionEarned").textContent = fmt(commission);
  document.getElementById("repTotalExpenses").textContent = fmt(expenses);

  const netProfit = commission - expenses;
  document.getElementById("repRevenueChange").innerHTML =
    `<i class="fas fa-arrow-${netProfit >= 0 ? "up" : "down"}"></i> Net: ${fmt(Math.abs(netProfit))}`;
  document.getElementById("repRevenueChange").className = `kpi-change ${netProfit >= 0 ? "up" : "down"}`;
}

// ---- CHART HELPERS ----
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

const COLORS = {
  navy: "rgba(30,58,95,0.85)",
  gold: "rgba(201,168,76,0.85)",
  green: "rgba(39,174,96,0.85)",
  red: "rgba(231,76,60,0.85)",
  blue: "rgba(41,128,185,0.85)",
  purple: "rgba(142,68,173,0.85)",
  orange: "rgba(230,126,34,0.85)",
  teal: "rgba(26,188,156,0.85)",
  lightNavy: "rgba(30,58,95,0.15)",
  lightGold: "rgba(201,168,76,0.15)",
};

// ---- REVENUE TREND (Last 6 months) ----
function renderRevenueChart(d) {
  destroyChart("revenue");
  const months = getLast6Months();
  const rentData = months.map(m => {
    return d.payments
      .filter(p => p.payment_status === "Paid" && p.paid_date && matchMonth(p.paid_date, m))
      .reduce((s, p) => s + Number(p.rent_amount || 0), 0);
  });
  const saleData = months.map(m => {
    return d.deals
      .filter(x => x.deal_status === "Registered" && x.token_date && matchMonth(x.token_date, m))
      .reduce((s, x) => s + Number(x.commission_amount || 0), 0);
  });

  const ctx = document.getElementById("revenueChart").getContext("2d");
  charts["revenue"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: "Rent Collected", data: rentData, backgroundColor: COLORS.navy, borderRadius: 6, stack: "a" },
        { label: "Commission", data: saleData, backgroundColor: COLORS.gold, borderRadius: 6, stack: "a" },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { y: { ticks: { callback: v => "₹" + (v/1000).toFixed(0) + "K" } } } },
  });
}

// ---- PROPERTY STATUS PIE ----
function renderStatusChart(d) {
  destroyChart("status");
  const avail = d.props.filter(p => p.status === "Available").length;
  const rented = d.props.filter(p => p.status === "Rented").length;
  const sold = d.props.filter(p => p.status === "Sold").length;

  const ctx = document.getElementById("statusChart").getContext("2d");
  charts["status"] = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Available", "Rented", "Sold"],
      datasets: [{ data: [avail, rented, sold], backgroundColor: [COLORS.green, COLORS.orange, COLORS.navy], borderWidth: 2 }],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } }, cutout: "65%" },
  });
}

// ---- LEAD FUNNEL ----
function renderFunnelChart(d) {
  destroyChart("funnel");
  const total = d.clients.length;
  const followup = d.clients.filter(c => c.lead_status === "Followup" || c.lead_status === "Closed" || c.lead_status === "New").length;
  const visits = Math.min(followup, Math.round(followup * 0.6));
  const closed = d.clients.filter(c => c.lead_status === "Closed").length;

  const ctx = document.getElementById("funnelChart").getContext("2d");
  charts["funnel"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Total Leads", "Follow-ups", "Site Visits", "Closed"],
      datasets: [{
        data: [total, followup, visits, closed],
        backgroundColor: [COLORS.navy, COLORS.blue, COLORS.gold, COLORS.green],
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: "y", responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } },
    },
  });
}

// ---- LEAD SOURCES DOUGHNUT ----
function renderSourceChart(d) {
  destroyChart("source");
  const sources = {};
  d.clients.forEach(c => { const s = c.lead_source || "Other"; sources[s] = (sources[s] || 0) + 1; });
  const sorted = Object.entries(sources).sort((a,b) => b[1]-a[1]).slice(0,6);

  const ctx = document.getElementById("sourceChart").getContext("2d");
  charts["source"] = new Chart(ctx, {
    type: "pie",
    data: {
      labels: sorted.map(([k]) => k),
      datasets: [{
        data: sorted.map(([,v]) => v),
        backgroundColor: [COLORS.navy, COLORS.gold, COLORS.green, COLORS.blue, COLORS.purple, COLORS.orange],
      }],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } },
  });
}

// ---- PROPERTY TYPE BAR ----
function renderTypeChart(d) {
  destroyChart("type");
  const types = {};
  d.props.forEach(p => { const t = p.property_type || "Other"; types[t] = (types[t] || 0) + 1; });

  const ctx = document.getElementById("typeChart").getContext("2d");
  charts["type"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(types),
      datasets: [{
        label: "Properties",
        data: Object.values(types),
        backgroundColor: [COLORS.navy, COLORS.gold, COLORS.green, COLORS.blue, COLORS.purple, COLORS.orange],
        borderRadius: 6,
      }],
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });
}

// ---- RENT STATUS PIE ----
function renderRentStatusChart(d) {
  destroyChart("rentStatus");
  const paid = d.payments.filter(p => p.payment_status === "Paid").length;
  const pending = d.payments.filter(p => p.payment_status === "Pending").length;
  const partial = d.payments.filter(p => p.payment_status === "Partial").length;

  const ctx = document.getElementById("rentStatusChart").getContext("2d");
  charts["rentStatus"] = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Paid", "Pending", "Partial"],
      datasets: [{ data: [paid, pending, partial], backgroundColor: [COLORS.green, COLORS.orange, COLORS.blue], borderWidth: 2 }],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } }, cutout: "65%" },
  });
}

// ---- AGENT PERFORMANCE TABLE ----
function renderAgentPerformance(d) {
  const tbody = document.getElementById("agentPerfTbody");
  if (!d.agents.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-light)">No agents found</td></tr>`;
    return;
  }

  const agentStats = d.agents.map(a => {
    const clients = d.clients.filter(c => String(c.assigned_agent_id) === String(a.agent_id)).length;
    const deals = d.deals.filter(x => String(x.agent_id) === String(a.agent_id) && x.deal_status === "Registered").length;
    const commission = d.deals.filter(x => String(x.agent_id) === String(a.agent_id)).reduce((s, x) => s + Number(x.commission_amount || 0), 0);
    return { ...a, clients, deals, commission };
  }).sort((a, b) => b.commission - a.commission);

  const maxCommission = Math.max(...agentStats.map(a => a.commission), 1);

  tbody.innerHTML = agentStats.map((a, i) => {
    const pct = Math.round((a.commission / maxCommission) * 100);
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
    return `
      <tr>
        <td style="font-size:18px;text-align:center">${medal}</td>
        <td>
          <div style="font-weight:600;color:var(--navy)">${a.full_name}</div>
          <div style="font-size:11px;color:var(--text-light)">${a.specialization || ""}</div>
        </td>
        <td style="text-align:center;font-weight:600">${a.clients}</td>
        <td style="text-align:center;font-weight:600;color:var(--green)">${a.deals}</td>
        <td style="font-weight:700;color:var(--navy)">${fmt(a.commission)}</td>
        <td style="min-width:140px">
          <div style="background:var(--gray-200);border-radius:8px;height:8px;overflow:hidden">
            <div style="background:var(--gold);width:${pct}%;height:100%;border-radius:8px;transition:width 1s ease"></div>
          </div>
          <span style="font-size:11px;color:var(--text-light)">${pct}%</span>
        </td>
      </tr>`;
  }).join("");
}

// ---- EXPORT ----
async function downloadReport(type) {
  showToast("Preparing export...");
  let data, headers, rows, filename;

  switch (type) {
    case "clients":
      data = allData.clients || [];
      headers = ["ID","Name","Mobile","Type","Budget Min","Budget Max","Source","Status","Date"];
      rows = data.map(c => [c.client_id,c.full_name,c.mobile,c.client_type,c.budget_min,c.budget_max,c.lead_source,c.lead_status,c.created_at]);
      filename = "ApnaGhar_Clients_Report";
      break;
    case "properties":
      data = allData.props || [];
      headers = ["ID","Code","Title","Type","Listing","BHK","Area","Price","Rent","City","Status"];
      rows = data.map(p => [p.property_id,p.property_code,p.title,p.property_type,p.listing_type,p.bhk,p.carpet_area,p.expected_price,p.expected_rent,p.city,p.status]);
      filename = "ApnaGhar_Properties_Report";
      break;
    case "deals":
      data = allData.deals || [];
      headers = ["Deal ID","Property","Client","Final Price","Commission","Token Date","Reg Date","Status"];
      rows = data.map(d => [d.deal_id,d.property_id,d.client_id,d.final_price,d.commission_amount,d.token_date,d.registration_date,d.deal_status]);
      filename = "ApnaGhar_Sales_Report";
      break;
    case "rent":
      data = allData.payments || [];
      headers = ["Payment ID","Agreement","Month","Amount","Late Fee","Mode","Status","Paid Date"];
      rows = data.map(p => [p.payment_id,p.agreement_id,p.month_year,p.rent_amount,p.late_fee,p.payment_mode,p.payment_status,p.paid_date]);
      filename = "ApnaGhar_Rent_Collection";
      break;
    case "expenses":
      data = allData.expenses || [];
      headers = ["Expense ID","Property","Type","Amount","Date","Paid To","Remark"];
      rows = data.map(e => [e.expense_id,e.property_id,e.expense_type,e.amount,e.expense_date,e.paid_to,e.remark]);
      filename = "ApnaGhar_Expenses_Report";
      break;
    case "full":
      exportFullReport();
      return;
  }

  const csv = [[...headers], ...rows].map(r => r.map(v => `"${v||""}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  const dateStr = new Date().toISOString().slice(0,10);
  a.download = `${filename}_${dateStr}.csv`;
  a.click();
  showToast("Report downloaded!", "success");
}

function exportFullReport() {
  const sheets = [
    { name: "Clients",   data: allData.clients || [] },
    { name: "Properties", data: allData.props || [] },
    { name: "Deals",     data: allData.deals || [] },
    { name: "Payments",  data: allData.payments || [] },
    { name: "Expenses",  data: allData.expenses || [] },
    { name: "Agents",    data: allData.agents || [] },
  ];
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ApnaGhar Full Report</title>
  <style>body{font-family:Arial,sans-serif;font-size:12px} h2{color:#1e3a5f;margin:24px 0 8px} table{border-collapse:collapse;width:100%;margin-bottom:32px} th{background:#1e3a5f;color:#fff;padding:8px 10px;text-align:left} td{padding:7px 10px;border-bottom:1px solid #eee} tr:nth-child(even){background:#f8f9fa}</style>
  </head><body><h1 style="color:#1e3a5f">🏠 ApnaGhar ERP — Full Report</h1><p>Generated: ${new Date().toLocaleString("en-IN")}</p>`;

  sheets.forEach(s => {
    if (!s.data.length) return;
    const keys = Object.keys(s.data[0]);
    html += `<h2>${s.name} (${s.data.length} records)</h2><table><thead><tr>${keys.map(k=>`<th>${k}</th>`).join("")}</tr></thead><tbody>`;
    html += s.data.map(row => `<tr>${keys.map(k=>`<td>${row[k]||""}</td>`).join("")}</tr>`).join("");
    html += `</tbody></table>`;
  });

  html += `</body></html>`;
  const a = document.createElement("a");
  a.href = "data:text/html;charset=utf-8," + encodeURIComponent(html);
  a.download = `ApnaGhar_FullReport_${new Date().toISOString().slice(0,10)}.html`;
  a.click();
  showToast("Full report downloaded!", "success");
}

// ---- HELPERS ----
function getLast6Months() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }) });
  }
  return months;
}

function matchMonth(dateStr, m) {
  const d = new Date(dateStr);
  return d.getMonth() === m.month && d.getFullYear() === m.year;
}
