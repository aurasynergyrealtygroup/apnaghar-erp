// ============================================================
// ApnaGhar Admin — work-requests.js
// ============================================================

let allWorkRequests = [], allAssignments = [], allSPs = [], propsCache = [];
let filteredWR = [], wrView = "table";

document.addEventListener("DOMContentLoaded", () => {
  loadAllData();
});

async function loadAllData() {
  const [wrRes, assignRes, spRes, propsRes] = await Promise.all([
    API.admin.getWorkRequests(),
    API.get({ action: "getWorkAssignments" }),
    API.admin.getServiceProviders(),
    API.getProperties({ limit: 500 }),
  ]);
  allWorkRequests = wrRes.success ? wrRes.data : [];
  allAssignments  = assignRes.success ? assignRes.data : [];
  allSPs          = spRes.success ? spRes.data : [];
  propsCache      = propsRes.success ? propsRes.data : [];

  // KPIs
  document.getElementById("wrTotal").textContent     = allWorkRequests.length;
  document.getElementById("wrOpen").textContent      = allWorkRequests.filter(w => w.status === "Open").length;
  document.getElementById("wrInProgress").textContent= allWorkRequests.filter(w => w.status === "In Progress").length;
  document.getElementById("wrCompleted").textContent = allWorkRequests.filter(w => w.status === "Completed").length;
  const totalCost = allAssignments.reduce((s,a) => s + Number(a.total_cost||0), 0);
  document.getElementById("wrTotalCost").textContent = fmt(totalCost);

  // Populate dropdowns
  document.getElementById("wrPropertyId").innerHTML = '<option value="">Select Property</option>' +
    propsCache.map(p => `<option value="${p.property_id}">${p.title}</option>`).join("");
  document.getElementById("aWorkRequestId").innerHTML = '<option value="">Select Work Request</option>' +
    allWorkRequests.filter(w => w.status !== "Completed").map(w => `<option value="${w.work_request_id}">${w.work_request_id} — ${w.work_type} (${getPropName(w.property_id)})</option>`).join("");
  document.getElementById("aServiceProviderId").innerHTML = '<option value="">Select Service Provider</option>' +
    allSPs.map(s => `<option value="${s.service_provider_id}">${s.company_name || s.contact_person} (${s.provider_type})</option>`).join("");

  filterWR();
  renderAssignments();
}

function getPropName(id) { const p = propsCache.find(x => String(x.property_id)===String(id)); return p ? p.title.slice(0,20) : id; }
function getSPName(id) { const s = allSPs.find(x => String(x.service_provider_id)===String(id)); return s ? (s.company_name || s.contact_person) : id; }

// ---- FILTER ----
function filterWR() {
  const q = document.getElementById("wrSearch")?.value.toLowerCase() || "";
  const status = document.getElementById("wrStatusFilter").value;
  const priority = document.getElementById("wrPriorityFilter").value;
  const type = document.getElementById("wrTypeFilter").value;

  filteredWR = allWorkRequests.filter(w => {
    const matchQ = !q || (w.work_request_id||"").toLowerCase().includes(q) || (w.work_type||"").toLowerCase().includes(q) || getPropName(w.property_id).toLowerCase().includes(q);
    return matchQ && (!status||w.status===status) && (!priority||w.priority===priority) && (!type||w.work_type===type);
  });
  renderWR();
}

// ---- RENDER ----
function renderWR() {
  if (wrView === "table") renderWRTable();
  else renderWRKanban();
}

function renderWRTable() {
  const tbody = document.getElementById("wrTbody");
  document.getElementById("wrFooterInfo").textContent = `${filteredWR.length} requests`;
  if (!filteredWR.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-light)">No work requests found</td></tr>`;
    return;
  }
  const sorted = [...filteredWR].sort((a,b) => {
    const order = { High:0, Medium:1, Low:2 };
    return (order[a.priority]||1) - (order[b.priority]||1);
  });
  tbody.innerHTML = sorted.map(w => `
    <tr>
      <td><span style="font-weight:700;color:var(--navy);font-size:12px">${w.work_request_id}</span></td>
      <td><span style="font-size:13px">${getPropName(w.property_id)}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="work-type-icon">${getWorkIcon(w.work_type)}</span>
          <span style="font-size:13px">${w.work_type||"—"}</span>
        </div>
      </td>
      <td>${priorityBadge(w.priority)}</td>
      <td><span style="font-size:12px">${w.requested_by||"—"}</span></td>
      <td style="font-weight:600;color:var(--navy)">${fmt(w.estimated_cost)}</td>
      <td>${statusBadge(w.status)}</td>
      <td><span style="font-size:12px;color:var(--text-light)">${fmtDate(w.request_date)}</span></td>
      <td>
        <div style="display:flex;gap:5px">
          ${w.status === "Open" ? `<button class="btn btn-sm btn-gold btn-icon" onclick="quickAssign('${w.work_request_id}')" title="Assign"><i class="fas fa-user-hard-hat"></i></button>` : ""}
          ${w.status !== "Completed" ? `<button class="btn btn-sm btn-success btn-icon" onclick="markWRComplete('${w.work_request_id}')" title="Complete"><i class="fas fa-check"></i></button>` : ""}
          <button class="btn btn-sm btn-primary btn-icon" onclick="editWorkRequest('${w.work_request_id}')" title="Edit"><i class="fas fa-edit"></i></button>
        </div>
      </td>
    </tr>`).join("");
}

function renderWRKanban() {
  const stages = ["Open","In Progress","Completed","Cancelled"];
  const ids = { "Open":"kanbanOpen","In Progress":"kanbanInProgress","Completed":"kanbanCompleted","Cancelled":"kanbanCancelled" };
  const counts = { "Open":"kOpen","In Progress":"kInProgress","Completed":"kCompleted","Cancelled":"kCancelled" };
  stages.forEach(stage => {
    const items = filteredWR.filter(w => w.status === stage);
    document.getElementById(counts[stage]).textContent = items.length;
    document.getElementById(ids[stage]).innerHTML = items.length
      ? items.map(w => `
          <div class="kanban-card" onclick="editWorkRequest('${w.work_request_id}')">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:11px;font-weight:700;color:var(--navy)">${w.work_request_id}</span>
              ${priorityBadge(w.priority)}
            </div>
            <div class="kc-client">${getWorkIcon(w.work_type)} ${w.work_type||"—"}</div>
            <div class="kc-note">${getPropName(w.property_id)}</div>
            <div class="kc-meta"><span><i class="fas fa-rupee-sign"></i> ${fmt(w.estimated_cost)}</span></div>
          </div>`).join("")
      : `<div style="text-align:center;padding:20px;color:var(--text-light);font-size:13px">—</div>`;
  });
}

function renderAssignments() {
  const tbody = document.getElementById("assignmentTbody");
  if (!allAssignments.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-light)">No assignments yet</td></tr>`;
    return;
  }
  tbody.innerHTML = allAssignments.slice().reverse().map(a => `
    <tr>
      <td><span style="font-weight:700;font-size:12px;color:var(--navy)">${a.assignment_id}</span></td>
      <td><span style="font-size:12px">${a.work_request_id}</span></td>
      <td><span style="font-size:13px;font-weight:600">${getSPName(a.service_provider_id)}</span></td>
      <td><span style="font-size:12px">${fmtDate(a.assigned_date)}</span></td>
      <td><span style="font-size:12px">${fmtDate(a.expected_completion_date)}</span></td>
      <td>${fmt(a.labour_cost)}</td>
      <td>${fmt(a.material_cost)}</td>
      <td style="font-weight:700;color:var(--navy)">${fmt(a.total_cost)}</td>
      <td>${statusBadge(a.work_status)}</td>
    </tr>`).join("");
}

// ---- VIEW TOGGLE ----
function setWRView(v) {
  wrView = v;
  document.getElementById("vtWRTable").classList.toggle("active", v==="table");
  document.getElementById("vtWRKanban").classList.toggle("active", v==="kanban");
  document.getElementById("wrTableWrap").style.display = v==="table" ? "" : "none";
  document.getElementById("wrKanbanWrap").style.display = v==="kanban" ? "" : "none";
  renderWR();
}

// ---- CRUD ----
function openAddWorkModal() {
  document.getElementById("workModalTitle").innerHTML = '<i class="fas fa-tools"></i> New Work Request';
  document.getElementById("editWorkId").value = "";
  document.getElementById("wrPropertyId").value = "";
  document.getElementById("wrRequestedBy").value = "Owner";
  document.getElementById("wrWorkType").value = "Electrical";
  document.getElementById("wrPriority").value = "Medium";
  document.getElementById("wrRequestDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("wrEstCost").value = "";
  document.getElementById("wrStatus").value = "Open";
  document.getElementById("wrApprovedBy").value = "";
  document.getElementById("wrDescription").value = "";
  openModal("workModal");
}

function editWorkRequest(id) {
  const w = allWorkRequests.find(x => String(x.work_request_id)===String(id));
  if (!w) return;
  document.getElementById("workModalTitle").innerHTML = '<i class="fas fa-edit"></i> Edit Work Request';
  document.getElementById("editWorkId").value = w.work_request_id;
  document.getElementById("wrPropertyId").value = w.property_id || "";
  document.getElementById("wrRequestedBy").value = w.requested_by || "Owner";
  document.getElementById("wrWorkType").value = w.work_type || "Electrical";
  document.getElementById("wrPriority").value = w.priority || "Medium";
  document.getElementById("wrRequestDate").value = w.request_date ? w.request_date.split("T")[0] : "";
  document.getElementById("wrEstCost").value = w.estimated_cost || "";
  document.getElementById("wrStatus").value = w.status || "Open";
  document.getElementById("wrApprovedBy").value = w.approved_by || "";
  document.getElementById("wrDescription").value = w.description || "";
  openModal("workModal");
}

async function saveWorkRequest() {
  const desc = document.getElementById("wrDescription").value.trim();
  const propId = document.getElementById("wrPropertyId").value;
  if (!desc || !propId) { showToast("Property आणि Description आवश्यक आहे", "error"); return; }

  const id = document.getElementById("editWorkId").value;
  const data = {
    property_id: propId,
    requested_by: document.getElementById("wrRequestedBy").value,
    work_type: document.getElementById("wrWorkType").value,
    priority: document.getElementById("wrPriority").value,
    request_date: document.getElementById("wrRequestDate").value,
    estimated_cost: document.getElementById("wrEstCost").value,
    status: document.getElementById("wrStatus").value,
    approved_by: document.getElementById("wrApprovedBy").value,
    description: desc,
  };

  const btn = document.getElementById("saveWorkBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  const result = id
    ? await API.admin.updateWorkRequest({ ...data, work_request_id: id })
    : await API.admin.addWorkRequest(data);
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save';

  if (result.success) { showToast(id ? "Updated!" : "Created!", "success"); closeModal("workModal"); loadAllData(); }
  else showToast(result.error || "Error", "error");
}

async function markWRComplete(id) {
  const result = await API.admin.updateWorkRequest({ work_request_id: id, status: "Completed" });
  if (result.success) { showToast("Marked complete!", "success"); loadAllData(); }
  else showToast("Error", "error");
}

function quickAssign(workId) {
  document.getElementById("aWorkRequestId").value = workId;
  document.getElementById("aAssignedDate").value = new Date().toISOString().split("T")[0];
  openAddAssignmentModal();
}

function openAddAssignmentModal() {
  if (!document.getElementById("aWorkRequestId").value) {
    document.getElementById("aWorkRequestId").value = "";
  }
  document.getElementById("aServiceProviderId").value = "";
  document.getElementById("aAssignedDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("aExpectedDate").value = "";
  document.getElementById("aLabourCost").value = "";
  document.getElementById("aMaterialCost").value = "";
  document.getElementById("aTotalCost").value = "";
  document.getElementById("aWorkStatus").value = "Assigned";
  openModal("assignModal");
}

function calcTotalCost() {
  const l = Number(document.getElementById("aLabourCost").value)||0;
  const m = Number(document.getElementById("aMaterialCost").value)||0;
  document.getElementById("aTotalCost").value = l + m;
}

async function saveAssignment() {
  const wrId = document.getElementById("aWorkRequestId").value;
  const spId = document.getElementById("aServiceProviderId").value;
  if (!wrId || !spId) { showToast("Work Request आणि Service Provider निवडा", "error"); return; }

  const btn = document.getElementById("saveAssignBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  const result = await API.post("addWorkAssignment", {
    work_request_id: wrId,
    service_provider_id: spId,
    assigned_date: document.getElementById("aAssignedDate").value,
    expected_completion_date: document.getElementById("aExpectedDate").value,
    labour_cost: document.getElementById("aLabourCost").value,
    material_cost: document.getElementById("aMaterialCost").value,
    total_cost: document.getElementById("aTotalCost").value,
    work_status: document.getElementById("aWorkStatus").value,
  });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Assign';

  if (result.success) { showToast("Work assigned!", "success"); closeModal("assignModal"); loadAllData(); }
  else showToast(result.error || "Error", "error");
}

// ---- HELPERS ----
function priorityBadge(p) {
  const map = { High:"badge-danger", Medium:"badge-warning", Low:"badge-success" };
  return `<span class="badge ${map[p]||"badge-info"}">${p||"—"}</span>`;
}
function getWorkIcon(type) {
  const icons = { Electrical:"⚡", Plumbing:"🔧", Cleaning:"🧹", Construction:"🏗", Repair:"🔨", Painting:"🎨", Carpentry:"🪚" };
  return icons[type] || "🔧";
}
