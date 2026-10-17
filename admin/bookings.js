// ============================================================
// ApnaGhar Admin — bookings.js
// Bookings for New Launch Projects AND individual properties.
// Website "Book Now" requests arrive here with status "Enquiry".
// ============================================================

let allBookings = [], filteredBookings = [];
let clientsCache = [], propertiesCache = [], agentsCache = [], projectsCache = [];
const QS = new URLSearchParams(location.search);

document.addEventListener("DOMContentLoaded", async () => {
  await loadDropdownData();
  await loadBookings();
  if (QS.get("project")) document.getElementById("bProjectFilter").value = QS.get("project");
  if (QS.get("new") === "1") openAddBookingModal(QS.get("project"), QS.get("property"));
  filterBookings();
});

async function loadDropdownData() {
  const [c, p, a, pj] = await Promise.all([API.admin.getClients(), API.getProperties({ limit: 1000 }), API.admin.getAgents(), API.admin.getNewProjects()]);
  clientsCache = c.success ? c.data : [];
  propertiesCache = p.success ? p.data : [];
  agentsCache = a.success ? a.data : [];
  projectsCache = pj.success ? pj.data : [];
  fillClientSelect();
  document.getElementById("bPropertyId").innerHTML = '<option value="">Select Property</option>' +
    propertiesCache.map(x => `<option value="${escapeHtml(x.property_id)}">${escapeHtml(x.title)} — ${escapeHtml(x.listing_type || "")} (${escapeHtml(x.status || "")})</option>`).join("");
  document.getElementById("bAgentId").innerHTML = '<option value="">Select Agent</option>' +
    agentsCache.map(x => `<option value="${escapeHtml(x.agent_id)}">${escapeHtml(x.full_name)}</option>`).join("");
  const projOpts = projectsCache.map(x => `<option value="${escapeHtml(x.project_id)}">${escapeHtml(x.project_name)}${x.location ? " — " + escapeHtml(x.location) : ""}</option>`).join("");
  document.getElementById("bProjectId").innerHTML = '<option value="">Select Project</option>' + projOpts;
  document.getElementById("bProjectFilter").innerHTML = '<option value="">All Projects</option>' + projOpts;
}

function fillClientSelect() {
  document.getElementById("bClientId").innerHTML = '<option value="">— New client (fill below) —</option>' +
    clientsCache.map(x => `<option value="${escapeHtml(x.client_id)}">${escapeHtml(x.full_name)} (${escapeHtml(x.mobile)})</option>`).join("");
}

const findBy = (list, key, id) => list.find(x => String(x[key]) === String(id));
const getProject = id => findBy(projectsCache, "project_id", id);
const getProp = id => findBy(propertiesCache, "property_id", id);
function custName(b) { const c = findBy(clientsCache, "client_id", b.client_id); return b.customer_name || (c ? c.full_name : b.client_id || "—"); }
function custMobile(b) { const c = findBy(clientsCache, "client_id", b.client_id); return b.customer_mobile || (c ? c.mobile : ""); }
function itemOf(b) {
  if (b.booking_for === "Project" || (b.project_id && !b.property_id)) {
    const p = getProject(b.project_id);
    return { type: "Project", title: p ? p.project_name : (b.project_id || "—"), img: p ? p.image1_url : "", rec: p };
  }
  const p = getProp(b.property_id);
  return { type: "Property", title: p ? p.title : (b.property_id || "—"), img: p ? p.image1_url : "", rec: p };
}

// ---- Form behaviour ----
function onBookingForChange() {
  const isProj = document.getElementById("bFor").value === "Project";
  document.getElementById("bProjectWrap").style.display = isProj ? "" : "none";
  document.getElementById("bPropertyWrap").style.display = isProj ? "none" : "";
  ["bConfigWrap", "bTowerWrap"].forEach(id => document.getElementById(id).style.display = isProj ? "" : "none");
  onBookingItemChange();
}

function onBookingItemChange() {
  const isProj = document.getElementById("bFor").value === "Project";
  const rec = isProj ? getProject(document.getElementById("bProjectId").value) : getProp(document.getElementById("bPropertyId").value);
  const preview = document.getElementById("bMediaPreview");
  if (!rec) { preview.classList.remove("show"); return; }
  if (isProj) {
    document.getElementById("bConfigList").innerHTML = String(rec.configurations || "").split(/[,/]/).map(s => s.trim()).filter(Boolean).map(s => `<option value="${escapeHtml(s)}">`).join("");
    const tok = document.getElementById("bTokenAmount");
    if (!tok.value && rec.booking_amount) tok.value = rec.booking_amount;
    document.getElementById("bMediaInfo").textContent = [rec.launch_status, rec.configurations, rec.price_from ? fmt(rec.price_from) + "+" : "", rec.available_units ? rec.available_units + " units left" : ""].filter(Boolean).join(" • ");
  } else {
    const tp = document.getElementById("bTotalPrice");
    if (!tp.value && rec.expected_price) tp.value = rec.expected_price;
    document.getElementById("bMediaInfo").textContent = [rec.bhk, rec.listing_type === "Rent" ? fmt(rec.expected_rent) + "/mo" : fmt(rec.expected_price), rec.status].filter(Boolean).join(" • ");
  }
  const imgs = [1, 2, 3, 4, 5, 6].map(i => rec["image" + i + "_url"]).filter(Boolean).map(getImageUrl);
  document.getElementById("bMediaGallery").innerHTML = imgs.map(src => `<img src="${escapeHtml(src)}" referrerpolicy="no-referrer" onclick="AGUpload.lightbox('${escapeHtml(src)}')" onerror="this.style.display='none'" />`).join("");
  document.getElementById("bMediaVideoWrap").innerHTML = buildVideoEmbedHtml(rec.video_url, "media-video-wrap");
  document.getElementById("bMediaEmpty").style.display = (!imgs.length && !rec.video_url) ? "block" : "none";
  preview.classList.add("show");
}

function onClientPick() {
  const c = findBy(clientsCache, "client_id", document.getElementById("bClientId").value);
  if (!c) return;
  document.getElementById("bCustName").value = c.full_name || "";
  document.getElementById("bCustMobile").value = c.mobile || "";
  document.getElementById("bCustEmail").value = c.email || "";
}

// ---- LOAD ----
async function loadBookings() {
  const result = await API.admin.getBookings();
  if (!result.success) {
    allBookings = [];
    document.getElementById("bookingsTbody").innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-light)">${escapeHtml(result.error || "Error loading bookings")}</td></tr>`;
    return;
  }
  allBookings = result.data || [];
  const live = allBookings.filter(b => b.booking_status !== "Cancelled" && b.booking_status !== "Refunded");
  document.getElementById("bTotal").textContent = allBookings.length;
  document.getElementById("bEnquiry").textContent = allBookings.filter(b => b.booking_status === "Enquiry").length;
  document.getElementById("bActive").textContent = allBookings.filter(b => b.booking_status === "Active").length;
  document.getElementById("bConverted").textContent = allBookings.filter(b => b.booking_status === "Converted").length;
  document.getElementById("bTokenTotal").textContent = fmt(live.filter(b => b.booking_status !== "Enquiry").reduce((s, b) => s + Number(b.token_amount || 0), 0));
  filterBookings();
}

function filterBookings() {
  const q = (document.getElementById("bSearch").value || "").toLowerCase();
  const status = document.getElementById("bStatusFilter").value;
  const type = document.getElementById("bTypeFilter").value;
  const proj = document.getElementById("bProjectFilter").value;
  filteredBookings = allBookings.filter(b => {
    const it = itemOf(b);
    const hay = [custName(b), custMobile(b), it.title, b.unit_no, b.configuration, b.booking_id].join(" ").toLowerCase();
    return (!q || hay.includes(q)) && (!status || b.booking_status === status) && (!type || it.type === type) && (!proj || String(b.project_id) === proj);
  });
  renderBookings();
}

function renderBookings() {
  const tbody = document.getElementById("bookingsTbody");
  const list = [...filteredBookings].sort((a, b) => String(b.created_at || b.booking_date || "").localeCompare(String(a.created_at || a.booking_date || "")));
  document.getElementById("bookingsFooterInfo").textContent = list.length ? `${list.length} bookings` : "No records";
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-light)">No bookings found. Click "New Booking" to add one.</td></tr>`; return; }
  tbody.innerHTML = list.map(b => {
    const it = itemOf(b), id = escapeHtml(b.booking_id), mob = custMobile(b);
    return `<tr>
      <td><img class="booking-thumb" src="${escapeHtml(getImageUrl(it.img))}" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'" />
        <span style="font-size:13px;font-weight:600;color:var(--navy)">${escapeHtml(it.title)}</span>
        <div style="font-size:11px;color:var(--text-light);margin-left:52px">${it.type === "Project" ? "🚀 New Launch" : "🏠 Property"} • ${id}</div></td>
      <td><div style="font-weight:600">${escapeHtml(custName(b))}</div><div style="font-size:11px"><a href="tel:${escapeHtml(mob)}">${escapeHtml(mob)}</a></div></td>
      <td style="font-size:12px">${escapeHtml([b.configuration, b.tower_wing && "Wing " + b.tower_wing, b.unit_no].filter(Boolean).join(" • ") || "—")}</td>
      <td><div style="font-weight:600">${fmt(b.total_price)}</div><div style="font-size:11px;color:var(--text-light)">Token ${fmt(b.token_amount)}</div></td>
      <td style="font-size:12px">${fmtDate(b.booking_date)}</td>
      <td style="font-size:12px">${escapeHtml(b.source || "Admin")}</td>
      <td>${statusBadge(b.booking_status)}</td>
      <td><div style="display:flex;gap:5px">
        <button class="btn btn-sm btn-primary btn-icon" onclick="editBooking('${id}')" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-outline btn-icon" onclick="printBooking('${id}')" title="Print booking receipt"><i class="fas fa-print"></i></button>
        ${mob ? `<a class="btn btn-sm btn-success btn-icon" target="_blank" title="WhatsApp" href="https://wa.me/91${String(mob).replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(`Hello ${custName(b)}, regarding your booking ${b.booking_id} for ${it.title} — Aura Synergy Realty Group`)}"><i class="fab fa-whatsapp"></i></a>` : ""}
        <button class="btn btn-sm btn-danger btn-icon" onclick="deleteBooking('${id}')" title="Delete"><i class="fas fa-trash"></i></button>
      </div></td></tr>`;
  }).join("");
}

// ---- ADD / EDIT ----
function setVal(id, v) { document.getElementById(id).value = v ?? ""; }

function openAddBookingModal(projectId, propertyId) {
  document.getElementById("bookingModalTitle").innerHTML = '<i class="fas fa-bookmark"></i> New Booking';
  ["editBookingId", "bProjectId", "bPropertyId", "bConfig", "bTower", "bUnit", "bClientId", "bCustName", "bCustMobile", "bCustEmail", "bAgentId", "bTotalPrice", "bTokenAmount", "bExpectedRegDate", "bPaymentMode", "bTxnRef", "bReceipt", "bDocument", "bNotes"].forEach(id => setVal(id, ""));
  setVal("bFor", typeof propertyId === "string" && propertyId ? "Property" : "Project");
  if (typeof projectId === "string") setVal("bProjectId", projectId);
  if (typeof propertyId === "string") setVal("bPropertyId", propertyId);
  setVal("bBookingDate", new Date().toISOString().split("T")[0]);
  setVal("bStatus", "Active"); setVal("bSource", "Admin");
  AGUpload.refresh();
  onBookingForChange();
  openModal("bookingModal");
}

function editBooking(id) {
  const b = findBy(allBookings, "booking_id", id); if (!b) return;
  document.getElementById("bookingModalTitle").innerHTML = `<i class="fas fa-edit"></i> Edit Booking <small style="font-weight:400;color:var(--text-light)">${escapeHtml(b.booking_id)}</small>`;
  setVal("editBookingId", b.booking_id);
  setVal("bFor", itemOf(b).type);
  setVal("bProjectId", b.project_id); setVal("bPropertyId", b.property_id);
  setVal("bConfig", b.configuration); setVal("bTower", b.tower_wing); setVal("bUnit", b.unit_no);
  setVal("bClientId", b.client_id); setVal("bCustName", custName(b)); setVal("bCustMobile", custMobile(b)); setVal("bCustEmail", b.customer_email);
  setVal("bAgentId", b.agent_id); setVal("bTotalPrice", b.total_price); setVal("bTokenAmount", b.token_amount);
  setVal("bBookingDate", String(b.booking_date || "").slice(0, 10)); setVal("bExpectedRegDate", String(b.expected_registration_date || "").slice(0, 10));
  setVal("bPaymentMode", b.payment_mode); setVal("bTxnRef", b.transaction_ref); setVal("bStatus", b.booking_status || "Active");
  setVal("bSource", b.source || "Admin"); setVal("bReceipt", b.receipt_url); setVal("bDocument", b.document_url); setVal("bNotes", b.notes);
  AGUpload.refresh();
  onBookingForChange();
  openModal("bookingModal");
}

async function saveBooking() {
  const v = id => document.getElementById(id).value.trim();
  const isProj = v("bFor") === "Project";
  if (isProj && !v("bProjectId")) return showToast("Project चुनें", "error");
  if (!isProj && !v("bPropertyId")) return showToast("Property चुनें", "error");
  if (!v("bCustName") || !/^\d{10}$/.test(v("bCustMobile").replace(/\D/g, "").slice(-10))) return showToast("Customer name और 10-digit mobile भरें", "error");
  if (v("bStatus") !== "Enquiry" && !v("bTokenAmount")) return showToast("Token Amount भरें (or set status Enquiry)", "error");

  const btn = document.getElementById("saveBookingBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  // Create client automatically if not selected
  let clientId = v("bClientId");
  if (!clientId) {
    const mob = v("bCustMobile").replace(/\D/g, "").slice(-10);
    const existing = clientsCache.find(c => String(c.mobile).replace(/\D/g, "").slice(-10) === mob);
    if (existing) clientId = existing.client_id;
    else {
      const cr = await API.admin.addClient({ full_name: v("bCustName"), mobile: mob, email: v("bCustEmail"), client_type: "Buyer", lead_source: v("bSource"), lead_status: "Booked" });
      if (cr.success) { clientId = cr.id; clientsCache.push({ client_id: cr.id, full_name: v("bCustName"), mobile: mob }); fillClientSelect(); }
    }
  }

  const id = v("editBookingId");
  const data = {
    booking_for: v("bFor"), project_id: isProj ? v("bProjectId") : "", property_id: isProj ? "" : v("bPropertyId"),
    configuration: isProj ? v("bConfig") : "", tower_wing: isProj ? v("bTower") : "", unit_no: v("bUnit"),
    client_id: clientId, customer_name: v("bCustName"), customer_mobile: v("bCustMobile").replace(/\D/g, "").slice(-10), customer_email: v("bCustEmail"),
    agent_id: v("bAgentId"), total_price: v("bTotalPrice"), token_amount: v("bTokenAmount"),
    booking_date: v("bBookingDate"), expected_registration_date: v("bExpectedRegDate"),
    payment_mode: v("bPaymentMode"), transaction_ref: v("bTxnRef"), booking_status: v("bStatus"), source: v("bSource"),
    receipt_url: v("bReceipt"), document_url: v("bDocument"), notes: v("bNotes"),
  };
  let result;
  if (id) { data.booking_id = id; result = await API.admin.updateBooking(data); }
  else result = await API.admin.addBooking(data);

  // Mark an individual property as Booked/Sold so the website shows the right status
  if (result.success && !isProj) {
    const p = getProp(data.property_id);
    const newStatus = data.booking_status === "Active" ? "Booked" : data.booking_status === "Converted" ? (p && p.listing_type === "Rent" ? "Rented" : "Sold") : null;
    if (p && newStatus && p.status !== newStatus) { await API.admin.updateProperty({ property_id: p.property_id, status: newStatus }); p.status = newStatus; }
  }

  btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Booking';
  if (result.success) {
    showToast(id ? "Booking updated — saved to Google Sheet" : `Booking created — ${result.id}`, "success");
    closeModal("bookingModal");
    loadBookings();
  } else showToast(result.error || "Error saving booking", "error");
}

function deleteBooking(id) {
  confirmDelete(id, async () => {
    const r = await API.admin.deleteBooking(id);
    if (r.success) { showToast("Booking deleted", "success"); loadBookings(); } else showToast(r.error || "Error", "error");
  });
}

// ---- PRINTABLE RECEIPT ----
function printBooking(id) {
  const b = findBy(allBookings, "booking_id", id); if (!b) return;
  const it = itemOf(b), C = CONFIG.COMPANY;
  const row = (k, v) => v ? `<tr><td>${k}</td><td><b>${escapeHtml(v)}</b></td></tr>` : "";
  const money = n => n ? "₹ " + Number(n).toLocaleString("en-IN") : "";
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>Booking ${escapeHtml(b.booking_id)}</title><style>
    body{font-family:Arial,sans-serif;max-width:720px;margin:30px auto;color:#222} h1{color:#1e3a5f;margin:0} .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #c9a84c;padding-bottom:12px}
    table{width:100%;border-collapse:collapse;margin-top:18px} td{padding:8px;border-bottom:1px solid #eee} td:first-child{color:#666;width:40%} .sig{display:flex;justify-content:space-between;margin-top:60px} .sig div{border-top:1px solid #999;padding-top:6px;width:40%;text-align:center;font-size:13px}
    @media print{button{display:none}}</style></head><body>
    <div class="hd"><div><h1>${escapeHtml(C.name)}</h1><div style="font-size:13px">${escapeHtml(C.address)} • ${escapeHtml(C.phone_display || C.phone)} • ${escapeHtml(C.email)}</div></div>
    <img src="${location.origin}/admin/images/logo-small.png" style="height:60px" onerror="this.remove()"></div>
    <h2 style="margin-top:20px">Booking Acknowledgement</h2>
    <table>${row("Booking ID", b.booking_id)}${row("Booking Date", b.booking_date)}${row(it.type === "Project" ? "Project" : "Property", it.title)}
    ${row("Configuration", b.configuration)}${row("Tower / Wing", b.tower_wing)}${row("Unit No.", b.unit_no)}
    ${row("Customer", custName(b))}${row("Mobile", custMobile(b))}${row("Email", b.customer_email)}
    ${row("Agreement Value", money(b.total_price))}${row("Token / Booking Amount", money(b.token_amount))}${row("Payment Mode", b.payment_mode)}${row("Transaction Ref.", b.transaction_ref)}
    ${row("Expected Registration", b.expected_registration_date)}${row("Status", b.booking_status)}${row("Notes", b.notes)}</table>
    <div class="sig"><div>Customer Signature</div><div>For ${escapeHtml(C.name)}</div></div>
    <p style="text-align:center;margin-top:30px"><button onclick="print()">Print / Save as PDF</button></p></body></html>`);
  w.document.close();
}
