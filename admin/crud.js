// ============================================================
// ApnaGhar Admin — crud.js
// Generic list / add / edit / delete page for any Google Sheet tab.
// Usage: CRUD.init({ sheet, idField, title, fields:[...], columns:[...] })
// ============================================================

const CRUD = {
  cfg: null, rows: [], filtered: [], page: 1, pageSize: 15, lookups: {},

  async init(cfg) {
    CRUD.cfg = cfg;
    CRUD.renderShell();
    CRUD.renderModal();
    if (!API.isConfigured()) CRUD.showSetupAlert();
    if (cfg.lookups) await CRUD.loadLookups();
    await CRUD.load();
    const q = new URLSearchParams(location.search);
    if (q.get("new") === "1") CRUD.openAdd();
    if (q.get("edit")) CRUD.openEdit(q.get("edit"));
  },

  showSetupAlert() {
    document.getElementById("crudRoot").insertAdjacentHTML("afterbegin",
      `<div class="setup-alert"><i class="fas fa-plug"></i><div><b>Google Sheet not connected yet.</b> Data will appear after you paste the Apps Script URL in <code>website/js/config.js</code>. <a href="settings.html">Open Settings &amp; Setup →</a></div></div>`);
  },

  // ---- Lookups: e.g. { clients: () => API.admin.getClients() } ----
  async loadLookups() {
    const keys = Object.keys(CRUD.cfg.lookups);
    const res = await Promise.all(keys.map(k => CRUD.cfg.lookups[k]()));
    keys.forEach((k, i) => CRUD.lookups[k] = res[i] && res[i].success ? (res[i].data || []) : []);
  },

  renderShell() {
    const c = CRUD.cfg;
    const filters = (c.filters || []).map(f =>
      `<select class="toolbar-select" data-filter="${f.field}" onchange="CRUD.applyFilters()">
        <option value="">${f.label}</option>${f.options.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}
      </select>`).join("");
    document.getElementById("crudRoot").innerHTML = `
      ${c.kpis ? `<div class="kpi-grid" id="crudKpis" style="grid-template-columns:repeat(${c.kpis.length},1fr);margin-bottom:20px"></div>` : ""}
      ${c.intro ? `<div class="setup-alert" style="background:#eef4fb;border-color:#c9daf0;color:var(--navy)"><i class="fas fa-info-circle"></i><div>${c.intro}</div></div>` : ""}
      <div class="card">
        <div class="card-header">
          <h3><i class="fas ${c.icon || "fa-list"}"></i> ${c.plural || c.title + "s"}</h3>
          <div style="display:flex;gap:8px">
            <button class="btn btn-outline btn-sm" onclick="CRUD.load()"><i class="fas fa-sync-alt"></i> Refresh</button>
            <button class="btn btn-outline btn-sm" onclick="CRUD.exportCSV()"><i class="fas fa-download"></i> Export</button>
          </div>
        </div>
        <div style="padding:16px 20px;border-bottom:1px solid var(--gray-200)">
          <div class="toolbar" style="margin:0">
            <div class="toolbar-search" style="flex:1"><i class="fas fa-search"></i>
              <input type="text" id="crudSearch" placeholder="Search..." oninput="CRUD.applyFilters()" /></div>
            ${filters}
          </div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr>${c.columns.map(col => `<th>${col.label}</th>`).join("")}<th>Actions</th></tr></thead>
          <tbody id="crudTbody"><tr><td colspan="${c.columns.length + 1}" class="empty-row"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:12px">Loading...</p></td></tr></tbody>
        </table></div>
        <div class="table-footer"><span id="crudInfo">—</span><div class="tbl-pages" id="crudPages"></div></div>
      </div>`;
  },

  fieldHtml(f) {
    if (f.type === "section") return `<div class="form-section-title">${f.label}</div>`;
    const id = "f_" + f.name;
    const req = f.required ? " *" : "";
    const full = f.full || ["textarea", "image", "video", "doc"].includes(f.type) ? " full" : "";
    let input;
    const ph = f.placeholder ? ` placeholder="${escapeHtml(f.placeholder)}"` : "";
    switch (f.type) {
      case "select": {
        const opts = typeof f.options === "function" ? f.options(CRUD.lookups) : f.options.map(o => typeof o === "string" ? { v: o, t: o } : o);
        input = `<select id="${id}">${f.blank !== false ? `<option value="">${f.blank || "Select"}</option>` : ""}${opts.map(o => `<option value="${escapeHtml(o.v)}">${escapeHtml(o.t)}</option>`).join("")}</select>`;
        break;
      }
      case "textarea": input = `<textarea id="${id}" rows="${f.rows || 3}"${ph}></textarea>`; break;
      case "image": case "video": case "doc":
        input = `<input type="text" id="${id}" data-upload="${f.type}" data-module="${escapeHtml(CRUD.cfg.module || CRUD.cfg.sheet)}" data-record-field="f_${CRUD.cfg.idField}"${ph} />`; break;
      case "password": input = `<input type="password" id="${id}" autocomplete="new-password"${ph} />`; break;
      default: input = `<input type="${f.type || "text"}" id="${id}"${f.step ? ` step="${f.step}"` : ""}${ph} />`;
    }
    return `<div class="form-group${full}"><label for="${id}">${f.label}${req}</label>${input}${f.help ? `<small style="font-size:11px;color:var(--text-light)">${f.help}</small>` : ""}</div>`;
  },

  renderModal() {
    const c = CRUD.cfg;
    const el = document.createElement("div");
    el.className = "modal-overlay"; el.id = "crudModal";
    el.onclick = e => { if (e.target === el) closeModal("crudModal"); };
    el.innerHTML = `
      <div class="modal-box" style="max-width:${c.modalWidth || 780}px">
        <div class="modal-header"><h3 id="crudModalTitle"></h3><button class="modal-close" onclick="closeModal('crudModal')"><i class="fas fa-times"></i></button></div>
        <div class="modal-body"><input type="hidden" id="f_${c.idField}" /><div class="form-grid" id="crudFormGrid"></div></div>
        <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('crudModal')">Cancel</button>
          <button class="btn btn-primary" id="crudSaveBtn" onclick="CRUD.save()"><i class="fas fa-save"></i> Save</button></div>
      </div>`;
    document.body.appendChild(el);
  },

  buildForm() {
    document.getElementById("crudFormGrid").innerHTML = CRUD.cfg.fields.map(CRUD.fieldHtml).join("");
    AGUpload.enhance(document.getElementById("crudFormGrid"));
  },

  async load() {
    const c = CRUD.cfg;
    const res = c.load ? await c.load() : await API.list(c.sheet);
    if (!res.success) {
      CRUD.rows = [];
      document.getElementById("crudTbody").innerHTML = `<tr><td colspan="${c.columns.length + 1}" class="empty-row"><i class="fas fa-exclamation-triangle" style="font-size:24px;display:block;margin-bottom:8px"></i>${escapeHtml(res.error || "Could not load data")}</td></tr>`;
      return;
    }
    CRUD.rows = (res.data || []).slice().reverse();
    if (c.kpis) document.getElementById("crudKpis").innerHTML = c.kpis.map(k =>
      `<div class="kpi-card"><div class="kpi-icon ${k.color || "navy"}"><i class="fas ${k.icon}"></i></div><div><span class="kpi-val">${k.value(CRUD.rows)}</span><span class="kpi-label">${k.label}</span></div></div>`).join("");
    CRUD.applyFilters();
  },

  applyFilters() {
    const q = (document.getElementById("crudSearch").value || "").toLowerCase();
    const fs = [...document.querySelectorAll("[data-filter]")].map(s => [s.dataset.filter, s.value]).filter(x => x[1]);
    CRUD.filtered = CRUD.rows.filter(r =>
      (!q || Object.values(r).some(v => String(v ?? "").toLowerCase().includes(q))) &&
      fs.every(([k, v]) => String(r[k] ?? "") === v));
    CRUD.page = 1; CRUD.render();
  },

  render() {
    const c = CRUD.cfg, total = CRUD.filtered.length, start = (CRUD.page - 1) * CRUD.pageSize;
    const tb = document.getElementById("crudTbody");
    if (!total) tb.innerHTML = `<tr><td colspan="${c.columns.length + 1}" class="empty-row">No records yet. Click <b>“Add”</b> to create the first one.</td></tr>`;
    else tb.innerHTML = CRUD.filtered.slice(start, start + CRUD.pageSize).map(r => {
      const id = escapeHtml(r[c.idField]);
      return `<tr>${c.columns.map(col => `<td>${col.render ? col.render(r, CRUD.lookups) : escapeHtml(r[col.field] ?? "—")}</td>`).join("")}
        <td><div style="display:flex;gap:5px">
          ${c.rowActions ? c.rowActions(r) : ""}
          <button class="btn btn-sm btn-primary btn-icon" title="Edit" onclick="CRUD.openEdit('${id}')"><i class="fas fa-edit"></i></button>
          ${c.noDelete ? "" : `<button class="btn btn-sm btn-danger btn-icon" title="Delete" onclick="CRUD.del('${id}')"><i class="fas fa-trash"></i></button>`}
        </div></td></tr>`;
    }).join("");
    document.getElementById("crudInfo").textContent = total ? `Showing ${start + 1}–${Math.min(start + CRUD.pageSize, total)} of ${total}` : "No records";
    const pages = Math.ceil(total / CRUD.pageSize);
    document.getElementById("crudPages").innerHTML = pages <= 1 ? "" :
      Array.from({ length: pages }, (_, i) => `<button class="tbl-page-btn ${i + 1 === CRUD.page ? "active" : ""}" onclick="CRUD.page=${i + 1};CRUD.render()">${i + 1}</button>`).join("");
  },

  openAdd() {
    const c = CRUD.cfg;
    CRUD.buildForm();
    document.getElementById("f_" + c.idField).value = "";
    Object.entries(c.defaults || {}).forEach(([k, v]) => { const el = document.getElementById("f_" + k); if (el) el.value = typeof v === "function" ? v() : v; });
    document.getElementById("crudModalTitle").innerHTML = `<i class="fas fa-plus"></i> Add ${c.title}`;
    AGUpload.refresh(document.getElementById("crudFormGrid"));
    c.onOpen && c.onOpen(null);
    openModal("crudModal");
  },

  openEdit(id) {
    const c = CRUD.cfg;
    const r = CRUD.rows.find(x => String(x[c.idField]) === String(id));
    if (!r) return;
    CRUD.buildForm();
    document.getElementById("f_" + c.idField).value = r[c.idField];
    c.fields.forEach(f => { if (f.type === "section" || f.type === "password") return; const el = document.getElementById("f_" + f.name); if (el) el.value = r[f.name] ?? ""; });
    document.getElementById("crudModalTitle").innerHTML = `<i class="fas fa-edit"></i> Edit ${c.title} <small style="font-weight:400;color:var(--text-light)">${escapeHtml(r[c.idField])}</small>`;
    AGUpload.refresh(document.getElementById("crudFormGrid"));
    c.onOpen && c.onOpen(r);
    openModal("crudModal");
  },

  async save() {
    const c = CRUD.cfg;
    const id = document.getElementById("f_" + c.idField).value;
    const data = {};
    for (const f of c.fields) {
      if (f.type === "section") continue;
      const el = document.getElementById("f_" + f.name); if (!el) continue;
      const v = el.value.trim();
      if (f.required && !v) { showToast(`${f.label} ज़रूरी है`, "error"); el.focus(); return; }
      if (f.type === "password" && !v) continue;
      data[f.name] = v;
    }
    if (c.beforeSave) { const err = c.beforeSave(data, id); if (err) { showToast(err, "error"); return; } }
    if (id) data[c.idField] = id;
    const btn = document.getElementById("crudSaveBtn");
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    const res = c.save ? await c.save(data, id) : id ? await API.update(c.sheet, data) : await API.create(c.sheet, data);
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save';
    if (res.success) {
      showToast(id ? `${c.title} updated — saved to Google Sheet` : `${c.title} added — ID ${res.id || ""}`, "success");
      closeModal("crudModal");
      c.afterSave && c.afterSave(data, res);
      CRUD.load();
    } else showToast(res.error || "Error saving", "error");
  },

  del(id) {
    const c = CRUD.cfg;
    confirmDelete(id, async () => {
      const res = c.remove ? await c.remove(id) : await API.remove(c.sheet, id);
      if (res.success) { showToast("Deleted", "success"); CRUD.load(); } else showToast(res.error || "Error", "error");
    });
  },

  exportCSV() {
    if (!CRUD.filtered.length) { showToast("Nothing to export", "info"); return; }
    const keys = [...new Set(CRUD.filtered.flatMap(r => Object.keys(r)))].filter(k => k !== "password_hash");
    const csv = [keys, ...CRUD.filtered.map(r => keys.map(k => r[k] ?? ""))]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `ApnaGhar_${CRUD.cfg.sheet}.csv`; a.click();
  },
};

// Small render helpers for column definitions
const R = {
  thumb: f => r => `<img class="thumb-sm" src="${escapeHtml(getImageUrl(r[f]))}" referrerpolicy="no-referrer" onerror="this.src='${CONFIG.CLOUDINARY.placeholder}'" />`,
  money: f => r => r[f] ? `<b style="color:var(--navy)">${fmt(r[f])}</b>` : "—",
  date: f => r => fmtDate(r[f]),
  badge: f => r => statusBadge(r[f]),
  title: (f, sub) => r => `<div style="font-weight:600;color:var(--navy)">${escapeHtml(r[f] || "—")}</div>${sub ? `<div style="font-size:11px;color:var(--text-light)">${sub(r)}</div>` : ""}`,
  link: (f, label) => r => r[f] ? `<a href="${escapeHtml(r[f])}" target="_blank" rel="noopener" style="color:var(--navy);font-weight:600"><i class="fas fa-external-link-alt"></i> ${label || "Open"}</a>` : "—",
  lookup: (f, list, idKey, nameKey) => (r, L) => { const x = (L[list] || []).find(o => String(o[idKey]) === String(r[f])); return escapeHtml(x ? x[nameKey] : (r[f] || "—")); },
};
