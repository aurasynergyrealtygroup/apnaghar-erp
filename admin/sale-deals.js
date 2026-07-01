// ============================================================
// ApnaGhar Admin — sale-deals.js
// ============================================================

let allDeals = [];
let filteredDeals = [];
let propsCache = [];
let clientsCacheD = [];

document.addEventListener("DOMContentLoaded", () => {
  loadDeals();
  loadDropdowns();
});

async function loadDropdowns() {
  const [propsRes, clientsRes] = await Promise.all([
    API.getProperties({ listing_type: "Sale", limit: 500 }),
    API.admin.getClients(),
  ]);
  propsCache = propsRes.success ? propsRes.data : [];
  clientsCacheD = clientsRes.success ? clientsRes.data : [];

  document.getElementById("sdPropertyId").innerHTML = '<option value="">Select Property</option>' +
    propsCache.map(p => `<option value="${p.property_id}" data-price="${p.expected_price}">${p.title} — ${fmt(p.expected_price)}</option>`).join("");
  document.getElementById("sdClientId").innerHTML = '<option value="">Select Client</option>' +
    clientsCacheD.map(c => `<option value="${c.client_id}">${c.full_name} (${c.mobile})</option>`).join("");
}

function getPropertyTitleD(id) { const p = propsCache.find(x => String(x.property_id)===String(id)); return p ? p.title : id; }
function getClientNameD(id) { const c = clientsCacheD.find(x => String(x.client_id)===String(id)); return c ? c.full_name : `Client ${id}`; }

function autoFillOfferedPrice() {
  const sel = document.getElementById("sdPropertyId");
  const opt = sel.options[sel.selectedIndex];
  const price = opt?.dataset.price;
  if (price) {
    document.getElementById("sdOfferedPrice").value = price;
    document.getElementById("sdFinalPrice").value = price;
    calcCommission();
  }
}

function calcCommission() {
  const finalPrice = Number(document.getElementById("sdFinalPrice").value) || 0;
  const pct = Number(document.getElementById("sdCommissionPct").value) || 0;
  const amt = Math.round((finalPrice * pct) / 100);
  document.getElementById("sdCommissionAmt").value = amt;

  const preview = document.getElementById("commissionPreview");
  if (finalPrice && pct) {
    preview.innerHTML = `
      <div style="background:var(--bg);border-radius:8px;padding:14px 16px;margin-top:8px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;color:var(--text-light)">Commission (${pct}% of ${fmt(finalPrice)})</span>
        <strong style="font-size:18px;color:var(--navy)">${fmt(amt)}</strong>
      </div>`;
  } else preview.innerHTML = "";
}

// ---- LOAD ----
async function loadDeals() {
  const result = await API.admin.getSaleDeals();
  if (!result.success) { showToast("Error loading deals", "error"); return; }
  allDeals = result.data || [];

  document.getElementById("sdTotal").textContent = allDeals.length;
  document.getElementById("sdNegotiation").textContent = allDeals.filter(d => d.deal_status === "Negotiation").length;
  document.getElementById("sdTokenDone").textContent = allDeals.filter(d => d.deal_status === "Token Done").length;
  document.getElementById("sdRegistered").textContent = allDeals.filter(d => d.deal_status === "Registered").length;
  const totalComm = allDeals.reduce((s,d) => s + (Number(d.commission_amount)||0), 0);
  document.getElementById("sdCommission").textContent = fmt(totalComm);

  renderPipeline();
  filterDeals();
}

// ---- PIPELINE ----
function renderPipeline() {
  const stages = ["Negotiation", "Token Done", "Registered", "Cancelled"];
  const colors = { "Negotiation": "var(--purple)", "Token Done": "var(--blue)", "Registered": "var(--green)", "Cancelled": "var(--red)" };
  const board = document.getElementById("pipelineBoard");

  board.innerHTML = stages.map(stage => {
    const deals = allDeals.filter(d => d.deal_status === stage);
    const total = deals.reduce((s,d) => s + (Number(d.final_price)||0), 0);
    return `
      <div class="pipeline-col">
        <div class="pipeline-col-header" style="border-top:3px solid ${colors[stage]}">
          <span>${stage}</span>
          <span class="kc-count">${deals.length}</span>
        </div>
        <div class="pipeline-value">${fmt(total)}</div>
        <div class="pipeline-cards">
          ${deals.slice(0,4).map(d => `
            <div class="pipeline-card" onclick="editDeal('${d.deal_id}')">
              <div class="pc-id">${d.deal_id}</div>
              <div class="pc-prop">${getPropertyTitleD(d.property_id).slice(0,28)}</div>
              <div class="pc-price">${fmt(d.final_price)}</div>
            </div>`).join("")}
          ${deals.length > 4 ? `<div style="text-align:center;font-size:11px;color:var(--text-light);padding:6px">+${deals.length-4} more</div>` : ""}
        </div>
      </div>`;
  }).join("");
}

// ---- FILTER ----
function filterDeals() {
  const q = document.getElementById("sdSearch").value.toLowerCase();
  const status = document.getElementById("sdStatusFilter").value;

  filteredDeals = allDeals.filter(d => {
    const propTitle = getPropertyTitleD(d.property_id).toLowerCase();
    const matchQ = !q || (d.deal_id||"").toLowerCase().includes(q) || propTitle.includes(q);
    const matchStatus = !status || d.deal_status === status;
    return matchQ && matchStatus;
  });

  renderDeals();
}

// ---- RENDER ----
function renderDeals() {
  const tbody = document.getElementById("dealsTbody");
  const total = filteredDeals.length;
  document.getElementById("dealsFooterInfo").textContent = total === 0 ? "No records" : `${total} deals`;

  if (!total) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-light)">No deals found</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredDeals.map(d => `
    <tr>
      <td><div style="font-weight:700;color:var(--navy)">${d.deal_id}</div></td>
      <td><span style="font-size:13px">${getPropertyTitleD(d.property_id)}</span></td>
      <td><span style="font-size:13px">${getClientNameD(d.client_id)}</span></td>
      <td style="font-weight:700;color:var(--navy)">${fmt(d.final_price)}</td>
      <td><span style="font-size:13px">${fmt(d.token_amount)}</span></td>
      <td><span style="font-size:13px;color:var(--green);font-weight:600">${fmt(d.commission_amount)}</span></td>
      <td>${statusBadge(d.deal_status)}</td>
      <td>
        <div style="display:flex;gap:5px">
          <button class="btn btn-sm btn-primary btn-icon" onclick="editDeal('${d.deal_id}')" title="Edit"><i class="fas fa-edit"></i></button>
        </div>
      </td>
    </tr>`).join("");
}

// ---- CRUD ----
function openAddDealModal() {
  document.getElementById("dealModalTitle").innerHTML = '<i class="fas fa-handshake"></i> New Sale Deal';
  document.getElementById("editDealId").value = "";
  document.getElementById("sdPropertyId").value = "";
  document.getElementById("sdClientId").value = "";
  document.getElementById("sdOfferedPrice").value = "";
  document.getElementById("sdFinalPrice").value = "";
  document.getElementById("sdTokenAmount").value = "";
  document.getElementById("sdTokenDate").value = "";
  document.getElementById("sdRegDate").value = "";
  document.getElementById("sdStatus").value = "Negotiation";
  document.getElementById("sdCommissionPct").value = "2";
  document.getElementById("sdCommissionAmt").value = "";
  document.getElementById("commissionPreview").innerHTML = "";
  openModal("dealModal");
}

function editDeal(id) {
  const d = allDeals.find(x => String(x.deal_id) === String(id));
  if (!d) return;
  document.getElementById("dealModalTitle").innerHTML = '<i class="fas fa-edit"></i> Edit Deal';
  document.getElementById("editDealId").value = d.deal_id;
  document.getElementById("sdPropertyId").value = d.property_id || "";
  document.getElementById("sdClientId").value = d.client_id || "";
  document.getElementById("sdOfferedPrice").value = d.offered_price || "";
  document.getElementById("sdFinalPrice").value = d.final_price || "";
  document.getElementById("sdTokenAmount").value = d.token_amount || "";
  document.getElementById("sdTokenDate").value = d.token_date ? d.token_date.split("T")[0] : "";
  document.getElementById("sdRegDate").value = d.registration_date ? d.registration_date.split("T")[0] : "";
  document.getElementById("sdStatus").value = d.deal_status || "Negotiation";
  document.getElementById("sdCommissionPct").value = d.commission_percent || "2";
  calcCommission();
  openModal("dealModal");
}

async function saveDeal() {
  const propertyId = document.getElementById("sdPropertyId").value;
  const clientId = document.getElementById("sdClientId").value;
  const finalPrice = document.getElementById("sdFinalPrice").value;
  if (!propertyId || !clientId || !finalPrice) { showToast("सर्व required fields भरा", "error"); return; }

  const id = document.getElementById("editDealId").value;
  const data = {
    property_id: propertyId,
    client_id: clientId,
    offered_price: document.getElementById("sdOfferedPrice").value,
    final_price: finalPrice,
    token_amount: document.getElementById("sdTokenAmount").value,
    token_date: document.getElementById("sdTokenDate").value,
    registration_date: document.getElementById("sdRegDate").value,
    deal_status: document.getElementById("sdStatus").value,
    commission_percent: document.getElementById("sdCommissionPct").value,
    commission_amount: document.getElementById("sdCommissionAmt").value,
  };

  const btn = document.getElementById("saveDealBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  let result;
  if (id) { data.deal_id = id; result = await API.admin.updateSaleDeal(data); }
  else result = await API.admin.addSaleDeal(data);

  btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Deal';

  if (result.success) {
    showToast(id ? "Deal updated!" : "Deal created!", "success");
    closeModal("dealModal");
    loadDeals();
  } else {
    showToast(result.error || "Error saving", "error");
  }
}

// ---- EXPORT ----
function exportDealsCSV() {
  const headers = ["Deal ID","Property","Client","Offered","Final Price","Token","Commission %","Commission Amt","Status"];
  const rows = filteredDeals.map(d => [d.deal_id, getPropertyTitleD(d.property_id), getClientNameD(d.client_id), d.offered_price, d.final_price, d.token_amount, d.commission_percent, d.commission_amount, d.deal_status]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v||""}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = "ApnaGhar_SaleDeals.csv";
  a.click();
  showToast("CSV exported!", "success");
}
