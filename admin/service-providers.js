// ============================================================
// ApnaGhar Admin — service-providers.js
// ============================================================

let allSPs = [], filteredSPs = [], spView = "table";

document.addEventListener("DOMContentLoaded", loadSPs);

async function loadSPs() {
  const result = await API.admin.getServiceProviders();
  if (!result.success) { showToast("Error loading", "error"); return; }
  allSPs = result.data || [];

  document.getElementById("spTotal").textContent   = allSPs.length;
  document.getElementById("spActive").textContent  = allSPs.filter(s => s.status === "Active").length;
  const ratings = allSPs.map(s => Number(s.rating)||0).filter(r => r>0);
  document.getElementById("spAvgRating").textContent = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1)+"★" : "—";
  document.getElementById("spElectrical").textContent = allSPs.filter(s => s.provider_type === "Wireman").length;
  document.getElementById("spPlumber").textContent    = allSPs.filter(s => s.provider_type === "Plumber").length;

  filterSP();
}

function filterSP() {
  const q = document.getElementById("spSearch").value.toLowerCase();
  const type = document.getElementById("spTypeFilter").value;
  const status = document.getElementById("spStatusFilter").value;
  filteredSPs = allSPs.filter(s => {
    const matchQ = !q || (s.company_name||"").toLowerCase().includes(q) || (s.contact_person||"").toLowerCase().includes(q) || (s.mobile||"").includes(q);
    return matchQ && (!type||s.provider_type===type) && (!status||s.status===status);
  });
  renderSPs();
}

function renderSPs() {
  document.getElementById("spFooterInfo").textContent = `${filteredSPs.length} providers`;
  if (spView === "table") renderSPTable();
  else renderSPCards();
}

function renderSPTable() {
  const tbody = document.getElementById("spTbody");
  if (!filteredSPs.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-light)">No providers found</td></tr>`;
    return;
  }
  tbody.innerHTML = filteredSPs.map(s => `
    <tr>
      <td>
        <div style="font-weight:600;color:var(--navy)">${s.company_name || s.contact_person}</div>
        <div style="font-size:11px;color:var(--text-light)">${s.contact_person || ""}</div>
      </td>
      <td><span class="badge badge-navy">${s.provider_type||"—"}</span></td>
      <td><a href="tel:${s.mobile}" style="font-weight:600;color:var(--navy)">${s.mobile||"—"}</a></td>
      <td><span style="font-size:12px">${s.city||"—"}</span></td>
      <td>${renderStars(s.rating)}</td>
      <td><span style="font-size:11px;color:var(--text-light)">${s.gst_no||"—"}</span></td>
      <td>${statusBadge(s.status)}</td>
      <td>
        <div style="display:flex;gap:5px">
          <button class="btn btn-sm btn-primary btn-icon" onclick="editSP('${s.service_provider_id}')" title="Edit"><i class="fas fa-edit"></i></button>
          <a href="tel:${s.mobile}" class="btn btn-sm btn-success btn-icon" title="Call"><i class="fas fa-phone"></i></a>
          <a href="https://wa.me/91${s.mobile}" target="_blank" class="btn btn-sm btn-icon" style="background:#25D366;color:#fff" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>
        </div>
      </td>
    </tr>`).join("");
}

function renderSPCards() {
  const grid = document.getElementById("spCardsGrid");
  if (!filteredSPs.length) { grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-light)">No providers found</div>`; return; }
  grid.innerHTML = filteredSPs.map(s => `
    <div class="sp-card">
      <div class="sp-card-top">
        <div class="sp-avatar">${getTypeEmoji(s.provider_type)}</div>
        <div class="sp-card-info">
          <div class="sp-card-name">${s.company_name || s.contact_person}</div>
          <div class="sp-card-type">${s.provider_type}</div>
          <div class="sp-card-rating">${renderStars(s.rating)}</div>
        </div>
        ${statusBadge(s.status)}
      </div>
      <div class="sp-card-details">
        <div class="sp-detail"><i class="fas fa-phone"></i> ${s.mobile||"—"}</div>
        <div class="sp-detail"><i class="fas fa-map-marker-alt"></i> ${s.city||"—"}</div>
        ${s.gst_no ? `<div class="sp-detail"><i class="fas fa-file-invoice"></i> ${s.gst_no}</div>` : ""}
      </div>
      <div class="sp-card-actions">
        <a href="tel:${s.mobile}" class="btn btn-sm btn-success"><i class="fas fa-phone"></i> Call</a>
        <a href="https://wa.me/91${s.mobile}" target="_blank" class="btn btn-sm" style="background:#25D366;color:#fff"><i class="fab fa-whatsapp"></i></a>
        <button class="btn btn-sm btn-primary" onclick="editSP('${s.service_provider_id}')"><i class="fas fa-edit"></i> Edit</button>
      </div>
    </div>`).join("");
}

function setSPView(v) {
  spView = v;
  document.getElementById("vtSPTable").classList.toggle("active", v==="table");
  document.getElementById("vtSPCard").classList.toggle("active", v==="card");
  document.getElementById("spTableWrap").style.display = v==="table" ? "" : "none";
  document.getElementById("spCardWrap").style.display = v==="card" ? "" : "none";
  renderSPs();
}

// ---- CRUD ----
function openAddSPModal() {
  document.getElementById("spModalTitle").innerHTML = '<i class="fas fa-hard-hat"></i> Add Service Provider';
  document.getElementById("editSPId").value = "";
  ["spCompany","spContact","spMobile","spAltMobile","spEmail","spPAN","spGST","spBank","spIFSC","spAddress","spRating"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("spCity").value = "Pune";
  document.getElementById("spType").value = "Wireman";
  document.getElementById("spStatus").value = "Active";
  openModal("spModal");
}

function editSP(id) {
  const s = allSPs.find(x => String(x.service_provider_id)===String(id));
  if (!s) return;
  document.getElementById("spModalTitle").innerHTML = '<i class="fas fa-edit"></i> Edit Service Provider';
  document.getElementById("editSPId").value = s.service_provider_id;
  document.getElementById("spType").value = s.provider_type || "Wireman";
  document.getElementById("spCompany").value = s.company_name || "";
  document.getElementById("spContact").value = s.contact_person || "";
  document.getElementById("spMobile").value = s.mobile || "";
  document.getElementById("spAltMobile").value = s.alternate_mobile || "";
  document.getElementById("spEmail").value = s.email || "";
  document.getElementById("spPAN").value = s.pan_no || "";
  document.getElementById("spGST").value = s.gst_no || "";
  document.getElementById("spCity").value = s.city || "Pune";
  document.getElementById("spRating").value = s.rating || "";
  document.getElementById("spBank").value = s.bank_account || "";
  document.getElementById("spIFSC").value = s.ifsc || "";
  document.getElementById("spAddress").value = s.address || "";
  document.getElementById("spStatus").value = s.status || "Active";
  openModal("spModal");
}

async function saveSP() {
  const contact = document.getElementById("spContact").value.trim();
  const mobile = document.getElementById("spMobile").value.trim();
  if (!contact || !mobile) { showToast("Contact Person आणि Mobile आवश्यक आहे", "error"); return; }

  const id = document.getElementById("editSPId").value;
  const data = {
    provider_type: document.getElementById("spType").value,
    company_name: document.getElementById("spCompany").value,
    contact_person: contact, mobile, 
    alternate_mobile: document.getElementById("spAltMobile").value,
    email: document.getElementById("spEmail").value,
    pan_no: document.getElementById("spPAN").value,
    gst_no: document.getElementById("spGST").value,
    city: document.getElementById("spCity").value,
    rating: document.getElementById("spRating").value,
    bank_account: document.getElementById("spBank").value,
    ifsc: document.getElementById("spIFSC").value,
    address: document.getElementById("spAddress").value,
    status: document.getElementById("spStatus").value,
  };

  const btn = document.getElementById("saveSPBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  const result = id
    ? await API.post("updateServiceProvider", { ...data, service_provider_id: id })
    : await API.post("addServiceProvider", data);
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Provider';

  if (result.success) { showToast(id ? "Updated!" : "Provider added!", "success"); closeModal("spModal"); loadSPs(); }
  else showToast(result.error || "Error", "error");
}

function exportSPCSV() {
  const headers = ["ID","Type","Company","Contact","Mobile","City","Rating","GST","Status"];
  const rows = filteredSPs.map(s => [s.service_provider_id, s.provider_type, s.company_name, s.contact_person, s.mobile, s.city, s.rating, s.gst_no, s.status]);
  const csv = [headers,...rows].map(r => r.map(v=>`"${v||""}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = "ApnaGhar_ServiceProviders.csv";
  a.click();
  showToast("Exported!", "success");
}

// ---- HELPERS ----
function renderStars(rating) {
  const r = Number(rating) || 0;
  const full = Math.floor(r), half = r % 1 >= 0.5;
  let html = "";
  for (let i = 0; i < full; i++) html += `<i class="fas fa-star" style="color:#f39c12;font-size:12px"></i>`;
  if (half) html += `<i class="fas fa-star-half-alt" style="color:#f39c12;font-size:12px"></i>`;
  for (let i = full + (half?1:0); i < 5; i++) html += `<i class="far fa-star" style="color:#ccc;font-size:12px"></i>`;
  return `<span>${html} <span style="font-size:11px;color:var(--text-light)">${r||"—"}</span></span>`;
}

function getTypeEmoji(type) {
  const map = { Wireman:"⚡", Plumber:"🔧", Builder:"🏗", Contractor:"👷", Cleaning:"🧹", Painter:"🎨", Carpenter:"🪚" };
  return map[type] || "🔨";
}
