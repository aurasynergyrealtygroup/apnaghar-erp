// ============================================================
// ApnaGhar — API Layer
// js/api.js
// ============================================================

const API = {
  base: () => CONFIG.APPS_SCRIPT_URL,

  // GET request
  async get(params) {
    const url = new URL(API.base());
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    try {
      const res = await fetch(url.toString());
      return await res.json();
    } catch (e) {
      console.error("API GET error:", e);
      return { success: false, error: e.message };
    }
  },

  // POST request
  async post(action, data) {
    try {
      const res = await fetch(API.base(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      return await res.json();
    } catch (e) {
      console.error("API POST error:", e);
      return { success: false, error: e.message };
    }
  },

  // ---- Public API calls ----
  getFeaturedProperties: () => API.get({ action: "getFeaturedProperties" }),
  getProperties: (filters = {}) => API.get({ action: "getProperties", ...filters }),
  getProperty: (id) => API.get({ action: "getProperty", id }),
  searchProperties: (q) => API.get({ action: "searchProperties", q }),
  getLand: (filters = {}) => API.get({ action: "getLand", ...filters }),
  getLandById: (id) => API.get({ action: "getLandById", id }),
  getSocieties: () => API.get({ action: "getSocieties" }),
  getAgents: () => API.get({ action: "getAgents" }),
  getDashboard: () => API.get({ action: "getDashboard" }),
  getMasters: (type) => API.get({ action: "getMasters", type }),

  // Forms
  submitContact: (data) => API.post("submitContact", data),
  submitInquiry: (data) => API.post("submitInquiry", data),

  // ---- Admin API calls ----
  admin: {
    login: (data) => API.post("login", data),
    getClients: () => API.get({ action: "getClients" }),
    getClient: (id) => API.get({ action: "getClient", id }),
    addClient: (data) => API.post("addClient", data),
    updateClient: (data) => API.post("updateClient", data),
    deleteClient: (id) => API.post("deleteClient", { client_id: id }),

    getAgents: () => API.get({ action: "getAgents" }),
    addAgent: (data) => API.post("addAgent", data),
    updateAgent: (data) => API.post("updateAgent", data),

    addProperty: (data) => API.post("addProperty", data),
    updateProperty: (data) => API.post("updateProperty", data),
    deleteProperty: (id) => API.post("deleteProperty", { property_id: id }),

    getAgreements: () => API.get({ action: "getAgreements" }),
    addAgreement: (data) => API.post("addAgreement", data),
    updateAgreement: (data) => API.post("updateAgreement", data),

    getRentPayments: () => API.get({ action: "getRentPayments" }),
    addRentPayment: (data) => API.post("addRentPayment", data),
    updateRentPayment: (data) => API.post("updateRentPayment", data),

    getSaleDeals: () => API.get({ action: "getSaleDeals" }),
    addSaleDeal: (data) => API.post("addSaleDeal", data),
    updateSaleDeal: (data) => API.post("updateSaleDeal", data),

    getFollowups: () => API.get({ action: "getFollowups" }),
    addFollowup: (data) => API.post("addFollowup", data),

    getSiteVisits: () => API.get({ action: "getSiteVisits" }),
    addSiteVisit: (data) => API.post("addSiteVisit", data),

    getExpenses: () => API.get({ action: "getExpenses" }),
    addExpense: (data) => API.post("addExpense", data),

    getInvoices: () => API.get({ action: "getInvoices" }),
    addInvoice: (data) => API.post("addInvoice", data),

    getLedger: () => API.get({ action: "getLedger" }),
    addLedgerEntry: (data) => API.post("addLedgerEntry", data),

    getWorkRequests: () => API.get({ action: "getWorkRequests" }),
    addWorkRequest: (data) => API.post("addWorkRequest", data),
    updateWorkRequest: (data) => API.post("updateWorkRequest", data),

    getServiceProviders: () => API.get({ action: "getServiceProviders" }),
    getUsers: () => API.get({ action: "getUsers" }),
    getProjects: () => API.get({ action: "getProjects" }),
    getCommissions: () => API.get({ action: "getCommissions" }),
  }
};

// ---- Helpers ----
function formatPrice(amount) {
  if (!amount) return "—";
  amount = Number(amount);
  if (amount >= 10000000) return "₹" + (amount / 10000000).toFixed(2) + " Cr";
  if (amount >= 100000) return "₹" + (amount / 100000).toFixed(1) + " L";
  if (amount >= 1000) return "₹" + (amount / 1000).toFixed(0) + "K";
  return "₹" + amount.toLocaleString("en-IN");
}

function getImageUrl(url) {
  if (!url || url === "" || url === null) return CONFIG.CLOUDINARY.placeholder;
  if (url.startsWith("http")) return url;
  return CONFIG.CLOUDINARY.base_url + url;
}

function buildPropertyCard(p) {
  const price = p.listing_type === "Rent"
    ? formatPrice(p.expected_rent) + "/mo"
    : formatPrice(p.expected_price);
  const img = getImageUrl(p.image1_url);
  const badge = p.listing_type === "Rent" ? "rent-badge" : "sale-badge";
  return `
    <div class="property-card" onclick="location.href='property-detail.html?id=${p.property_id}'">
      <div class="card-img-wrap">
        <img src="${img}" alt="${p.title}" loading="lazy" onerror="this.src='${CONFIG.CLOUDINARY.placeholder}'" />
        <span class="listing-badge ${badge}">${p.listing_type === "Rent" ? "भाडे" : "विक्री"}</span>
        ${p.status === "Available" ? '<span class="avail-badge">Available</span>' : ""}
      </div>
      <div class="card-body">
        <h3 class="card-title">${p.title || "Property"}</h3>
        <div class="card-meta">
          <span><i class="fas fa-map-marker-alt"></i> ${p.city || "Pune"}</span>
          ${p.bhk ? `<span><i class="fas fa-bed"></i> ${p.bhk}</span>` : ""}
          ${p.carpet_area ? `<span><i class="fas fa-vector-square"></i> ${p.carpet_area} SqFt</span>` : ""}
        </div>
        <div class="card-footer">
          <span class="card-price">${price}</span>
          <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); openInquiryModal('${p.property_id}', '${p.title}')">
            <i class="fas fa-phone"></i> Inquire
          </button>
        </div>
      </div>
    </div>
  `;
}
