// ============================================================
// ApnaGhar — API Layer   (website/js/api.js)
// Talks to the Google Apps Script web app (Google Sheet backend)
// ============================================================

const API = {
  base: () => CONFIG.APPS_SCRIPT_URL,
  isConfigured: () => /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/.test(CONFIG.APPS_SCRIPT_URL) && !CONFIG.APPS_SCRIPT_URL.includes("YOUR_SCRIPT_ID"),

  user() { try { return JSON.parse(sessionStorage.getItem("ag_user") || localStorage.getItem("ag_user") || "null"); } catch (e) { return null; } },
  token() { return API.user()?.token || ""; },

  _notConfigured() {
    return { success: false, error: "Backend not connected: paste your Apps Script Web App URL in website/js/config.js (see SETUP_GUIDE.md)", not_configured: true };
  },

  _handle(json) {
    if (json && json.success === false && /^AUTH:/.test(json.error || "")) {
      json.error = json.error.replace(/^AUTH:\s*/, "");
      if (location.pathname.endsWith("partner.html")) {
        sessionStorage.removeItem("ag_user"); localStorage.removeItem("ag_user");
        alert(json.error); location.reload();
      } else if (location.pathname.includes("/admin/") && !location.pathname.endsWith("login.html")) {
        sessionStorage.removeItem("ag_user"); localStorage.removeItem("ag_user");
        alert(json.error);
        location.href = "login.html";
      }
    }
    return json;
  },

  async get(params) {
    if (!API.isConfigured()) return API._notConfigured();
    const url = new URL(API.base());
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v); });
    const t = API.token(); if (t) url.searchParams.set("token", t);
    try {
      const res = await fetch(url.toString(), { redirect: "follow" });
      return API._handle(await res.json());
    } catch (e) {
      console.error("API GET error:", e);
      return { success: false, error: "Network error — check internet / Apps Script deployment (" + e.message + ")" };
    }
  },

  // NOTE: Content-Type MUST be text/plain. application/json triggers a CORS
  // preflight that Google Apps Script cannot answer, so every save would fail.
  async post(action, data, extra = {}) {
    if (!API.isConfigured()) return API._notConfigured();
    try {
      const res = await fetch(API.base(), {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, data, token: API.token(), ...extra }),
      });
      return API._handle(await res.json());
    } catch (e) {
      console.error("API POST error:", e);
      return { success: false, error: "Network error — check internet / Apps Script deployment (" + e.message + ")" };
    }
  },

  // ---- Generic CRUD for any sheet ----
  list:   (sheet)       => API.get({ action: "list", sheet }),
  getOne: (sheet, id)   => API.get({ action: "get", sheet, id }),
  create: (sheet, data) => API.post("create", data, { sheet }),
  update: (sheet, data) => API.post("update", data, { sheet }),
  remove: (sheet, id)   => API.post("delete", { id }, { sheet }),

  // ---- File upload (image / video / PDF → Google Drive, link saved to Sheet) ----
  async uploadFile(file, module = "General", recordId = "", onStatus) {
    const isImg = /^image\/(jpeg|png|webp)$/.test(file.type);
    const isVid = file.type.startsWith("video/");
    const mb = file.size / 1048576;
    if (isVid && mb > CONFIG.UPLOAD.max_video_mb) return { success: false, error: `Video is ${mb.toFixed(1)} MB. Max ${CONFIG.UPLOAD.max_video_mb} MB — upload larger videos to YouTube and paste the link.` };
    if (!isVid && !file.type.startsWith("image/") && mb > CONFIG.UPLOAD.max_doc_mb) return { success: false, error: `File too large (max ${CONFIG.UPLOAD.max_doc_mb} MB)` };
    onStatus && onStatus(isImg ? "Optimizing image…" : "Reading file…");
    let blob = file, name = file.name;
    if (isImg) { try { blob = await API._resizeImage(file); name = name.replace(/\.\w+$/, "") + ".jpg"; } catch (e) { blob = file; } }
    const base64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1]);
      r.onerror = () => rej(new Error("Could not read file"));
      r.readAsDataURL(blob);
    });
    onStatus && onStatus("Uploading to Google Drive…");
    return API.post("uploadFile", { file_name: name, mime_type: blob.type || file.type, base64, module, record_id: recordId });
  },

  _resizeImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const max = CONFIG.UPLOAD.max_image_px;
        let { width: w, height: h } = img;
        if (w > max || h > max) { const k = max / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        c.toBlob(b => b ? resolve(b) : reject(new Error("resize failed")), "image/jpeg", CONFIG.UPLOAD.image_quality);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  },

  // ---- Public API calls (website) ----
  ping: () => API.get({ action: "ping" }),
  getFeaturedProperties: () => API.get({ action: "getFeaturedProperties" }),
  getProperties: (filters = {}) => API.get({ action: "getProperties", ...filters }),
  getProperty: (id) => API.get({ action: "getProperty", id }),
  searchProperties: (q) => API.get({ action: "searchProperties", q }),
  getLand: (filters = {}) => API.get({ action: "getLand", ...filters }),
  getLandById: (id) => API.get({ action: "getLandById", id }),
  getSocieties: () => API.get({ action: "getSocieties" }),
  getNewProjects: (filters = {}) => API.get({ action: "getNewProjects", ...filters }),
  getNewProject: (id) => API.get({ action: "getNewProject", id }),
  getAgents: () => API.get({ action: "getAgents" }),
  getDashboard: () => API.token() ? API.get({ action: "getAdminSummary" }) : API.get({ action: "getDashboard" }),
  getMasters: (type) => API.get({ action: "getMasters", type }),

  // Website forms → Google Sheet
  submitContact: (data) => API.post("submitContact", { source_page: location.pathname, ...data }),
  submitInquiry: (data) => API.post("submitInquiry", { source_page: location.pathname, ...data }),
  submitBooking: (data) => API.post("submitBooking", { source_page: location.pathname, ...data }),
  submitSiteVisit: (data) => API.post("submitSiteVisit", { source_page: location.pathname, ...data }),
  registerPartner: (data) => API.post("registerPartner", data),

  // ---- Post-Your-Ad partners (Agent / Builder / Owner) ----
  partner: {
    login: (data) => API.post("login", data),
    myListings: () => API.get({ action: "myListings" }),
    myLeads: () => API.get({ action: "myLeads" }),
    save: (sheet, data) => API.post("savePartnerListing", data, { sheet }),
    remove: (sheet, id) => API.post("deletePartnerListing", { id }, { sheet }),
    changePassword: (data) => API.post("changePassword", data),
  },
  isPartnerRole: (role) => ["Partner Agent", "Builder", "Owner"].includes(role),

  // ---- Admin API calls ----
  admin: {
    login: (data) => API.post("login", data),
    changePassword: (data) => API.post("changePassword", data),
    runSetup: () => API.post("runSetup", {}),

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

    getNewProjects: () => API.get({ action: "getNewProjectsAdmin" }),

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
    getRoles: () => API.get({ action: "getRoles" }),
    saveUser: (data) => API.post("saveUser", data),
    deleteUser: (id) => API.post("deleteUser", { user_id: id }),
    approveUser: (id, status = "Active") => API.post("approveUser", { user_id: id, status }),
    approveListing: (sheet, id, approval_status = "Approved", approval_note = "") => API.post("approveListing", { id, approval_status, approval_note }, { sheet }),
    getProjects: () => API.get({ action: "getProjects" }),
    getCommissions: () => API.get({ action: "getCommissions" }),
    getMedia: () => API.get({ action: "getMedia" }),
    getInquiries: () => API.get({ action: "getInquiries" }),

    getBookings: () => API.get({ action: "getBookings" }),
    getBooking: (id) => API.get({ action: "getBooking", id }),
    addBooking: (data) => API.post("addBooking", data),
    updateBooking: (data) => API.post("updateBooking", data),
    deleteBooking: (id) => API.post("deleteBooking", { booking_id: id }),
  }
};

// ---- Helpers ----
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatPrice(amount) {
  if (!amount) return "—";
  amount = Number(amount);
  if (amount >= 10000000) return "₹" + (amount / 10000000).toFixed(2) + " Cr";
  if (amount >= 100000) return "₹" + (amount / 100000).toFixed(1) + " L";
  if (amount >= 1000) return "₹" + (amount / 1000).toFixed(0) + "K";
  return "₹" + amount.toLocaleString("en-IN");
}

// Converts any stored image link (Drive, Cloudinary, direct) into a displayable URL
function getImageUrl(url) {
  if (!url) return CONFIG.CLOUDINARY.placeholder;
  url = String(url).trim();
  const d = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/);
  if (d) return "https://lh3.googleusercontent.com/d/" + d[1];
  if (url.startsWith("http")) return url;
  return CONFIG.CLOUDINARY.base_url ? CONFIG.CLOUDINARY.base_url + url : CONFIG.CLOUDINARY.placeholder;
}

function extractYouTubeId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

// Returns <iframe>/<video> HTML for YouTube, Google Drive, Cloudflare Stream or a direct video file
function buildVideoEmbedHtml(videoUrl, wrapClass) {
  if (!videoUrl) return "";
  const v = String(videoUrl).trim();
  let inner;
  const yt = extractYouTubeId(v);
  const drive = v.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/);
  if (yt) inner = `<iframe src="https://www.youtube.com/embed/${yt}" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  else if (drive) inner = `<iframe src="https://drive.google.com/file/d/${drive[1]}/preview" allow="autoplay" allowfullscreen></iframe>`;
  else if (/cloudflarestream\.com|videodelivery\.net/.test(v)) inner = `<iframe src="${escapeHtml(v)}" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen></iframe>`;
  else inner = `<video src="${escapeHtml(v)}" controls playsinline style="width:100%;height:100%;object-fit:contain;background:#000"></video>`;
  return wrapClass ? `<div class="${wrapClass}">${inner}</div>` : inner;
}

function buildPropertyCard(p) {
  const price = p.listing_type === "Rent" ? formatPrice(p.expected_rent) + "/mo" : formatPrice(p.expected_price);
  const img = getImageUrl(p.image1_url);
  const badge = p.listing_type === "Rent" ? "rent-badge" : "sale-badge";
  const title = escapeHtml(p.title || "Property");
  return `
    <div class="property-card" onclick="location.href='property-detail.html?id=${encodeURIComponent(p.property_id)}'">
      <div class="card-img-wrap">
        <img src="${img}" alt="${title}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='${CONFIG.CLOUDINARY.placeholder}'" />
        <span class="listing-badge ${badge}">${p.listing_type === "Rent" ? "किराया" : "बिक्री"}</span>
        ${p.status === "Available" ? '<span class="avail-badge">Available</span>' : ""}
        ${p.video_url ? '<span class="video-indicator" title="Video available"><i class="fas fa-play"></i></span>' : ""}
      </div>
      <div class="card-body">
        <h3 class="card-title">${title}</h3>
        <div class="card-meta">
          <span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(p.city || "Pune")}</span>
          ${p.bhk ? `<span><i class="fas fa-bed"></i> ${escapeHtml(p.bhk)}</span>` : ""}
          ${p.carpet_area ? `<span><i class="fas fa-vector-square"></i> ${escapeHtml(p.carpet_area)} SqFt</span>` : ""}
        </div>
        <div class="card-footer">
          <span class="card-price">${price}</span>
          <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); openInquiryModal('${encodeURIComponent(p.property_id)}', '${title.replace(/'/g, "")}')">
            <i class="fas fa-phone"></i> Inquire
          </button>
        </div>
      </div>
    </div>`;
}

function buildProjectCard(p) {
  const img = getImageUrl(p.image1_url);
  const name = escapeHtml(p.project_name || "Project");
  const price = p.price_from ? formatPrice(p.price_from) + (p.price_to ? " – " + formatPrice(p.price_to) : " onwards") : "Price on request";
  return `
    <div class="property-card project-card" onclick="location.href='project-detail.html?id=${encodeURIComponent(p.project_id)}'">
      <div class="card-img-wrap">
        <img src="${img}" alt="${name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='${CONFIG.CLOUDINARY.placeholder}'" />
        <span class="listing-badge launch-badge">${escapeHtml(p.launch_status || "New Launch")}</span>
        ${p.video_url ? '<span class="video-indicator" title="Video available"><i class="fas fa-play"></i></span>' : ""}
      </div>
      <div class="card-body">
        <h3 class="card-title">${name}</h3>
        <div class="card-meta">
          <span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(p.location || p.city || "Pune")}</span>
          ${p.configurations ? `<span><i class="fas fa-bed"></i> ${escapeHtml(p.configurations)}</span>` : ""}
        </div>
        ${p.builder_name ? `<div class="card-meta"><span><i class="fas fa-building"></i> ${escapeHtml(p.builder_name)}</span>${p.possession_date ? `<span><i class="fas fa-key"></i> ${escapeHtml(p.possession_date)}</span>` : ""}</div>` : ""}
        <div class="card-footer">
          <span class="card-price">${price}</span>
          <span class="btn btn-sm btn-primary"><i class="fas fa-bookmark"></i> Book</span>
        </div>
      </div>
    </div>`;
}
