// ============================================================
// ApnaGhar Admin — dashboard.js
// ============================================================

document.addEventListener("DOMContentLoaded", loadDashboard);

async function loadDashboard() {
  const icon = document.getElementById("refreshIcon");
  if (icon) { icon.style.animation = "spin 1s linear infinite"; }

  await Promise.all([
    loadKPIs(),
    loadRecentClients(),
    loadPendingFollowups(),
    loadRecentProperties(),
    loadRecentDeals(),
  ]);

  if (icon) icon.style.animation = "";
}

// ---- KPIs ----
async function loadKPIs() {
  const result = await API.getDashboard();
  if (!result.success) return;
  const d = result.data;

  setKPI("kTotal",      d.total_properties);
  setKPI("kAvail",      d.available_properties);
  setKPI("kRented",     d.rented_properties);
  setKPI("kClients",    d.total_clients);
  setKPI("kRentIncome", fmt(d.monthly_rent_income));
  setKPI("kDeals",      d.total_deals);
  setKPI("kLand",       d.total_land);
  setKPI("kFollowups",  d.pending_followups);

  // Nav badges
  const nf = document.getElementById("newClientsCount");
  const pf = document.getElementById("pendingFollowups");
  if (nf) nf.textContent = d.new_clients_this_month || 0;
  if (pf) pf.textContent = d.pending_followups || 0;

  // Status breakdown
  renderStatusBreakdown({
    Available: d.available_properties || 0,
    Rented:    d.rented_properties    || 0,
    Sold:      d.sold_properties      || 0,
  });
}

function setKPI(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? "—";
}

function renderStatusBreakdown(data) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const colors = { Available: "#27ae60", Rented: "#e67e22", Sold: "#2980b9" };
  const container = document.getElementById("statusBreakdown");
  if (!container) return;
  container.innerHTML = Object.entries(data).map(([label, val]) => {
    const pct = Math.round((val / total) * 100);
    return `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
          <span style="font-weight:600;color:var(--text)">${label}</span>
          <span style="color:var(--text-light)">${val} (${pct}%)</span>
        </div>
        <div style="background:var(--gray-200);border-radius:8px;height:8px;overflow:hidden">
          <div style="background:${colors[label]};width:${pct}%;height:100%;border-radius:8px;transition:width 0.8s ease"></div>
        </div>
      </div>`;
  }).join("");
}

// ---- RECENT CLIENTS ----
async function loadRecentClients() {
  const result = await API.admin.getClients();
  const tbody = document.getElementById("recentClientsTbody");
  if (!result.success || !result.data?.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-light)">No clients found</td></tr>`;
    return;
  }
  const recent = result.data.slice(-8).reverse();
  tbody.innerHTML = recent.map(c => `
    <tr>
      <td>
        <div style="font-weight:600;color:var(--navy)">${c.full_name || "—"}</div>
        <div style="font-size:11px;color:var(--text-light)">${c.email || ""}</div>
      </td>
      <td><a href="tel:${c.mobile}" style="color:var(--navy);font-weight:500">${c.mobile || "—"}</a></td>
      <td>${statusBadge(c.client_type)}</td>
      <td><span style="font-size:12px;color:var(--text-light)">${c.lead_source || "—"}</span></td>
      <td>${statusBadge(c.lead_status)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <a href="clients.html?id=${c.client_id}" class="btn btn-sm btn-outline btn-icon" title="View"><i class="fas fa-eye"></i></a>
          <a href="tel:${c.mobile}" class="btn btn-sm btn-success btn-icon" title="Call"><i class="fas fa-phone"></i></a>
          <a href="https://wa.me/91${c.mobile}" target="_blank" class="btn btn-sm btn-icon" style="background:#25D366;color:#fff" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>
        </div>
      </td>
    </tr>`).join("");
}

// ---- PENDING FOLLOWUPS ----
async function loadPendingFollowups() {
  const result = await API.admin.getFollowups();
  const container = document.getElementById("pendingFollowupsList");
  if (!result.success || !result.data?.length) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-light)"><i class="fas fa-check-circle" style="font-size:28px;color:var(--green);margin-bottom:8px;display:block"></i>No pending follow-ups!</div>`;
    return;
  }
  const pending = result.data.filter(f => f.followup_status === "Pending").slice(0, 6);
  if (!pending.length) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--green)"><i class="fas fa-check-circle"></i> All follow-ups done!</div>`;
    return;
  }
  container.innerHTML = pending.map(f => `
    <div style="display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--gray-100)">
      <div style="width:8px;height:8px;border-radius:50%;background:var(--orange);flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.discussion_note || "Follow-up"}</div>
        <div style="font-size:11px;color:var(--text-light);margin-top:2px">${fmtDate(f.next_followup_date)} • Client: ${f.client_id}</div>
      </div>
      <a href="followups.html" class="btn btn-sm btn-outline" style="flex-shrink:0">Done</a>
    </div>`).join("");
}

// ---- RECENT PROPERTIES ----
async function loadRecentProperties() {
  const result = await API.getProperties({ limit: 8 });
  const tbody = document.getElementById("recentPropsTbody");
  if (!result.success || !result.data?.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-light)">No properties found</td></tr>`;
    return;
  }
  const recent = result.data.slice(-8).reverse();
  tbody.innerHTML = recent.map(p => `
    <tr>
      <td>
        <div style="font-weight:600;color:var(--navy)">${p.title || "—"}</div>
        <div style="font-size:11px;color:var(--text-light)">${p.city || ""} ${p.address ? "• " + p.address.slice(0,30) : ""}</div>
      </td>
      <td><span style="font-size:12px">${p.property_type || "—"}</span></td>
      <td><span style="font-size:12px;font-weight:600">${p.bhk || "—"}</span></td>
      <td style="font-weight:700;color:var(--navy)">${p.listing_type === "Rent" ? fmt(p.expected_rent) + "/mo" : fmt(p.expected_price)}</td>
      <td>${statusBadge(p.status)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <a href="../property-detail.html?id=${p.property_id}" target="_blank" class="btn btn-sm btn-outline btn-icon" title="View"><i class="fas fa-eye"></i></a>
          <a href="properties.html?edit=${p.property_id}" class="btn btn-sm btn-primary btn-icon" title="Edit"><i class="fas fa-edit"></i></a>
        </div>
      </td>
    </tr>`).join("");
}

// ---- RECENT DEALS ----
async function loadRecentDeals() {
  const result = await API.admin.getSaleDeals();
  const container = document.getElementById("recentDealsList");
  if (!result.success || !result.data?.length) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-light)">No deals yet</div>`;
    return;
  }
  const recent = result.data.slice(-5).reverse();
  container.innerHTML = recent.map(d => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--gray-100)">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--navy)">${d.deal_id}</div>
        <div style="font-size:11px;color:var(--text-light)">${fmtDate(d.token_date)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:14px;font-weight:700;color:var(--navy)">${fmt(d.final_price)}</div>
        ${statusBadge(d.deal_status)}
      </div>
    </div>`).join("");
}

// CSS animation for refresh
const style = document.createElement("style");
style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
document.head.appendChild(style);
