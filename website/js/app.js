// ============================================================
// ApnaGhar — Main App JS
// js/app.js
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  loadFeaturedProperties();
  loadDashboardStats();
  calcEMI();
});

// ---- Navbar scroll effect ----
function initNavbar() {
  const nav = document.getElementById("navbar");
  window.addEventListener("scroll", () => {
    nav.classList.toggle("scrolled", window.scrollY > 60);
  });

  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("navLinks");
  hamburger?.addEventListener("click", () => {
    navLinks.classList.toggle("open");
    hamburger.classList.toggle("active");
  });

  // Search tabs
  document.querySelectorAll(".stab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".stab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

// ---- Load Featured Properties ----
async function loadFeaturedProperties() {
  const grid = document.getElementById("featuredGrid");
  const data = await API.getFeaturedProperties();
  if (!data.success || !data.data.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-home"></i><p>Properties लवकरच उपलब्ध होतील</p></div>`;
    return;
  }
  grid.innerHTML = data.data.map(p => buildPropertyCard(p)).join("");
}

// ---- Load Dashboard Stats ----
async function loadDashboardStats() {
  const data = await API.getDashboard();
  if (!data.success) return;
  const d = data.data;
  if (d.total_properties) document.getElementById("statProps").textContent = d.total_properties + "+";
  if (d.total_clients) document.getElementById("statClients").textContent = d.total_clients + "+";
  if (d.active_agents) document.getElementById("statAgents").textContent = d.active_agents + "+";
}

// ---- Search Handler ----
function handleSearch() {
  const location = document.getElementById("searchLocation").value.trim();
  const bhk = document.getElementById("searchBHK").value;
  const budget = document.getElementById("searchBudget").value;
  const activeTab = document.querySelector(".stab.active")?.dataset.type || "Buy";

  const params = new URLSearchParams();
  if (location) params.set("q", location);
  if (bhk) params.set("bhk", bhk);
  if (activeTab === "Rent") params.set("listing_type", "Rent");
  else if (activeTab === "Buy") params.set("listing_type", "Sale");
  else if (activeTab === "Land") {
    window.location.href = "land.html?" + params.toString();
    return;
  }
  if (budget) {
    const [min, max] = budget.split("-");
    if (min) params.set("min_price", min);
    if (max) params.set("max_price", max);
  }

  window.location.href = "properties.html?" + params.toString();
}

// ---- EMI Calculator ----
function calcEMI() {
  const P = parseFloat(document.getElementById("loanAmt").value);
  const annual = parseFloat(document.getElementById("interestRate").value);
  const years = parseInt(document.getElementById("tenure").value);
  const r = annual / 12 / 100;
  const n = years * 12;

  const emi = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  const total = emi * n;
  const interest = total - P;

  document.getElementById("loanAmtVal").textContent = "₹" + P.toLocaleString("en-IN");
  document.getElementById("rateVal").textContent = annual.toFixed(1) + "%";
  document.getElementById("tenureVal").textContent = years + " Years";
  document.getElementById("emiResult").textContent = "₹" + Math.round(emi).toLocaleString("en-IN");
  document.getElementById("totalAmt").textContent = "₹" + Math.round(total).toLocaleString("en-IN");
  document.getElementById("totalInterest").textContent = "₹" + Math.round(interest).toLocaleString("en-IN");
}

// ---- Contact Form ----
async function submitContact(e) {
  e.preventDefault();
  const btn = document.getElementById("submitBtn");
  const status = document.getElementById("formStatus");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

  const data = {
    full_name: document.getElementById("cName").value,
    mobile: document.getElementById("cMobile").value,
    email: document.getElementById("cEmail").value,
    client_type: document.getElementById("cType").value,
    message: document.getElementById("cMessage").value,
  };

  const result = await API.submitContact(data);
  if (result.success) {
    status.innerHTML = `<div class="status-success"><i class="fas fa-check-circle"></i> ${result.message}</div>`;
    document.getElementById("contactForm").reset();
  } else {
    status.innerHTML = `<div class="status-error"><i class="fas fa-exclamation-circle"></i> काहीतरी चुकले. पुन्हा प्रयत्न करा.</div>`;
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Inquiry';
}

// ---- Inquiry Modal ----
function openInquiryModal(propertyId, title) {
  const name = prompt(`Property Inquiry — ${title}\n\nतुमचे नाव सांगा:`);
  if (!name) return;
  const mobile = prompt("Mobile Number (10 digits):");
  if (!mobile || mobile.length !== 10) { alert("Valid mobile number द्या"); return; }

  API.submitContact({
    full_name: name, mobile, client_type: "Buyer",
    message: `Inquiry for: ${title} (ID: ${propertyId})`
  }).then(r => {
    alert(r.message || "Inquiry submitted!");
  });
}
