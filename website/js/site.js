// ============================================================
// ApnaGhar — site.js  (shared website helpers)
// Lead / Site-visit / Booking popup → saved to Google Sheet
// ============================================================

function initSiteNav() {
  const nav = document.getElementById("navbar");
  if (nav && !nav.classList.contains("scrolled-fixed")) window.addEventListener("scroll", () => nav.classList.toggle("scrolled", window.scrollY > 60 || nav.dataset.solid === "1"));
  const h = document.getElementById("hamburger"), links = document.getElementById("navLinks");
  h?.addEventListener("click", () => { links.classList.toggle("open"); h.classList.toggle("active"); });
}

const AGLead = {
  el: null, ctx: {},
  build() {
    if (AGLead.el) return;
    const d = document.createElement("div");
    d.className = "ag-modal"; d.id = "agLeadModal";
    d.onclick = e => { if (e.target === d) AGLead.close(); };
    d.innerHTML = `
      <div class="ag-modal-box" role="dialog" aria-modal="true" aria-labelledby="agLeadTitle">
        <button class="ag-modal-x" onclick="AGLead.close()" aria-label="Close"><i class="fas fa-times"></i></button>
        <h3 id="agLeadTitle">Inquiry</h3>
        <p class="ag-modal-sub" id="agLeadSub"></p>
        <form id="agLeadForm" onsubmit="AGLead.submit(event)">
          <div class="form-group"><input type="text" id="agName" placeholder="पूर्ण नाव *" required /></div>
          <div class="form-row">
            <div class="form-group"><input type="tel" id="agMobile" placeholder="Mobile (10 digits) *" pattern="[6-9][0-9]{9}" maxlength="10" required /></div>
            <div class="form-group"><input type="email" id="agEmail" placeholder="Email (optional)" /></div>
          </div>
          <div class="form-group" id="agConfigWrap"><select id="agConfig"></select></div>
          <div class="form-row" id="agVisitWrap">
            <div class="form-group"><label>Visit Date</label><input type="date" id="agDate" /></div>
            <div class="form-group"><label>Time</label><select id="agTime"><option>10:00 AM</option><option>12:00 PM</option><option>3:00 PM</option><option>5:00 PM</option></select></div>
          </div>
          <div class="form-group"><textarea id="agMsg" rows="2" placeholder="Message (optional)"></textarea></div>
          <label class="ag-consent"><input type="checkbox" required checked /> मला Call / WhatsApp द्वारे संपर्क करण्यास परवानगी आहे.</label>
          <button type="submit" class="btn btn-primary full-width" id="agSubmit"><i class="fas fa-paper-plane"></i> Submit</button>
          <div id="agStatus" class="form-status"></div>
        </form>
        <a class="ag-wa" id="agWA" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> किंवा WhatsApp वर बोला</a>
      </div>`;
    document.body.appendChild(d);
    AGLead.el = d;
    document.addEventListener("keydown", e => { if (e.key === "Escape") AGLead.close(); });
  },

  // mode: "inquiry" | "visit" | "booking"
  open(opts = {}) {
    AGLead.build();
    AGLead.ctx = opts;
    const mode = opts.mode || "inquiry";
    const titles = { inquiry: "Property Inquiry", visit: "Free Site Visit बुक करा", booking: "Book Now — Booking Request" };
    document.getElementById("agLeadTitle").textContent = titles[mode];
    document.getElementById("agLeadSub").textContent = opts.title || "";
    document.getElementById("agVisitWrap").style.display = mode === "visit" ? "" : "none";
    const cfgs = (opts.configs || []).filter(Boolean);
    document.getElementById("agConfigWrap").style.display = mode === "booking" && cfgs.length ? "" : "none";
    document.getElementById("agConfig").innerHTML = `<option value="">Configuration निवडा</option>` + cfgs.map(c => `<option>${escapeHtml(c)}</option>`).join("");
    const t = new Date(); t.setDate(t.getDate() + 1);
    document.getElementById("agDate").min = new Date().toISOString().slice(0, 10);
    document.getElementById("agDate").value = t.toISOString().slice(0, 10);
    document.getElementById("agSubmit").innerHTML = mode === "booking" ? '<i class="fas fa-bookmark"></i> Send Booking Request' : mode === "visit" ? '<i class="fas fa-calendar-check"></i> Request Site Visit' : '<i class="fas fa-paper-plane"></i> Submit Inquiry';
    document.getElementById("agStatus").innerHTML = "";
    document.getElementById("agWA").href = `https://wa.me/${CONFIG.COMPANY.whatsapp}?text=${encodeURIComponent(`Hello! I'm interested in ${opts.title || "your properties"}`)}`;
    AGLead.el.classList.add("open");
    document.body.style.overflow = "hidden";
    setTimeout(() => document.getElementById("agName").focus(), 100);
  },
  close() { AGLead.el?.classList.remove("open"); document.body.style.overflow = ""; },

  async submit(e) {
    e.preventDefault();
    const c = AGLead.ctx, mode = c.mode || "inquiry";
    const btn = document.getElementById("agSubmit"), st = document.getElementById("agStatus"), orig = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    const base = {
      full_name: document.getElementById("agName").value.trim(),
      mobile: document.getElementById("agMobile").value.trim(),
      email: document.getElementById("agEmail").value.trim(),
      property_id: c.property_id || "", project_id: c.project_id || "",
      message: [document.getElementById("agMsg").value.trim(), c.title ? "For: " + c.title : ""].filter(Boolean).join(" | "),
    };
    let r;
    if (mode === "booking") r = await API.submitBooking({ ...base, configuration: document.getElementById("agConfig").value });
    else if (mode === "visit") r = await API.submitSiteVisit({ ...base, visit_date: document.getElementById("agDate").value, visit_time: document.getElementById("agTime").value });
    else r = await API.submitContact({ ...base, inquiry_type: c.property_id ? "Property Inquiry" : c.project_id ? "Project Inquiry" : "General" });
    btn.disabled = false; btn.innerHTML = orig;
    if (r.success) {
      st.innerHTML = `<div class="status-success"><i class="fas fa-check-circle"></i> ${escapeHtml(r.message)}</div>`;
      document.getElementById("agLeadForm").reset();
    } else {
      st.innerHTML = `<div class="status-error"><i class="fas fa-exclamation-circle"></i> ${escapeHtml(r.error || "काहीतरी चुकले. पुन्हा प्रयत्न करा.")}<br><small>किंवा थेट call करा: ${escapeHtml(CONFIG.COMPANY.phone_display)}</small></div>`;
    }
  },
};

// Used by property cards everywhere (overridden on properties.html by its own modal)
function openInquiryModal(propertyId, title) {
  AGLead.open({ mode: "inquiry", property_id: decodeURIComponent(propertyId || ""), title });
}
