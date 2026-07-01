// ============================================================
// ApnaGhar Admin — site-visits.js
// ============================================================

let allVisits = [];
let filteredVisits = [];
let clientsCache = [];
let propertiesCache = [];
let agentsCache = [];

document.addEventListener("DOMContentLoaded", () => {
  loadVisits();
  loadDropdownData();
  renderWeekStrip();
});

async function loadDropdownData() {
  const [clientsRes, propsRes, agentsRes] = await Promise.all([
    API.admin.getClients(),
    API.getProperties({ limit: 500 }),
    API.admin.getAgents(),
  ]);
  clientsCache = clientsRes.success ? clientsRes.data : [];
  propertiesCache = propsRes.success ? propsRes.data : [];
  agentsCache = agentsRes.success ? agentsRes.data : [];

  document.getElementById("vClientId").innerHTML = '<option value="">Select Client</option>' +
    clientsCache.map(c => `<option value="${c.client_id}">${c.full_name} (${c.mobile})</option>`).join("");
  document.getElementById("vPropertyId").innerHTML = '<option value="">Select Property</option>' +
    propertiesCache.map(p => `<option value="${p.property_id}">${p.title}</option>`).join("");
  document.getElementById("vAgentId").innerHTML = '<option value="">Select Agent</option>' +
    agentsCache.map(a => `<option value="${a.agent_id}">${a.full_name}</option>`).join("");
}

function getClientName(id) { const c = clientsCache.find(x => String(x.client_id)===String(id)); return c ? c.full_name : `Client ${id}`; }
function getPropertyTitle(id) { const p = propertiesCache.find(x => String(x.property_id)===String(id)); return p ? p.title : id; }
function getAgentName(id) { const a = agentsCache.find(x => String(x.agent_id)===String(id)); return a ? a.full_name : (id ? `Agent ${id}` : "—"); }

// ---- LOAD ----
async function loadVisits() {
  const result = await API.admin.getSiteVisits();
  if (!result.success) { showToast("Error loading visits", "error"); return; }
  allVisits = result.data || [];

  const today = new Date(); today.setHours(0,0,0,0);
  document.getElementById("vToday").textContent = allVisits.filter(v => v.visit_date && isSameDay(new Date(v.visit_date), today)).length;
  document.getElementById("vScheduled").textContent = allVisits.filter(v => v.visit_status === "Scheduled").length;
  document.getElementById("vCompleted").textContent = allVisits.filter(v => v.visit_status === "Completed").length;
  document.getElementById("vCancelled").textContent = allVisits.filter(v => v.visit_status === "Cancelled").length;

  filterVisits();
}

function isSameDay(a, b) { return a.toDateString() === b.toDateString(); }

// ---- FILTER ----
function filterVisits() {
  const q = document.getElementById("vSearch").value.toLowerCase();
  const status = document.getElementById("vStatusFilter").value;

  filteredVisits = allVisits.filter(v => {
    const clientName = getClientName(v.client_id).toLowerCase();
    const propTitle = getPropertyTitle(v.asset_id || v.property_id).toLowerCase();
    const matchQ = !q || clientName.includes(q) || propTitle.includes(q);
    const matchStatus = !status || v.visit_status === status;
    return matchQ && matchStatus;
  });

  renderVisits();
}

// ---- RENDER ----
function renderVisits() {
  const tbody = document.getElementById("visitsTbody");
  const total = filteredVisits.length;
  document.getElementById("visitsFooterInfo").textContent = total === 0 ? "No records" : `${total} visits`;

  if (!total) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-light)">No site visits found</td></tr>`;
    return;
  }

  const sorted = [...filteredVisits].sort((a,b) => new Date(b.visit_date||0) - new Date(a.visit_date||0));

  tbody.innerHTML = sorted.map(v => `
    <tr>
      <td><div style="font-weight:600;color:var(--navy)">${getClientName(v.client_id)}</div></td>
      <td><span style="font-size:13px">${getPropertyTitle(v.asset_id || v.property_id)}</span></td>
      <td><span style="font-size:12px">${getAgentName(v.agent_id)}</span></td>
      <td><span style="font-size:12px">${fmtDate(v.visit_date)}</span></td>
      <td>${statusBadge(v.visit_status)}</td>
      <td><div style="font-size:12px;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-light)">${v.feedback || "—"}</div></td>
      <td>
        <div style="display:flex;gap:5px">
          ${v.visit_status === "Scheduled" ? `<button class="btn btn-sm btn-success btn-icon" onclick="markVisitComplete('${v.visit_id}')" title="Mark Complete"><i class="fas fa-check"></i></button>` : ""}
          <button class="btn btn-sm btn-primary btn-icon" onclick="editVisit('${v.visit_id}')" title="Edit"><i class="fas fa-edit"></i></button>
        </div>
      </td>
    </tr>`).join("");
}

// ---- WEEK STRIP ----
function renderWeekStrip() {
  const strip = document.getElementById("weekStrip");
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  strip.innerHTML = days.map(d => {
    const count = allVisits.filter(v => v.visit_date && isSameDay(new Date(v.visit_date), d)).length;
    const isToday = isSameDay(d, today);
    return `
      <div class="week-day ${isToday ? "today" : ""}">
        <div class="wd-name">${d.toLocaleDateString("en-IN", { weekday: "short" })}</div>
        <div class="wd-num">${d.getDate()}</div>
        ${count > 0 ? `<div class="wd-count">${count}</div>` : ""}
      </div>`;
  }).join("");
}

// ---- CRUD ----
function openAddVisitModal() {
  document.getElementById("visitModalTitle").innerHTML = '<i class="fas fa-car"></i> Schedule Site Visit';
  document.getElementById("editVisitId").value = "";
  document.getElementById("vClientId").value = "";
  document.getElementById("vPropertyId").value = "";
  document.getElementById("vAgentId").value = "";
  document.getElementById("vVisitDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("vStatus").value = "Scheduled";
  document.getElementById("vFeedback").value = "";
  document.getElementById("vNextFollowup").value = "";
  openModal("visitModal");
}

function editVisit(id) {
  const v = allVisits.find(x => String(x.visit_id) === String(id));
  if (!v) return;
  document.getElementById("visitModalTitle").innerHTML = '<i class="fas fa-edit"></i> Edit Site Visit';
  document.getElementById("editVisitId").value = v.visit_id;
  document.getElementById("vClientId").value = v.client_id || "";
  document.getElementById("vPropertyId").value = v.asset_id || v.property_id || "";
  document.getElementById("vAgentId").value = v.agent_id || "";
  document.getElementById("vVisitDate").value = v.visit_date ? v.visit_date.split("T")[0] : "";
  document.getElementById("vStatus").value = v.visit_status || "Scheduled";
  document.getElementById("vFeedback").value = v.feedback || "";
  document.getElementById("vNextFollowup").value = v.next_followup_date ? v.next_followup_date.split("T")[0] : "";
  openModal("visitModal");
}

async function saveVisit() {
  const clientId = document.getElementById("vClientId").value;
  const propertyId = document.getElementById("vPropertyId").value;
  if (!clientId || !propertyId) { showToast("Client आणि Property निवडा", "error"); return; }

  const id = document.getElementById("editVisitId").value;
  const data = {
    client_id: clientId,
    asset_id: propertyId,
    agent_id: document.getElementById("vAgentId").value,
    visit_date: document.getElementById("vVisitDate").value,
    visit_status: document.getElementById("vStatus").value,
    feedback: document.getElementById("vFeedback").value,
    next_followup_date: document.getElementById("vNextFollowup").value,
  };

  const btn = document.getElementById("saveVisitBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  let result;
  if (id) { data.visit_id = id; result = await API.post("updateSiteVisit", data); }
  else result = await API.admin.addSiteVisit(data);

  btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save';

  if (result.success) {
    showToast(id ? "Visit updated!" : "Visit scheduled!", "success");
    closeModal("visitModal");
    loadVisits();
    renderWeekStrip();
  } else {
    showToast(result.error || "Error saving", "error");
  }
}

async function markVisitComplete(id) {
  const result = await API.post("updateSiteVisit", { visit_id: id, visit_status: "Completed" });
  if (result.success) { showToast("Marked completed!", "success"); loadVisits(); }
  else showToast("Error updating", "error");
}
