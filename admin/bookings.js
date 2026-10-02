// ============================================================
// ApnaGhar Admin — bookings.js
// Property Bookings: token-amount reservations before a full Sale Deal
// ============================================================

let allBookings = [];
let filteredBookings = [];
let clientsCache = [];
let propertiesCache = [];
let agentsCache = [];

document.addEventListener("DOMContentLoaded", () => {
  loadBookings();
  loadDropdownData();
});

async function loadDropdownData() {
  const [clientsRes, propsRes, agentsRes] = await Promise.all([
    API.admin.getClients(),
    API.getProperties({ limit: 500 }),
    API.admin.getAgents(),
  ]);
  clientsCache = clientsRes.success ? clientsRes.data : [];
  propertiesCache = propsRes.success ? propsRes.data : [];
  agentsCache = agentsRes.success ? agentsRes.data : [];

  document.getElementById("bClientId").innerHTML = '<option value="">Select Client</option>' +
    clientsCache.map(c => `<option value="${c.client_id}">${c.full_name} (${c.mobile})</option>`).join("");
  document.getElementById("bPropertyId").innerHTML = '<option value="">Select Property</option>' +
    propertiesCache.map(p => `<option value="${p.property_id}">${p.title} — ${p.listing_type || ""}</option>`).join("");
  document.getElementById("bAgentId").innerHTML = '<option value="">Select Agent</option>' +
    agentsCache.map(a => `<option value="${a.agent_id}">${a.full_name}</option>`).join("");

  renderBookings(); // property titles may now resolve
}

function getClientName(id) { const c = clientsCache.find(x => String(x.client_id) === String(id)); return c ? c.full_name : `Client ${id}`; }
function getAgentName(id) { const a = agentsCache.find(x => String(x.agent_id) === String(id)); return a ? a.full_name : (id ? `Agent ${id}` : "—"); }
function getProperty(id) { return propertiesCache.find(x => String(x.property_id) === String(id)); }
function getPropertyTitle(id) { const p = getProperty(id); return p ? p.title : id; }
function getPropertyThumb(id) {
  const p = getProperty(id);
  const url = p ? (p.image1_url || "") : "";
  return getImageUrl(url);
}

// ---- VIDEO HELPERS (YouTube + Cloudflare Stream) ----
function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return m ? m[1] : null;
}
function buildVideoEmbedHtml(videoUrl) {
  if (!videoUrl) return "";
  const ytId = extractYouTubeId(videoUrl);
  if (ytId) {
    return `<div class="media-video-wrap"><iframe src="https://www.youtube.com/embed/${ytId}" allowfullscreen></iframe></div>`;
  }
  if (videoUrl.includes("cloudflarestream.com") || videoUrl.includes("videodelivery.net")) {
    // Accept either a full iframe/watch URL or a bare stream UID
    let src = videoUrl;
    const idMatch = videoUrl.match(/([a-f0-9]{32})/i);
    if (idMatch && !videoUrl.includes("/iframe")) {
      src = `https://customer-.cloudflarestream.com/${idMatch[1]}/iframe`;
    }
    return `<div class="media-video-wrap"><iframe src="${src}" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen></iframe></div>`;
  }
  // Fallback: direct video file
  return `<div class="media-video-wrap"><video src="${videoUrl}" controls style="width:100%;height:100%;object-fit:cover"></video></div>`;
}

// ---- MEDIA PREVIEW (images + video for selected property) ----
function onBookingPropertyChange() {
  const propId = document.getElementById("bPropertyId").value;
  const preview = document.getElementById("bMediaPreview");
  const gallery = document.getElementById("bMediaGallery");
  const videoWrap = document.getElementById("bMediaVideoWrap");
  const empty = document.getElementById("bMediaEmpty");

  if (!propId) { preview.classList.remove("show"); return; }
  const p = getProperty(propId);
  if (!p) { preview.classList.remove("show"); return; }

  const images = [p.image1_url, p.image2_url, p.image3_url, p.image4_url].filter(Boolean).map(getImageUrl);
  gallery.innerHTML = images.map(src => `<img src="${src}" onclick="openLightbox('${src}')" onerror="this.style.display='none'" />`).join("");
  videoWrap.innerHTML = buildVideoEmbedHtml(p.video_url);

  empty.style.display = (!images.length && !p.video_url) ? "block" : "none";
  preview.classList.add("show");
}

function openLightbox(src) {
  document.getElementById("lightboxImg").src = src;
  document.getElementById("lightboxOverlay").classList.add("show");
}

// ---- LOAD ----
async function loadBookings() {
  const result = await API.admin.getBookings();
  if (!result.success) { showToast(result.error || "Error loading bookings", "error"); allBookings = []; renderBookings(); return; }
  allBookings = result.data || [];

  document.getElementById("bTotal").textContent = allBookings.length;
  document.getElementById("bActive").textContent = allBookings.filter(b => b.booking_status === "Active").length;
  document.getElementById("bConverted").textContent = allBookings.filter(b => b.booking_status === "Converted").length;
  const tokenTotal = allBookings
    .filter(b => b.booking_status !== "Cancelled" && b.booking_status !== "Refunded")
    .reduce((s, b) => s + Number(b.token_amount || 0), 0);
  document.getElementById("bTokenTotal").textContent = fmt(tokenTotal);

  filterBookings();
}

// ---- FILTER ----
function filterBookings() {
  const q = (document.getElementById("bSearch").value || "").toLowerCase();
  const status = document.getElementById("bStatusFilter").value;

  filteredBookings = allBookings.filter(b => {
    const clientName = getClientName(b.client_id).toLowerCase();
    const propTitle = String(getPropertyTitle(b.property_id) || "").toLowerCase();
    const matchQ = !q || clientName.includes(q) || propTitle.includes(q);
    const matchStatus = !status || b.booking_status === status;
    return matchQ && matchStatus;
  });

  renderBookings();
}

// ---- RENDER ----
function renderBookings() {
  const tbody = document.getElementById("bookingsTbody");
  const list = filteredBookings.length || allBookings.length ? filteredBookings : allBookings;
  const total = list.length;
  document.getElementById("bookingsFooterInfo").textContent = total === 0 ? "No records" : `${total} bookings`;

  if (!total) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-light)">No bookings found. Click "New Booking" to add one.</td></tr>`;
    return;
  }

  const sorted = [...list].sort((a, b) => new Date(b.booking_date || 0) - new Date(a.booking_date || 0));

  tbody.innerHTML = sorted.map(b => `
    <tr>
      <td>
        <img class="booking-thumb" src="${getPropertyThumb(b.property_id)}" onerror="this.style.visibility='hidden'" />
        <span style="font-size:13px;font-weight:600;color:var(--navy)">${getPropertyTitle(b.property_id)}</span>
      </td>
      <td>${getClientName(b.client_id)}</td>
      <td style="font-weight:600">${fmt(b.token_amount)}</td>
      <td><span style="font-size:12px">${fmtDate(b.booking_date)}</span></td>
      <td><span style="font-size:12px">${fmtDate(b.expected_registration_date)}</span></td>
      <td>${statusBadge(b.booking_status === "Converted" ? "Registered" : b.booking_status)}</td>
      <td>
        <div style="display:flex;gap:5px">
          <button class="btn btn-sm btn-primary btn-icon" onclick="editBooking('${b.booking_id}')" title="Edit"><i class="fas fa-edit"></i></button>
        </div>
      </td>
    </tr>`).join("");
}

// ---- CRUD ----
function openAddBookingModal() {
  document.getElementById("bookingModalTitle").innerHTML = '<i class="fas fa-bookmark"></i> New Property Booking';
  document.getElementById("editBookingId").value = "";
  document.getElementById("bPropertyId").value = "";
  document.getElementById("bClientId").value = "";
  document.getElementById("bAgentId").value = "";
  document.getElementById("bTokenAmount").value = "";
  document.getElementById("bBookingDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("bExpectedRegDate").value = "";
  document.getElementById("bStatus").value = "Active";
  document.getElementById("bPaymentMode").value = "";
  document.getElementById("bNotes").value = "";
  document.getElementById("bMediaPreview").classList.remove("show");
  openModal("bookingModal");
}

function editBooking(id) {
  const b = allBookings.find(x => String(x.booking_id) === String(id));
  if (!b) return;
  document.getElementById("bookingModalTitle").innerHTML = '<i class="fas fa-edit"></i> Edit Booking';
  document.getElementById("editBookingId").value = b.booking_id;
  document.getElementById("bPropertyId").value = b.property_id || "";
  document.getElementById("bClientId").value = b.client_id || "";
  document.getElementById("bAgentId").value = b.agent_id || "";
  document.getElementById("bTokenAmount").value = b.token_amount || "";
  document.getElementById("bBookingDate").value = b.booking_date ? b.booking_date.split("T")[0] : "";
  document.getElementById("bExpectedRegDate").value = b.expected_registration_date ? b.expected_registration_date.split("T")[0] : "";
  document.getElementById("bStatus").value = b.booking_status || "Active";
  document.getElementById("bPaymentMode").value = b.payment_mode || "";
  document.getElementById("bNotes").value = b.notes || "";
  onBookingPropertyChange();
  openModal("bookingModal");
}

async function saveBooking() {
  const propertyId = document.getElementById("bPropertyId").value;
  const clientId = document.getElementById("bClientId").value;
  const tokenAmount = document.getElementById("bTokenAmount").value;
  if (!propertyId || !clientId || !tokenAmount) { showToast("Property, Client आणि Token Amount भरा", "error"); return; }

  const id = document.getElementById("editBookingId").value;
  const data = {
    property_id: propertyId,
    client_id: clientId,
    agent_id: document.getElementById("bAgentId").value,
    token_amount: tokenAmount,
    booking_date: document.getElementById("bBookingDate").value,
    expected_registration_date: document.getElementById("bExpectedRegDate").value,
    booking_status: document.getElementById("bStatus").value,
    payment_mode: document.getElementById("bPaymentMode").value,
    notes: document.getElementById("bNotes").value,
  };

  const btn = document.getElementById("saveBookingBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  let result;
  if (id) { data.booking_id = id; result = await API.admin.updateBooking(data); }
  else result = await API.admin.addBooking(data);

  btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Booking';

  if (result.success) {
    showToast(id ? "Booking updated!" : "Booking created!", "success");
    closeModal("bookingModal");
    loadBookings();
  } else {
    showToast(result.error || "Error saving booking", "error");
  }
}
