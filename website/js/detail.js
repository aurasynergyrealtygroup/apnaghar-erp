// ============================================================
// ApnaGhar — detail.js
// ============================================================

let currentProperty = null;
let galleryImages = [];
let currentImageIndex = 0;

document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) { window.location.href = "properties.html"; return; }
  loadPropertyDetail(id);
});

function initNavbar() {
  const hamburger = document.getElementById("hamburger");
  const navLinks  = document.getElementById("navLinks");
  hamburger?.addEventListener("click", () => {
    navLinks.classList.toggle("open");
    hamburger.classList.toggle("active");
  });
}

// ---- LOAD PROPERTY ----
async function loadPropertyDetail(id) {
  const result = await API.getProperty(id);
  if (!result.success) {
    document.getElementById("detailLoading").innerHTML =
      `<div class="container" style="text-align:center;padding:120px 20px">
        <i class="fas fa-exclamation-circle" style="font-size:48px;color:var(--gray-400);margin-bottom:16px"></i>
        <h2>Property सापडली नाही</h2>
        <p style="color:var(--text-light);margin:12px 0 24px">ही property उपलब्ध नाही किंवा काढून टाकली आहे.</p>
        <a href="properties.html" class="btn btn-primary">← Properties पाहा</a>
      </div>`;
    return;
  }

  currentProperty = result.data;
  renderPropertyDetail(currentProperty);
  loadSimilarProperties(currentProperty);

  // Hide loading, show detail
  document.getElementById("detailLoading").style.display = "none";
  document.getElementById("detailMain").style.display = "block";
}

// ---- RENDER ----
function renderPropertyDetail(p) {
  // Page title & meta
  document.getElementById("pageTitle").textContent = `${p.title} — ApnaGhar`;
  document.getElementById("bcTitle").textContent = p.title;

  // Gallery
  galleryImages = [p.image1_url, p.image2_url, p.image3_url, p.image4_url]
    .filter(Boolean).map(getImageUrl);
  if (!galleryImages.length) galleryImages = [CONFIG.CLOUDINARY.placeholder];
  setGalleryImage(0);
  renderThumbs();

  // Badges
  const listBadge = p.listing_type === "Rent"
    ? `<span class="detail-badge db-rent">भाडे</span>`
    : `<span class="detail-badge db-sale">विक्री</span>`;
  const statusBadge = p.status === "Available"
    ? `<span class="detail-badge db-available">Available</span>`
    : p.status === "Rented"
    ? `<span class="detail-badge db-rented">Rented</span>`
    : `<span class="detail-badge db-sold">Sold</span>`;
  document.getElementById("detailBadges").innerHTML = listBadge + statusBadge;

  // Title & Location
  document.getElementById("detailTitle").textContent  = p.title || "Property";
  document.getElementById("detailAddress").textContent = [p.address, p.city].filter(Boolean).join(", ");

  // Price
  const price = p.listing_type === "Rent" ? formatPrice(p.expected_rent) : formatPrice(p.expected_price);
  const priceSub = p.listing_type === "Rent"
    ? `Deposit: ${formatPrice(p.deposit_amount)}`
    : p.carpet_area ? `₹${Math.round(p.expected_price / p.carpet_area).toLocaleString("en-IN")}/SqFt` : "";
  document.getElementById("detailPrice").textContent   = price + (p.listing_type === "Rent" ? "/mo" : "");
  document.getElementById("detailPriceSub").textContent = priceSub;

  // Sticky price
  document.getElementById("stickyPrice").textContent = price + (p.listing_type === "Rent" ? "/mo" : "");
  document.getElementById("stickyWA").href =
    `https://wa.me/${CONFIG.COMPANY.whatsapp}?text=Hello! I'm interested in: ${p.title}`;

  // Agent WhatsApp
  document.getElementById("agentWA").href =
    `https://wa.me/${CONFIG.COMPANY.whatsapp}?text=Hello! I want details about: ${p.title}`;

  // Info Cards
  const infoItems = [
    { icon: "🛏", val: p.bhk || "—", label: "BHK" },
    { icon: "📐", val: p.carpet_area ? p.carpet_area + " SqFt" : "—", label: "Carpet Area" },
    { icon: "🏗", val: p.builtup_area ? p.builtup_area + " SqFt" : "—", label: "Built-up" },
    { icon: "🏢", val: p.floor ? `${p.floor} / ${p.total_floors || "?"}` : "—", label: "Floor" },
    { icon: "🧭", val: p.facing || "—", label: "Facing" },
    { icon: "🛋", val: p.furnished_status || "—", label: "Furnished" },
    { icon: "🏠", val: p.property_type || "—", label: "Type" },
    { icon: "✅", val: p.status || "—", label: "Status" },
  ];
  document.getElementById("infoCards").innerHTML = infoItems.map(i =>
    `<div class="info-card">
      <div class="ic-icon">${i.icon}</div>
      <span class="ic-val">${i.val}</span>
      <span class="ic-label">${i.label}</span>
    </div>`
  ).join("");

  // Description
  document.getElementById("detailDesc").textContent =
    p.description || `${p.title} — ${p.city} मधील उत्तम Property. ${p.bhk || ""} ${p.property_type || ""}, ${p.furnished_status || ""}. आजच Inquiry करा.`;

  // Spec Grid
  const specs = [
    { icon: "fa-hashtag",      label: "Property Code",    val: p.property_code },
    { icon: "fa-home",         label: "Property Type",    val: p.property_type },
    { icon: "fa-map-marker-alt", label: "City",           val: p.city },
    { icon: "fa-layer-group",  label: "Floor",            val: p.floor ? `${p.floor} of ${p.total_floors}` : null },
    { icon: "fa-compass",      label: "Facing",           val: p.facing },
    { icon: "fa-couch",        label: "Furnished",        val: p.furnished_status },
    { icon: "fa-water",        label: "Water Source",     val: p.water_source },
    { icon: "fa-calendar-alt", label: "Listed On",        val: p.created_at },
  ].filter(s => s.val);

  document.getElementById("propSpecGrid").innerHTML = specs.map(s =>
    `<div class="spec-item">
      <i class="fas ${s.icon}"></i>
      <div><span class="spec-label">${s.label}</span><span class="spec-val">${s.val}</span></div>
    </div>`
  ).join("");

  // Map
  const mapQuery = encodeURIComponent([p.address, p.city, "Pune"].filter(Boolean).join(", "));
  document.getElementById("mapFrame").src =
    `https://maps.google.com/maps?q=${mapQuery}&output=embed`;
  document.getElementById("mapOpenBtn").href =
    `https://maps.google.com/?q=${mapQuery}`;

  // Video
  if (p.video_url) {
    const videoId = extractYouTubeId(p.video_url);
    if (videoId) {
      document.getElementById("videoWrap").innerHTML =
        `<iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>`;
    }
  }
}

// ---- GALLERY ----
function setGalleryImage(index) {
  currentImageIndex = index;
  document.getElementById("mainImg").src = galleryImages[index];
  document.getElementById("galleryCounter").textContent = `${index + 1} / ${galleryImages.length}`;
  document.querySelectorAll(".g-thumb").forEach((t, i) => t.classList.toggle("active", i === index));
}

function renderThumbs() {
  document.getElementById("galleryThumbs").innerHTML = galleryImages.map((img, i) =>
    `<div class="g-thumb ${i === 0 ? "active" : ""}" onclick="setGalleryImage(${i})">
      <img src="${img}" alt="Photo ${i + 1}" />
    </div>`
  ).join("");
}

function changeImage(dir) {
  const next = (currentImageIndex + dir + galleryImages.length) % galleryImages.length;
  setGalleryImage(next);
}

// Keyboard navigation
document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") changeImage(-1);
  if (e.key === "ArrowRight") changeImage(1);
});

// ---- TABS ----
function switchTab(btn, tabId) {
  document.querySelectorAll(".dtab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(`tab-${tabId}`).classList.add("active");
}

// ---- SIMILAR PROPERTIES ----
async function loadSimilarProperties(p) {
  const result = await API.getProperties({ bhk: p.bhk, listing_type: p.listing_type, limit: 4 });
  if (!result.success) return;
  const similar = result.data.filter(r => r.property_id !== p.property_id).slice(0, 3);
  const grid = document.getElementById("similarGrid");
  if (!similar.length) { grid.innerHTML = "<p style='font-size:13px;color:var(--text-light)'>Similar properties उपलब्ध नाहीत</p>"; return; }
  grid.innerHTML = similar.map(s => {
    const img = getImageUrl(s.image1_url);
    const price = s.listing_type === "Rent" ? formatPrice(s.expected_rent) + "/mo" : formatPrice(s.expected_price);
    return `<div class="similar-card" onclick="location.href='property-detail.html?id=${s.property_id}'">
      <img src="${img}" alt="${s.title}" onerror="this.src='${CONFIG.CLOUDINARY.placeholder}'" />
      <div>
        <div class="similar-card-title">${s.title}</div>
        <div class="similar-card-meta">${s.city || ""} ${s.bhk ? "• " + s.bhk : ""}</div>
        <div class="similar-card-price">${price}</div>
      </div>
    </div>`;
  }).join("");
}

// ---- INQUIRY FORM ----
async function submitDetailInquiry(e) {
  e.preventDefault();
  const btn = document.getElementById("diSubmitBtn");
  const status = document.getElementById("diStatus");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

  const result = await API.submitContact({
    full_name: document.getElementById("diName").value,
    mobile: document.getElementById("diMobile").value,
    email: document.getElementById("diEmail").value,
    client_type: "Buyer",
    message: `${document.getElementById("diMessage").value} | Visit: ${document.getElementById("diVisit").value} | Property: ${currentProperty?.title}`,
  });

  if (result.success) {
    status.innerHTML = `<div class="status-success" style="margin-top:12px"><i class="fas fa-check-circle"></i> ${result.message}</div>`;
    document.getElementById("detailInquiryForm").reset();
  } else {
    status.innerHTML = `<div class="status-error" style="margin-top:12px"><i class="fas fa-exclamation-circle"></i> Error. पुन्हा प्रयत्न करा.</div>`;
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Inquiry';
}

// ---- SHARE ----
function shareProperty(platform) {
  const url = window.location.href;
  const text = `Check out this property: ${currentProperty?.title} — ${url}`;
  if (platform === "whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  if (platform === "facebook") window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
}
function copyLink() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    const el = document.getElementById("copyConfirm");
    el.style.display = "inline";
    setTimeout(() => el.style.display = "none", 2000);
  });
}

// ---- UTILS ----
function extractYouTubeId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return m ? m[1] : null;
}
