// ============================================================
// ApnaGhar Admin — admin.js  (shared across all admin pages)
// ============================================================

// ---- AUTH GUARD ----
function getAdminUser() {
  const u = sessionStorage.getItem("ag_user") || localStorage.getItem("ag_user");
  return u ? JSON.parse(u) : null;
}

(function authGuard() {
  const user = getAdminUser();
  if (!user) { window.location.href = "login.html"; return; }
  // Populate sidebar user info
  const nameEl = document.getElementById("sidebarUserName");
  const roleEl = document.getElementById("sidebarUserRole");
  if (nameEl) nameEl.textContent = user.full_name || user.username;
  if (roleEl) roleEl.textContent = user.role || "User";
})();

function logout() {
  if (!confirm("Logout करायचे आहे का?")) return;
  sessionStorage.removeItem("ag_user");
  localStorage.removeItem("ag_user");
  window.location.href = "login.html";
}

// ---- SIDEBAR TOGGLE ----
function toggleSidebar() {
  const sidebar  = document.getElementById("adminSidebar");
  const overlay  = document.getElementById("sidebarOverlay");
  sidebar.classList.toggle("open");
  overlay.classList.toggle("show");
}

// ---- TOAST ----
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = "";
  const icon = type === "success" ? "fa-check-circle" : type === "error" ? "fa-exclamation-circle" : "fa-info-circle";
  t.innerHTML = `<i class="fas ${icon}"></i> ${msg}`;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3200);
}

// ---- MODAL HELPERS ----
function openModal(id) {
  document.getElementById(id)?.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
  document.body.style.overflow = "";
}

// ---- FORMAT HELPERS ----
function fmt(n) {
  if (!n) return "—";
  n = Number(n);
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(2) + "Cr";
  if (n >= 100000)   return "₹" + (n / 100000).toFixed(1) + "L";
  if (n >= 1000)     return "₹" + (n / 1000).toFixed(0) + "K";
  return "₹" + n.toLocaleString("en-IN");
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function statusBadge(status) {
  const map = {
    "Available":  "badge-success",
    "Active":     "badge-success",
    "Paid":       "badge-success",
    "Completed":  "badge-success",
    "Registered": "badge-success",
    "Rented":     "badge-warning",
    "Pending":    "badge-warning",
    "Followup":   "badge-warning",
    "In Progress":"badge-warning",
    "Token Done": "badge-info",
    "New":        "badge-info",
    "Sold":       "badge-navy",
    "Closed":     "badge-navy",
    "Cancelled":  "badge-danger",
    "Lost":       "badge-danger",
    "Expired":    "badge-danger",
    "Inactive":   "badge-danger",
    "Negotiation":"badge-purple",
    "Open":       "badge-info",
  };
  const cls = map[status] || "badge-gold";
  return `<span class="badge ${cls}">${status || "—"}</span>`;
}

// ---- TABLE SEARCH ----
function filterTable(inputId, tbodyId) {
  const q = document.getElementById(inputId)?.value.toLowerCase() || "";
  const rows = document.querySelectorAll(`#${tbodyId} tr`);
  let visible = 0;
  rows.forEach(row => {
    const match = row.textContent.toLowerCase().includes(q);
    row.style.display = match ? "" : "none";
    if (match) visible++;
  });
  return visible;
}

// ---- CONFIRM DELETE ----
function confirmDelete(name, cb) {
  if (confirm(`"${name}" delete करायचे आहे का?\n\nही action undo होऊ शकत नाही.`)) cb();
}

// ---- DATE GREETING ----
function setGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  const user = getAdminUser();
  const el = document.getElementById("welcomeMsg");
  if (el) el.textContent = `${greet}, ${user?.full_name?.split(" ")[0] || "Admin"}! 👋`;

  const dateEl = document.getElementById("todayDate");
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

document.addEventListener("DOMContentLoaded", setGreeting);
