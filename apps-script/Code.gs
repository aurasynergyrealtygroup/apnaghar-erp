// ============================================================
// ApnaGhar ERP — Google Apps Script Backend  (v2.4)
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

// ------------------------------------------------------------
// SCHEMA — every sheet tab, its ID column, ID prefix and headers.
// Row 1 = title, Row 2 = headers, Row 3+ = data (your existing convention).
// Missing tabs/columns are created automatically; nothing is ever deleted.
// ------------------------------------------------------------
const MEDIA_COLS = ["image1_url","image2_url","image3_url","image4_url","image5_url","image6_url","video_url","brochure_url"];

const SCHEMA = {
  PROPERTIES: { id: "property_id", prefix: "PROP", title: "Properties (Sale / Rent)", public: true,
    headers: ["property_id","property_code","title","posted_by","posted_by_name","posted_by_type","contact_name","contact_mobile","approval_status","approval_note","property_type","listing_type","bhk","furnished_status","carpet_area","builtup_area","floor","total_floors","facing","city","address","society_id","project_id","owner_name","owner_mobile","agent_id","status","featured","expected_price","expected_rent","deposit_amount","amenities","description"].concat(MEDIA_COLS, ["created_at","updated_at"]) },
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
    headers: ["agent_id","full_name","mobile","email","rera_agent_no","experience_years","area","commission_percent","photo_url","joining_date","status","created_at","updated_at"] },
  SOCIETIES: { id: "society_id", prefix: "SOC", title: "Societies", public: true,
    headers: ["society_id","society_name","builder_name","address","area","city","pincode","total_wings","total_flats","amenities","secretary_name","secretary_mobile","image_url","status","created_at","updated_at"] },
  LAND_PROPERTIES: { id: "land_id", prefix: "LAND", title: "Land", public: true,
    headers: ["land_id","title","land_type","survey_no","village","taluka","district","area_value","area_unit","price","price_per_unit","road_touch","zone","ownership","status","featured","description","image1_url","image2_url","image3_url","video_url","document_url","created_at","updated_at"] },
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
    case "ping":                  return { success: true, message: "ApnaGhar API is running", time: new Date().toISOString(), version: "2.4" };
    case "getProperties":         return getProperties(p);
    case "getProperty":           return getPublicById("PROPERTIES", p.id, p.token);
    case "getFeaturedProperties": return getFeaturedProperties();
    case "searchProperties":      return searchProperties(p);
    case "getLand":               return getLand(p);
    case "getLandById":           return getById("LAND_PROPERTIES", p.id);
    case "getSocieties":          return listRows("SOCIETIES");
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
  requireStaff(user);                         // everything below = ERP staff only
  if (action === "list")  return listRows(checkSheet(p.sheet));
  if (action === "get")   return getById(checkSheet(p.sheet), p.id);
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
  }
  requireStaff(user);                         // everything below = ERP staff only
  switch (action) {
    case "approveListing": return approveListing(body.sheet, data, who);
    case "approveUser":    requireAdmin(user); return approveUser(data, who);
    case "create":      return addRow(checkSheet(body.sheet), data, who);
    case "update":      return updateRow(checkSheet(body.sheet), data, who);
    case "delete":      return deleteRow(checkSheet(body.sheet), data.id || data[SCHEMA[checkSheet(body.sheet)].id], who);
    case "saveUser":    requireAdmin(user); return saveUser(data, who);
    case "deleteUser":  requireAdmin(user); return deleteRow("USERS", data.user_id, who);
    case "runSetup":    requireAdmin(user); return setupSheets();
  }
  const legacy = LEGACY_POST[action];
  if (legacy) {
    const [op, sheet] = legacy;
    if (op === "create") return addRow(sheet, data, who);
    if (op === "update") return updateRow(sheet, data, who);
    if (op === "delete") return deleteRow(sheet, data[SCHEMA[sheet].id], who);
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

// Opens the Sheet by ID; falls back to the Sheet this script is attached to.
function getSS() {
  try { return SpreadsheetApp.openById(SPREADSHEET_ID); }
  catch (e) {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error("Cannot open spreadsheet " + SPREADSHEET_ID + ": " + e.message);
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
    if (key !== "USER_ACTIVITY_LOG") logActivity(who, "Add", key, newId);
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
  if (!isStaffToken(p.token)) rows = rows.filter(isLive);
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
  if (p.q) {
    const q = lc(p.q);
    rows = rows.filter(function (r) { return [r.title, r.city, r.address, r.bhk, r.property_type].some(function (v) { return lc(v).indexOf(q) !== -1; }); });
  }
  rows.reverse(); // newest first
  const page = parseInt(p.page) || 1, limit = parseInt(p.limit) || 20;
  const total = rows.length, start = (page - 1) * limit;
  return { success: true, total: total, page: page, limit: limit, count: Math.min(limit, Math.max(0, total - start)), data: rows.slice(start, start + limit) };
}

function getFeaturedProperties() {
  let rows = sheetToJSON(getSheet("PROPERTIES")).filter(function (r) { return r.status === "Available" && isLive(r); }).reverse();
  const featured = rows.filter(function (r) { return String(r.featured).toLowerCase() === "yes" || r.featured === true; });
  rows = featured.concat(rows.filter(function (r) { return featured.indexOf(r) === -1; })).slice(0, 6);
  return { success: true, count: rows.length, data: rows };
}

function searchProperties(p) { return getProperties({ q: p.q, limit: 1000 }); }

function getLand(p) {
  let rows = sheetToJSON(getSheet("LAND_PROPERTIES"));
  const lc = function (v) { return String(v || "").toLowerCase(); };
  if (p.land_type) rows = rows.filter(function (r) { return r.land_type === p.land_type; });
  if (p.district)  rows = rows.filter(function (r) { return lc(r.district).indexOf(lc(p.district)) !== -1; });
  if (p.status)    rows = rows.filter(function (r) { return r.status === p.status; });
  if (p.q) { const q = lc(p.q); rows = rows.filter(function (r) { return [r.title, r.village, r.taluka, r.district].some(function (v) { return lc(v).indexOf(q) !== -1; }); }); }
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
  res.units = sheetToJSON(getSheet("PROPERTIES")).filter(function (r) { return String(r.project_id) === String(id) && (staff || isLive(r)); });
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
function isLive(r) { const a = String(r.approval_status || "").trim(); return a === "" || a === "Approved"; }
function isStaffToken(token) { try { return !!token && !isPartnerRole(requireAuth(token).role); } catch (e) { return false; } }

function getPublicById(key, id, token) {
  const res = getById(key, id);
  if (res.success && !isStaffToken(token) && !isLive(res.data)) return { success: false, error: "Record not found" };
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
  PROPERTIES: ["title","property_type","listing_type","bhk","furnished_status","carpet_area","builtup_area","floor","total_floors","facing","city","address","project_id","expected_price","expected_rent","deposit_amount","amenities","description","contact_name","contact_mobile","status"].concat(MEDIA_COLS),
  NEW_PROJECTS: ["project_name","builder_name","project_type","launch_status","location","city","rera_number","configurations","price_from","price_to","carpet_from","carpet_to","total_towers","total_units","available_units","launch_date","possession_date","booking_amount","offer","amenities","highlights","description","map_url","floor_plan_url","contact_name","contact_mobile"].concat(MEDIA_COLS),
};

function partnerSheet(user, sheet) {
  if (!PARTNER_FIELDS[sheet]) throw new Error("You can post Properties or Projects only");
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
  if (sheet === "PROPERTIES" && rec.project_id) {           // may only attach units to own project
    const pj = getById("NEW_PROJECTS", rec.project_id);
    if (!pj.success || String(pj.data.posted_by) !== String(user.user_id)) rec.project_id = "";
  }
  if (!(sheet === "PROPERTIES" ? rec.title : rec.project_name)) return { success: false, error: "Title / project name is required" };
  const u = sheetToJSON(getSheet("USERS")).find(function (x) { return String(x.user_id) === String(user.user_id); }) || {};
  if (!rec.contact_name) rec.contact_name = u.full_name || "";
  if (!rec.contact_mobile) rec.contact_mobile = u.mobile || "";
  rec.approval_status = AUTO_APPROVE_ADS ? "Approved" : "Pending";
  rec.approval_note = "";
  const who = user.username || user.user_id;
  if (id) {
    ownedRecord(user, sheet, id);
    rec[idField] = id;
    const r = updateRow(sheet, rec, who);
    if (r.success) r.message = AUTO_APPROVE_ADS ? "Listing updated" : "Listing updated — sent for admin approval";
    return r;
  }
  rec.posted_by = user.user_id;
  rec.posted_by_name = u.company_name || u.full_name || user.username;
  rec.posted_by_type = u.user_type || "";
  if (sheet === "PROPERTIES" && !rec.status) rec.status = "Available";
  if (sheet === "NEW_PROJECTS") { rec.status = "Active"; rec.featured = "No"; if (!rec.builder_name) rec.builder_name = u.company_name || u.full_name; }
  const r = addRow(sheet, rec, who);
  if (r.success) {
    r.message = AUTO_APPROVE_ADS ? "Your ad is live!" : "Ad submitted ✅ It will appear on the website after admin approval.";
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
    properties: sheetToJSON(getSheet("PROPERTIES")).filter(mine).reverse(),
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
  if (sheet !== "PROPERTIES" && sheet !== "NEW_PROJECTS") return { success: false, error: "Bad sheet" };
  const status = d.approval_status === "Rejected" ? "Rejected" : "Approved";
  const rec = { approval_status: status, approval_note: d.approval_note || "" };
  rec[SCHEMA[sheet].id] = d.id;
  return updateRow(sheet, rec, who);
}

function approveUser(d, who) {
  const status = d.status === "Rejected" ? "Rejected" : "Active";
  const r = updateRow("USERS", { user_id: d.user_id, status: status, approved_by: who }, who);
  const u = sheetToJSON(getSheet("USERS")).find(function (x) { return String(x.user_id) === String(d.user_id); });
  if (r.success && u && u.email && status === "Active") {
    try { MailApp.sendEmail(u.email, "Your ApnaGhar account is approved", "Hello " + u.full_name + ",\n\nYour account (" + u.username + ") is now active. Login and post your ads here:\nhttps://apnaghar-erp.aurasynergyrealtygroup.workers.dev/website/partner.html\n\n— Aura Synergy Realty Group"); } catch (e) {}
  }
  return r;
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
