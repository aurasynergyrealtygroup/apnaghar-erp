// ============================================================
// ApnaGhar Admin — sidebar.js  (one menu for every admin page)
// ============================================================
(function renderSidebar() {
  const MENU = [
    ["Main", [["dashboard.html", "fa-th-large", "Dashboard"], ["inquiries.html", "fa-inbox", "Website Leads"], ["approvals.html", "fa-user-check", "Approvals (Post Ad)"]]],
    ["Property", [["properties.html", "fa-home", "Properties"], ["projects.html", "fa-rocket", "New Launch Projects"], ["land.html", "fa-map", "Land"], ["societies.html", "fa-city", "Societies"], ["listing-rules.html", "fa-hourglass-half", "Listing Rules (45/60 days)"], ["listing-log.html", "fa-history", "Listing Log"], ["media.html", "fa-photo-video", "Media Library"]]],
    ["CRM", [["clients.html", "fa-users", "Clients"], ["agents.html", "fa-user-tie", "Agents"], ["followups.html", "fa-phone-alt", "Follow-ups"], ["site-visits.html", "fa-car", "Site Visits"]]],
    ["Transactions", [["bookings.html", "fa-bookmark", "Bookings"], ["sale-deals.html", "fa-handshake", "Sale Deals"], ["agreements.html", "fa-file-contract", "Rent Agreements"], ["rent-payments.html", "fa-money-bill-wave", "Rent Payments"]]],
    ["Maintenance", [["work-requests.html", "fa-tools", "Work Requests"], ["service-providers.html", "fa-hard-hat", "Service Providers"]]],
    ["Finance", [["expenses.html", "fa-receipt", "Expenses"], ["invoices.html", "fa-file-invoice", "Invoices"], ["ledger.html", "fa-book", "Ledger"], ["reports.html", "fa-chart-bar", "Reports"]]],
    ["Admin", [["users.html", "fa-user-cog", "Users & Roles"], ["settings.html", "fa-cog", "Settings & Setup"]]],
  ];
  const nav = document.getElementById("sidebarNav") || document.querySelector(".admin-sidebar .sidebar-nav");
  if (!nav) return;
  const here = (location.pathname.split("/").pop() || "dashboard.html").replace(/\?.*$/, "");
  nav.innerHTML = MENU.map(([label, items]) =>
    `<div class="nav-section-label">${label}</div>` +
    items.map(([href, icon, text]) => `<a class="nav-item${href === here ? " active" : ""}" href="${href}"><i class="fas ${icon}"></i> ${text}</a>`).join("")
  ).join("");
  // Footer: website + sheet links
  const foot = document.querySelector(".admin-sidebar .sidebar-footer");
  if (foot && typeof CONFIG !== "undefined" && CONFIG.SHEET_URL && !foot.querySelector(".sheet-link")) {
    const a = document.createElement("a");
    a.className = "nav-item sheet-link"; a.href = CONFIG.SHEET_URL; a.target = "_blank"; a.rel = "noopener"; a.style.padding = "8px 0";
    a.innerHTML = `<i class="fas fa-table"></i> Open Google Sheet`;
    foot.insertBefore(a, foot.firstChild);
  }
})();
