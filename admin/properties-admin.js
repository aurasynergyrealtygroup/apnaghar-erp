// ============================================================
// ApnaGhar Admin — properties-admin.js
// ============================================================

let allProperties = [];
let filteredProperties = [];
let currentPropPage = 1;
let adminView = "table";
const PROP_PAGE_SIZE = 12;

document.addEventListener("DOMContentLoaded", loadAdminProperties);

// ---- LOAD ----
async function loadAdminProperties() {
  const result = await API.getProperties({ limit: 1000 });
  if (!result.success) { showToast("Error loading properties", "error"); return; }
  allProperties = result.data || [];

  // KPIs
  document.getElementById("pTotal").textContent  = allProperties.length;
  document.getElementById("pAvail").textContent  = allProperties.filter(p => p.status === "Available").length;
  document.getElementById("pRented").textContent = allProperties.filter(p => p.status === "Rented").length;
  document.getElementById("pSold").textContent   = allProperties.filter(p => p.status === "Sold").length;
  const totalValue = allProperties.reduce((s, p) => s + (Number(p.expected_price) || 0), 0);
  document.getElementById("pValue").textContent = fmt(totalValue);

  filterProperties();
}

// ---- FILTER ----
function filterProperties() {
  const q = document.getElementById("propSearch").value.toLowerCase();
  const listingType = document.getElementById("listingTypeFilter").value;
  const propType = document.getElementById("propTypeFilter").value;
  const status = document.getElementById("statusFilterP").value;

  filteredProperties = allProperties.filter(p => {
    const matchQ = !q || (p.title||"").toLowerCase().includes(q) || (p.property_code||"").toLowerCase().includes(q) || (p.city||"").toLowerCase().includes(q);
    const matchListing = !listingType || p.listing_type === listingType;
    const matchType = !propType || p.property_type === propType;
    const matchStatus = !status || p.status === status;
    return matchQ && matchListing && matchType && matchStatus;
  });

  currentPropPage = 1;
  renderProperties();
}

// ---- RENDER ----
function renderProperties() {
  const total = filteredProperties.length;
  const start = (currentPropPage - 1) * PROP_PAGE_SIZE;
  const page = filteredProperties.slice(start, start + PROP_PAGE_SIZE);

  if (adminView === "table") renderTableView(page, total);
  else renderCardView(page, total);

  document.getElementById("propsFooterInfo").textContent =
    total === 0 ? "No records" : `Showing ${start + 1}–${Math.min(start + PROP_PAGE_SIZE, total)} of ${total}`;
  renderPropPagination(total);
}

function renderTableView(page, total) {
  const tbody = document.getElementById("propsTbody");
  if (!total) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-light)"><i class="fas fa-search" style="font-size:28px;margin-bottom:8px;display:block"></i>No properties found</td></tr>`;
    return;
  }
  tbody.innerHTML = page.map(p => `
    <tr>
      <td><img src="${getImageUrl(p.image1_url)}" style="width:56px;height:42px;object-fit:cover;border-radius:6px" onerror="this.src='${CONFIG.CLOUDINARY.placeholder}'" /></td>
      <td>
        <div style="font-weight:600;color:var(--navy)">${p.title || "—"}</div>
        <div style="font-size:11px;color:var(--text-light)">${p.property_code || p.property_id} • ${p.city || ""}</div>
      </td>
      <td><span style="font-size:12px">${p.property_type || "—"}</span> ${statusBadge(p.listing_type === "Rent" ? "Followup" : "New").replace(/Followup|New/, p.listing_type)}</td>
      <td style="font-weight:600">${p.bhk || "—"}</td>
      <td><span style="font-size:12px">${p.carpet_area ? p.carpet_area + " sqft" : "—"}</span></td>
      <td style="font-weight:700;color:var(--navy)">${p.listing_type === "Rent" ? fmt(p.expected_rent) + "/mo" : fmt(p.expected_price)}</td>
      <td><span style="font-size:12px">${p.society_id || "—"}</span></td>
      <td>${statusBadge(p.status)}</td>
      <td>
        <div style="display:flex;gap:5px">
          <a href="../property-detail.html?id=${p.property_id}" target="_blank" class="btn btn-sm btn-outline btn-icon" title="View Live"><i class="fas fa-external-link-alt"></i></a>
          <button class="btn btn-sm btn-outline btn-icon" onclick="viewProperty('${p.property_id}')" title="Quick View"><i class="fas fa-eye"></i></button>
          <button class="btn btn-sm btn-primary btn-icon" onclick="editProperty('${p.property_id}')" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteProperty('${p.property_id}','${(p.title||"").replace(/'/g,"")}')" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join("");
}

function renderCardView(page, total) {
  const wrap = document.getElementById("cardViewWrap");
  if (!total) {
    wrap.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-light);grid-column:1/-1"><i class="fas fa-search" style="font-size:28px;margin-bottom:8px;display:block"></i>No properties found</div>`;
    return;
  }
  wrap.innerHTML = page.map(p => `
    <div class="admin-prop-card">
      <div class="apc-img">
        <img src="${getImageUrl(p.image1_url)}" onerror="this.src='${CONFIG.CLOUDINARY.placeholder}'" />
        <span class="apc-badge">${p.listing_type === "Rent" ? "भाडे" : "विक्री"}</span>
      </div>
      <div class="apc-body">
        <h4>${p.title || "—"}</h4>
        <p>${p.city || ""} ${p.bhk ? "• " + p.bhk : ""}</p>
        <div class="apc-price">${p.listing_type === "Rent" ? fmt(p.expected_rent) + "/mo" : fmt(p.expected_price)}</div>
        <div class="apc-footer">
          ${statusBadge(p.status)}
          <div style="display:flex;gap:5px">
            <button class="btn btn-sm btn-primary btn-icon" onclick="editProperty('${p.property_id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-danger btn-icon" onclick="deleteProperty('${p.property_id}','${(p.title||"").replace(/'/g,"")}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>
    </div>`).join("");
}

function renderPropPagination(total) {
  const pages = Math.ceil(total / PROP_PAGE_SIZE);
  const container = document.getElementById("propsPages");
  if (pages <= 1) { container.innerHTML = ""; return; }
  let html = "";
  for (let i = 1; i <= Math.min(pages, 7); i++) {
    html += `<button class="tbl-page-btn ${i === currentPropPage ? "active" : ""}" onclick="goToPropPage(${i})">${i}</button>`;
  }
  container.innerHTML = html;
}
function goToPropPage(p) { currentPropPage = p; renderProperties(); }

function setAdminView(v) {
  adminView = v;
  document.getElementById("vtTable").classList.toggle("active", v === "table");
  document.getElementById("vtCard").classList.toggle("active", v === "card");
  document.getElementById("tableViewWrap").style.display = v === "table" ? "" : "none";
  document.getElementById("cardViewWrap").style.display = v === "card" ? "grid" : "none";
  renderProperties();
}

// ---- FORM TABS ----
function switchFormTab(btn, tab) {
  document.querySelectorAll(".ftab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".ftab-content").forEach(c => c.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(`ftab-${tab}`).classList.add("active");
}

function togglePriceFields() {
  const isRent = document.getElementById("pListingType").value === "Rent";
  document.getElementById("saleFieldWrap").style.display = isRent ? "none" : "";
  document.getElementById("rentFieldWrap").style.display = isRent ? "" : "none";
  document.getElementById("depositFieldWrap").style.display = isRent ? "" : "none";
}

// ---- ADD / EDIT ----
function openAddModal() {
  document.getElementById("propModalTitle").innerHTML = '<i class="fas fa-plus"></i> Add New Property';
  document.getElementById("editPropId").value = "";
  document.getElementById("savePropBtn").innerHTML = '<i class="fas fa-save"></i> Save Property';
  clearPropForm();
  document.querySelector('.ftab').click();
  openModal("propModal");
}

function clearPropForm() {
  const fields = ["pCode","pTitle","pCarpetArea","pBuiltupArea","pFloor","pTotalFloors","pAddress","pSocietyId","pExpectedPrice","pExpectedRent","pDeposit","pImage1","pImage2","pImage3","pVideo","pDescription"];
  fields.forEach(id => document.getElementById(id).value = "");
  document.getElementById("pCity").value = "Pune";
  document.getElementById("pType").value = "Apartment";
  document.getElementById("pListingType").value = "Sale";
  document.getElementById("pBHK").value = "";
  document.getElementById("pFurnished").value = "Unfurnished";
  document.getElementById("pFacing").value = "";
  document.getElementById("pStatus").value = "Available";
  togglePriceFields();
}

function editProperty(id) {
  const p = allProperties.find(x => String(x.property_id) === String(id));
  if (!p) return;
  document.getElementById("propModalTitle").innerHTML = '<i class="fas fa-edit"></i> Edit Property';
  document.getElementById("editPropId").value = p.property_id;
  document.getElementById("savePropBtn").innerHTML = '<i class="fas fa-save"></i> Update Property';

  document.getElementById("pCode").value = p.property_code || "";
  document.getElementById("pTitle").value = p.title || "";
  document.getElementById("pType").value = p.property_type || "Apartment";
  document.getElementById("pListingType").value = p.listing_type || "Sale";
  document.getElementById("pBHK").value = p.bhk || "";
  document.getElementById("pFurnished").value = p.furnished_status || "Unfurnished";
  document.getElementById("pCarpetArea").value = p.carpet_area || "";
  document.getElementById("pBuiltupArea").value = p.builtup_area || "";
  document.getElementById("pFloor").value = p.floor || "";
  document.getElementById("pTotalFloors").value = p.total_floors || "";
  document.getElementById("pFacing").value = p.facing || "";
  document.getElementById("pCity").value = p.city || "Pune";
  document.getElementById("pAddress").value = p.address || "";
  document.getElementById("pSocietyId").value = p.society_id || "";
  document.getElementById("pStatus").value = p.status || "Available";
  document.getElementById("pExpectedPrice").value = p.expected_price || "";
  document.getElementById("pExpectedRent").value = p.expected_rent || "";
  document.getElementById("pDeposit").value = p.deposit_amount || "";
  document.getElementById("pImage1").value = p.image1_url || "";
  document.getElementById("pImage2").value = p.image2_url || "";
  document.getElementById("pImage3").value = p.image3_url || "";
  document.getElementById("pVideo").value = p.video_url || "";
  document.getElementById("pDescription").value = p.description || "";

  togglePriceFields();
  document.querySelector('.ftab').click();
  openModal("propModal");
}

async function saveProperty() {
  const title = document.getElementById("pTitle").value.trim();
  if (!title) { showToast("Title आवश्यक आहे", "error"); return; }

  const id = document.getElementById("editPropId").value;
  const data = {
    property_code: document.getElementById("pCode").value,
    title: title,
    property_type: document.getElementById("pType").value,
    listing_type: document.getElementById("pListingType").value,
    bhk: document.getElementById("pBHK").value,
    furnished_status: document.getElementById("pFurnished").value,
    carpet_area: document.getElementById("pCarpetArea").value,
    builtup_area: document.getElementById("pBuiltupArea").value,
    floor: document.getElementById("pFloor").value,
    total_floors: document.getElementById("pTotalFloors").value,
    facing: document.getElementById("pFacing").value,
    city: document.getElementById("pCity").value,
    address: document.getElementById("pAddress").value,
    society_id: document.getElementById("pSocietyId").value,
    status: document.getElementById("pStatus").value,
    expected_price: document.getElementById("pExpectedPrice").value,
    expected_rent: document.getElementById("pExpectedRent").value,
    deposit_amount: document.getElementById("pDeposit").value,
    image1_url: document.getElementById("pImage1").value,
    image2_url: document.getElementById("pImage2").value,
    image3_url: document.getElementById("pImage3").value,
    video_url: document.getElementById("pVideo").value,
    description: document.getElementById("pDescription").value,
  };

  const btn = document.getElementById("savePropBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  let result;
  if (id) { data.property_id = id; result = await API.admin.updateProperty(data); }
  else { result = await API.admin.addProperty(data); }

  btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Property';

  if (result.success) {
    showToast(id ? "Property updated!" : "Property added!", "success");
    closeModal("propModal");
    loadAdminProperties();
  } else {
    showToast(result.error || "Error saving property", "error");
  }
}

// ---- VIEW ----
function viewProperty(id) {
  const p = allProperties.find(x => String(x.property_id) === String(id));
  if (!p) return;
  document.getElementById("viewPropBody").innerHTML = `
    <img src="${getImageUrl(p.image1_url)}" style="width:100%;height:200px;object-fit:cover;border-radius:10px;margin-bottom:16px" onerror="this.src='${CONFIG.CLOUDINARY.placeholder}'" />
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      ${infoRow("Title", p.title)}
      ${infoRow("Code", p.property_code || p.property_id)}
      ${infoRow("Type", p.property_type)}
      ${infoRow("Listing", p.listing_type)}
      ${infoRow("BHK", p.bhk)}
      ${infoRow("Area", p.carpet_area ? p.carpet_area + " sqft" : "—")}
      ${infoRow("Price/Rent", p.listing_type === "Rent" ? fmt(p.expected_rent) + "/mo" : fmt(p.expected_price))}
      ${infoRow("Status", statusBadge(p.status))}
      ${infoRow("City", p.city)}
      ${infoRow("Facing", p.facing)}
    </div>
    <div style="margin-top:14px">${infoRow("Address", p.address)}</div>
  `;
  document.getElementById("editFromViewPropBtn").onclick = () => { closeModal("viewPropModal"); editProperty(id); };
  openModal("viewPropModal");
}

function infoRow(label, val) {
  return `<div><div style="font-size:11px;font-weight:600;color:var(--text-light);text-transform:uppercase;margin-bottom:4px">${label}</div><div style="font-size:14px;color:var(--navy)">${val || "—"}</div></div>`;
}

// ---- DELETE ----
async function deleteProperty(id, title) {
  confirmDelete(title || id, async () => {
    const result = await API.admin.deleteProperty(id);
    if (result.success) { showToast("Property deleted", "success"); loadAdminProperties(); }
    else showToast(result.error || "Error deleting", "error");
  });
}

// ---- EXPORT ----
function exportPropertiesCSV() {
  const headers = ["ID","Code","Title","Type","Listing","BHK","Area","Price","Rent","City","Status"];
  const rows = filteredProperties.map(p => [p.property_id, p.property_code, p.title, p.property_type, p.listing_type, p.bhk, p.carpet_area, p.expected_price, p.expected_rent, p.city, p.status]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v||""}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = "ApnaGhar_Properties.csv";
  a.click();
  showToast("CSV exported!", "success");
}
