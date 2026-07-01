// ============================================================
// ApnaGhar ERP — Google Apps Script API
// File: Code.gs
// Version: 1.0
// ============================================================

// ⚠️ IMPORTANT: Replace these IDs with your actual Google Sheet IDs
const SPREADSHEET_ID = "14SH_L0fsknVQRNqrNPcfSS0lODipe-7mlnFt1pvFFG8";

// Sheet Names
const SHEETS = {
  PROPERTIES: "PROPERTIES",
  SOCIETIES: "SOCIETIES",
  CLIENTS: "CLIENTS",
  AGENTS: "AGENTS",
  OWNERS: "OWNERS",
  PROPERTY_OWNERS: "PROPERTY_OWNERS",
  AGREEMENTS: "AGREEMENTS",
  TENANTS: "TENANTS",
  RENT_PAYMENTS: "RENT_PAYMENTS",
  SALE_DEALS: "SALE_DEALS",
  AGENT_COMMISSION: "AGENT_COMMISSION",
  SITE_VISITS: "SITE_VISITS",
  FOLLOWUPS: "FOLLOWUPS",
  SERVICE_PROVIDERS: "SERVICE_PROVIDERS",
  WORK_REQUEST: "PROPERTY_WORK_REQUEST",
  WORK_ASSIGNMENT: "WORK_ASSIGNMENT",
  WORK_PAYMENT: "WORK_PAYMENT",
  CONSTRUCTION: "CONSTRUCTION_PROJECT",
  PROJECT_EXPENSES: "PROJECT_EXPENSES",
  EXPENSES: "EXPENSES",
  LAND: "LAND_PROPERTIES",
  LAND_PLOTS: "LAND_PLOTS",
  LAND_DOCUMENTS: "LAND_DOCUMENTS",
  LAND_OWNERS: "LAND_OWNERS",
  LAND_SALE_DEALS: "LAND_SALE_DEALS",
  INVOICES: "INVOICES",
  LEDGER: "ACCOUNT_LEDGER",
  USERS: "USERS",
  ROLES: "ROLES",
  PERMISSIONS: "PERMISSIONS",
  ROLE_PERMISSIONS: "ROLE_PERMISSIONS",
  DOCUMENT_LOCKER: "DOCUMENT_LOCKER",
  MESSAGE_LOG: "MESSAGE_LOG",
  CLIENT_INTEREST: "CLIENT_PROPERTY_INTEREST",
  AGENT_ASSIGNMENT: "AGENT_PROPERTY_ASSIGNMENT",
  DASHBOARD: "DASHBOARD",
  MASTER_CITY: "MASTER_CITY",
  MASTER_BHK: "MASTER_BHK",
  MASTER_PROPERTY_TYPE: "MASTER_PROPERTY_TYPE",
  MASTER_AMENITIES: "MASTER_AMENITIES",
  MASTER_LEAD_SOURCE: "MASTER_LEAD_SOURCE",
  VEHICLES: "VEHICLES",
  CAR_RENTALS: "CAR_RENTALS",
  TEMP_RENTALS: "TEMPORARY_RENTALS",
  PACKERS_SERVICE: "PACKERS_MOVERS_SERVICE",
  PACKERS_REQUESTS: "PACKERS_REQUESTS",
  RERA: "RERA_COMPLIANCE",
  RENT_TEMPLATES: "RENT_TEMPLATE_MASTER",
  INVESTORS: "INVESTORS",
  JOINT_VENTURE: "JOINT_VENTURE",
  INVESTOR_TXN: "INVESTOR_TRANSACTIONS",
  USER_LOG: "USER_ACTIVITY_LOG",
};

// ============================================================
// MAIN ROUTER — doGet handles all API requests
// ============================================================
function doGet(e) {
  try {
    const params = e.parameter;
    const action = params.action || "";
    const sheet = params.sheet || "";
    const id = params.id || "";

    let result;

    switch (action) {
      // Public endpoints (no auth needed)
      case "getProperties":      result = getProperties(params); break;
      case "getProperty":        result = getById(SHEETS.PROPERTIES, id, "property_id"); break;
      case "getSocieties":       result = getAllRows(SHEETS.SOCIETIES); break;
      case "getLand":            result = getLand(params); break;
      case "getLandById":        result = getById(SHEETS.LAND, id, "land_id"); break;
      case "getAgents":          result = getAllRows(SHEETS.AGENTS); break;
      case "getMasters":         result = getMasters(params.type); break;
      case "getDashboard":       result = getDashboardStats(); break;
      case "searchProperties":   result = searchProperties(params); break;
      case "getFeaturedProperties": result = getFeaturedProperties(); break;

      // CRM
      case "getClients":         result = getAllRows(SHEETS.CLIENTS); break;
      case "getClient":          result = getById(SHEETS.CLIENTS, id, "client_id"); break;
      case "getFollowups":       result = getAllRows(SHEETS.FOLLOWUPS); break;
      case "getSiteVisits":      result = getAllRows(SHEETS.SITE_VISITS); break;
      case "getClientInterests": result = getAllRows(SHEETS.CLIENT_INTEREST); break;

      // Rental
      case "getAgreements":      result = getAllRows(SHEETS.AGREEMENTS); break;
      case "getRentPayments":    result = getAllRows(SHEETS.RENT_PAYMENTS); break;
      case "getTenants":         result = getAllRows(SHEETS.TENANTS); break;

      // Sales
      case "getSaleDeals":       result = getAllRows(SHEETS.SALE_DEALS); break;
      case "getCommissions":     result = getAllRows(SHEETS.AGENT_COMMISSION); break;

      // Land
      case "getLandPlots":       result = getAllRows(SHEETS.LAND_PLOTS); break;
      case "getLandDocuments":   result = getAllRows(SHEETS.LAND_DOCUMENTS); break;

      // Finance
      case "getInvoices":        result = getAllRows(SHEETS.INVOICES); break;
      case "getLedger":          result = getAllRows(SHEETS.LEDGER); break;
      case "getExpenses":        result = getAllRows(SHEETS.EXPENSES); break;

      // Construction
      case "getProjects":        result = getAllRows(SHEETS.CONSTRUCTION); break;
      case "getProjectExpenses": result = getAllRows(SHEETS.PROJECT_EXPENSES); break;

      // Maintenance
      case "getWorkRequests":    result = getAllRows(SHEETS.WORK_REQUEST); break;
      case "getServiceProviders": result = getAllRows(SHEETS.SERVICE_PROVIDERS); break;

      // Services
      case "getVehicles":        result = getAllRows(SHEETS.VEHICLES); break;
      case "getCarRentals":      result = getAllRows(SHEETS.CAR_RENTALS); break;

      // Admin
      case "getUsers":           result = getAllRows(SHEETS.USERS); break;
      case "getRoles":           result = getAllRows(SHEETS.ROLES); break;
      case "getUserLog":         result = getAllRows(SHEETS.USER_LOG); break;

      default:
        result = { success: false, error: "Unknown action: " + action };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ============================================================
// doPost — handles Create, Update, Delete, Login
// ============================================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || "";
    const data = body.data || {};

    let result;

    switch (action) {
      // Properties
      case "addProperty":         result = addRow(SHEETS.PROPERTIES, data); break;
      case "updateProperty":      result = updateRow(SHEETS.PROPERTIES, data, "property_id"); break;
      case "deleteProperty":      result = deleteRow(SHEETS.PROPERTIES, data.property_id, "property_id"); break;

      // Clients
      case "addClient":           result = addRow(SHEETS.CLIENTS, data); break;
      case "updateClient":        result = updateRow(SHEETS.CLIENTS, data, "client_id"); break;
      case "deleteClient":        result = deleteRow(SHEETS.CLIENTS, data.client_id, "client_id"); break;

      // Agents
      case "addAgent":            result = addRow(SHEETS.AGENTS, data); break;
      case "updateAgent":         result = updateRow(SHEETS.AGENTS, data, "agent_id"); break;

      // Agreements
      case "addAgreement":        result = addRow(SHEETS.AGREEMENTS, data); break;
      case "updateAgreement":     result = updateRow(SHEETS.AGREEMENTS, data, "agreement_id"); break;

      // Rent Payments
      case "addRentPayment":      result = addRow(SHEETS.RENT_PAYMENTS, data); break;
      case "updateRentPayment":   result = updateRow(SHEETS.RENT_PAYMENTS, data, "payment_id"); break;

      // Sale Deals
      case "addSaleDeal":         result = addRow(SHEETS.SALE_DEALS, data); break;
      case "updateSaleDeal":      result = updateRow(SHEETS.SALE_DEALS, data, "deal_id"); break;

      // CRM
      case "addFollowup":         result = addRow(SHEETS.FOLLOWUPS, data); break;
      case "updateFollowup":      result = updateRow(SHEETS.FOLLOWUPS, data, "followup_id"); break;
      case "addSiteVisit":        result = addRow(SHEETS.SITE_VISITS, data); break;
      case "updateSiteVisit":     result = updateRow(SHEETS.SITE_VISITS, data, "visit_id"); break;
      case "addClientInterest":   result = addRow(SHEETS.CLIENT_INTEREST, data); break;

      // Land
      case "addLand":             result = addRow(SHEETS.LAND, data); break;
      case "updateLand":          result = updateRow(SHEETS.LAND, data, "land_id"); break;

      // Maintenance
      case "addWorkRequest":      result = addRow(SHEETS.WORK_REQUEST, data); break;
      case "updateWorkRequest":   result = updateRow(SHEETS.WORK_REQUEST, data, "work_request_id"); break;
      case "addWorkAssignment":   result = addRow(SHEETS.WORK_ASSIGNMENT, data); break;

      // Finance
      case "addExpense":          result = addRow(SHEETS.EXPENSES, data); break;
      case "addInvoice":          result = addRow(SHEETS.INVOICES, data); break;
      case "addLedgerEntry":      result = addRow(SHEETS.LEDGER, data); break;

      // Documents
      case "addDocument":         result = addRow(SHEETS.DOCUMENT_LOCKER, data); break;

      // Contact form (public)
      case "submitContact":       result = submitContactForm(data); break;
      case "submitInquiry":       result = submitInquiry(data); break;

      // Auth
      case "login":               result = loginUser(data); break;

      // Message Log
      case "logMessage":          result = addRow(SHEETS.MESSAGE_LOG, data); break;

      default:
        result = { success: false, error: "Unknown action: " + action };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ============================================================
// CORE HELPERS
// ============================================================

function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);
  return sheet;
}

function sheetToJSON(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 3) return []; // Row 1=title, Row 2=headers, Row 3+=data
  const headers = data[1]; // Row 2 is the actual headers
  return data.slice(2).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] === "" ? null : row[i];
    });
    return obj;
  }).filter(row => Object.values(row).some(v => v !== null));
}

function getAllRows(sheetName) {
  const sheet = getSheet(sheetName);
  const rows = sheetToJSON(sheet);
  return { success: true, count: rows.length, data: rows };
}

function getById(sheetName, id, idField) {
  const sheet = getSheet(sheetName);
  const rows = sheetToJSON(sheet);
  const found = rows.find(r => String(r[idField]) === String(id));
  if (!found) return { success: false, error: "Record not found" };
  return { success: true, data: found };
}

function addRow(sheetName, data) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newId = generateId(sheetName);
  const firstIdKey = headers[0];
  data[firstIdKey] = newId;
  data.created_at = new Date().toISOString().split("T")[0];
  const row = headers.map(h => data[h] !== undefined ? data[h] : "");
  sheet.appendRow(row);
  logActivity("Add", sheetName, newId);
  return { success: true, id: newId, message: "Record added successfully" };
}

function updateRow(sheetName, data, idField) {
  const sheet = getSheet(sheetName);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[1];
  const idColIndex = headers.indexOf(idField);
  if (idColIndex === -1) return { success: false, error: "ID field not found" };

  for (let i = 2; i < allData.length; i++) {
    if (String(allData[i][idColIndex]) === String(data[idField])) {
      headers.forEach((h, j) => {
        if (data[h] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(data[h]);
        }
      });
      logActivity("Update", sheetName, data[idField]);
      return { success: true, message: "Record updated successfully" };
    }
  }
  return { success: false, error: "Record not found" };
}

function deleteRow(sheetName, id, idField) {
  const sheet = getSheet(sheetName);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[1];
  const idColIndex = headers.indexOf(idField);

  for (let i = 2; i < allData.length; i++) {
    if (String(allData[i][idColIndex]) === String(id)) {
      sheet.deleteRow(i + 1);
      logActivity("Delete", sheetName, id);
      return { success: true, message: "Record deleted" };
    }
  }
  return { success: false, error: "Record not found" };
}

function generateId(sheetName) {
  const prefixes = {
    PROPERTIES: "PROP", CLIENTS: "CLI", AGENTS: "AGT", AGREEMENTS: "AGR",
    RENT_PAYMENTS: "PAY", SALE_DEALS: "DEAL", LAND_PROPERTIES: "LAND",
    EXPENSES: "EXP", INVOICES: "INV", ACCOUNT_LEDGER: "LED",
    PROPERTY_WORK_REQUEST: "WRK", WORK_ASSIGNMENT: "WA", SERVICE_PROVIDERS: "SP",
    OWNERS: "OWN", TENANTS: "TNT", CONSTRUCTION_PROJECT: "PROJ", DOCUMENT_LOCKER: "DOC",
    FOLLOWUPS: "FUP", SITE_VISITS: "VIS", AGENTS: "AGT",
  };
  const prefix = prefixes[sheetName] || "REC";
  const timestamp = Date.now().toString().slice(-6);
  return prefix + timestamp;
}

// ============================================================
// SPECIFIC API FUNCTIONS
// ============================================================

function getProperties(params) {
  const sheet = getSheet(SHEETS.PROPERTIES);
  let rows = sheetToJSON(sheet);

  // Filters
  if (params.listing_type) rows = rows.filter(r => r.listing_type === params.listing_type);
  if (params.bhk) rows = rows.filter(r => r.bhk === params.bhk);
  if (params.city) rows = rows.filter(r => r.city && r.city.toLowerCase().includes(params.city.toLowerCase()));
  if (params.status) rows = rows.filter(r => r.status === params.status);
  if (params.property_type) rows = rows.filter(r => r.property_type === params.property_type);
  if (params.min_price) rows = rows.filter(r => Number(r.expected_price || r.expected_rent) >= Number(params.min_price));
  if (params.max_price) rows = rows.filter(r => Number(r.expected_price || r.expected_rent) <= Number(params.max_price));
  if (params.society_id) rows = rows.filter(r => String(r.society_id) === params.society_id);

  // Pagination
  const page = parseInt(params.page) || 1;
  const limit = parseInt(params.limit) || 20;
  const total = rows.length;
  const start = (page - 1) * limit;
  const paginated = rows.slice(start, start + limit);

  return { success: true, total, page, limit, count: paginated.length, data: paginated };
}

function getFeaturedProperties() {
  const sheet = getSheet(SHEETS.PROPERTIES);
  let rows = sheetToJSON(sheet);
  rows = rows.filter(r => r.status === "Available");
  rows = rows.slice(0, 6);
  return { success: true, count: rows.length, data: rows };
}

function searchProperties(params) {
  const q = (params.q || "").toLowerCase();
  const sheet = getSheet(SHEETS.PROPERTIES);
  let rows = sheetToJSON(sheet);
  if (q) {
    rows = rows.filter(r =>
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.city && r.city.toLowerCase().includes(q)) ||
      (r.address && r.address.toLowerCase().includes(q)) ||
      (r.bhk && r.bhk.toLowerCase().includes(q)) ||
      (r.property_type && r.property_type.toLowerCase().includes(q))
    );
  }
  return { success: true, count: rows.length, data: rows };
}

function getLand(params) {
  const sheet = getSheet(SHEETS.LAND);
  let rows = sheetToJSON(sheet);
  if (params.land_type) rows = rows.filter(r => r.land_type === params.land_type);
  if (params.district) rows = rows.filter(r => r.district && r.district.toLowerCase().includes(params.district.toLowerCase()));
  if (params.status) rows = rows.filter(r => r.status === params.status);
  return { success: true, count: rows.length, data: rows };
}

function getMasters(type) {
  const masterMap = {
    city: SHEETS.MASTER_CITY, bhk: SHEETS.MASTER_BHK,
    property_type: SHEETS.MASTER_PROPERTY_TYPE, amenities: SHEETS.MASTER_AMENITIES,
    lead_source: SHEETS.MASTER_LEAD_SOURCE,
  };
  const sheetName = masterMap[type];
  if (!sheetName) return { success: false, error: "Unknown master type" };
  return getAllRows(sheetName);
}

function getDashboardStats() {
  try {
    const props = sheetToJSON(getSheet(SHEETS.PROPERTIES));
    const clients = sheetToJSON(getSheet(SHEETS.CLIENTS));
    const agents = sheetToJSON(getSheet(SHEETS.AGENTS));
    const land = sheetToJSON(getSheet(SHEETS.LAND));
    const payments = sheetToJSON(getSheet(SHEETS.RENT_PAYMENTS));
    const deals = sheetToJSON(getSheet(SHEETS.SALE_DEALS));
    const followups = sheetToJSON(getSheet(SHEETS.FOLLOWUPS));

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const monthlyRent = payments
      .filter(p => p.payment_status === "Paid" && p.paid_date && new Date(p.paid_date).getMonth() === thisMonth)
      .reduce((s, p) => s + Number(p.rent_amount || 0), 0);

    const monthlySales = deals
      .filter(d => d.deal_status === "Registered" && d.registration_date && new Date(d.registration_date).getMonth() === thisMonth)
      .reduce((s, d) => s + Number(d.final_price || 0), 0);

    return {
      success: true,
      data: {
        total_properties: props.length,
        available_properties: props.filter(p => p.status === "Available").length,
        rented_properties: props.filter(p => p.status === "Rented").length,
        sold_properties: props.filter(p => p.status === "Sold").length,
        total_clients: clients.length,
        new_clients_this_month: clients.filter(c => c.created_at && new Date(c.created_at).getMonth() === thisMonth).length,
        total_agents: agents.length,
        active_agents: agents.filter(a => a.status === "Active").length,
        total_land: land.length,
        available_land: land.filter(l => l.status === "Available").length,
        pending_followups: followups.filter(f => f.followup_status === "Pending").length,
        total_deals: deals.length,
        registered_deals: deals.filter(d => d.deal_status === "Registered").length,
        monthly_rent_income: monthlyRent,
        monthly_sale_revenue: monthlySales,
        last_updated: new Date().toISOString(),
      }
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function submitContactForm(data) {
  const sheet = getSheet(SHEETS.CLIENTS);
  const allClients = sheetToJSON(sheet);
  const existing = allClients.find(c => c.mobile === data.mobile);
  if (existing) {
    return { success: true, message: "Inquiry received. Our team will contact you shortly." };
  }
  const newClient = {
    client_type: data.client_type || "Buyer",
    full_name: data.full_name || data.name,
    mobile: data.mobile,
    email: data.email || "",
    occupation: "",
    lead_source: "Website",
    lead_status: "New",
    created_at: new Date().toISOString().split("T")[0],
  };
  addRow(SHEETS.CLIENTS, newClient);
  return { success: true, message: "Thank you! We will contact you within 24 hours." };
}

function submitInquiry(data) {
  const newInterest = {
    client_id: data.client_id,
    property_id: data.property_id,
    visit_date: new Date().toISOString().split("T")[0],
    interest_level: "Warm",
    remark: data.message || "Website inquiry",
  };
  addRow(SHEETS.CLIENT_INTEREST, newInterest);
  return { success: true, message: "Inquiry submitted successfully!" };
}

function loginUser(data) {
  const users = sheetToJSON(getSheet(SHEETS.USERS));
  const roles = sheetToJSON(getSheet(SHEETS.ROLES));

  const user = users.find(u =>
    u.username === data.username && u.status === "Active"
  );

  if (!user) return { success: false, error: "Invalid username or password" };

  // Simple hash check (in production use proper hashing)
  const inputHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    data.password + "apnaghar_salt"
  ).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")).join("");

  if (user.password_hash !== inputHash && user.password_hash !== data.password) {
    return { success: false, error: "Invalid username or password" };
  }

  const role = roles.find(r => String(r.role_id) === String(user.role_id));

  return {
    success: true,
    user: {
      user_id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      role: role ? role.role_name : "Unknown",
      role_id: user.role_id,
      agent_id: user.agent_id,
    },
    message: "Login successful"
  };
}

function logActivity(action, module, recordId) {
  try {
    const sheet = getSheet(SHEETS.USER_LOG);
    sheet.appendRow([
      generateId("USER_LOG"), "SYSTEM", module, action, recordId,
      new Date().toISOString(), "API"
    ]);
  } catch (e) { /* silent */ }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
