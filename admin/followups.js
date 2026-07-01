// ============================================================
// ApnaGhar Admin — followups.js
// ============================================================

let allFollowups = [];
let filteredFollowups = [];
let allClientsCache = [];
let allAgentsCache = [];
let followupView = "list";

document.addEventListener("DOMContentLoaded", () => {
  loadFollowups();
  loadClientsForDropdown();
  loadAgentsForDropdown();

  // Pre-fill client if coming from clients.html?client=X
  const clientParam = new URLSearchParams(window.location.search).get("client");
  if (clientParam) setTimeout(() => openAddFollowupModal(clientParam), 600);
});

async function loadFollowups() {
  const result = await API.admin.getFollowups();
  if (!result.success) { showToast("Error loading follow-ups", "error"); return; }
  allFollowups = result.data || [];

  const today = new Date(); today.setHours(0,0,0,0);
  const pending = allFollowups.filter(f => f.followup_status === "Pending");
  const overdue = pending.filter(f => f.next_followup_date && new Date(f.next_followup_date) < today);
  const dueToday = pending.filter(f => f.next_followup_date && isSameDay(new Date(f.next_followup_date), today));

  document.getElementById("fPending").textContent = pending.length;
  document.getElementById("fOverdue").textContent = overdue.length;
  document.getElementById("fToday").textContent = dueToday.length;
  document.getElementById("fDone").textContent = allFollowups.filter(f => f.followup_status === "Done").length;

  filterFollowups();
}

function isSameDay(a, b) { return a.toDateString() === b.toDateString(); }

async function loadClientsForDropdown() {
  const result = await API.admin.getClients();
  if (!result.success) return;
  allClientsCache = result.data || [];
  const sel = document.getElementById("fClientId");
  sel.innerHTML = '<option value="">Select Client</option>' +
    allClientsCache.map(c => `<option value="${c.client_id}">${c.full_name} (${c.mobile})</option>`).join("");
}

async function loadAgentsForDropdown() {
  const result = await API.admin.getAgents();
  if (!result.success) return;
  allAgentsCache = result.data || [];
  const sel = document.getElementById("fAgentId");
  sel.innerHTML = '<option value="">Select Agent</option>' +
    allAgentsCache.map(a => `<option value="${a.agent_id}">${a.full_name}</option>`).join("");
}

function getClientName(id) {
  const c = allClientsCache.find(x => String(x.client_id) === String(id));
  return c ? c.full_name : `Client ${id}`;
}
function getAgentName(id) {
  const a = allAgentsCache.find(x => String(x.agent_id) === String(id));
  return a ? a.full_name : (id ? `Agent ${id}` : "—");
}

// ---- FILTER ----
function filterFollowups() {
  const q = document.getElementById("fSearch").value.toLowerCase();
  const status = document.getElementById("fStatusFilter").value;
  const dateF = document.getElementById("fDateFilter").value;
  const today = new Date(); today.setHours(0,0,0,0);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

  filteredFollowups = allFollowups.filter(f => {
    const clientName = getClientName(f.client_id).toLowerCase();
    const matchQ = !q || clientName.includes(q) || (f.discussion_note||"").toLowerCase().includes(q);
    const matchStatus = !status || f.followup_status === status;
    let matchDate = true;
    if (dateF === "overdue") matchDate = f.next_followup_date && new Date(f.next_followup_date) < today;
    else if (dateF === "today") matchDate = f.next_followup_date && isSameDay(new Date(f.next_followup_date), today);
    else if (dateF === "week") matchDate = f.next_followup_date && new Date(f.next_followup_date) >= today && new Date(f.next_followup_date) <= weekEnd;
    return matchQ && matchStatus && matchDate;
  });

  renderFollowups();
}

// ---- RENDER ----
function renderFollowups() {
  if (followupView === "list") renderListView();
  else renderKanbanView();
}

function renderListView() {
  const tbody = document.getElementById("followupsTbody");
  const total = filteredFollowups.length;
  document.getElementById("followupsFooterInfo").textContent = total === 0 ? "No records" : `${total} follow-ups`;

  if (!total) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-light)">No follow-ups found</td></tr>`;
    return;
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const sorted = [...filteredFollowups].sort((a,b) => new Date(b.followup_date||0) - new Date(a.followup_date||0));

  tbody.innerHTML = sorted.map(f => {
    const isOverdue = f.followup_status === "Pending" && f.next_followup_date && new Date(f.next_followup_date) < today;
    return `
    <tr style="${isOverdue ? 'background:#fef2f2' : ''}">
      <td>
        <div style="font-weight:600;color:var(--navy)">${getClientName(f.client_id)}</div>
      </td>
      <td><span style="font-size:12px">${getAgentName(f.agent_id)}</span></td>
      <td><div style="font-size:13px;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.discussion_note || "—"}</div></td>
      <td><span style="font-size:12px">${fmtDate(f.followup_date)}</span></td>
      <td>
        <span style="font-size:12px;${isOverdue ? 'color:var(--red);font-weight:700' : ''}">${fmtDate(f.next_followup_date)}</span>
        ${isOverdue ? '<div style="font-size:10px;color:var(--red);font-weight:600"><i class="fas fa-exclamation-triangle"></i> Overdue</div>' : ''}
      </td>
      <td>${statusBadge(f.followup_status)}</td>
      <td>
        <div style="display:flex;gap:5px">
          ${f.followup_status === "Pending" ? `<button class="btn btn-sm btn-success btn-icon" onclick="markDone('${f.followup_id}')" title="Mark Done"><i class="fas fa-check"></i></button>` : ""}
          <button class="btn btn-sm btn-primary btn-icon" onclick="editFollowup('${f.followup_id}')" title="Edit"><i class="fas fa-edit"></i></button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

function renderKanbanView() {
  const pending = filteredFollowups.filter(f => f.followup_status === "Pending");
  const done = filteredFollowups.filter(f => f.followup_status === "Done");

  document.getElementById("kPendingCount").textContent = pending.length;
  document.getElementById("kDoneCount").textContent = done.length;

  document.getElementById("kanbanPending").innerHTML = pending.map(f => kanbanCard(f)).join("") || emptyKanban();
  document.getElementById("kanbanDone").innerHTML = done.map(f => kanbanCard(f)).join("") || emptyKanban();
}

function kanbanCard(f) {
  const today = new Date(); today.setHours(0,0,0,0);
  const isOverdue = f.followup_status === "Pending" && f.next_followup_date && new Date(f.next_followup_date) < today;
  return `
    <div class="kanban-card ${isOverdue ? "overdue" : ""}">
      <div class="kc-client">${getClientName(f.client_id)}</div>
      <div class="kc-note">${f.discussion_note || "—"}</div>
      <div class="kc-meta">
        <span><i class="fas fa-calendar"></i> ${fmtDate(f.next_followup_date)}</span>
        <span><i class="fas fa-user-tie"></i> ${getAgentName(f.agent_id)}</span>
      </div>
      <div class="kc-actions">
        ${f.followup_status === "Pending" ? `<button class="btn btn-sm btn-success" onclick="markDone('${f.followup_id}')"><i class="fas fa-check"></i> Done</button>` : ""}
        <button class="btn btn-sm btn-outline" onclick="editFollowup('${f.followup_id}')"><i class="fas fa-edit"></i></button>
      </div>
    </div>`;
}

function emptyKanban() {
  return `<div style="text-align:center;padding:30px;color:var(--text-light);font-size:13px">कोणतेही records नाहीत</div>`;
}

function setFollowupView(v) {
  followupView = v;
  document.getElementById("vtList").classList.toggle("active", v === "list");
  document.getElementById("vtKanban").classList.toggle("active", v === "kanban");
  document.getElementById("listViewWrap").style.display = v === "list" ? "" : "none";
  document.getElementById("kanbanViewWrap").style.display = v === "kanban" ? "" : "none";
  document.getElementById("followupsFooterWrap").style.display = v === "list" ? "flex" : "none";
  renderFollowups();
}

// ---- CRUD ----
function openAddFollowupModal(prefillClientId) {
  document.getElementById("followupModalTitle").innerHTML = '<i class="fas fa-phone-alt"></i> Log Follow-up';
  document.getElementById("editFollowupId").value = "";
  document.getElementById("fClientId").value = prefillClientId || "";
  document.getElementById("fAgentId").value = "";
  document.getElementById("fFollowupDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("fNextDate").value = "";
  document.getElementById("fNote").value = "";
  document.getElementById("fStatus").value = "Pending";
  openModal("followupModal");
}

function editFollowup(id) {
  const f = allFollowups.find(x => String(x.followup_id) === String(id));
  if (!f) return;
  document.getElementById("followupModalTitle").innerHTML = '<i class="fas fa-edit"></i> Edit Follow-up';
  document.getElementById("editFollowupId").value = f.followup_id;
  document.getElementById("fClientId").value = f.client_id || "";
  document.getElementById("fAgentId").value = f.agent_id || "";
  document.getElementById("fFollowupDate").value = f.followup_date ? f.followup_date.split("T")[0] : "";
  document.getElementById("fNextDate").value = f.next_followup_date ? f.next_followup_date.split("T")[0] : "";
  document.getElementById("fNote").value = f.discussion_note || "";
  document.getElementById("fStatus").value = f.followup_status || "Pending";
  openModal("followupModal");
}

async function saveFollowup() {
  const clientId = document.getElementById("fClientId").value;
  const note = document.getElementById("fNote").value.trim();
  if (!clientId) { showToast("Client निवडा", "error"); return; }
  if (!note) { showToast("Discussion note आवश्यक आहे", "error"); return; }

  const id = document.getElementById("editFollowupId").value;
  const data = {
    client_id: clientId,
    agent_id: document.getElementById("fAgentId").value,
    followup_date: document.getElementById("fFollowupDate").value,
    next_followup_date: document.getElementById("fNextDate").value,
    discussion_note: note,
    followup_status: document.getElementById("fStatus").value,
  };

  const btn = document.getElementById("saveFollowupBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  let result;
  if (id) { data.followup_id = id; result = await API.post("updateFollowup", data); }
  else result = await API.admin.addFollowup(data);

  btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save';

  if (result.success) {
    showToast(id ? "Follow-up updated!" : "Follow-up logged!", "success");
    closeModal("followupModal");
    loadFollowups();
  } else {
    showToast(result.error || "Error saving", "error");
  }
}

async function markDone(id) {
  const result = await API.post("updateFollowup", { followup_id: id, followup_status: "Done" });
  if (result.success) { showToast("Marked as done!", "success"); loadFollowups(); }
  else showToast("Error updating", "error");
}
