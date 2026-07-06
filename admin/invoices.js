// ============================================================
// ApnaGhar Admin — invoices.js
// ============================================================

let allInvoices = [], filteredInvoices = [], clientsCacheI = [];

document.addEventListener("DOMContentLoaded", () => {
  loadInvoices();
  loadClientsDropdown();
  document.getElementById("invNumber").value = generateInvNumber();
  document.getElementById("invDate").value = new Date().toISOString().split("T")[0];
});

async function loadClientsDropdown() {
  const r = await API.admin.getClients();
  clientsCacheI = r.success ? r.data : [];
  document.getElementById("invClientId").innerHTML = '<option value="">Select Client</option>' +
    clientsCacheI.map(c => `<option value="${c.client_id}">${c.full_name} (${c.mobile})</option>`).join("");
}

function getClientName(id) {
  const c = clientsCacheI.find(x => String(x.client_id) === String(id));
  return c ? c.full_name : `Client ${id}`;
}

function generateInvNumber() {
  const now = new Date();
  return `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
}

async function loadInvoices() {
  const result = await API.admin.getInvoices();
  if (!result.success) { showToast("Error loading", "error"); return; }
  allInvoices = result.data || [];

  const totalPaid = allInvoices.filter(i => i.payment_status === "Paid").reduce((s, i) => s + Number(i.total_amount || 0), 0);
  const totalUnpaid = allInvoices.filter(i => i.payment_status !== "Paid").reduce((s, i) => s + Number(i.total_amount || 0), 0);
  const totalGST = allInvoices.reduce((s, i) => s + Number(i.gst_amount || 0), 0);

  document.getElementById("invTotal").textContent = allInvoices.length;
  document.getElementById("invPaid").textContent = fmt(totalPaid);
  document.getElementById("invUnpaid").textContent = fmt(totalUnpaid);
  document.getElementById("invGST").textContent = fmt(totalGST);

  filterInvoices();
}

function filterInvoices() {
  const q = document.getElementById("invSearch").value.toLowerCase();
  const type = document.getElementById("invTypeFilter").value;
  const status = document.getElementById("invStatusFilter").value;

  filteredInvoices = allInvoices.filter(i => {
    const clientName = getClientName(i.client_id).toLowerCase();
    const matchQ = !q || (i.invoice_number || "").toLowerCase().includes(q) || clientName.includes(q);
    return matchQ && (!type || i.invoice_type === type) && (!status || i.payment_status === status);
  });

  const tbody = document.getElementById("invoicesTbody");
  document.getElementById("invFooterInfo").textContent = `${filteredInvoices.length} invoices`;

  if (!filteredInvoices.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-light)">No invoices found</td></tr>`;
    return;
  }

  const sorted = [...filteredInvoices].sort((a, b) => new Date(b.invoice_date || 0) - new Date(a.invoice_date || 0));
  tbody.innerHTML = sorted.map(i => `
    <tr>
      <td><span style="font-weight:700;color:var(--navy);font-size:12px">${i.invoice_number}</span></td>
      <td><span style="font-size:13px">${getClientName(i.client_id)}</span></td>
      <td><span class="badge badge-navy">${i.invoice_type || "—"}</span></td>
      <td style="font-weight:600">${fmt(i.taxable_amount)}</td>
      <td><span style="color:var(--orange)">${fmt(i.gst_amount)} (${i.gst_percent || 0}%)</span></td>
      <td style="font-weight:700;color:var(--navy)">${fmt(i.total_amount)}</td>
      <td><span style="font-size:12px;color:var(--text-light)">${fmtDate(i.invoice_date)}</span></td>
      <td>${statusBadge(i.payment_status)}</td>
      <td>
        <div style="display:flex;gap:5px">
          <button class="btn btn-sm btn-outline btn-icon" onclick="viewInvoice('${i.invoice_id}')" title="View"><i class="fas fa-eye"></i></button>
          <button class="btn btn-sm btn-primary btn-icon" onclick="editInvoice('${i.invoice_id}')" title="Edit"><i class="fas fa-edit"></i></button>
          ${i.payment_status !== "Paid" ? `<button class="btn btn-sm btn-success btn-icon" onclick="markInvoicePaid('${i.invoice_id}')" title="Mark Paid"><i class="fas fa-check"></i></button>` : ""}
        </div>
      </td>
    </tr>`).join("");
}

function calcInvoiceGST() {
  const taxable = Number(document.getElementById("invTaxable").value) || 0;
  const gstPct = Number(document.getElementById("invGSTPct").value) || 0;
  const gstAmt = Math.round((taxable * gstPct) / 100);
  const total = taxable + gstAmt;

  document.getElementById("invGSTAmt").value = gstAmt;
  document.getElementById("invTotalAmt").value = total;

  const preview = document.getElementById("gstPreview");
  if (taxable > 0) {
    preview.style.display = "";
    document.getElementById("gpTaxable").textContent = fmt(taxable);
    document.getElementById("gpGST").textContent = `${fmt(gstAmt)} (${gstPct}%)`;
    document.getElementById("gpTotal").textContent = fmt(total);
  } else preview.style.display = "none";
}

function openAddInvoiceModal() {
  document.getElementById("invModalTitle").innerHTML = '<i class="fas fa-file-invoice"></i> Create Invoice';
  document.getElementById("editInvoiceId").value = "";
  document.getElementById("invNumber").value = generateInvNumber();
  document.getElementById("invClientId").value = "";
  document.getElementById("invType").value = "Commission";
  document.getElementById("invTaxable").value = "";
  document.getElementById("invGSTPct").value = "18";
  document.getElementById("invGSTAmt").value = "";
  document.getElementById("invTotalAmt").value = "";
  document.getElementById("invDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("invPayStatus").value = "Unpaid";
  document.getElementById("gstPreview").style.display = "none";
  document.getElementById("printInvBtn").style.display = "none";
  openModal("invoiceModal");
}

function editInvoice(id) {
  const i = allInvoices.find(x => String(x.invoice_id) === String(id));
  if (!i) return;
  document.getElementById("invModalTitle").innerHTML = '<i class="fas fa-edit"></i> Edit Invoice';
  document.getElementById("editInvoiceId").value = i.invoice_id;
  document.getElementById("invNumber").value = i.invoice_number || "";
  document.getElementById("invClientId").value = i.client_id || "";
  document.getElementById("invType").value = i.invoice_type || "Commission";
  document.getElementById("invTaxable").value = i.taxable_amount || "";
  document.getElementById("invGSTPct").value = i.gst_percent || "18";
  document.getElementById("invDate").value = i.invoice_date ? i.invoice_date.split("T")[0] : "";
  document.getElementById("invPayStatus").value = i.payment_status || "Unpaid";
  calcInvoiceGST();
  document.getElementById("printInvBtn").style.display = "";
  openModal("invoiceModal");
}

async function saveInvoice() {
  const clientId = document.getElementById("invClientId").value;
  const taxable = document.getElementById("invTaxable").value;
  if (!clientId || !taxable) { showToast("Client आणि Amount आवश्यक आहे", "error"); return; }

  const id = document.getElementById("editInvoiceId").value;
  const data = {
    invoice_number: document.getElementById("invNumber").value,
    client_id: clientId,
    invoice_type: document.getElementById("invType").value,
    taxable_amount: taxable,
    gst_percent: document.getElementById("invGSTPct").value,
    gst_amount: document.getElementById("invGSTAmt").value,
    total_amount: document.getElementById("invTotalAmt").value,
    invoice_date: document.getElementById("invDate").value,
    payment_status: document.getElementById("invPayStatus").value,
  };

  const btn = document.getElementById("saveInvoiceBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  const result = id
    ? await API.post("updateInvoice", { ...data, invoice_id: id })
    : await API.admin.addInvoice(data);
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Invoice';

  if (result.success) { showToast(id ? "Updated!" : "Invoice created!", "success"); closeModal("invoiceModal"); loadInvoices(); }
  else showToast(result.error || "Error", "error");
}

async function markInvoicePaid(id) {
  const result = await API.post("updateInvoice", { invoice_id: id, payment_status: "Paid" });
  if (result.success) { showToast("Invoice marked as Paid!", "success"); loadInvoices(); }
  else showToast("Error", "error");
}

function viewInvoice(id) {
  const i = allInvoices.find(x => String(x.invoice_id) === String(id));
  if (!i) return;
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head><title>Invoice ${i.invoice_number}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #1e3a5f; padding-bottom: 20px; margin-bottom: 24px; }
    .logo { font-size: 24px; font-weight: 800; color: #1e3a5f; }
    .inv-no { font-size: 13px; color: #666; margin-top: 4px; }
    .section { margin-bottom: 20px; }
    .label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
    .value { font-size: 14px; font-weight: 600; color: #2c3e50; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #1e3a5f; color: #fff; padding: 10px 14px; text-align: left; font-size: 12px; }
    td { padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 13px; }
    .total-row td { font-weight: 800; font-size: 15px; background: #f8f9fa; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
    .badge { display:inline-block; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .paid { background: #d1fae5; color: #065f46; }
    .unpaid { background: #fee2e2; color: #991b1b; }
  </style>
  </head><body>
  <div class="header">
    <div class="logo">🏠 ApnaGhar Realty</div>
    <div class="inv-no">${CONFIG?.COMPANY?.address || "Pune, Maharashtra"}</div>
  </div>
  <div style="display:flex;justify-content:space-between;margin-bottom:24px">
    <div>
      <div class="label">Invoice To</div>
      <div class="value">${getClientName(i.client_id)}</div>
    </div>
    <div style="text-align:right">
      <div class="label">Invoice No</div>
      <div class="value">${i.invoice_number}</div>
      <div class="label" style="margin-top:8px">Date</div>
      <div class="value">${fmtDate(i.invoice_date)}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      <tr><td>${i.invoice_type} Services</td><td style="text-align:right">${fmt(i.taxable_amount)}</td></tr>
      <tr><td>GST (${i.gst_percent}%)</td><td style="text-align:right;color:#e67e22">${fmt(i.gst_amount)}</td></tr>
      <tr class="total-row"><td>Total Payable</td><td style="text-align:right;color:#1e3a5f">${fmt(i.total_amount)}</td></tr>
    </tbody>
  </table>
  <div style="margin-top:20px;text-align:right">
    Status: <span class="badge ${i.payment_status === 'Paid' ? 'paid' : 'unpaid'}">${i.payment_status}</span>
  </div>
  <div class="footer">
    <p>Thank you for your business! | ${CONFIG?.COMPANY?.phone || "+91 98765 43210"}</p>
    <p style="margin-top:4px">GSTIN: 27XXXXX | This is a computer generated invoice</p>
  </div>
  <script>window.onload = () => window.print();</script>
  </body></html>`);
  win.document.close();
}

function exportInvoicesCSV() {
  const headers = ["Invoice No", "Client", "Type", "Taxable", "GST%", "GST Amt", "Total", "Date", "Status"];
  const rows = filteredInvoices.map(i => [i.invoice_number, getClientName(i.client_id), i.invoice_type, i.taxable_amount, i.gst_percent, i.gst_amount, i.total_amount, i.invoice_date, i.payment_status]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v || ""}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = `ApnaGhar_Invoices_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast("Exported!", "success");
}
