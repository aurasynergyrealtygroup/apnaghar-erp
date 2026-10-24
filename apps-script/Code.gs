// ============================================================
// ApnaGhar ERP — Google Apps Script Backend  (v2.5)
// Aura Synergy Realty Group
// ------------------------------------------------------------
// FIRST-TIME SETUP (do this once):   (if anything fails, run "diagnose" and read the log)
//   1. Paste this whole file into Extensions → Apps Script of your Google Sheet.
//   2. Select function "setupSheets" in the toolbar → click Run → Allow permissions.
//      This creates every sheet tab + headers, a Drive media folder and the admin user.
//   3. Deploy → New deployment → type "Web app"
//        Execute as: Me      Who has access: Anyone
//      Copy the Web app URL (ends with /exec).
//   4. Paste that URL into website/js/config.js → APPS_SCRIPT_URL, push to GitHub.
//   5. Login at /admin/login.html with  admin / admin123  and change the password.
//   (Want a brand-new empty Google Sheet with every tab made for you?  Run  createNewDatabase  instead of steps 1-2.)
//   6. (v2.5) Also run  installDailyTrigger  once — it hides rent listings after 45 days and sale listings after 60 days.
// After any change to this file: Deploy → Manage deployments → Edit → Version: New → Deploy
// ============================================================

const SPREADSHEET_ID = "14SH_L0fsknVQRNqrNPcfSS0lODipe-7mlnFt1pvFFG8";
const MEDIA_ROOT_FOLDER = "ApnaGhar ERP Media";
const NOTIFY_EMAIL = "aurasynergyrealtygroup@gmail.com"; // new website leads/bookings are emailed here ("" to disable)
const TOKEN_DAYS = 7;
const TZ = "Asia/Kolkata";

// ---- Post-Your-Ad partners (Agents / Builders / Owners) ----
// Partner accounts can ONLY post & manage their own ads — no access to the ERP.
const PARTNER_ROLES = { Agent: "Partner Agent", Builder: "Builder", Owner: "Owner" };   // user_type → role name
const STAFF_ROLES = ["Admin", "Manager", "Agent", "Accountant"];
const AUTO_APPROVE_PARTNERS = false;  // true = new partner accounts can log in immediately
const AUTO_APPROVE_ADS = false;       // true = partner ads go live without admin approval

// ---- Listing validity (v2.5) ----
// A RENT listing is hidden from the website 45 days after its last manual update / renew,
// a SALE listing after 60 days. LAND = 0 means "never auto-hides". The real values are read from
// the LISTING_RULES sheet tab (edit them there); these are only the fallback defaults.
// An agent edits the ad or presses Renew  →  it goes live again and the clock restarts.
const DEFAULT_LISTING_DAYS = { RENT: 45, SALE: 60, LAND: 0 };
const LISTING_SHEETS = { PROPERTIES: "property_id", LAND_PROPERTIES: "land_id" };

// ------------------------------------------------------------
// SCHEMA — every sheet tab, its ID column, ID prefix and headers.
// Row 1 = title, Row 2 = headers, Row 3+ = data (your existing convention).
// Missing tabs/columns are created automatically; nothing is ever deleted.
// ------------------------------------------------------------
const MEDIA_COLS = ["image1_url","image2_url","image3_url","image4_url","image5_url","image6_url","video_url","brochure_url"];

const SCHEMA = {
  PROPERTIES: { id: "property_id", prefix: "PROP", title: "Properties (Sale / Rent)", public: true,
    headers: ["property_id","property_code","title","posted_by","posted_by_name","posted_by_type","contact_name","contact_mobile","approval_status","approval_note","property_type","listing_type","bhk","furnished_status","carpet_area","builtup_area","floor","total_floors","facing","city","area","address","society_id","society_name","project_id","owner_name","owner_mobile","agent_id","status","featured","expected_price","expected_rent","deposit_amount","amenities","description","last_renewed_on","expiry_date","listing_active","deactivated_on"].concat(MEDIA_COLS, ["created_at","updated_at"]) },
  NEW_PROJECTS: { id: "project_id", prefix: "NPJ", title: "New Launch Projects", public: true,
    headers: ["project_id","project_name","builder_name","posted_by","posted_by_name","posted_by_type","contact_name","contact_mobile","approval_status","approval_note","project_type","launch_status","location","city","rera_number","configurations","price_from","price_to","carpet_from","carpet_to","total_towers","total_units","available_units","launch_date","possession_date","booking_amount","offer","amenities","highlights","description","map_url","floor_plan_url","status","featured"].concat(MEDIA_COLS, ["created_at","updated_at"]) },
  PROPERTY_BOOKINGS: { id: "booking_id", prefix: "BKG", title: "Bookings (Property + New Launch Projects)",
    headers: ["booking_id","booking_for","property_id","project_id","unit_no","tower_wing","configuration","client_id","customer_name","customer_mobile","customer_email","agent_id","total_price","token_amount","booking_date","expected_registration_date","booking_status","payment_mode","transaction_ref","receipt_url","document_url","source","notes","created_at","updated_at"] },
  WEBSITE_INQUIRIES: { id: "inquiry_id", prefix: "INQ", title: "Website Inquiries / Leads",
    headers: ["inquiry_id","inquiry_type","full_name","mobile","email","client_id","property_id","project_id","preferred_date","message","source_page","status","created_at","updated_at"] },
  MEDIA_LIBRARY: { id: "media_id", prefix: "MED", title: "Media Library (uploaded images / videos / documents)",
    headers: ["media_id","file_name","media_type","mime_type","size_kb","module","record_id","file_id","url","view_url","download_url","uploaded_by","created_at"] },
  CLIENTS: { id: "client_id", prefix: "CLI", title: "Clients / Leads",
    headers: ["client_id","client_type","full_name","mobile","alternate_mobile","email","occupation","company_name","preferred_location","preferred_bhk","property_type_interest","budget_min","budget_max","loan_required","lead_source","lead_status","assigned_agent_id","remarks","created_at","updated_at"] },
  AGENTS: { id: "agent_id", prefix: "AGT", title: "Agents",
    headers: ["agent_id","full_name","mobile","alt_mobile","whatsapp","email","address","city","area","rera_agent_no","experience_years","pan_no","aadhaar_last4","commission_percent","bank_name","account_no","ifsc","photo_url","user_id","joining_date","status","created_at","updated_at"] },
  SOCIETIES: { id: "society_id", prefix: "SOC", title: "Societies", public: true,
    headers: ["society_id","society_name","builder_name","address","landmark","area","city","pincode","total_wings","total_flats","amenities","secretary_name","secretary_mobile","image_url","status","created_at","updated_at"] },
  LAND_PROPERTIES: { id: "land_id", prefix: "LAND", title: "Land", public: true,
    headers: ["land_id","title","posted_by","posted_by_name","posted_by_type","contact_name","contact_mobile","approval_status","approval_note","agent_id","land_type","survey_no","village","taluka","district","area","area_value","area_unit","price","price_per_unit","road_touch","zone","ownership","status","featured","description","last_renewed_on","expiry_date","listing_active","deactivated_on","image1_url","image2_url","image3_url","video_url","document_url","created_at","updated_at"] },
  AGREEMENTS: { id: "agreement_id", prefix: "AGR", title: "Rent Agreements",
    headers: ["agreement_id","property_id","owner_name","tenant_client_id","tenant_name","tenant_mobile","start_date","end_date","monthly_rent","deposit","rent_due_day","escalation_percent","agreement_url","status","created_at","updated_at"] },
  RENT_PAYMENTS: { id: "payment_id", prefix: "PAY", title: "Rent Payments",
    headers: ["payment_id","agreement_id","month_year","rent_amount","late_fee","due_date","paid_date","payment_mode","transaction_id","payment_status","receipt_url","created_at","updated_at"] },
  SALE_DEALS: { id: "deal_id", prefix: "DEAL", title: "Sale Deals",
    headers: ["deal_id","property_id","project_id","client_id","agent_id","offered_price","final_price","token_amount","token_date","registration_date","commission_percent","commission_amount","deal_status","created_at","updated_at"] },
  FOLLOWUPS: { id: "followup_id", prefix: "FUP", title: "Follow-ups",
    headers: ["followup_id","client_id","agent_id","followup_date","discussion_note","next_followup_date","followup_status","created_at","updated_at"] },
  SITE_VISITS: { id: "visit_id", prefix: "VIS", title: "Site Visits",
    headers: ["visit_id","client_id","property_id","project_id","asset_id","agent_id","visit_date","visit_time","visit_status","feedback","next_followup_date","source","created_at","updated_at"] },
  SERVICE_PROVIDERS: { id: "service_provider_id", prefix: "SP", title: "Service Providers",
    headers: ["service_provider_id","provider_type","company_name","contact_person","mobile","alternate_mobile","email","address","city","gst_no","pan_no","bank_account","ifsc","rating","status","created_at","updated_at"] },
  PROPERTY_WORK_REQUEST: { id: "work_request_id", prefix: "WRK", title: "Work Requests",
    headers: ["work_request_id","property_id","work_type","description","priority","request_date","requested_by","estimated_cost","approved_by","status","created_at","updated_at"] },
  WORK_ASSIGNMENT: { id: "assignment_id", prefix: "WA", title: "Work Assignments",
    headers: ["assignment_id","work_request_id","service_provider_id","assigned_date","expected_completion_date","material_cost","labour_cost","total_cost","work_status","created_at","updated_at"] },
  EXPENSES: { id: "expense_id", prefix: "EXP", title: "Expenses",
    headers: ["expense_id","expense_date","expense_type","amount","paid_to","payment_mode","property_id","project_id","bill_url","remark","created_at","updated_at"] },
  INVOICES: { id: "invoice_id", prefix: "INV", title: "Invoices",
    headers: ["invoice_id","invoice_number","invoice_date","client_id","invoice_type","taxable_amount","gst_percent","gst_amount","total_amount","payment_status","created_at","updated_at"] },
  ACCOUNT_LEDGER: { id: "ledger_id", prefix: "LED", title: "Account Ledger",
    headers: ["ledger_id","transaction_date","transaction_type","category","amount","description","payment_mode","reference_id","created_by","created_at","updated_at"] },
  AGENT_COMMISSION: { id: "commission_id", prefix: "COM", title: "Agent Commission",
    headers: ["commission_id","agent_id","deal_id","amount","status","paid_date","created_at","updated_at"] },
  CLIENT_PROPERTY_INTEREST: { id: "interest_id", prefix: "INT", title: "Client Property Interest",
    headers: ["interest_id","client_id","property_id","project_id","visit_date","interest_level","remark","created_at"] },
  CONSTRUCTION_PROJECT: { id: "project_id", prefix: "PROJ", title: "Construction Projects",
    headers: ["project_id","project_name","location","start_date","end_date","budget","status","created_at","updated_at"] },
  DOCUMENT_LOCKER: { id: "document_id", prefix: "DOC", title: "Document Locker",
    headers: ["document_id","document_name","document_type","module","record_id","file_url","created_at"] },
  MESSAGE_LOG: { id: "message_id", prefix: "MSG", title: "Message Log",
    headers: ["message_id","channel","to","message","status","created_at"] },
  USERS: { id: "user_id", prefix: "USR", title: "Users",
    headers: ["user_id","username","full_name","email","mobile","password_hash","role_id","user_type","company_name","rera_number","city","agent_id","status","approved_by","last_login","created_at","updated_at"] },
  ROLES: { id: "role_id", prefix: "ROLE", title: "Roles",
    headers: ["role_id","role_name","description","created_at"] },
  LISTING_RULES: { id: "rule_id", prefix: "RUL", title: "Listing Rules — days a listing stays live after the last update (0 = never hides)",
    headers: ["rule_id","listing_type","validity_days","note","created_at","updated_at"] },
  LISTING_LOG: { id: "listing_log_id", prefix: "LLG", title: "Listing Log (created / renewed / auto-deactivated)",
    headers: ["listing_log_id","listing_sheet","listing_id","title","agent_id","action","action_date","done_by","remark","created_at"] },
  LEAD_SYNC_LOG: { id: "lead_sync_id", prefix: "LSY", title: "Lead Sync Log (rows imported from other Google Sheets — do not delete, prevents duplicates)",
    headers: ["lead_sync_id","source_name","source_tab","source_row","lead_key","client_id","action","synced_at","created_at"] },
  USER_ACTIVITY_LOG: { id: "log_id", prefix: "LOG", title: "Activity Log",
    headers: ["log_id","user","module","action","record_id","timestamp","source"] },
};

// Legacy action names used by existing pages → [operation, sheet]
const LEGACY_GET = {
  getProperties: null, getProperty: ["get","PROPERTIES"], getSocieties: ["list","SOCIETIES"], getLand: null,
  getLandById: ["get","LAND_PROPERTIES"], getAgents: ["list","AGENTS"], getClients: ["list","CLIENTS"],
  getClient: ["get","CLIENTS"], getFollowups: ["list","FOLLOWUPS"], getSiteVisits: ["list","SITE_VISITS"],
  getClientInterests: ["list","CLIENT_PROPERTY_INTEREST"], getAgreements: ["list","AGREEMENTS"],
  getRentPayments: ["list","RENT_PAYMENTS"], getSaleDeals: ["list","SALE_DEALS"], getCommissions: ["list","AGENT_COMMISSION"],
  getBookings: ["list","PROPERTY_BOOKINGS"], getBooking: ["get","PROPERTY_BOOKINGS"],
  getInvoices: ["list","INVOICES"], getLedger: ["list","ACCOUNT_LEDGER"], getExpenses: ["list","EXPENSES"],
  getProjects: ["list","CONSTRUCTION_PROJECT"], getWorkRequests: ["list","PROPERTY_WORK_REQUEST"],
  getWorkAssignments: ["list","WORK_ASSIGNMENT"], getServiceProviders: ["list","SERVICE_PROVIDERS"],
  getUsers: ["list","USERS"], getRoles: ["list","ROLES"], getUserLog: ["list","USER_ACTIVITY_LOG"],
  getMedia: ["list","MEDIA_LIBRARY"], getInquiries: ["list","WEBSITE_INQUIRIES"], getNewProjectsAdmin: ["list","NEW_PROJECTS"],
};
const LEGACY_POST = {
  addProperty: ["create","PROPERTIES"], updateProperty: ["update","PROPERTIES"], deleteProperty: ["delete","PROPERTIES"],
  addClient: ["create","CLIENTS"], updateClient: ["update","CLIENTS"], deleteClient: ["delete","CLIENTS"],
  addAgent: ["create","AGENTS"], updateAgent: ["update","AGENTS"],
  addAgreement: ["create","AGREEMENTS"], updateAgreement: ["update","AGREEMENTS"],
  addRentPayment: ["create","RENT_PAYMENTS"], updateRentPayment: ["update","RENT_PAYMENTS"],
  addSaleDeal: ["create","SALE_DEALS"], updateSaleDeal: ["update","SALE_DEALS"],
  addBooking: ["create","PROPERTY_BOOKINGS"], updateBooking: ["update","PROPERTY_BOOKINGS"], deleteBooking: ["delete","PROPERTY_BOOKINGS"],
  addFollowup: ["create","FOLLOWUPS"], updateFollowup: ["update","FOLLOWUPS"],
  addSiteVisit: ["create","SITE_VISITS"], updateSiteVisit: ["update","SITE_VISITS"],
  addClientInterest: ["create","CLIENT_PROPERTY_INTEREST"],
  addLand: ["create","LAND_PROPERTIES"], updateLand: ["update","LAND_PROPERTIES"],
  addWorkRequest: ["create","PROPERTY_WORK_REQUEST"], updateWorkRequest: ["update","PROPERTY_WORK_REQUEST"],
  addWorkAssignment: ["create","WORK_ASSIGNMENT"],
  addServiceProvider: ["create","SERVICE_PROVIDERS"], updateServiceProvider: ["update","SERVICE_PROVIDERS"],
  addExpense: ["create","EXPENSES"], updateExpense: ["update","EXPENSES"],
  addInvoice: ["create","INVOICES"], updateInvoice: ["update","INVOICES"],
  addLedgerEntry: ["create","ACCOUNT_LEDGER"], addDocument: ["create","DOCUMENT_LOCKER"], logMessage: ["create","MESSAGE_LOG"],
};

// ============================================================
// ROUTERS
// ============================================================
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    return jsonResponse(routeGet(p.action || "", p));
  } catch (err) {
    return jsonResponse({ success: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    return jsonResponse(routePost(body.action || "", body.data || {}, body));
  } catch (err) {
    return jsonResponse({ success: false, error: String(err.message || err) });
  }
}

function routeGet(action, p) {
  // ---------- Public (website) ----------
  switch (action) {
    case "ping":                  return { success: true, message: "ApnaGhar API is running", time: new Date().toISOString(), version: "2.5" };
    case "getProperties":         return getProperties(p);
    case "getProperty":           return getPublicById("PROPERTIES", p.id, p.token);
    case "getFeaturedProperties": return getFeaturedProperties();
    case "searchProperties":      return searchProperties(p);
    case "getLand":               return getLand(p);
    case "getLandById":           return getPublicById("LAND_PROPERTIES", p.id, p.token);
    case "getSocieties":          return getSocietiesPublic(p.token);
    case "getSearchOptions":      return getSearchOptions();
    case "getNewProjects":        return getNewProjects(p);
    case "getNewProject":         return getNewProject(p.id, p.token);
    case "getDashboard":          return getDashboardStats();
    case "getMasters":            return { success: true, data: [] };
  }

  // ---------- Admin (token required) ----------
  const user = requireAuth(p.token);
  if (action === "whoami")     return { success: true, user: user };
  if (action === "myListings") return myListings(user);
  if (action === "myLeads")    return myLeads(user);
  if (action === "myProfile")  return myProfile(user);
  requireStaff(user);
  if (action === "getDbInfo") return getDbInfo();
  if (action === "diagnoseWebsite") return diagnoseWebsite();
  if (action === "previewMerge") return previewMerge();
  if (action === "leadSyncStatus") return leadSyncStatus();                         // everything below = ERP staff only
  const scopeFn = agentScopeFor(user);        // staff role "Agent" sees only own properties / land
  if (action === "list") {
    const sh = checkSheet(p.sheet);
    return LISTING_SHEETS[sh] ? scopeResult(listRows(sh), scopeFn) : listRows(sh);
  }
  if (action === "get") {
    const sh = checkSheet(p.sheet), g = getById(sh, p.id);
    if (LISTING_SHEETS[sh] && scopeFn && g.success && !scopeFn(g.data)) return { success: false, error: "Record not found" };
    return g;
  }
  if (action === "getUsers") return listUsersSafe();
  if (action === "getAdminSummary") return getDashboardStats(true);
  const legacy = LEGACY_GET[action];
  if (legacy) return legacy[0] === "list" ? listRows(legacy[1]) : getById(legacy[1], p.id);
  return { success: false, error: "Unknown action: " + action };
}

function routePost(action, data, body) {
  // ---------- Public (website forms) ----------
  switch (action) {
    case "login":          return loginUser(data);
    case "submitContact":  return submitContactForm(data);
    case "submitInquiry":  return submitContactForm(Object.assign({ inquiry_type: "Property Inquiry" }, data));
    case "submitBooking":  return submitWebsiteBooking(data);
    case "submitSiteVisit":return submitWebsiteSiteVisit(data);
    case "registerPartner":return registerPartner(data);
  }

  // ---------- Admin (token required) ----------
  const user = requireAuth(body.token);
  const who = user.username || user.user_id;
  // Allowed for every logged-in user (staff + partners)
  switch (action) {
    case "uploadFile":     return uploadFile(data, who);
    case "changePassword": return changePassword(user, data);
    case "savePartnerListing":   return savePartnerListing(user, body.sheet, data);
    case "deletePartnerListing": return deletePartnerListing(user, body.sheet, data.id);
    case "renewListing":         return renewListing(user, body.sheet, data.id);
    case "saveMyProfile":        return saveMyProfile(user, data);
  }
  requireStaff(user);                         // everything below = ERP staff only
  switch (action) {
    case "approveListing": return approveListing(body.sheet, data, who);
    case "approveUser":    requireAdmin(user); return approveUser(data, who);
    case "create":      return addRow(checkSheet(body.sheet), listingGuard(user, body.sheet, "create", data), who);
    case "update":      return updateRow(checkSheet(body.sheet), listingGuard(user, body.sheet, "update", data), who);
    case "delete":      listingGuard(user, body.sheet, "delete", data); return deleteRow(checkSheet(body.sheet), data.id || data[SCHEMA[checkSheet(body.sheet)].id], who);
    case "saveUser":    requireAdmin(user); return saveUser(data, who);
    case "deleteUser":  requireAdmin(user); return deleteRow("USERS", data.user_id, who);
    case "runSetup":    requireAdmin(user); return setupSheets();
    case "runListingJob": requireAdmin(user); return deactivateExpiredListings();
    case "repairSheet":
      requireAdmin(user);
      if (data.confirm !== "REPAIR") return { success: false, error: "Confirmation missing" };
      return repairSheetLayout(body.sheet);
    case "addLeadSource":    requireAdmin(user); return addLeadSource(data.url, data.name, data.lead_source);
    case "removeLeadSource": requireAdmin(user); return removeLeadSource(data.id);
    case "syncLeadsNow":     requireAdmin(user); return syncLeads();
    case "leadSyncOn":       requireAdmin(user); return { success: true, message: installLeadSyncTrigger() };
    case "leadSyncOff":      requireAdmin(user); return { success: true, message: removeLeadSyncTrigger() };
    case "mergeSheet":
      requireAdmin(user);
      if (data.confirm !== "MERGE") return { success: false, error: "Confirmation missing" };
      return mergeLatestIntoSheet({ addColumns: data.addColumns !== false, backup: data.backup !== false });
    case "attachDatabase":
      requireAdmin(user);
      if (data.confirm !== "ATTACH") return { success: false, error: "Confirmation missing" };
      return attachSheet(data.sheet);
    case "createDatabase":
      requireAdmin(user);
      if (data.confirm !== "CREATE NEW") return { success: false, error: "Confirmation missing" };
      return createNewDatabase(data.name);
  }
  const legacy = LEGACY_POST[action];
  if (legacy) {
    const [op, sheet] = legacy;
    if (op === "create") return addRow(sheet, listingGuard(user, sheet, "create", data), who);
    if (op === "update") return updateRow(sheet, listingGuard(user, sheet, "update", data), who);
    if (op === "delete") { listingGuard(user, sheet, "delete", data); return deleteRow(sheet, data[SCHEMA[sheet].id], who); }
  }
  return { success: false, error: "Unknown action: " + action };
}

function checkSheet(key) {
  if (!key || !SCHEMA[key]) throw new Error("Unknown sheet: " + key);
  if (key === "USERS") throw new Error("Use the Users screen to manage users");
  return key;
}

// ============================================================
// SETUP — creates/repairs every tab. Safe to run again any time.
// ============================================================
function setupSheets() {
  const report = [], errors = [];
  const ss = getSS();
  report.push("Spreadsheet: " + ss.getName());

  Object.keys(SCHEMA).forEach(function (key) {
    try {
      const def = SCHEMA[key];
      let sh = ss.getSheetByName(key);
      if (!sh) {
        sh = createTab(ss, key);
        report.push("Created " + key);
      } else {
        const added = ensureColumns(sh, def.headers);
        if (added.length) report.push(key + ": added columns " + added.join(", "));
      }
    } catch (e) {
      errors.push(key + " → " + e.message);
    }
  });
  SpreadsheetApp.flush();

  try {
    const addedRoles = ensureRoles();
    if (addedRoles.length) report.push("Added roles: " + addedRoles.join(", "));
    const roles = sheetToJSON(getSheet("ROLES"));
    const adminRole = roles.find(function (r) { return r.role_name === "Admin"; });
    const users = sheetToJSON(getSheet("USERS"));
    if (!users.some(function (u) { return String(u.username) === "admin"; })) {
      addRow("USERS", { username: "admin", full_name: "Admin User", email: NOTIFY_EMAIL,
        password_hash: hashPassword("admin123"), role_id: adminRole ? adminRole.role_id : "", status: "Active" }, "SETUP");
      report.push("Created user admin / admin123  (please change after first login)");
    } else report.push("Admin user already exists");
  } catch (e) { errors.push("Users/Roles → " + e.message); }

  try {
    const seeded = seedListingRules();
    if (seeded.length) report.push("Listing rules added: " + seeded.join(", "));
    const filled = backfillListingDates();
    if (filled) report.push("Listing dates set for " + filled + " existing listings (so none disappear on day 1)");
  } catch (e) { errors.push("Listing rules → " + e.message); }
  try { report.push(installDailyTrigger()); }
  catch (e) { report.push("⚠️ Daily auto-hide trigger not installed (" + e.message + ") — run installDailyTrigger from the editor once."); }

  try { getSecret(); report.push("Login security key ready"); }
  catch (e) { errors.push("Security key → " + e.message); }

  try { getMediaFolder("General"); report.push("Google Drive folder ready: " + MEDIA_ROOT_FOLDER); }
  catch (e) { errors.push("Drive folder (uploads) → " + e.message + "  (sheets still work; run setupDrive later)"); }

  Logger.log("✅ DONE\n" + report.join("\n") + (errors.length ? "\n\n❌ PROBLEMS:\n" + errors.join("\n") : "\n\nNo problems 🎉"));
  return { success: errors.length === 0, message: errors.length ? "Setup finished with problems" : "Setup complete", report: report, errors: errors };
}

// ------------------------------------------------------------
// RESET ADMIN LOGIN — run this from the editor if login says
// "Invalid username or password". Sets  admin / admin123  (Active, Admin role).
// ------------------------------------------------------------
function resetAdmin() {
  const log = [];
  const sh = getSheet("USERS");
  ensureColumns(sh, SCHEMA.USERS.headers);
  const headers = sh.getRange(2, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  log.push("USERS headers (row 2): " + headers.join(", "));

  // Make sure the Admin role exists
  if (!sheetToJSON(getSheet("ROLES")).some(function (r) { return r.role_name === "Admin"; })) {
    addRow("ROLES", { role_name: "Admin", description: "Admin role" }, "SETUP");
    log.push("Created Admin role");
  }
  const adminRole = sheetToJSON(getSheet("ROLES")).find(function (r) { return r.role_name === "Admin"; });

  const all = sh.getDataRange().getValues();
  const col = function (h) { return headers.indexOf(h); };
  const uCol = col("username");
  log.push("Users found: " + (all.slice(2).map(function (r) { return "[" + r[uCol] + " | status=" + r[col("status")] + "]"; }).join(" ") || "none"));
  let fixed = 0;
  for (let i = 2; i < all.length; i++) {
    if (String(all[i][uCol] || "").toLowerCase().trim() !== "admin") continue;
    const row = all[i].slice();
    if (fixed === 0) {
      if (!row[col("user_id")]) row[col("user_id")] = generateId("USERS");
      row[uCol] = "admin";
      row[col("status")] = "Active";
      row[col("password_hash")] = hashPassword("admin123");
      if (adminRole) row[col("role_id")] = adminRole.role_id;
      if (!row[col("full_name")]) row[col("full_name")] = "Admin User";
      log.push("✅ Existing admin row " + (i + 1) + " reset → password admin123, status Active, role Admin");
    } else {
      row[uCol] = "admin_old_" + (i + 1);   // duplicate admin rows renamed so they can't block login
      log.push("Renamed duplicate admin row " + (i + 1) + " → " + row[uCol]);
    }
    sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
    fixed++;
  }
  if (!fixed) {
    const r = addRow("USERS", { username: "admin", full_name: "Admin User", status: "Active",
      password_hash: hashPassword("admin123"), role_id: adminRole ? adminRole.role_id : "" }, "SETUP");
    log.push("✅ Created admin user " + r.id + " → admin / admin123");
  }
  SpreadsheetApp.flush();
  const test = loginUser({ username: "admin", password: "admin123" });
  log.push(test.success ? "✅ Login test PASSED — you can log in on the website now." : "❌ Login test failed: " + test.error);
  Logger.log(log.join("\n"));
}

// ------------------------------------------------------------
// NEW DATABASE — creates a brand-new, EMPTY Google Sheet with every tab, header, role and the admin login,
// then switches the whole system (website + admin + partner portal) to it. Nothing is copied from the old
// sheet and the old sheet is left untouched. Run from the editor (▶ createNewDatabase) or Admin → Settings.
// Go back any time with  useExistingDatabase("<sheet id>").
// ------------------------------------------------------------
function createNewDatabase(name) {
  const stamp = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm");
  const ss = SpreadsheetApp.create((name && String(name).trim()) || "ApnaGhar ERP Database " + stamp);
  PropertiesService.getScriptProperties().setProperty("DB_SPREADSHEET_ID", ss.getId());
  _ss = null; _rules = null;                       // forget the old sheet for the rest of this run
  const res = setupSheets();                        // all tabs + columns + roles + admin + listing rules + nightly trigger
  try {                                             // remove Google's empty default tab
    const def = getSS().getSheetByName("Sheet1");
    if (def && getSS().getSheets().length > 1) getSS().deleteSheet(def);
  } catch (e) {}
  const out = { success: res.success, id: ss.getId(), url: ss.getUrl(), message: "New database created and activated", report: res.report, errors: res.errors };
  Logger.log("✅ NEW DATABASE READY\n" + ss.getUrl() + "\nLogin: admin / admin123\n" + res.report.join("\n"));
  return out;
}

// Point the system at any existing Google Sheet (e.g. go back to the old one). Run setupSheets afterwards.
function useExistingDatabase(sheetId) {
  if (!sheetId) throw new Error("Pass the Google Sheet ID, e.g. useExistingDatabase('1AbC...')");
  SpreadsheetApp.openById(sheetId);                 // throws if it cannot be opened
  PropertiesService.getScriptProperties().setProperty("DB_SPREADSHEET_ID", sheetId);
  _ss = null; _rules = null;
  return setupSheets();
}

function getDbInfo() {
  const ss = getSS();
  return { success: true, data: { id: ss.getId(), name: ss.getName(), url: ss.getUrl(), tabs: ss.getSheets().length, default_id: SPREADSHEET_ID, is_default: ss.getId() === SPREADSHEET_ID } };
}

// ------------------------------------------------------------
// ATTACH A GOOGLE SHEET — make the website / admin / partner portal read & write THIS sheet.
// Nothing is deleted or copied: missing tabs / columns are added, your data stays as it is.
//   • attachProjectSheet()      → re-attaches the sheet written in SPREADSHEET_ID at the top of this file
//   • attachSheet("<link|id>")  → attaches any other sheet (also: Admin → Settings → Attach Google Sheet)
// The person who deployed the web app must be able to EDIT that sheet.
// ------------------------------------------------------------
function extractSheetId(v) {
  const s = String(v || "").trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : "";
}

function attachSheet(urlOrId) {
  const id = extractSheetId(urlOrId);
  if (!id) return { success: false, error: "Paste the Google Sheet link (https://docs.google.com/spreadsheets/d/…) or its ID" };
  let ss;
  try { ss = SpreadsheetApp.openById(id); }
  catch (e) { return { success: false, error: "Cannot open that sheet: " + e.message + ". Share it (Editor) with the Google account that deployed this web app." }; }
  const props = PropertiesService.getScriptProperties();
  if (id === SPREADSHEET_ID) props.deleteProperty("DB_SPREADSHEET_ID"); else props.setProperty("DB_SPREADSHEET_ID", id);
  _ss = null; _rules = null;
  const res = setupSheets();                        // adds only what is missing (tabs, columns, roles, listing rules)
  return { success: true, id: id, name: ss.getName(), url: ss.getUrl(), message: "Attached: " + ss.getName(), report: (res.report || []).concat((res.errors || []).map(function (e) { return "⚠ " + e; })), errors: res.errors };   // attached even if a setup step had a warning
}

function attachProjectSheet() {
  const r = attachSheet(SPREADSHEET_ID);
  Logger.log((r.success ? "✅ " : "❌ ") + (r.message || r.error) + (r.url ? "\n" + r.url : "") + "\n" + (r.report || []).join("\n"));
  return r;
}

// Run separately if the Drive step failed in setupSheets
function setupDrive() {
  const f = getMediaFolder("General");
  Logger.log("Drive folder OK: " + f.getUrl());
}

// Quick diagnosis — run this if anything fails and share the log
function diagnose() {
  const out = [];
  try { const ss = getSS(); out.push("✅ Sheet opened: " + ss.getName() + " (" + ss.getSheets().length + " tabs)"); }
  catch (e) { out.push("❌ Cannot open sheet: " + e.message); }
  try { DriveApp.getRootFolder().getName(); out.push("✅ Drive access OK"); }
  catch (e) { out.push("❌ Drive: " + e.message); }
  try { PropertiesService.getScriptProperties().getKeys(); out.push("✅ Script properties OK"); }
  catch (e) { out.push("❌ Properties: " + e.message); }
  try { out.push("✅ Email quota left today: " + MailApp.getRemainingDailyQuota()); }
  catch (e) { out.push("⚠️ Email: " + e.message); }
  out.push("Account: " + Session.getEffectiveUser().getEmail());
  Logger.log(out.join("\n"));
}

// Which Google Sheet is the database?  A sheet created by createNewDatabase() (saved in Script Properties)
// wins; otherwise the SPREADSHEET_ID constant at the top of this file.
function dbId() { return PropertiesService.getScriptProperties().getProperty("DB_SPREADSHEET_ID") || SPREADSHEET_ID; }

// Opens the Sheet by ID; falls back to the Sheet this script is attached to.
function getSS() {
  try { return SpreadsheetApp.openById(dbId()); }
  catch (e) {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error("Cannot open spreadsheet " + dbId() + ": " + e.message);
  }
}

// New tabs have only 26 columns (A–Z); widen before writing more headers.
function ensureWidth(sheet, n) {
  const max = sheet.getMaxColumns();
  if (max < n) sheet.insertColumnsAfter(max, n - max);
}

function createTab(ss, key) {
  const def = SCHEMA[key];
  const sh = ss.insertSheet(key);
  ensureWidth(sh, def.headers.length);
  sh.getRange(1, 1).setValue(def.title).setFontWeight("bold").setFontSize(13);
  sh.getRange(2, 1, 1, def.headers.length).setValues([def.headers])
    .setFontWeight("bold").setBackground("#1e3a5f").setFontColor("#ffffff");
  sh.setFrozenRows(2);
  return sh;
}

// Adds any missing header columns at the end of row 2. Returns names added.
function ensureColumns(sheet, wanted) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  let headers = sheet.getRange(2, 1, 1, lastCol).getValues()[0].map(String);
  if (headers.every(function (h) { return h === ""; })) headers = [];
  const missing = wanted.filter(function (h) { return h && /^[a-z0-9_]+$/.test(h) && headers.indexOf(h) === -1; });
  if (missing.length) {
    ensureWidth(sheet, headers.length + missing.length);
    sheet.getRange(2, headers.length + 1, 1, missing.length).setValues([missing])
      .setFontWeight("bold").setBackground("#1e3a5f").setFontColor("#ffffff");
  }
  return missing;
}

// ============================================================
// CORE DATA HELPERS
// ============================================================
let _ss = null;
function getSheet(key) {
  if (!_ss) _ss = getSS();
  let sh = _ss.getSheetByName(key);
  if (!sh && SCHEMA[key]) sh = createTab(_ss, key);   // auto-create on first use
  if (!sh) throw new Error("Sheet not found: " + key);
  return sh;
}

function cellOut(v) {
  if (v === "" || v === null || v === undefined) return null;
  if (Object.prototype.toString.call(v) === "[object Date]") {
    const hasTime = v.getHours() || v.getMinutes();
    return Utilities.formatDate(v, TZ, hasTime ? "yyyy-MM-dd HH:mm" : "yyyy-MM-dd");
  }
  return v;
}

function sheetToJSON(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 3) return [];
  const headers = data[1].map(String);
  return data.slice(2).map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) { if (h) obj[h] = cellOut(row[i]); });
    return obj;
  }).filter(function (row) { return Object.keys(row).some(function (k) { return row[k] !== null; }); });
}

function listRows(key) {
  const rows = sheetToJSON(getSheet(key));
  return { success: true, count: rows.length, data: rows };
}

function getById(key, id) {
  const idField = SCHEMA[key].id;
  const found = sheetToJSON(getSheet(key)).find(function (r) { return String(r[idField]) === String(id); });
  return found ? { success: true, data: found } : { success: false, error: "Record not found" };
}

function cleanValue(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return /^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? "'" + s : v; // block formula injection
}

function generateId(key) {
  const prefix = (SCHEMA[key] && SCHEMA[key].prefix) || "REC";
  return prefix + Utilities.formatDate(new Date(), TZ, "yyMMdd") + Math.floor(1000 + Math.random() * 9000);
}

function addRow(key, data, who) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sheet = getSheet(key);
    const def = SCHEMA[key];
    const keys = Object.keys(data).filter(function (k) { return /^[a-z0-9_]+$/.test(k); });
    ensureColumns(sheet, def.headers.concat(keys));
    const headers = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const idField = headers.indexOf(def.id) !== -1 ? def.id : headers[0];
    const newId = generateId(key);
    data[idField] = newId;
    const now = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm");
    data.created_at = now; data.updated_at = now;
    sheet.appendRow(headers.map(function (h) { return data[h] !== undefined ? cleanValue(data[h]) : ""; }));
    if (key !== "USER_ACTIVITY_LOG" && key !== "LISTING_LOG" && key !== "LEAD_SYNC_LOG") logActivity(who, "Add", key, newId);
    return { success: true, id: newId, message: "Record added successfully" };
  } finally { lock.releaseLock(); }
}

function updateRow(key, data, who) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sheet = getSheet(key);
    const idField = SCHEMA[key].id;
    const id = data[idField] || data.id;
    if (!id) return { success: false, error: "Missing " + idField };
    const keys = Object.keys(data).filter(function (k) { return /^[a-z0-9_]+$/.test(k) && k !== "id" && k !== "created_at"; });
    ensureColumns(sheet, keys.concat(["updated_at"]));
    const all = sheet.getDataRange().getValues();
    const headers = all[1].map(String);
    const idCol = headers.indexOf(idField);
    if (idCol === -1) return { success: false, error: "ID column not found: " + idField };
    data.updated_at = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm");
    for (let i = 2; i < all.length; i++) {
      if (String(all[i][idCol]) === String(id)) {
        const row = all[i].slice();
        headers.forEach(function (h, j) {
          if (h !== idField && h !== "created_at" && data[h] !== undefined) row[j] = cleanValue(data[h]);
        });
        sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
        logActivity(who, "Update", key, id);
        return { success: true, id: id, message: "Record updated successfully" };
      }
    }
    return { success: false, error: "Record not found" };
  } finally { lock.releaseLock(); }
}

function deleteRow(key, id, who) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sheet = getSheet(key);
    const all = sheet.getDataRange().getValues();
    const idCol = all[1].map(String).indexOf(SCHEMA[key].id);
    for (let i = 2; i < all.length; i++) {
      if (String(all[i][idCol]) === String(id)) {
        sheet.deleteRow(i + 1);
        logActivity(who, "Delete", key, id);
        return { success: true, message: "Record deleted" };
      }
    }
    return { success: false, error: "Record not found" };
  } finally { lock.releaseLock(); }
}

function logActivity(who, action, module, recordId) {
  try {
    getSheet("USER_ACTIVITY_LOG").appendRow([
      generateId("USER_ACTIVITY_LOG"), who || "SYSTEM", module, action, recordId,
      Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm:ss"), "API"]);
  } catch (e) { /* never block the main action */ }
}

// ============================================================
// FILE UPLOAD → Google Drive  (images, videos, PDFs)
// Link is returned to the page, saved in the record's column,
// and also logged in the MEDIA_LIBRARY sheet.
// ============================================================
function getMediaFolder(moduleName) {
  const rootIt = DriveApp.getFoldersByName(MEDIA_ROOT_FOLDER);
  const root = rootIt.hasNext() ? rootIt.next() : DriveApp.createFolder(MEDIA_ROOT_FOLDER);
  const name = String(moduleName || "General").replace(/[^\w \-]/g, "");
  const subIt = root.getFoldersByName(name);
  return subIt.hasNext() ? subIt.next() : root.createFolder(name);
}

function uploadFile(data, who) {
  if (!data.base64) return { success: false, error: "No file data received" };
  const mime = data.mime_type || "application/octet-stream";
  const bytes = Utilities.base64Decode(String(data.base64).replace(/^data:[^,]+,/, ""));
  const fileName = (data.file_name || "upload").replace(/[\\\/:*?"<>|]/g, "_");
  const blob = Utilities.newBlob(bytes, mime, fileName);
  const folder = getMediaFolder(data.module || "General");
  const file = folder.createFile(blob);
  file.setDescription("Uploaded via ApnaGhar ERP by " + who + (data.record_id ? " for " + data.record_id : ""));
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    return { success: false, error: "File saved but could not be made public (Drive sharing is restricted on this account): " + e.message };
  }
  const id = file.getId();
  const type = mime.indexOf("image/") === 0 ? "image" : mime.indexOf("video/") === 0 ? "video" : "document";
  const url = type === "image" ? "https://lh3.googleusercontent.com/d/" + id
            : type === "video" ? "https://drive.google.com/file/d/" + id + "/preview"
            : "https://drive.google.com/file/d/" + id + "/view";
  const rec = {
    file_name: fileName, media_type: type, mime_type: mime, size_kb: Math.round(bytes.length / 1024),
    module: data.module || "General", record_id: data.record_id || "", file_id: id, url: url,
    view_url: "https://drive.google.com/file/d/" + id + "/view",
    download_url: "https://drive.google.com/uc?export=download&id=" + id, uploaded_by: who,
  };
  const saved = addRow("MEDIA_LIBRARY", rec, who);
  rec.media_id = saved.id;
  return { success: true, message: "Uploaded", data: rec, url: url };
}

// ============================================================
// PUBLIC DATA
// ============================================================
function getProperties(p) {
  let rows = sheetToJSON(getSheet("PROPERTIES"));
  const scope = agentScope(p.token);               // staff "Agent" role → own listings only (incl. inactive)
  if (scope) rows = rows.filter(scope);
  else if (!isStaffToken(p.token)) rows = rows.filter(function (r) { return isLive(r, "PROPERTIES"); });   // public: approved + not expired
  rows = decorateListings("PROPERTIES", rows);
  const lc = function (v) { return String(v || "").toLowerCase(); };
  if (p.listing_type)  rows = rows.filter(function (r) { return r.listing_type === p.listing_type; });
  if (p.bhk)           rows = rows.filter(function (r) { return lc(r.bhk).replace(/\s/g, "") === lc(p.bhk).replace(/\s/g, ""); });
  if (p.city)          rows = rows.filter(function (r) { return lc(r.city).indexOf(lc(p.city)) !== -1; });
  if (p.status)        rows = rows.filter(function (r) { return r.status === p.status; });
  if (p.property_type) rows = rows.filter(function (r) { return r.property_type === p.property_type; });
  if (p.project_id)    rows = rows.filter(function (r) { return String(r.project_id) === String(p.project_id); });
  if (p.min_price)     rows = rows.filter(function (r) { return Number(r.expected_price || r.expected_rent) >= Number(p.min_price); });
  if (p.max_price)     rows = rows.filter(function (r) { return Number(r.expected_price || r.expected_rent) <= Number(p.max_price); });
  if (p.society_id)    rows = rows.filter(function (r) { return String(r.society_id) === String(p.society_id); });
  if (p.area)          rows = rows.filter(function (r) { return lc(r.area).indexOf(lc(p.area)) !== -1; });
  if (p.society)       rows = rows.filter(function (r) { return String(r.society_id) === String(p.society) || lc(r.society_name).indexOf(lc(p.society)) !== -1; });
  if (p.agent_id)      rows = rows.filter(function (r) { return String(r.agent_id) === String(p.agent_id); });
  if (p.q) {
    const q = lc(p.q);
    rows = rows.filter(function (r) { return [r.title, r.city, r.area, r.address, r.society_name, r.society_address, r.bhk, r.property_type].some(function (v) { return lc(v).indexOf(q) !== -1; }); });
  }
  rows.reverse(); // newest first
  const page = parseInt(p.page) || 1, limit = parseInt(p.limit) || 20;
  const total = rows.length, start = (page - 1) * limit;
  return { success: true, total: total, page: page, limit: limit, count: Math.min(limit, Math.max(0, total - start)), data: rows.slice(start, start + limit) };
}

function getFeaturedProperties() {
  let rows = decorateListings("PROPERTIES", sheetToJSON(getSheet("PROPERTIES")).filter(function (r) { return r.status === "Available" && isLive(r, "PROPERTIES"); })).reverse();
  const featured = rows.filter(function (r) { return String(r.featured).toLowerCase() === "yes" || r.featured === true; });
  rows = featured.concat(rows.filter(function (r) { return featured.indexOf(r) === -1; })).slice(0, 6);
  return { success: true, count: rows.length, data: rows };
}

function searchProperties(p) { return getProperties({ q: p.q, limit: 1000 }); }

function getLand(p) {
  let rows = sheetToJSON(getSheet("LAND_PROPERTIES"));
  const scope = agentScope(p.token);
  if (scope) rows = rows.filter(scope);
  else if (!isStaffToken(p.token)) rows = rows.filter(function (r) { return isLive(r, "LAND_PROPERTIES"); });
  rows = decorateListings("LAND_PROPERTIES", rows);
  const lc = function (v) { return String(v || "").toLowerCase(); };
  if (p.area) rows = rows.filter(function (r) { return [r.area, r.village, r.taluka].some(function (v) { return lc(v).indexOf(lc(p.area)) !== -1; }); });
  if (p.min_price) rows = rows.filter(function (r) { return Number(r.price) >= Number(p.min_price); });
  if (p.max_price) rows = rows.filter(function (r) { return Number(r.price) <= Number(p.max_price); });
  if (p.land_type) rows = rows.filter(function (r) { return r.land_type === p.land_type; });
  if (p.district)  rows = rows.filter(function (r) { return lc(r.district).indexOf(lc(p.district)) !== -1; });
  if (p.status)    rows = rows.filter(function (r) { return r.status === p.status; });
  if (p.q) { const q = lc(p.q); rows = rows.filter(function (r) { return [r.title, r.area, r.village, r.taluka, r.district, r.survey_no].some(function (v) { return lc(v).indexOf(q) !== -1; }); }); }
  return { success: true, count: rows.length, data: rows.reverse() };
}

function getNewProjects(p) {
  let rows = sheetToJSON(getSheet("NEW_PROJECTS")).filter(function (r) { return r.status !== "Inactive" && isLive(r); });
  if (p.launch_status) rows = rows.filter(function (r) { return r.launch_status === p.launch_status; });
  if (p.city) rows = rows.filter(function (r) { return String(r.city || "").toLowerCase().indexOf(String(p.city).toLowerCase()) !== -1; });
  rows.reverse();
  rows.sort(function (a, b) { return (String(b.featured) === "Yes") - (String(a.featured) === "Yes"); });
  if (p.limit) rows = rows.slice(0, parseInt(p.limit));
  return { success: true, count: rows.length, data: rows };
}

function getNewProject(id, token) {
  const staff = isStaffToken(token);
  const res = getById("NEW_PROJECTS", id);
  if (!res.success || (!staff && (res.data.status === "Inactive" || !isLive(res.data)))) return { success: false, error: "Project not found" };
  res.units = sheetToJSON(getSheet("PROPERTIES")).filter(function (r) { return String(r.project_id) === String(id) && (staff || isLive(r, "PROPERTIES")); });
  return res;
}

function safeRows(key) { try { return sheetToJSON(getSheet(key)); } catch (e) { return []; } }

function getDashboardStats(full) {
  const props = safeRows("PROPERTIES"), clients = safeRows("CLIENTS"), agents = safeRows("AGENTS");
  const land = safeRows("LAND_PROPERTIES"), projects = safeRows("NEW_PROJECTS");
  const data = {
    total_properties: props.length,
    available_properties: props.filter(function (p) { return p.status === "Available"; }).length,
    total_clients: clients.length,
    active_agents: agents.filter(function (a) { return a.status === "Active"; }).length,
    total_land: land.length,
    total_new_projects: projects.filter(function (p) { return p.status !== "Inactive"; }).length,
  };
  if (full !== true) return { success: true, data: data }; // public: counts only

  const payments = safeRows("RENT_PAYMENTS"), deals = safeRows("SALE_DEALS"), followups = safeRows("FOLLOWUPS");
  const bookings = safeRows("PROPERTY_BOOKINGS"), inquiries = safeRows("WEBSITE_INQUIRIES");
  const ym = Utilities.formatDate(new Date(), TZ, "yyyy-MM");
  const inMonth = function (d) { return d && String(d).indexOf(ym) === 0; };
  Object.assign(data, {
    rented_properties: props.filter(function (p) { return p.status === "Rented"; }).length,
    sold_properties: props.filter(function (p) { return p.status === "Sold"; }).length,
    new_clients_this_month: clients.filter(function (c) { return inMonth(c.created_at); }).length,
    total_agents: agents.length,
    available_land: land.filter(function (l) { return l.status === "Available"; }).length,
    pending_followups: followups.filter(function (f) { return f.followup_status === "Pending"; }).length,
    total_deals: deals.length,
    registered_deals: deals.filter(function (d) { return d.deal_status === "Registered"; }).length,
    monthly_rent_income: payments.filter(function (p) { return p.payment_status === "Paid" && inMonth(p.paid_date); }).reduce(function (s, p) { return s + Number(p.rent_amount || 0); }, 0),
    monthly_sale_revenue: deals.filter(function (d) { return d.deal_status === "Registered" && inMonth(d.registration_date); }).reduce(function (s, d) { return s + Number(d.final_price || 0); }, 0),
    total_bookings: bookings.length,
    active_bookings: bookings.filter(function (b) { return b.booking_status === "Active" || b.booking_status === "Enquiry"; }).length,
    new_inquiries: inquiries.filter(function (i) { return i.status === "New"; }).length,
    expired_listings: props.filter(function (r) { return listingInfo("PROPERTIES", r).expired; }).length + land.filter(function (r) { return listingInfo("LAND_PROPERTIES", r).expired; }).length,
    pending_users: safeRows("USERS").filter(function (u) { return String(u.status).trim() === "Pending"; }).length,
    pending_ads: props.concat(projects).filter(function (r) { return String(r.approval_status).trim() === "Pending"; }).length,
    last_updated: new Date().toISOString(),
  });
  return { success: true, data: data };
}

// ============================================================
// PUBLIC FORMS  (website → Google Sheet)
// ============================================================
function validMobile(m) { return /^[6-9]\d{9}$/.test(String(m || "").replace(/\D/g, "").slice(-10)); }
function normMobile(m) { return String(m || "").replace(/\D/g, "").slice(-10); }

function findOrCreateClient(d) {
  const mobile = normMobile(d.mobile);
  const existing = sheetToJSON(getSheet("CLIENTS")).find(function (c) { return normMobile(c.mobile) === mobile; });
  if (existing) return existing.client_id;
  return addRow("CLIENTS", {
    client_type: d.client_type || "Buyer", full_name: d.full_name || d.name || "", mobile: mobile,
    email: d.email || "", lead_source: "Website", lead_status: "New", remarks: d.message || "",
  }, "WEBSITE").id;
}

function notify(subject, lines) {
  if (!NOTIFY_EMAIL) return;
  try { MailApp.sendEmail(NOTIFY_EMAIL, "[ApnaGhar] " + subject, lines.filter(String).join("\n")); } catch (e) { /* quota */ }
}

function submitContactForm(d) {
  if (!d.full_name && !d.name) return { success: false, error: "Name is required" };
  if (!validMobile(d.mobile)) return { success: false, error: "Valid 10-digit mobile number दें" };
  const clientId = findOrCreateClient(d);
  addRow("WEBSITE_INQUIRIES", {
    inquiry_type: d.inquiry_type || d.client_type || "General", full_name: d.full_name || d.name, mobile: normMobile(d.mobile),
    email: d.email || "", client_id: clientId, property_id: d.property_id || "", project_id: d.project_id || "",
    message: d.message || "", source_page: d.source_page || "", status: "New",
  }, "WEBSITE");
  notify("New inquiry from " + (d.full_name || d.name), ["Mobile: " + d.mobile, "Type: " + (d.inquiry_type || d.client_type || ""), "Message: " + (d.message || ""), d.property_id ? "Property: " + d.property_id : "", d.project_id ? "Project: " + d.project_id : ""]);
  return { success: true, message: "Thank you! हमारी टीम 24 घंटों में संपर्क करेगी।" };
}

function submitWebsiteBooking(d) {
  if (!d.full_name) return { success: false, error: "Name is required" };
  if (!validMobile(d.mobile)) return { success: false, error: "Valid 10-digit mobile number दें" };
  if (!d.project_id && !d.property_id) return { success: false, error: "Project / property missing" };
  const clientId = findOrCreateClient(d);
  const res = addRow("PROPERTY_BOOKINGS", {
    booking_for: d.project_id ? "Project" : "Property", project_id: d.project_id || "", property_id: d.property_id || "",
    configuration: d.configuration || "", client_id: clientId, customer_name: d.full_name, customer_mobile: normMobile(d.mobile),
    customer_email: d.email || "", booking_date: Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"),
    booking_status: "Enquiry", source: "Website", notes: d.message || "",
  }, "WEBSITE");
  notify("New booking request (" + res.id + ")", ["Name: " + d.full_name, "Mobile: " + d.mobile, "Project: " + (d.project_id || ""), "Property: " + (d.property_id || ""), "Configuration: " + (d.configuration || ""), "Message: " + (d.message || "")]);
  return { success: true, id: res.id, message: "Booking request received! Booking ID: " + res.id + ". हमारी टीम जल्द ही संपर्क करेगी।" };
}

function submitWebsiteSiteVisit(d) {
  if (!d.full_name) return { success: false, error: "Name is required" };
  if (!validMobile(d.mobile)) return { success: false, error: "Valid 10-digit mobile number दें" };
  const clientId = findOrCreateClient(d);
  const res = addRow("SITE_VISITS", {
    client_id: clientId, property_id: d.property_id || "", project_id: d.project_id || "",
    visit_date: d.visit_date || "", visit_time: d.visit_time || "", visit_status: "Scheduled",
    feedback: d.message || "", source: "Website",
  }, "WEBSITE");
  notify("Site visit request", ["Name: " + d.full_name, "Mobile: " + d.mobile, "Date: " + (d.visit_date || "") + " " + (d.visit_time || ""), "Property: " + (d.property_id || ""), "Project: " + (d.project_id || "")]);
  return { success: true, id: res.id, message: "Site visit request received! समय confirm करने के लिए हम call करेंगे।" };
}

// ============================================================
// AUTH  (signed token; passwords stored as salted SHA-256)
// ============================================================
function getSecret() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty("TOKEN_SECRET");
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty("TOKEN_SECRET", s); }
  return s;
}
function b64(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ""); }
function hex(bytes) { return bytes.map(function (b) { return (b < 0 ? b + 256 : b).toString(16).padStart(2, "0"); }).join(""); }
function hashPassword(pw) { return "sha256:" + hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pw) + "|apnaghar|" + SPREADSHEET_ID)); }
function legacyMd5(pw) { return hex(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, pw + "apnaghar_salt")); }

function makeToken(u) {
  const payload = b64(Utilities.newBlob(JSON.stringify({ uid: u.user_id, un: u.username, role: u.role, exp: Date.now() + TOKEN_DAYS * 86400000 })).getBytes());
  return payload + "." + b64(Utilities.computeHmacSha256Signature(payload, getSecret()));
}

function requireAuth(token) {
  if (!token) throw new Error("AUTH: Login required");
  const parts = String(token).split(".");
  if (parts.length !== 2 || b64(Utilities.computeHmacSha256Signature(parts[0], getSecret())) !== parts[1]) throw new Error("AUTH: Invalid session, please login again");
  const p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0] + "===".slice((parts[0].length + 3) % 4))).getDataAsString());
  if (p.exp < Date.now()) throw new Error("AUTH: Session expired, please login again");
  return { user_id: p.uid, username: p.un, role: p.role };
}
function requireAdmin(u) { if (u.role !== "Admin") throw new Error("Only Admin users can do this"); }

function loginUser(d) {
  const users = sheetToJSON(getSheet("USERS"));
  const roles = sheetToJSON(getSheet("ROLES"));
  const uname = String(d.username || "").toLowerCase().trim();
  const matches = users.filter(function (u) { return String(u.username || "").toLowerCase().trim() === uname; });
  const user = matches.find(function (u) { return String(u.status || "Active").trim().toLowerCase() === "active"; }) || matches[0];
  if (!user) return { success: false, error: "Invalid username or password" };
  const stored = String(user.password_hash || "").trim();
  const pw = String(d.password || "");
  const ok = stored === hashPassword(pw) || stored === legacyMd5(pw) || (stored !== "" && stored.trim() === pw);
  if (!ok) return { success: false, error: "Invalid username or password" };
  const st = String(user.status || "Active").trim().toLowerCase();
  if (st === "pending") return { success: false, error: "Your account is waiting for admin approval. We will call you shortly." };
  if (st !== "active") return { success: false, error: "This account is " + user.status + ". Please contact " + NOTIFY_EMAIL };
  if (stored.indexOf("sha256:") !== 0) updateRow("USERS", { user_id: user.user_id, password_hash: hashPassword(d.password) }, "SYSTEM"); // upgrade old hash
  const role = roles.find(function (r) { return String(r.role_id) === String(user.role_id); });
  const out = { user_id: user.user_id, username: user.username, full_name: user.full_name, email: user.email,
    role: role ? role.role_name : "User", role_id: user.role_id, agent_id: user.agent_id,
    user_type: user.user_type || "", company_name: user.company_name || "", mobile: user.mobile || "" };
  out.is_partner = isPartnerRole(out.role);
  out.token = makeToken(out);
  try { updateRow("USERS", { user_id: user.user_id, last_login: Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm") }, user.username); } catch (e) {}
  return { success: true, user: out, message: "Login successful" };
}

function listUsersSafe() {
  const rows = sheetToJSON(getSheet("USERS")).map(function (u) { delete u.password_hash; return u; });
  return { success: true, count: rows.length, data: rows };
}

function saveUser(d, who) {
  const rec = { username: d.username, full_name: d.full_name, email: d.email, mobile: d.mobile, role_id: d.role_id, agent_id: d.agent_id, status: d.status || "Active",
    user_type: d.user_type, company_name: d.company_name, rera_number: d.rera_number, city: d.city };
  if (d.password) rec.password_hash = hashPassword(d.password);
  const users = sheetToJSON(getSheet("USERS"));
  const clash = users.find(function (u) { return String(u.username).toLowerCase() === String(d.username).toLowerCase() && String(u.user_id) !== String(d.user_id || ""); });
  if (clash) return { success: false, error: "Username already exists" };
  if (d.user_id) { rec.user_id = d.user_id; return updateRow("USERS", rec, who); }
  if (!d.password) return { success: false, error: "Password is required for a new user" };
  return addRow("USERS", rec, who);
}

function changePassword(user, d) {
  const u = sheetToJSON(getSheet("USERS")).find(function (x) { return String(x.user_id) === String(user.user_id); });
  if (!u) return { success: false, error: "User not found" };
  const s = String(u.password_hash || "");
  if (!(s === hashPassword(d.old_password) || s === legacyMd5(d.old_password) || s === String(d.old_password))) return { success: false, error: "Current password is wrong" };
  if (!d.new_password || String(d.new_password).length < 6) return { success: false, error: "New password must be at least 6 characters" };
  return updateRow("USERS", { user_id: u.user_id, password_hash: hashPassword(d.new_password) }, user.username);
}

// ============================================================
// POST-YOUR-AD PARTNERS  (Agents / Builders / Owners)
// ============================================================
function isPartnerRole(role) { return Object.keys(PARTNER_ROLES).some(function (k) { return PARTNER_ROLES[k] === role; }); }
function requireStaff(u) { if (isPartnerRole(u.role)) throw new Error("Partner accounts can only manage their own ads"); }
// isLive(row)            → approved? (projects)
// isLive(row, sheet)     → approved AND not expired (PROPERTIES / LAND_PROPERTIES listings)
function isLive(r, sheet) {
  const a = String(r.approval_status || "").trim();
  if (!(a === "" || a === "Approved")) return false;
  if (typeof sheet === "string" && LISTING_SHEETS[sheet]) return !listingInfo(sheet, r).expired;
  return true;
}
function isStaffToken(token) { try { return !!token && !isPartnerRole(requireAuth(token).role); } catch (e) { return false; } }

function getPublicById(key, id, token) {
  const res = getById(key, id);
  if (!res.success) return res;
  const scope = agentScope(token);
  if (scope) { if (!scope(res.data)) return { success: false, error: "Record not found" }; }
  else if (!isStaffToken(token) && !isLive(res.data, key)) return { success: false, error: "Record not found" };
  if (LISTING_SHEETS[key]) decorateListing(key, res.data, key === "PROPERTIES" ? societyMap() : null);
  return res;
}

function ensureRoles() {
  const have = sheetToJSON(getSheet("ROLES")).map(function (r) { return r.role_name; });
  const want = STAFF_ROLES.concat(Object.keys(PARTNER_ROLES).map(function (k) { return PARTNER_ROLES[k]; }));
  const added = [];
  want.forEach(function (r) {
    if (have.indexOf(r) === -1) { addRow("ROLES", { role_name: r, description: (isPartnerRole(r) ? "Post-your-ad partner: " : "") + r }, "SETUP"); added.push(r); }
  });
  return added;
}
function roleIdByName(name) {
  ensureRoles();
  const r = sheetToJSON(getSheet("ROLES")).find(function (x) { return x.role_name === name; });
  return r ? r.role_id : "";
}

// Public self-registration from website/post-ad.html
function registerPartner(d) {
  const type = String(d.user_type || "");
  if (!PARTNER_ROLES[type]) return { success: false, error: "Select Agent, Builder or Owner" };
  if (!d.full_name || String(d.full_name).trim().length < 3) return { success: false, error: "पूरा नाम दें" };
  if (!validMobile(d.mobile)) return { success: false, error: "Valid 10-digit mobile number दें" };
  if (!/^[a-zA-Z0-9_.]{3,30}$/.test(String(d.username || ""))) return { success: false, error: "Username: 3–30 letters/numbers, no spaces" };
  if (String(d.password || "").length < 6) return { success: false, error: "Password must be at least 6 characters" };
  if (type === "Builder" && !d.company_name) return { success: false, error: "Builder / company name is required" };
  const users = sheetToJSON(getSheet("USERS"));
  const uname = String(d.username).toLowerCase();
  if (users.some(function (u) { return String(u.username || "").toLowerCase().trim() === uname; })) return { success: false, error: "This username is already taken — choose another" };
  const mob = normMobile(d.mobile);
  if (users.some(function (u) { return normMobile(u.mobile) === mob && PARTNER_ROLES[u.user_type]; })) return { success: false, error: "An account with this mobile already exists. Please login, or contact us to reset password." };
  const res = addRow("USERS", {
    username: d.username, full_name: String(d.full_name).trim(), email: d.email || "", mobile: mob,
    password_hash: hashPassword(d.password), role_id: roleIdByName(PARTNER_ROLES[type]), user_type: type,
    company_name: d.company_name || "", rera_number: d.rera_number || "", city: d.city || "Pune",
    status: AUTO_APPROVE_PARTNERS ? "Active" : "Pending",
  }, "WEBSITE");
  notify("New " + type + " registration: " + d.full_name, ["Mobile: " + mob, "Company: " + (d.company_name || "-"), "RERA: " + (d.rera_number || "-"), "Username: " + d.username, "", "Approve in Admin → Approvals"]);
  return { success: true, id: res.id, message: AUTO_APPROVE_PARTNERS ? "Account created! You can login now." : "Registration received ✅ Admin will verify and activate your account (usually within 24 hours). You will be able to login after approval." };
}

const PARTNER_FIELDS = {
  PROPERTIES: ["title","property_type","listing_type","bhk","furnished_status","carpet_area","builtup_area","floor","total_floors","facing","city","area","address","society_id","society_name","project_id","expected_price","expected_rent","deposit_amount","amenities","description","contact_name","contact_mobile","status"].concat(MEDIA_COLS),
  LAND_PROPERTIES: ["title","land_type","survey_no","village","taluka","district","area","area_value","area_unit","price","price_per_unit","road_touch","zone","ownership","status","description","contact_name","contact_mobile","image1_url","image2_url","image3_url","video_url","document_url"],
  NEW_PROJECTS: ["project_name","builder_name","project_type","launch_status","location","city","rera_number","configurations","price_from","price_to","carpet_from","carpet_to","total_towers","total_units","available_units","launch_date","possession_date","booking_amount","offer","amenities","highlights","description","map_url","floor_plan_url","contact_name","contact_mobile"].concat(MEDIA_COLS),
};

function partnerSheet(user, sheet) {
  if (!PARTNER_FIELDS[sheet]) throw new Error("You can post Properties, Land or Projects only");
  if (sheet === "NEW_PROJECTS" && isPartnerRole(user.role) && user.role !== PARTNER_ROLES.Builder) throw new Error("Only Builder accounts can post New Launch Projects");
  return sheet;
}
function ownedRecord(user, sheet, id) {
  const r = getById(sheet, id);
  if (!r.success) throw new Error("Listing not found");
  if (String(r.data.posted_by) !== String(user.user_id)) throw new Error("You can only edit your own listings");
  return r.data;
}

function savePartnerListing(user, sheet, data) {
  sheet = partnerSheet(user, sheet);
  const idField = SCHEMA[sheet].id, id = data[idField];
  const rec = {};
  PARTNER_FIELDS[sheet].forEach(function (f) { if (data[f] !== undefined) rec[f] = data[f]; });
  if (sheet === "PROPERTIES" && rec.status && ["Available","Booked","Sold","Rented"].indexOf(rec.status) === -1) delete rec.status;
  if (sheet === "LAND_PROPERTIES" && rec.status && ["Available","Booked","Sold"].indexOf(rec.status) === -1) delete rec.status;
  if (sheet === "PROPERTIES" && rec.project_id) {           // may only attach units to own project
    const pj = getById("NEW_PROJECTS", rec.project_id);
    if (!pj.success || String(pj.data.posted_by) !== String(user.user_id)) rec.project_id = "";
  }
  if (sheet === "PROPERTIES" && rec.society_id) {           // society picked from the list → copy its name / area
    const so = getById("SOCIETIES", rec.society_id);
    if (so.success) { rec.society_name = so.data.society_name || rec.society_name || ""; if (!rec.area) rec.area = so.data.area || ""; }
    else rec.society_id = "";
  }
  const nameOk = sheet === "NEW_PROJECTS" ? rec.project_name : rec.title;
  if (!nameOk) return { success: false, error: "Title / project name is required" };
  const u = sheetToJSON(getSheet("USERS")).find(function (x) { return String(x.user_id) === String(user.user_id); }) || {};
  if (!rec.contact_name) rec.contact_name = u.full_name || "";
  if (!rec.contact_mobile) rec.contact_mobile = u.mobile || "";
  rec.approval_status = AUTO_APPROVE_ADS ? "Approved" : "Pending";
  rec.approval_note = "";
  const who = user.username || user.user_id;
  let existing = null;
  if (id) existing = ownedRecord(user, sheet, id);
  if (LISTING_SHEETS[sheet]) {
    const ag = ensureAgentProfile(user);                    // link every ad to the agent's profile
    if (ag) rec.agent_id = ag.agent_id;
    stampListing(sheet, rec, existing);                     // saving = manual update → 45 / 60 day clock restarts
  }
  if (id) {
    rec[idField] = id;
    const r = updateRow(sheet, rec, who);
    if (r.success) {
      r.message = AUTO_APPROVE_ADS ? "Listing updated" : "Listing updated — sent for admin approval";
      if (LISTING_SHEETS[sheet]) logListing(sheet, Object.assign({}, existing, rec), "EDITED", who, "Edited & re-activated");
    }
    return r;
  }
  rec.posted_by = user.user_id;
  rec.posted_by_name = u.company_name || u.full_name || user.username;
  rec.posted_by_type = u.user_type || "";
  if ((sheet === "PROPERTIES" || sheet === "LAND_PROPERTIES") && !rec.status) rec.status = "Available";
  if (sheet === "LAND_PROPERTIES") rec.featured = "No";
  if (sheet === "NEW_PROJECTS") { rec.status = "Active"; rec.featured = "No"; if (!rec.builder_name) rec.builder_name = u.company_name || u.full_name; }
  const r = addRow(sheet, rec, who);
  if (r.success) {
    r.message = AUTO_APPROVE_ADS ? "Your ad is live!" : "Ad submitted ✅ It will appear on the website after admin approval.";
    if (LISTING_SHEETS[sheet]) { rec[idField] = r.id; logListing(sheet, rec, "CREATED", who, ""); }
    notify("New ad to approve: " + (rec.title || rec.project_name), ["Posted by: " + rec.posted_by_name + " (" + rec.posted_by_type + ")", "Mobile: " + rec.contact_mobile, "ID: " + r.id, "", "Approve in Admin → Approvals"]);
  }
  return r;
}

function deletePartnerListing(user, sheet, id) {
  sheet = partnerSheet(user, sheet);
  ownedRecord(user, sheet, id);
  return deleteRow(sheet, id, user.username || user.user_id);
}

function myListings(user) {
  const mine = function (r) { return String(r.posted_by) === String(user.user_id); };
  return { success: true, data: {
    properties: decorateListings("PROPERTIES", sheetToJSON(getSheet("PROPERTIES")).filter(mine)).reverse(),
    land: decorateListings("LAND_PROPERTIES", sheetToJSON(getSheet("LAND_PROPERTIES")).filter(mine)).reverse(),
    projects: sheetToJSON(getSheet("NEW_PROJECTS")).filter(mine).reverse(),
  } };
}

// Leads for the partner's own listings (inquiries, bookings, site visits)
function myLeads(user) {
  const L = myListings(user).data;
  const ids = {};
  L.properties.forEach(function (p) { ids["P:" + p.property_id] = p.title; });
  L.projects.forEach(function (p) { ids["J:" + p.project_id] = p.project_name; });
  const forMe = function (r) { return ids["P:" + r.property_id] || ids["J:" + r.project_id]; };
  const out = [];
  safeRows("WEBSITE_INQUIRIES").forEach(function (r) { const t = forMe(r); if (t) out.push({ type: "Inquiry", listing: t, name: r.full_name, mobile: r.mobile, detail: r.message, date: r.created_at, status: r.status }); });
  safeRows("PROPERTY_BOOKINGS").forEach(function (r) { const t = forMe(r); if (t) out.push({ type: "Booking", listing: t, name: r.customer_name, mobile: r.customer_mobile, detail: [r.configuration, r.unit_no].filter(String).join(" "), date: r.created_at, status: r.booking_status }); });
  const clients = safeRows("CLIENTS");
  safeRows("SITE_VISITS").forEach(function (r) {
    const t = forMe(r); if (!t) return;
    const c = clients.find(function (x) { return String(x.client_id) === String(r.client_id); }) || {};
    out.push({ type: "Site Visit", listing: t, name: c.full_name, mobile: c.mobile, detail: [r.visit_date, r.visit_time].filter(String).join(" "), date: r.created_at, status: r.visit_status });
  });
  out.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  return { success: true, count: out.length, data: out };
}

function approveListing(sheet, d, who) {
  if (sheet !== "PROPERTIES" && sheet !== "NEW_PROJECTS" && sheet !== "LAND_PROPERTIES") return { success: false, error: "Bad sheet" };
  const status = d.approval_status === "Rejected" ? "Rejected" : "Approved";
  const rec = { approval_status: status, approval_note: d.approval_note || "" };
  rec[SCHEMA[sheet].id] = d.id;
  return updateRow(sheet, rec, who);
}

function approveUser(d, who) {
  const status = d.status === "Rejected" ? "Rejected" : "Active";
  const r = updateRow("USERS", { user_id: d.user_id, status: status, approved_by: who }, who);
  const u = sheetToJSON(getSheet("USERS")).find(function (x) { return String(x.user_id) === String(d.user_id); });
  if (r.success && u && status === "Active" && String(u.user_type) === "Agent") {
    try { ensureAgentProfile({ user_id: u.user_id, role: PARTNER_ROLES.Agent, username: u.username }); } catch (e) {}   // creates the AGENTS row
  }
  if (r.success && u && u.email && status === "Active") {
    try { MailApp.sendEmail(u.email, "Your ApnaGhar account is approved", "Hello " + u.full_name + ",\n\nYour account (" + u.username + ") is now active. Login and post your ads here:\nhttps://apnaghar-erp.aurasynergyrealtygroup.workers.dev/website/partner.html\n\n— Aura Synergy Realty Group"); } catch (e) {}
  }
  return r;
}

// ============================================================
// LISTING VALIDITY  (v2.5)   RENT = 45 days · SALE = 60 days · then hidden until renewed
// ------------------------------------------------------------
// Rule (single source of truth = the DATE):
//   expiry_date = last_renewed_on + validity_days      (LISTING_RULES sheet, fallback DEFAULT_LISTING_DAYS)
//   Public website shows a listing only if it is Approved AND today <= expiry_date.
//   Agent saves / edits the ad, or presses Renew  →  last_renewed_on = today  →  live again.
// The daily trigger (deactivateExpiredListings) writes listing_active = Yes / No in the sheet so
// you can see and filter it — but even if the trigger fails, expired ads are still hidden.
// ============================================================
function todayStr() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"); }
function dayNum(s) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : NaN;
}
function addDaysStr(s, n) { return new Date((dayNum(s) + Number(n)) * 86400000).toISOString().slice(0, 10); }

let _rules = null;
function ruleDays(kind) {
  if (!_rules) {
    _rules = {};
    safeRows("LISTING_RULES").forEach(function (r) {
      const k = String(r.listing_type || "").trim().toUpperCase();
      if (k && r.validity_days !== null && r.validity_days !== undefined && String(r.validity_days) !== "") _rules[k] = Number(r.validity_days) || 0;
    });
  }
  return _rules[kind] !== undefined ? _rules[kind] : (DEFAULT_LISTING_DAYS[kind] || 0);
}

function listingKind(sheet, r) {
  if (sheet === "LAND_PROPERTIES") return "LAND";
  return String(r.listing_type || "").trim().toLowerCase() === "rent" ? "RENT" : "SALE";
}

function listingInfo(sheet, r) {
  const kind = listingKind(sheet, r), days = ruleDays(kind);
  const base = String(r.last_renewed_on || "").slice(0, 10);
  const out = { kind: kind, days: days, base: base, expiry: "", days_left: null, expired: false, state: "Active" };
  if (!days || isNaN(dayNum(base))) return out;                 // no rule / no date → never expires
  out.expiry = addDaysStr(base, days);
  out.days_left = dayNum(out.expiry) - dayNum(todayStr());
  out.expired = out.days_left < 0;
  out.state = out.expired ? "Inactive" : "Active";
  return out;
}

function societyMap() {
  const m = {};
  safeRows("SOCIETIES").forEach(function (s) { m[String(s.society_id)] = s; });
  return m;
}

// Adds computed fields: listing_status, expiry_date, days_left, validity_days, society_* (name/address/area)
function decorateListing(sheet, r, soc) {
  const info = listingInfo(sheet, r);
  r.listing_status = info.state;
  r.expiry_date = info.expiry || null;
  r.days_left = info.days_left;
  r.validity_days = info.days;
  if (soc && r.society_id && soc[String(r.society_id)]) {
    const so = soc[String(r.society_id)];
    r.society_name = r.society_name || so.society_name || null;
    r.society_address = [so.address, so.landmark ? "Near " + so.landmark : "", so.pincode].filter(String).join(", ") || null;
    if (!r.area) r.area = so.area || null;
  }
  return r;
}
function decorateListings(sheet, rows) {
  const soc = sheet === "PROPERTIES" ? societyMap() : null;
  return rows.map(function (r) { return decorateListing(sheet, r, soc); });
}

// Marks the record as freshly (manually) updated → live for the full validity period again
function stampListing(sheet, rec, existing) {
  const merged = Object.assign({}, existing || {}, rec);
  rec.last_renewed_on = todayStr();
  merged.last_renewed_on = rec.last_renewed_on;
  rec.listing_active = "Yes";
  rec.deactivated_on = "";
  rec.expiry_date = listingInfo(sheet, merged).expiry;
  return rec;
}

function logListing(sheet, rec, action, who, remark) {
  try {
    addRow("LISTING_LOG", {
      listing_sheet: sheet, listing_id: rec[LISTING_SHEETS[sheet]] || "", title: rec.title || "", agent_id: rec.agent_id || "",
      action: action, action_date: Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm"), done_by: who || "SYSTEM", remark: remark || "",
    }, who);
  } catch (e) { /* never block the main action */ }
}

// ---- who is this user in AGENTS? ----
function userRow(userId) {
  return sheetToJSON(getSheet("USERS")).find(function (x) { return String(x.user_id) === String(userId); }) || null;
}
function agentIdForUser(userId) { const u = userRow(userId); return u && u.agent_id ? String(u.agent_id) : ""; }

// Agent accounts (website "Partner Agent" or ERP role "Agent") always get one AGENTS row, linked to the login.
function ensureAgentProfile(user) {
  if (!user || (user.role !== PARTNER_ROLES.Agent && user.role !== "Agent")) return null;
  const u = userRow(user.user_id);
  if (!u) return null;
  if (u.agent_id) { const a = getById("AGENTS", u.agent_id); if (a.success) return a.data; }
  const mob = normMobile(u.mobile);
  const same = mob ? safeRows("AGENTS").find(function (x) { return normMobile(x.mobile) === mob; }) : null;
  const id = same ? same.agent_id : addRow("AGENTS", {
    full_name: u.full_name, mobile: mob, whatsapp: mob, email: u.email || "", rera_agent_no: u.rera_number || "",
    city: u.city || "Pune", joining_date: todayStr(), status: "Active", user_id: u.user_id,
  }, "SYSTEM").id;
  updateRow("USERS", { user_id: u.user_id, agent_id: id }, "SYSTEM");
  const a = getById("AGENTS", id);
  return a.success ? a.data : null;
}

// ---- "agent sees only own properties" ----
// Returns a row-filter for staff role "Agent" (own ads only), or null for everyone else.
function agentScopeFor(u) {
  if (!u || u.role !== "Agent") return null;
  const aid = agentIdForUser(u.user_id);
  return function (r) { return String(r.posted_by) === String(u.user_id) || (aid !== "" && String(r.agent_id) === aid); };
}
function agentScope(token) {
  let u; try { u = requireAuth(token); } catch (e) { return null; }
  return agentScopeFor(u);
}
function scopeResult(res, sc) {
  if (sc && res.success) { res.data = res.data.filter(sc); res.count = res.data.length; }
  return res;
}

// Guards admin-side create / update / delete of PROPERTIES & LAND_PROPERTIES
function listingGuard(user, sheet, op, data) {
  if (!LISTING_SHEETS[sheet]) return data;
  const idField = LISTING_SHEETS[sheet];
  if (user.role === "Agent") {
    const ag = ensureAgentProfile(user);
    if (op === "create") { data.agent_id = ag ? ag.agent_id : ""; data.posted_by = user.user_id; }
    else {
      const rec = getById(sheet, data[idField] || data.id);
      const sc = agentScopeFor(user);
      if (!rec.success || !sc(rec.data)) throw new Error("You can only change your own listings");
      delete data.agent_id; delete data.posted_by;
    }
  }
  if (op === "create" || op === "update") {
    let existing = null;
    if (op === "update") { const g = getById(sheet, data[idField] || data.id); if (g.success) existing = g.data; }
    if (data.last_renewed_on === undefined) stampListing(sheet, data, existing);    // any manual save = renewed
  }
  return data;
}

// ---- Renew / re-activate ----
function renewListing(user, sheet, id) {
  if (!LISTING_SHEETS[sheet]) return { success: false, error: "Bad sheet" };
  const res = getById(sheet, id);
  if (!res.success) return { success: false, error: "Listing not found" };
  if (isPartnerRole(user.role)) ownedRecord(user, sheet, id);
  else { const sc = agentScopeFor(user); if (sc && !sc(res.data)) throw new Error("You can only renew your own listings"); }
  const rec = {};
  rec[LISTING_SHEETS[sheet]] = id;
  stampListing(sheet, rec, res.data);
  const who = user.username || user.user_id;
  const r = updateRow(sheet, rec, who);
  if (r.success) {
    const days = listingInfo(sheet, Object.assign({}, res.data, rec)).days;
    logListing(sheet, res.data, "RENEWED", who, "Manual renew");
    r.expiry_date = rec.expiry_date || null;
    r.message = days ? "Renewed ✅ Live again for " + days + " days (till " + rec.expiry_date + ")" : "Renewed ✅";
  }
  return r;
}

// ---- Daily job: writes listing_active / expiry_date / deactivated_on into the sheets ----
function deactivateExpiredListings() {
  const out = [];
  Object.keys(LISTING_SHEETS).forEach(function (key) {
    const sheet = getSheet(key);
    ensureColumns(sheet, SCHEMA[key].headers);
    const all = sheet.getDataRange().getValues();
    if (all.length < 3) return;
    const headers = all[1].map(String);
    const col = function (h) { return headers.indexOf(h); };
    const cA = col("listing_active"), cE = col("expiry_date"), cD = col("deactivated_on"), idC = col(LISTING_SHEETS[key]);
    const n = all.length - 2;
    const A = [], E = [], D = [];
    let off = 0, on = 0;
    for (let i = 2; i < all.length; i++) {
      const row = all[i], rec = {};
      headers.forEach(function (h, j) { if (h) rec[h] = cellOut(row[j]); });
      let a = cellOut(row[cA]) || "", e = cellOut(row[cE]) || "", d = cellOut(row[cD]) || "";
      if (row[idC] !== "" && row[idC] !== null) {
        const info = listingInfo(key, rec), want = info.expired ? "No" : "Yes";
        if (want === "No" && a !== "No") { d = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm"); off++; logListing(key, rec, "AUTO_DEACTIVATED", "SYSTEM", info.days + " days without update"); }
        if (want === "Yes" && a === "No") { d = ""; on++; logListing(key, rec, "REACTIVATED", "SYSTEM", "Date updated"); }
        a = want; e = info.expiry || "";
      }
      A.push([a]); E.push([e]); D.push([d]);
    }
    sheet.getRange(3, cA + 1, n, 1).setValues(A);
    sheet.getRange(3, cE + 1, n, 1).setValues(E);
    sheet.getRange(3, cD + 1, n, 1).setValues(D);
    out.push(key + ": " + off + " hidden, " + on + " re-activated");
  });
  SpreadsheetApp.flush();
  Logger.log(out.join("\n"));
  return { success: true, report: out };
}

// Run once from the editor (setupSheets also tries it): daily run at ~1 AM IST
function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "deactivateExpiredListings") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("deactivateExpiredListings").timeBased().everyDays(1).atHour(1).inTimezone(TZ).create();
  return "Daily trigger installed — rent/sale listings auto-hide every night at ~1 AM";
}

function seedListingRules() {
  const have = safeRows("LISTING_RULES").map(function (r) { return String(r.listing_type || "").toUpperCase(); });
  const notes = { RENT: "Rent listing hidden after this many days without update / renew", SALE: "Sale listing hidden after this many days without update / renew", LAND: "0 = land listings never auto-hide (set a number to enable)" };
  const added = [];
  ["RENT", "SALE", "LAND"].forEach(function (k) {
    if (have.indexOf(k) === -1) { addRow("LISTING_RULES", { listing_type: k, validity_days: DEFAULT_LISTING_DAYS[k], note: notes[k] }, "SETUP"); added.push(k + "=" + DEFAULT_LISTING_DAYS[k]); }
  });
  _rules = null;
  return added;
}

// One-time: existing listings with no last_renewed_on get today's date, so nothing vanishes on day 1.
function backfillListingDates() {
  let total = 0;
  Object.keys(LISTING_SHEETS).forEach(function (key) {
    const sheet = getSheet(key);
    ensureColumns(sheet, SCHEMA[key].headers);
    const all = sheet.getDataRange().getValues();
    if (all.length < 3) return;
    const headers = all[1].map(String), cR = headers.indexOf("last_renewed_on"), cA = headers.indexOf("listing_active"), idC = headers.indexOf(LISTING_SHEETS[key]);
    const R = [], A = [];
    let n = 0;
    for (let i = 2; i < all.length; i++) {
      let r = all[i][cR], a = all[i][cA];
      if (all[i][idC] !== "" && (r === "" || r === null)) { r = todayStr(); a = a || "Yes"; n++; }
      R.push([r]); A.push([a]);
    }
    if (n) { sheet.getRange(3, cR + 1, R.length, 1).setValues(R); sheet.getRange(3, cA + 1, A.length, 1).setValues(A); }
    total += n;
  });
  return total;
}

// ============================================================
// AGENT PROFILE  (agent details stored in AGENTS; agent can edit own non-sensitive fields)
// ============================================================
const AGENT_SELF_FIELDS = ["alt_mobile","whatsapp","email","address","city","area","rera_agent_no","experience_years","pan_no","aadhaar_last4","bank_name","account_no","ifsc","photo_url"];
function asText(v) { v = String(v == null ? "" : v).trim(); return v ? "'" + v : ""; }   // leading ' keeps 0123 / long numbers as text

function myProfile(user) {
  const agent = ensureAgentProfile(user);
  const u = userRow(user.user_id) || {};
  if (agent && agent.aadhaar_last4 != null) agent.aadhaar_last4 = String(agent.aadhaar_last4).padStart(4, "0");
  return { success: true, data: { is_agent: !!agent, agent: agent, user: { full_name: u.full_name, mobile: u.mobile, email: u.email, company_name: u.company_name, user_type: u.user_type } } };
}

function saveMyProfile(user, d) {
  const agent = ensureAgentProfile(user);
  if (!agent) return { success: false, error: "My Profile is available for Agent accounts only" };
  const rec = { agent_id: agent.agent_id };
  AGENT_SELF_FIELDS.forEach(function (f) { if (d[f] !== undefined) rec[f] = d[f]; });
  if (rec.aadhaar_last4 !== undefined) rec.aadhaar_last4 = asText(String(rec.aadhaar_last4).replace(/\D/g, "").slice(-4));   // never store the full Aadhaar number
  if (rec.account_no !== undefined) rec.account_no = asText(String(rec.account_no).replace(/\s/g, ""));
  if (rec.pan_no) rec.pan_no = String(rec.pan_no).toUpperCase().trim();
  if (rec.ifsc) rec.ifsc = String(rec.ifsc).toUpperCase().trim();
  if (rec.pan_no && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(rec.pan_no)) return { success: false, error: "PAN format looks wrong (e.g. ABCDE1234F)" };
  if (rec.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(rec.ifsc)) return { success: false, error: "IFSC format looks wrong (e.g. HDFC0001234)" };
  const r = updateRow("AGENTS", rec, user.username);
  if (r.success) r.message = "Profile saved";
  return r;
}

// ============================================================
// PUBLIC SEARCH HELPERS  (area / society dropdowns)
// ============================================================
function getSearchOptions() {
  const soc = safeRows("SOCIETIES").filter(function (s) { return String(s.status || "Active") !== "Inactive"; });
  const areas = {};
  soc.forEach(function (s) { if (s.area) areas[String(s.area).trim()] = 1; });
  safeRows("PROPERTIES").filter(function (r) { return isLive(r, "PROPERTIES"); }).forEach(function (r) { if (r.area) areas[String(r.area).trim()] = 1; });
  safeRows("LAND_PROPERTIES").filter(function (r) { return isLive(r, "LAND_PROPERTIES"); }).forEach(function (r) { if (r.area) areas[String(r.area).trim()] = 1; });
  return { success: true, data: {
    areas: Object.keys(areas).sort(),
    societies: soc.map(function (s) { return { society_id: s.society_id, society_name: s.society_name, area: s.area, address: s.address, landmark: s.landmark, pincode: s.pincode }; }),
  } };
}

// Public society list never exposes the secretary's phone number
function getSocietiesPublic(token) {
  const res = listRows("SOCIETIES");
  if (!isStaffToken(token)) res.data = res.data.map(function (s) { delete s.secretary_name; delete s.secretary_mobile; return s; });
  return res;
}

// ============================================================
// WEBSITE DATA CHECK  (why is my sheet data not on the website?)
// ------------------------------------------------------------
// showDiagnosis()    — run from the editor, prints the report in View → Logs
// diagnoseWebsite()  — reads PROPERTIES / LAND_PROPERTIES / NEW_PROJECTS exactly like the website does and
//                      says, row by row, which ads are visible and WHY the others are hidden.
// repairSheetLayout(key) — fixes the usual cause: headers not on row 2 / different column names
//                      (makes a backup tab first, never deletes data rows).
// ============================================================
function normHeader(h) { return String(h == null ? "" : h).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }

function scanLayout(sheet, key) {
  const vals = sheet.getDataRange().getValues(), want = SCHEMA[key].headers;
  let best = { row: 0, hits: 0 };
  for (let i = 0; i < Math.min(vals.length, 8); i++) {
    const hits = vals[i].filter(function (c) { return want.indexOf(normHeader(c)) !== -1; }).length;
    if (hits > best.hits) best = { row: i + 1, hits: hits };
  }
  return { vals: vals, best: best };
}

function diagnoseWebsite() {
  const ss = getSS();
  const out = { success: true, version: "2.5", database: ss.getName(), url: ss.getUrl(), database_id: ss.getId(), default_id: SPREADSHEET_ID, today: todayStr(), sheets: {}, advice: [] };
  if (ss.getId() !== SPREADSHEET_ID) {
    out.attached_elsewhere = true;
    out.advice.push("⚠️ The website is reading \"" + ss.getName() + "\" — NOT the sheet in SPREADSHEET_ID (" + SPREADSHEET_ID + "). Data you add to your main sheet will not show. To use your main sheet: Apps Script → run attachProjectSheet (or Admin → Settings → Attach Google Sheet).");
  }
  ["PROPERTIES", "LAND_PROPERTIES", "NEW_PROJECTS"].forEach(function (key) {
    const sh = ss.getSheetByName(key), info = { tab_exists: !!sh };
    out.sheets[key] = info;
    if (!sh) { info.problem = "Tab is missing"; out.advice.push(key + ": tab missing — run setupSheets."); return; }
    const sc = scanLayout(sh, key), idf = SCHEMA[key].id;
    info.sheet_rows = sc.vals.length;
    info.header_row_found = sc.best.row;
    info.recognised_columns = sc.best.hits;
    const row2 = (sc.vals[1] || []).map(String);
    info.missing_columns = SCHEMA[key].headers.filter(function (h) { return row2.indexOf(h) === -1; });
    if (sc.best.hits < 3) {
      info.problem = "Column names are not recognised (website needs names like " + SCHEMA[key].headers.slice(0, 4).join(", ") + ")";
      out.advice.push(key + ": column names differ from what the website expects → press Repair layout.");
    } else if (sc.best.row !== 2) {
      info.problem = "Column names are on row " + sc.best.row + " — the website reads them from row 2 (row 1 = title, data from row 3)";
      out.advice.push(key + ": headers are on row " + sc.best.row + " → press Repair layout.");
    } else if (row2.indexOf(idf) === -1) {
      info.problem = "Column " + idf + " is missing";
      out.advice.push(key + ": ID column missing → run setupSheets.");
    }
    let rows = [];
    try { rows = sheetToJSON(sh); } catch (e) { info.problem = (info.problem || "") + " Read error: " + e.message; }
    info.rows_read = rows.length;
    let live = 0; const hidden = [], warn = [];
    rows.forEach(function (r) {
      const id = r[idf], why = [];
      const a = String(r.approval_status || "").trim();
      if (!(a === "" || a === "Approved")) why.push("approval_status = " + a + " → approve it in Admin → Approvals");
      if (key === "NEW_PROJECTS" && String(r.status || "").trim() === "Inactive") why.push("status = Inactive → set status to Active in Admin → New Launch Projects");
      if (LISTING_SHEETS[key]) {
        const li = listingInfo(key, r);
        if (li.expired) why.push("expired " + Math.abs(li.days_left) + " day(s) ago (" + li.kind + " rule = " + li.days + " days) → press Renew");
      }
      if (key === "NEW_PROJECTS") {
        if (!r.project_name) warn.push((id || "row") + ": project_name is empty — it shows as \"Project\"");
        if (r.launch_status && ["Pre-Launch", "New Launch", "Under Construction", "Ready to Move"].indexOf(r.launch_status) === -1) warn.push((r.project_name || id) + ": launch_status \"" + r.launch_status + "\" is not one of Pre-Launch / New Launch / Under Construction / Ready to Move — it shows only under the \"All\" tab");
        if (!r.image1_url) warn.push((r.project_name || id) + ": no image1_url — shows a placeholder picture");
      }
      if (!id) warn.push((r.title || r.project_name || "(untitled)") + ": ID column empty — card shows but its detail page will not open");
      if (why.length) hidden.push({ id: id || "(no id)", title: r.title || r.project_name || "", why: why.join("; ") }); else live++;
    });
    info.visible_on_website = live;
    info.hidden_count = hidden.length;
    info.hidden = hidden.slice(0, 40);
    info.warnings = warn.slice(0, 20);
    if (!rows.length && !info.problem) out.advice.push(key + ": no data rows found from row 3 down.");
  });
  if (!out.advice.length) out.advice.push("Sheet layout looks fine. If the website still shows nothing: (1) Deploy → Manage deployments → Edit → Version: New → Deploy, (2) check APPS_SCRIPT_URL in website/js/config.js is that deployment's URL, (3) hard-refresh the website (Ctrl+Shift+R).");
  return out;
}

// Run THIS from the Apps Script editor (▶ showDiagnosis) and open View → Logs — works even if the admin page is not updated.
// ============================================================
// AUTO-IMPORT LEADS FROM OTHER GOOGLE SHEETS  →  CLIENTS (main sheet)
// ------------------------------------------------------------
// Example source: "Aura Synergy Realty Group – Property Leads" (Facebook / Meta lead-form sheet) with columns
//   which_bhk_are_you_looking_for? | when_are_you_planning_to_buy? | Full_name | Phone_number | city | Follow-up Count | …
// Every few minutes new rows are read and added to CLIENTS (Admin → Clients). Rules:
//   • the source sheet is only READ — it is never changed
//   • same mobile number already in CLIENTS  → no duplicate client; a "repeat enquiry" line is added to its remarks
//   • every imported row is remembered in LEAD_SYNC_LOG, so nothing is imported twice
//   • columns are found by NAME (any order); every tab of the source sheet is checked
// Start:  run setupLeadSync once (or Admin → Settings → Auto-import leads). Stop: removeLeadSyncTrigger.
// ============================================================
const DEFAULT_LEAD_SOURCES = [
  { id: "1i6wFZg2QedxfP6tejHuPuI291gPpOmPefDIVohZ12I8", name: "Aura Synergy Realty Group – Property Leads", lead_source: "Facebook Ads" },
];
const LEAD_MAX_PER_RUN = 200;

function getLeadSources() {
  const raw = PropertiesService.getScriptProperties().getProperty("LEAD_SOURCES");
  if (raw) { try { const a = JSON.parse(raw); if (Array.isArray(a)) return a; } catch (e) {} }
  return DEFAULT_LEAD_SOURCES.slice();
}
function saveLeadSources(list) { PropertiesService.getScriptProperties().setProperty("LEAD_SOURCES", JSON.stringify(list)); }

function leadHumanize(v) {
  let s = String(v == null ? "" : v).replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function leadCols(headerRow) {
  const n = headerRow.map(normHeader);
  const find = function (re) { for (let i = 0; i < n.length; i++) if (n[i] && re.test(n[i])) return i; return -1; };
  return {
    name: find(/^(full_?name|name|customer_?name|your_?name)$/), phone: find(/(phone|mobile|contact_?(no|number)|whatsapp)/),
    city: find(/^(city|location|area|town)$/), bhk: find(/bhk|looking_for|requirement/),
    when: find(/planning_to_buy|when_are_you|timeline|purchase_time/), email: find(/^e_?mail/),
    followups: find(/^follow_?up/), response: find(/customer_?response|^response$|^remarks?$|^notes?$/),
    visit: find(/site_?visit/), outcome: find(/final_?outcome|^outcome$/),
  };
}

function leadParseBhk(v) {
  const s = String(v || "");
  const m = s.match(/(\d)\s*_?\s*bhk/i);
  return m ? m[1] + "BHK" : /studio/i.test(s) ? "Studio" : "";
}
function leadParseBudget(v) {
  const m = String(v || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*[–\-]\s*(\d+(?:\.\d+)?)\s*_?\s*(lakhs?|lacs?|l|crores?|cr)\b/i);
  if (!m) return null;
  const mul = /^c/i.test(m[3]) ? 10000000 : 100000;
  return { min: Math.round(parseFloat(m[1]) * mul), max: Math.round(parseFloat(m[2]) * mul) };
}

// Reads every tab of a source spreadsheet (overridable in tests)
function leadSourceTabs(src) {
  const ss = SpreadsheetApp.openById(src.id);
  return ss.getSheets().map(function (sh) { return { name: sh.getName(), values: sh.getDataRange().getValues() }; });
}

function syncLeads() {
  const out = { success: true, created: 0, repeats: 0, skipped: 0, report: [] };
  const sources = getLeadSources();
  if (!sources.length) { out.report.push("No lead source sheets configured"); return out; }
  const lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (e) { out.report.push("Another sync is running — skipped this time"); return out; }
  try {
    const seen = {};
    safeRows("LEAD_SYNC_LOG").forEach(function (l) { if (l.lead_key) seen[l.lead_key] = 1; });
    const byMobile = {};
    sheetToJSON(getSheet("CLIENTS")).forEach(function (c) { const m = normMobile(c.mobile); if (m) byMobile[m] = c; });
    const today = todayStr();
    const created = [];
    sources.forEach(function (src) {
      let tabs;
      try { tabs = leadSourceTabs(src); }
      catch (e) { out.report.push("❌ " + (src.name || src.id) + ": cannot open (" + e.message + ") — share it with the Google account that owns this script"); return; }
      tabs.forEach(function (tab) {
        let hr = -1, cols = null;
        for (let i = 0; i < Math.min(tab.values.length, 4); i++) { const c = leadCols(tab.values[i]); if (c.phone !== -1 && (c.name !== -1 || c.bhk !== -1)) { hr = i; cols = c; break; } }
        if (hr === -1) { out.report.push("⏭ " + (src.name || src.id) + " / " + tab.name + ": no phone column found — skipped"); return; }
        const cell = function (row, k) { return cols[k] === -1 ? "" : String(row[cols[k]] == null ? "" : row[cols[k]]).trim(); };
        for (let r = hr + 1; r < tab.values.length; r++) {
          if (out.created + out.repeats >= LEAD_MAX_PER_RUN) { out.report.push("… more rows will be imported in the next run"); return; }
          const row = tab.values[r];
          if (row.every(function (c) { return c === "" || c === null; })) continue;
          const mobile = normMobile(cell(row, "phone"));
          const bhkRaw = cell(row, "bhk"), whenRaw = cell(row, "when");
          if (mobile.length < 10) {
            const k0 = "BAD|" + src.id + "|" + tab.name + "|" + (r + 1) + "|" + cell(row, "name");
            if (!seen[k0]) { seen[k0] = 1; out.skipped++; addRow("LEAD_SYNC_LOG", { source_name: src.name || src.id, source_tab: tab.name, source_row: r + 1, lead_key: k0, action: "SKIPPED_BAD_PHONE", synced_at: today }, "LEADSYNC"); }
            continue;
          }
          const key = mobile + "|" + bhkRaw.toLowerCase() + "|" + whenRaw.toLowerCase();
          if (seen[key]) continue;
          seen[key] = 1;
          const bud = leadParseBudget(bhkRaw), city = cell(row, "city");
          const notes = [
            "Looking for: " + leadHumanize(bhkRaw), "Plans to buy: " + leadHumanize(whenRaw),
            cell(row, "followups") && "Follow-up: " + cell(row, "followups"), cell(row, "response") && "Customer response: " + cell(row, "response"),
            cell(row, "visit") && "Site visit: " + cell(row, "visit"), cell(row, "outcome") && "Outcome: " + cell(row, "outcome"),
          ].filter(Boolean).join(" • ");
          const stamp = "[" + today + " " + (src.lead_source || "Lead sheet") + " import]";
          const existing = byMobile[mobile];
          if (existing) {
            updateRow("CLIENTS", { client_id: existing.client_id, remarks: ((existing.remarks ? existing.remarks + "\n" : "") + stamp + " Repeat enquiry — " + notes).slice(0, 4000) }, "LEADSYNC");
            existing.remarks = (existing.remarks ? existing.remarks + "\n" : "") + stamp + " Repeat enquiry — " + notes;
            out.repeats++;
            addRow("LEAD_SYNC_LOG", { source_name: src.name || src.id, source_tab: tab.name, source_row: r + 1, lead_key: key, client_id: existing.client_id, action: "REPEAT_NOTED", synced_at: today }, "LEADSYNC");
            continue;
          }
          let status = "New";
          if (cell(row, "followups") || cell(row, "response") || cell(row, "visit")) status = "Followup";
          const oc = cell(row, "outcome");
          if (oc) status = /lost|not interested|no service|wrong|invalid/i.test(oc) ? "Lost" : /book|closed|deal|done|sold|registered/i.test(oc) ? "Closed" : "Followup";
          const rec = {
            client_type: "Buyer", full_name: cell(row, "name"), mobile: mobile, email: cell(row, "email"),
            preferred_location: city, preferred_bhk: leadParseBhk(bhkRaw), lead_source: src.lead_source || "Facebook Ads", lead_status: status,
            remarks: stamp + " " + notes,
          };
          if (bud) { rec.budget_min = bud.min; rec.budget_max = bud.max; }
          const res = addRow("CLIENTS", rec, "LEADSYNC");
          if (res.success) {
            byMobile[mobile] = Object.assign({ client_id: res.id }, rec);
            created.push((rec.full_name || mobile) + " (" + (rec.preferred_bhk || "—") + ", " + (city || "—") + ")");
            out.created++;
            addRow("LEAD_SYNC_LOG", { source_name: src.name || src.id, source_tab: tab.name, source_row: r + 1, lead_key: key, client_id: res.id, action: "CREATED", synced_at: today }, "LEADSYNC");
          }
        }
      });
    });
    if (created.length) {
      out.report.unshift("✅ " + out.created + " new client(s) added from lead sheets");
      notify(out.created + " new lead(s) imported", created.slice(0, 30).concat(["", "Open Admin → Clients"]));
    }
    if (out.repeats) out.report.push("↻ " + out.repeats + " repeat enquiry note(s) added to existing clients");
    if (out.skipped) out.report.push("⏭ " + out.skipped + " row(s) skipped (no valid phone number)");
    if (!out.created && !out.repeats && !out.skipped && !out.report.length) out.report.push("No new leads");
  } finally { lock.releaseLock(); }
  Logger.log(out.report.join("\\n"));
  return out;
}

function installLeadSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "syncLeads") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("syncLeads").timeBased().everyMinutes(5).create();
  return "Auto-import is ON — new rows in your lead sheet(s) are added to Clients every 5 minutes";
}
function removeLeadSyncTrigger() {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "syncLeads") { ScriptApp.deleteTrigger(t); n++; } });
  return n ? "Auto-import is OFF" : "Auto-import was not running";
}
function leadTriggerOn() { return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "syncLeads"; }); }

// Run once from the editor: turns auto-import ON and imports everything that is already in the sheet(s)
function setupLeadSync() {
  const msg = installLeadSyncTrigger();
  const r = syncLeads();
  Logger.log(msg + "\\n" + r.report.join("\\n"));
  return { success: true, message: msg, result: r };
}

function leadSyncStatus() {
  const log = safeRows("LEAD_SYNC_LOG");
  return { success: true, data: {
    trigger_on: leadTriggerOn(), sources: getLeadSources(),
    imported: log.filter(function (l) { return l.action === "CREATED"; }).length,
    repeats: log.filter(function (l) { return l.action === "REPEAT_NOTED"; }).length,
    skipped: log.filter(function (l) { return l.action === "SKIPPED_BAD_PHONE"; }).length,
    last: log.slice(-8).reverse(),
  } };
}

function addLeadSource(urlOrId, name, leadSource) {
  const id = extractSheetId(urlOrId);
  if (!id) return { success: false, error: "Paste the Google Sheet link or its ID" };
  let title = name;
  try { title = title || SpreadsheetApp.openById(id).getName(); }
  catch (e) { return { success: false, error: "Cannot open that sheet: " + e.message + ". Share it (Viewer is enough) with the Google account that owns this script." }; }
  const list = getLeadSources().filter(function (s) { return s.id !== id; });
  list.push({ id: id, name: title, lead_source: leadSource || "Facebook Ads" });
  saveLeadSources(list);
  return { success: true, message: "Lead sheet added: " + title };
}
function removeLeadSource(id) {
  saveLeadSources(getLeadSources().filter(function (s) { return s.id !== id; }));
  return { success: true, message: "Lead sheet removed (clients already imported are kept)" };
}

// ============================================================
// MERGE LATEST INTO YOUR SHEET  — one Google Sheet, new tabs / columns added, nothing of yours changed
// ------------------------------------------------------------
//   previewMerge()           → shows what WOULD be added (changes nothing)
//   mergeLatestIntoSheet()   → does it. Safe rules:
//     • a full backup copy of the spreadsheet is made in your Google Drive first
//     • tabs that do not exist yet are added (e.g. LISTING_RULES, LISTING_LOG, NEW_PROJECTS …)
//     • missing columns are added at the END of the header row only — nothing is moved, renamed or deleted
//     • your own tabs (OWNERS, TENANTS, INDEX …) and all your rows are never touched
//     • a tab whose header row is NOT on row 2 (older layout) is SKIPPED and reported — it is never written to
//   Run it again after any future update: it only adds what is still missing.
// ============================================================
function mergePlan() {
  const ss = getSS(), plan = { newTabs: [], addColumns: [], skipped: [], upToDate: [], leftAlone: [] };
  Object.keys(SCHEMA).forEach(function (key) {
    const sh = ss.getSheetByName(key);
    if (!sh) { plan.newTabs.push(key); return; }
    const sc = scanLayout(sh, key), row2 = (sc.vals[1] || []).map(String);
    const blank = sc.vals.every(function (r) { return r.every(function (c) { return c === "" || c === null; }); });
    const layoutOk = blank || (sc.best.row === 2 && sc.best.hits >= 3);
    const missing = SCHEMA[key].headers.filter(function (h) { return h && /^[a-z0-9_]+$/.test(h) && row2.indexOf(h) === -1; });
    if (!missing.length) { plan.upToDate.push(key); return; }
    if (!layoutOk) {
      plan.skipped.push({ tab: key, reason: sc.best.hits >= 3 ? "column names are on row " + sc.best.row + " (website needs row 2) — left untouched; use Repair layout" : "column names differ from the website's — left untouched" });
      return;
    }
    plan.addColumns.push({ tab: key, columns: missing, blank: blank });
  });
  ss.getSheets().forEach(function (s) { if (!SCHEMA[s.getName()]) plan.leftAlone.push(s.getName()); });
  return plan;
}

function previewMerge() {
  const ss = getSS(), plan = mergePlan();
  return { success: true, database: ss.getName(), url: ss.getUrl(), plan: plan,
    summary: plan.newTabs.length + " new tab(s), " + plan.addColumns.length + " tab(s) get extra columns, " + plan.skipped.length + " skipped for safety, " + plan.leftAlone.length + " of your tabs left alone" };
}

function ensureAdminLogin(report) {
  const addedRoles = ensureRoles();
  if (addedRoles.length) report.push("Added roles: " + addedRoles.join(", "));
  const roles = sheetToJSON(getSheet("ROLES")), adminRole = roles.find(function (r) { return r.role_name === "Admin"; });
  if (!sheetToJSON(getSheet("USERS")).some(function (u) { return String(u.username) === "admin"; })) {
    addRow("USERS", { username: "admin", full_name: "Admin User", email: NOTIFY_EMAIL, password_hash: hashPassword("admin123"), role_id: adminRole ? adminRole.role_id : "", status: "Active" }, "SETUP");
    report.push("Created login admin / admin123 (change it after first login)");
  }
}

function mergeLatestIntoSheet(opts) {
  opts = opts || {};
  const addColumns = opts.addColumns !== false, wantBackup = opts.backup !== false;
  const ss = getSS(), report = [];
  const plan = mergePlan();
  if (wantBackup && (plan.newTabs.length || (addColumns && plan.addColumns.length))) {
    try {
      const f = DriveApp.getFileById(ss.getId()).makeCopy(ss.getName() + " — BACKUP before merge " + Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH-mm"));
      report.push("✔ Backup copy saved in your Google Drive: " + f.getUrl());
    } catch (e) {
      if (opts.requireBackup) return { success: false, error: "Backup could not be made (" + e.message + ") — nothing was changed" };
      report.push("⚠ Backup copy could not be made (" + e.message + ") — continuing; only new tabs / end-columns are added");
    }
  }
  plan.newTabs.forEach(function (k) { createTab(ss, k); report.push("＋ New tab added: " + k); });
  if (plan.newTabs.indexOf("LISTING_RULES") !== -1) { const a = seedListingRules(); if (a.length) report.push("   rules: " + a.join(", ")); }
  if (plan.newTabs.indexOf("USERS") !== -1 || plan.newTabs.indexOf("ROLES") !== -1) ensureAdminLogin(report);
  if (addColumns) {
    plan.addColumns.forEach(function (p) {
      const sh = ss.getSheetByName(p.tab);
      if (p.blank) { sh.getRange(1, 1).setValue(SCHEMA[p.tab].title).setFontWeight("bold").setFontSize(13); }
      const added = ensureColumns(sh, SCHEMA[p.tab].headers);
      if (added.length) report.push("＋ " + p.tab + ": " + added.length + " column(s) added at the end — " + added.join(", "));
    });
  } else if (plan.addColumns.length) report.push("ℹ Extra columns for " + plan.addColumns.map(function (p) { return p.tab; }).join(", ") + " were NOT added (tabs only mode)");
  plan.skipped.forEach(function (s) { report.push("⏭ " + s.tab + " skipped — " + s.reason); });
  report.push("Left untouched: " + plan.leftAlone.length + " of your own tab(s) and every data row.");
  _ss = null; SpreadsheetApp.flush();
  return { success: true, database: ss.getName(), url: ss.getUrl(), report: report, plan: plan };
}

// Run from the editor (▶ runMerge) → View → Logs
function runMerge() {
  const p = previewMerge();
  Logger.log("PREVIEW: " + p.summary + "\\n" + JSON.stringify(p.plan, null, 1));
  const r = mergeLatestIntoSheet({ addColumns: true, backup: true });
  Logger.log((r.success ? "✅ MERGED into: " : "❌ ") + (r.database || r.error) + "\\n" + (r.report || []).join("\\n"));
  return r;
}

// Run from the editor (▶ previewOnly) → View → Logs. Changes nothing.
function previewOnly() {
  const p = previewMerge();
  Logger.log(p.summary + "\\n" + JSON.stringify(p.plan, null, 1));
  return p;
}

function showDiagnosis() {
  const d = diagnoseWebsite(), L = [];
  L.push("Website is reading: " + d.database + "  (" + d.url + ")", d.attached_elsewhere ? "⚠️ This is NOT your main sheet (" + d.default_id + ") — run attachProjectSheet" : "✔ This is the sheet in SPREADSHEET_ID", "Today: " + d.today + "   Backend version: " + d.version, "");
  Object.keys(d.sheets).forEach(function (k) {
    const s = d.sheets[k];
    if (!s.tab_exists) { L.push("[" + k + "] TAB MISSING"); return; }
    L.push("[" + k + "] visible on website: " + (s.visible_on_website || 0) + " | hidden: " + (s.hidden_count || 0) + " | rows read: " + (s.rows_read || 0) + " | headers on row " + s.header_row_found);
    if (s.problem) L.push("   ⚠ " + s.problem);
    (s.hidden || []).forEach(function (h) { L.push("   ✖ " + (h.title || h.id) + " (" + h.id + ") → " + h.why); });
    (s.warnings || []).forEach(function (w) { L.push("   • " + w); });
  });
  L.push("", "WHAT TO DO:");
  d.advice.forEach(function (a) { L.push(" - " + a); });
  Logger.log(L.join("\n"));
  return L.join("\n");
}

function repairSheetLayout(key) {
  if (!SCHEMA[key] || !LISTING_SHEETS[key] && key !== "NEW_PROJECTS") return { success: false, error: "Only PROPERTIES, LAND_PROPERTIES and NEW_PROJECTS can be repaired here" };
  const ss = getSS(), sh = ss.getSheetByName(key);
  if (!sh) return { success: false, error: "Tab " + key + " not found" };
  const sc = scanLayout(sh, key);
  if (sc.best.hits < 2) return { success: false, error: "Could not recognise the column names in the first rows of " + key + ". Send a screenshot of rows 1-4 so they can be mapped." };
  const backupName = key + "_BACKUP_" + Utilities.formatDate(new Date(), TZ, "MMdd_HHmm");
  sh.copyTo(ss).setName(backupName);
  const report = ["Backup tab created: " + backupName];
  const h = sc.best.row;
  if (h === 1) { sh.insertRowBefore(1); sh.getRange(1, 1).setValue(SCHEMA[key].title); report.push("Added a title row above the headers"); }
  else if (h > 2) { sh.deleteRows(2, h - 2); report.push("Removed " + (h - 2) + " extra row(s) between title and headers"); }
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const hdr = sh.getRange(2, 1, 1, lastCol).getValues()[0], used = {};
  let renamed = 0;
  const fixed = hdr.map(function (c) {
    const n = normHeader(c);
    if (n && SCHEMA[key].headers.indexOf(n) !== -1 && !used[n]) { used[n] = 1; if (n !== String(c)) renamed++; return n; }
    return c;
  });
  sh.getRange(2, 1, 1, lastCol).setValues([fixed]);
  if (renamed) report.push("Renamed " + renamed + " column name(s) to the names the website uses");
  const added = ensureColumns(sh, SCHEMA[key].headers);
  if (added.length) report.push("Added missing columns: " + added.join(", "));
  _ss = null;
  if (LISTING_SHEETS[key]) { const n = backfillListingDates(); if (n) report.push("Set the live-from date on " + n + " listing(s)"); }
  report.push("Done — refresh the website.");
  return { success: true, report: report };
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// Run this from the editor to quickly verify everything works.
function testSetup() {
  Logger.log(JSON.stringify(setupSheets()));
  Logger.log(JSON.stringify(routeGet("ping", {})));
  Logger.log(JSON.stringify(getDashboardStats(false)));
}
