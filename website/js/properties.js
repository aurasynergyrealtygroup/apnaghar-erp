// ============================================================
// ApnaGhar — properties.js
// Filtering, Sorting, Search, Pagination
// ============================================================

// ---- STATE ----
const STATE = {
  allProperties: [],   // full dataset from API
  filtered: [],        // after client-side filters
  currentPage: 1,
  pageSize: 12,
  view: "grid",
  searchTimer: null,
  selectedBHK: "",
  activeFilters: {},
};

// ---- INIT ----
document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  readURLParams();
  loadProperties();
});

function initNavbar() {
  const hamburger = document.getElementById("hamburger");
  const navLinks  = document.getElementById("navLinks");
  hamburger?.addEventListener("click", () => {
    navLinks.classList.toggle("open");
    hamburger.classList.toggle("active");
  });
}

// Read URL params and pre-set filters
function readURLParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.get("listing_type")) {
    document.querySelector(`input[name="listingType"][value="${p.get("listing_type")}"]`)?.click();
  }
  if (p.get("type")) {
    const cb = document.querySelector(`input[type="checkbox"][value="${p.get("type")}"]`);
    if (cb) { cb.checked = true; }
  }
  if (p.get("bhk")) selectBHK(document.querySelector(`[data-bhk="${p.get("bhk")}"]`), p.get("bhk"));
  if (p.get("q")) document.getElementById("searchInput").value = p.get("q");
}

// ---- LOAD DATA FROM API ----
async function loadProperties() {
  const grid = document.getElementById("propertiesGrid");
  showSkeletons(grid);

  const result = await API.getProperties({ limit: 500 });   // fetch all, filter client-side
  if (!result.success) {
    showEmpty("API Error. कृपया पुन्हा प्रयत्न करा.");
    return;
  }
  STATE.allProperties = result.data || [];
  applyFilters();
}

// ---- APPLY ALL FILTERS ----
function applyFilters() {
  let data = [...STATE.allProperties];
  const activeFilters = {};

  // Listing type
  const lt = document.querySelector('input[name="listingType"]:checked')?.value;
  if (lt) { data = data.filter(p => p.listing_type === lt); activeFilters["Listing"] = lt; }

  // Show/hide budget groups
  document.getElementById("budgetSaleGroup").style.display = lt === "Rent" ? "none" : "";
  document.getElementById("budgetRentGroup").style.display = lt === "Rent" ? "" : "none";

  // Property type (multi-check)
  const ptChecked = [...document.querySelectorAll('#propTypeFilters input:checked')].map(c => c.value);
  if (ptChecked.length) {
    data = data.filter(p => ptChecked.includes(p.property_type));
    activeFilters["Type"] = ptChecked.join(", ");
  }

  // BHK
  if (STATE.selectedBHK) {
    data = data.filter(p => p.bhk === STATE.selectedBHK);
    activeFilters["BHK"] = STATE.selectedBHK;
  }

  // Budget (Sale)
  const bSale = document.querySelector('input[name="budgetSale"]:checked')?.value;
  if (bSale && lt !== "Rent") {
    const [min, max] = bSale.split("-").map(Number);
    data = data.filter(p => {
      const price = Number(p.expected_price) || 0;
      return price >= min && price <= max;
    });
    activeFilters["Budget"] = formatBudgetLabel(bSale);
  }

  // Budget (Rent)
  const bRent = document.querySelector('input[name="budgetRent"]:checked')?.value;
  if (bRent && lt === "Rent") {
    const [min, max] = bRent.split("-").map(Number);
    data = data.filter(p => {
      const rent = Number(p.expected_rent) || 0;
      return rent >= min && rent <= max;
    });
    activeFilters["Rent"] = formatBudgetLabel(bRent, true);
  }

  // Furnished
  const furnChecked = [...document.querySelectorAll('.checkbox-group input[value="Furnished"], .checkbox-group input[value="Semi-Furnished"], .checkbox-group input[value="Unfurnished"]')].filter(c => c.checked).map(c => c.value);
  if (furnChecked.length) {
    data = data.filter(p => furnChecked.includes(p.furnished_status));
    activeFilters["Furnished"] = furnChecked.join(", ");
  }

  // Facing
  const facingChecked = [...document.querySelectorAll('.checkbox-group input[value="East"], .checkbox-group input[value="West"], .checkbox-group input[value="North"], .checkbox-group input[value="South"]')].filter(c => c.checked).map(c => c.value);
  if (facingChecked.length) {
    data = data.filter(p => facingChecked.includes(p.facing));
    activeFilters["Facing"] = facingChecked.join(", ");
  }

  // Search text
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  if (q) {
    data = data.filter(p =>
      (p.title || "").toLowerCase().includes(q) ||
      (p.city || "").toLowerCase().includes(q) ||
      (p.address || "").toLowerCase().includes(q) ||
      (p.bhk || "").toLowerCase().includes(q) ||
      (p.property_type || "").toLowerCase().includes(q)
    );
    activeFilters["Search"] = `"${q}"`;
    document.getElementById("clearSearch").style.display = "flex";
  } else {
    document.getElementById("clearSearch").style.display = "none";
  }

  // Sort
  const sort = document.getElementById("sortSelect").value;
  data = sortData(data, sort);

  STATE.filtered = data;
  STATE.currentPage = 1;
  STATE.activeFilters = activeFilters;

  updateFilterCount(Object.keys(activeFilters).length);
  updateActiveFilterPills(activeFilters);
  renderPage();
}

function sortData(data, sort) {
  switch (sort) {
    case "price_asc":
      return [...data].sort((a, b) => (Number(a.expected_price || a.expected_rent) || 0) - (Number(b.expected_price || b.expected_rent) || 0));
    case "price_desc":
      return [...data].sort((a, b) => (Number(b.expected_price || b.expected_rent) || 0) - (Number(a.expected_price || a.expected_rent) || 0));
    case "area_desc":
      return [...data].sort((a, b) => (Number(b.carpet_area) || 0) - (Number(a.carpet_area) || 0));
    default: // newest
      return [...data].reverse();
  }
}

// ---- RENDER ----
function renderPage() {
  const grid = document.getElementById("propertiesGrid");
  const { filtered, currentPage, pageSize, view } = STATE;
  const total = filtered.length;
  const start = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  // Result count
  document.getElementById("resultCount").textContent =
    total === 0 ? "No results" : `${total} Properties found`;

  if (total === 0) {
    grid.innerHTML = "";
    grid.style.display = "none";
    document.getElementById("emptyState").style.display = "block";
    document.getElementById("pagination").style.display = "none";
    return;
  }

  document.getElementById("emptyState").style.display = "none";
  grid.style.display = "";

  // Apply view
  grid.className = "properties-grid" + (view === "list" ? " list-view" : "");

  grid.innerHTML = paginated.map(p => buildPropertyCard(p)).join("");

  // Pagination
  renderPagination(total, pageSize, currentPage);
}

function renderPagination(total, pageSize, current) {
  const pages = Math.ceil(total / pageSize);
  const pag = document.getElementById("pagination");
  if (pages <= 1) { pag.style.display = "none"; return; }
  pag.style.display = "flex";

  document.getElementById("prevBtn").disabled = current === 1;
  document.getElementById("nextBtn").disabled = current === pages;

  const nums = document.getElementById("pageNumbers");
  nums.innerHTML = "";

  const range = getPageRange(current, pages);
  range.forEach(p => {
    if (p === "...") {
      nums.innerHTML += `<span class="page-ellipsis">…</span>`;
    } else {
      nums.innerHTML += `<button class="page-num ${p === current ? "active" : ""}" onclick="goToPage(${p})">${p}</button>`;
    }
  });
}

function getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

// ---- INTERACTION HANDLERS ----
function selectBHK(btn, val) {
  if (!btn) return;
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  btn.classList.add("active");
  STATE.selectedBHK = val;
  applyFilters();
}

function changePage(dir) {
  const pages = Math.ceil(STATE.filtered.length / STATE.pageSize);
  STATE.currentPage = Math.max(1, Math.min(pages, STATE.currentPage + dir));
  renderPage();
  window.scrollTo({ top: 200, behavior: "smooth" });
}

function goToPage(n) {
  STATE.currentPage = n;
  renderPage();
  window.scrollTo({ top: 200, behavior: "smooth" });
}

function setView(v) {
  STATE.view = v;
  document.getElementById("gridViewBtn").classList.toggle("active", v === "grid");
  document.getElementById("listViewBtn").classList.toggle("active", v === "list");
  renderPage();
}

function debounceSearch() {
  clearTimeout(STATE.searchTimer);
  STATE.searchTimer = setTimeout(applyFilters, 350);
}

function clearSearch() {
  document.getElementById("searchInput").value = "";
  applyFilters();
}

function clearAllFilters() {
  document.querySelectorAll('input[name="listingType"]')[0].checked = true;
  document.querySelectorAll('.checkbox-group input[type="checkbox"]').forEach(c => c.checked = false);
  document.querySelectorAll('input[name="budgetSale"]')[0].checked = true;
  document.querySelectorAll('input[name="budgetRent"]')[0].checked = true;
  document.getElementById("searchInput").value = "";
  STATE.selectedBHK = "";
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  document.querySelector('[data-bhk=""]')?.classList.add("active");
  applyFilters();
}

// ---- ACTIVE FILTER PILLS ----
function updateActiveFilterPills(filters) {
  const wrap = document.getElementById("activeFilters");
  const pills = document.getElementById("afPills");
  if (!Object.keys(filters).length) { wrap.style.display = "none"; return; }
  wrap.style.display = "flex";
  pills.innerHTML = Object.entries(filters).map(([k, v]) =>
    `<span class="af-pill">${k}: ${v} <button onclick="removeFilter('${k}')">×</button></span>`
  ).join("");
}

function removeFilter(key) {
  switch(key) {
    case "Listing":
      document.querySelector('input[name="listingType"][value=""]').checked = true; break;
    case "BHK":
      STATE.selectedBHK = "";
      document.querySelector('[data-bhk=""]')?.classList.add("active");
      document.querySelectorAll(".chip").forEach(c => { if (c.dataset.bhk !== "") c.classList.remove("active"); });
      break;
    case "Budget": document.querySelector('input[name="budgetSale"][value=""]').checked = true; break;
    case "Rent":   document.querySelector('input[name="budgetRent"][value=""]').checked = true; break;
    case "Type":
      document.querySelectorAll('#propTypeFilters input').forEach(c => c.checked = false); break;
    case "Furnished":
      document.querySelectorAll('.checkbox-group input[value="Furnished"], .checkbox-group input[value="Semi-Furnished"], .checkbox-group input[value="Unfurnished"]').forEach(c => c.checked = false); break;
    case "Facing":
      document.querySelectorAll('.checkbox-group input[value="East"], .checkbox-group input[value="West"], .checkbox-group input[value="North"], .checkbox-group input[value="South"]').forEach(c => c.checked = false); break;
    case "Search": clearSearch(); return;
  }
  applyFilters();
}

function updateFilterCount(count) {
  const fc = document.getElementById("filterCount");
  if (count > 0) { fc.textContent = count; fc.style.display = "flex"; }
  else fc.style.display = "none";
}

// ---- MOBILE FILTER ----
function toggleMobileFilter() {
  document.getElementById("filterSidebar").classList.toggle("mobile-open");
  document.getElementById("filterOverlay").style.display = "block";
  document.body.style.overflow = "hidden";
}
function closeMobileFilter() {
  document.getElementById("filterSidebar").classList.remove("mobile-open");
  document.getElementById("filterOverlay").style.display = "none";
  document.body.style.overflow = "";
}

// ---- INQUIRY MODAL ----
let currentInquiryPropId = "";
function openInquiryModal(propId, title) {
  currentInquiryPropId = propId;
  document.getElementById("modalTitle").textContent = "Property Inquiry";
  document.getElementById("modalSubtitle").textContent = title;
  document.getElementById("modalWA").href =
    `https://wa.me/${CONFIG.COMPANY.whatsapp}?text=Hello! I'm interested in: ${title}`;
  document.getElementById("inquiryModal").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeModal(e) {
  if (e.target === document.getElementById("inquiryModal")) {
    document.getElementById("inquiryModal").classList.remove("open");
    document.body.style.overflow = "";
  }
}
async function submitModalInquiry(e) {
  e.preventDefault();
  const btn = document.getElementById("modalSubmitBtn");
  const status = document.getElementById("modalStatus");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
  const result = await API.submitContact({
    full_name: document.getElementById("mName").value,
    mobile: document.getElementById("mMobile").value,
    message: document.getElementById("mMessage").value + ` | Property: ${currentInquiryPropId}`,
    client_type: "Buyer",
  });
  if (result.success) {
    status.innerHTML = `<div class="status-success" style="margin-top:12px"><i class="fas fa-check-circle"></i> ${result.message}</div>`;
    setTimeout(() => {
      document.getElementById("inquiryModal").classList.remove("open");
      document.body.style.overflow = "";
      document.getElementById("modalForm").reset();
      status.innerHTML = "";
    }, 2500);
  } else {
    status.innerHTML = `<div class="status-error" style="margin-top:12px"><i class="fas fa-exclamation-circle"></i> Error. पुन्हा प्रयत्न करा.</div>`;
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Inquiry';
}

// ---- UTILS ----
function showSkeletons(grid) {
  grid.innerHTML = Array(6).fill('<div class="skeleton-card"></div>').join("");
}
function showEmpty(msg) {
  document.getElementById("propertiesGrid").innerHTML = "";
  document.getElementById("emptyState").style.display = "block";
  document.getElementById("emptyState").querySelector("p").textContent = msg;
}
function formatBudgetLabel(range, isRent = false) {
  const [min, max] = range.split("-").map(Number);
  const fmt = n => n >= 10000000 ? (n/10000000).toFixed(0)+"Cr" : n >= 100000 ? (n/100000).toFixed(0)+"L" : n >= 1000 ? (n/1000).toFixed(0)+"K" : n;
  if (max >= 999999999) return `${fmt(min)}+`;
  return `${fmt(min)}–${fmt(max)}`;
}
