// ============================================================
// ApnaGhar Admin — rent-payments.js
// ============================================================

let allPayments = [];
let filteredPayments = [];
let agreementsCache = [];

document.addEventListener("DOMContentLoaded", () => {
  loadRentPayments();
  loadAgreementsDropdown();
});

async function loadAgreementsDropdown() {
  const result = await API.admin.getAgreements();
  if (!result.success) return;
  agreementsCache = result.data || [];
  document.getElementById("rpAgreementId").innerHTML = '<option value="">Select Agreement</option>' +
    agreementsCache.map(a => `<option value="${a.agreement_id}" data-rent="${a.rent_amount}">${a.agreement_id} (₹${a.rent_amount}/mo)</option>`).join("");
}

function getAgreementInfo(id) {
  return agreementsCache.find(a => String(a.agreement_id) === String(id));
}

function autoFillRentAmount() {
  const sel = document.getElementById("rpAgreementId");
  const opt = sel.options[sel.selectedIndex];
  const rent = opt?.dataset.rent;
  if (rent) document.getElementById("rpAmount").value = rent;
}

// ---- LOAD ----
async function loadRentPayments() {
  const result = await API.admin.getRentPayments();
  if (!result.success) { showToast("Error loading payments", "error"); return; }
  allPayments = result.data || [];

  // KPIs
  const now = new Date();
  const thisMonth = now.getMonth(), thisYear = now.getFullYear();
  const today = new Date(); today.setHours(0,0,0,0);

  const paidThisMonth = allPayments
    .filter(p => p.payment_status === "Paid" && p.paid_date && new Date(p.paid_date).getMonth() === thisMonth && new Date(p.paid_date).getFullYear() === thisYear)
    .reduce((s, p) => s + Number(p.rent_amount || 0), 0);

  const pendingTotal = allPayments
    .filter(p => p.payment_status === "Pending" || p.payment_status === "Partial")
    .reduce((s, p) => s + Number(p.rent_amount || 0), 0);

  const overdueCount = allPayments
    .filter(p => p.payment_status === "Pending" && p.due_date && new Date(p.due_date) < today).length;

  const totalDue = allPayments.length;
  const totalPaid = allPayments.filter(p => p.payment_status === "Paid").length;
  const collectionRate = totalDue ? Math.round((totalPaid / totalDue) * 100) : 0;

  document.getElementById("rpPaidThisMonth").textContent = fmt(paidThisMonth);
  document.getElementById("rpPending").textContent = fmt(pendingTotal);
  document.getElementById("rpOverdue").textContent = overdueCount;
  document.getElementById("rpCollectionRate").textContent = collectionRate + "%";

  // Populate month filter
  const months = [...new Set(allPayments.map(p => p.month_year).filter(Boolean))];
  document.getElementById("rpMonthFilter").innerHTML = '<option value="">All Months</option>' +
    months.map(m => `<option value="${m}">${m}</option>`).join("");

  filterRentPayments();
}

// ---- FILTER ----
function filterRentPayments() {
  const q = document.getElementById("rpSearch").value.toLowerCase();
  const status = document.getElementById("rpStatusFilter").value;
  const month = document.getElementById("rpMonthFilter").value;

  filteredPayments = allPayments.filter(p => {
    const matchQ = !q || (p.agreement_id||"").toLowerCase().includes(q) || (p.month_year||"").toLowerCase().includes(q);
    const matchStatus = !status || p.payment_status === status;
    const matchMonth = !month || p.month_year === month;
    return matchQ && matchStatus && matchMonth;
  });

  renderRentPayments();
}

// ---- RENDER ----
function renderRentPayments() {
  const tbody = document.getElementById("rentPaymentsTbody");
  const total = filteredPayments.length;
  document.getElementById("rentPaymentsFooterInfo").textContent = total === 0 ? "No records" : `${total} payments`;

  if (!total) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-light)">No payments found</td></tr>`;
    return;
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const sorted = [...filteredPayments].sort((a,b) => new Date(b.due_date||0) - new Date(a.due_date||0));

  tbody.innerHTML = sorted.map(p => {
    const isOverdue = p.payment_status === "Pending" && p.due_date && new Date(p.due_date) < today;
    return `
    <tr style="${isOverdue ? 'background:#fef2f2' : ''}">
      <td><div style="font-weight:600;color:var(--navy)">${p.agreement_id || "—"}</div></td>
      <td><span style="font-size:13px;font-weight:600">${p.month_year || "—"}</span></td>
      <td>
        <span style="font-size:12px;${isOverdue ? 'color:var(--red);font-weight:700' : ''}">${fmtDate(p.due_date)}</span>
        ${isOverdue ? '<div style="font-size:10px;color:var(--red);font-weight:600"><i class="fas fa-exclamation-triangle"></i> Overdue</div>' : ''}
      </td>
      <td style="font-weight:700;color:var(--navy)">${fmt(p.rent_amount)}</td>
      <td>${p.late_fee ? `<span style="color:var(--red);font-weight:600">${fmt(p.late_fee)}</span>` : "—"}</td>
      <td><span style="font-size:12px">${p.payment_mode || "—"}</span></td>
      <td>${statusBadge(p.payment_status)}</td>
      <td>
        <div style="display:flex;gap:5px">
          ${p.payment_status !== "Paid" ? `<button class="btn btn-sm btn-success btn-icon" onclick="markPaymentPaid('${p.payment_id}')" title="Mark Paid"><i class="fas fa-check"></i></button>` : ""}
          <button class="btn btn-sm btn-primary btn-icon" onclick="editPayment('${p.payment_id}')" title="Edit"><i class="fas fa-edit"></i></button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

// ---- CRUD ----
function openAddPaymentModal() {
  document.getElementById("paymentModalTitle").innerHTML = '<i class="fas fa-money-bill-wave"></i> Record Rent Payment';
  document.getElementById("editPaymentId").value = "";
  document.getElementById("rpAgreementId").value = "";
  document.getElementById("rpMonthYear").value = new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" }).replace(" ", "-");
  document.getElementById("rpDueDate").value = "";
  document.getElementById("rpPaidDate").value = "";
  document.getElementById("rpAmount").value = "";
  document.getElementById("rpLateFee").value = "0";
  document.getElementById("rpMode").value = "";
  document.getElementById("rpTxnId").value = "";
  document.getElementById("rpStatus").value = "Pending";
  openModal("paymentModal");
}

function editPayment(id) {
  const p = allPayments.find(x => String(x.payment_id) === String(id));
  if (!p) return;
  document.getElementById("paymentModalTitle").innerHTML = '<i class="fas fa-edit"></i> Edit Payment';
  document.getElementById("editPaymentId").value = p.payment_id;
  document.getElementById("rpAgreementId").value = p.agreement_id || "";
  document.getElementById("rpMonthYear").value = p.month_year || "";
  document.getElementById("rpDueDate").value = p.due_date ? p.due_date.split("T")[0] : "";
  document.getElementById("rpPaidDate").value = p.paid_date ? p.paid_date.split("T")[0] : "";
  document.getElementById("rpAmount").value = p.rent_amount || "";
  document.getElementById("rpLateFee").value = p.late_fee || "0";
  document.getElementById("rpMode").value = p.payment_mode || "";
  document.getElementById("rpTxnId").value = p.transaction_id || "";
  document.getElementById("rpStatus").value = p.payment_status || "Pending";
  openModal("paymentModal");
}

async function saveRentPayment() {
  const agreementId = document.getElementById("rpAgreementId").value;
  const monthYear = document.getElementById("rpMonthYear").value.trim();
  const amount = document.getElementById("rpAmount").value;
  if (!agreementId || !monthYear || !amount) { showToast("सर्व required fields भरा", "error"); return; }

  const id = document.getElementById("editPaymentId").value;
  const data = {
    agreement_id: agreementId,
    month_year: monthYear,
    due_date: document.getElementById("rpDueDate").value,
    paid_date: document.getElementById("rpPaidDate").value,
    rent_amount: amount,
    late_fee: document.getElementById("rpLateFee").value || 0,
    payment_mode: document.getElementById("rpMode").value,
    transaction_id: document.getElementById("rpTxnId").value,
    payment_status: document.getElementById("rpStatus").value,
  };

  const btn = document.getElementById("savePaymentBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  let result;
  if (id) { data.payment_id = id; result = await API.admin.updateRentPayment(data); }
  else result = await API.admin.addRentPayment(data);

  btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save';

  if (result.success) {
    showToast(id ? "Payment updated!" : "Payment recorded!", "success");
    closeModal("paymentModal");
    loadRentPayments();
  } else {
    showToast(result.error || "Error saving", "error");
  }
}

async function markPaymentPaid(id) {
  const result = await API.admin.updateRentPayment({
    payment_id: id,
    payment_status: "Paid",
    paid_date: new Date().toISOString().split("T")[0],
  });
  if (result.success) { showToast("Marked as Paid!", "success"); loadRentPayments(); }
  else showToast("Error updating", "error");
}

// ---- EXPORT ----
function exportRentCSV() {
  const headers = ["Payment ID","Agreement","Month","Due Date","Paid Date","Amount","Late Fee","Mode","Status"];
  const rows = filteredPayments.map(p => [p.payment_id, p.agreement_id, p.month_year, p.due_date, p.paid_date, p.rent_amount, p.late_fee, p.payment_mode, p.payment_status]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v||""}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = "ApnaGhar_RentPayments.csv";
  a.click();
  showToast("CSV exported!", "success");
}
