// ============================================================
// ApnaGhar Admin — media-upload.js
// Turns any <input data-upload="image|video|doc" data-module="Properties">
// into: [ URL field ] [Upload] [preview]
// Upload → Google Drive (via Apps Script) → link is filled in → saved to the Sheet on Save.
// ============================================================

const AGUpload = {
  accept: { image: "image/*", video: "video/*", doc: ".pdf,.doc,.docx,.xls,.xlsx,image/*", any: "image/*,video/*,.pdf" },

  enhance(root = document) {
    root.querySelectorAll("input[data-upload]:not([data-upload-ready])").forEach(inp => AGUpload.attach(inp));
  },

  attach(inp) {
    inp.setAttribute("data-upload-ready", "1");
    const kind = inp.dataset.upload || "image";
    const wrap = document.createElement("div");
    wrap.className = "upl-wrap";
    inp.parentNode.insertBefore(wrap, inp);
    const row = document.createElement("div");
    row.className = "upl-row";
    wrap.appendChild(row);
    row.appendChild(inp);
    inp.placeholder = inp.placeholder || (kind === "video" ? "Upload video or paste YouTube / Drive link" : "Upload file or paste link");

    const file = document.createElement("input");
    file.type = "file"; file.accept = AGUpload.accept[kind] || AGUpload.accept.any; file.hidden = true;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "btn btn-outline btn-sm upl-btn";
    btn.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> Upload`;
    btn.onclick = () => file.click();
    const clear = document.createElement("button");
    clear.type = "button"; clear.className = "btn btn-outline btn-sm btn-icon upl-clear"; clear.title = "Remove";
    clear.innerHTML = `<i class="fas fa-times"></i>`;
    clear.onclick = () => { inp.value = ""; AGUpload.preview(inp); inp.dispatchEvent(new Event("change")); };
    row.append(btn, clear, file);

    const status = document.createElement("div"); status.className = "upl-status";
    const prev = document.createElement("div"); prev.className = "upl-preview";
    wrap.append(status, prev);
    inp._uplPrev = prev; inp._uplStatus = status; inp._uplKind = kind;

    file.onchange = async () => {
      const f = file.files[0]; if (!f) return;
      btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
      status.className = "upl-status show";
      const recordId = inp.dataset.recordField ? (document.getElementById(inp.dataset.recordField)?.value || "") : "";
      const res = await API.uploadFile(f, inp.dataset.module || "General", recordId, s => status.textContent = s);
      btn.disabled = false; btn.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> Upload`;
      file.value = "";
      if (res.success) {
        inp.value = res.url;
        status.className = "upl-status show ok";
        status.innerHTML = `<i class="fas fa-check-circle"></i> Uploaded (${res.data.size_kb} KB) — link will be saved to the Sheet when you click Save.`;
        inp.dispatchEvent(new Event("change"));
      } else {
        status.className = "upl-status show err";
        status.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${escapeHtml(res.error || "Upload failed")}`;
      }
    };
    inp.addEventListener("input", () => AGUpload.preview(inp));
    inp.addEventListener("change", () => AGUpload.preview(inp));
    AGUpload.preview(inp);
  },

  // Call after setting .value from code (edit forms) so the preview updates
  refresh(root = document) {
    root.querySelectorAll("input[data-upload-ready]").forEach(inp => { AGUpload.preview(inp); if (inp._uplStatus) inp._uplStatus.className = "upl-status"; });
  },

  preview(inp) {
    const box = inp._uplPrev; if (!box) return;
    const v = (inp.value || "").trim();
    if (!v) { box.innerHTML = ""; return; }
    if (inp._uplKind === "video") box.innerHTML = buildVideoEmbedHtml(v, "upl-video");
    else if (inp._uplKind === "image" || /lh3\.googleusercontent|\.(jpe?g|png|webp|gif)(\?|$)/i.test(v))
      box.innerHTML = `<img src="${escapeHtml(getImageUrl(v))}" referrerpolicy="no-referrer" onclick="AGUpload.lightbox(this.src)" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'upl-bad',textContent:'Preview not available'}))" />`;
    else box.innerHTML = `<a href="${escapeHtml(v)}" target="_blank" rel="noopener" class="upl-doc"><i class="fas fa-file-alt"></i> Open file</a>`;
  },

  lightbox(src) {
    let lb = document.getElementById("aguLightbox");
    if (!lb) {
      lb = document.createElement("div"); lb.id = "aguLightbox"; lb.className = "lightbox-overlay";
      lb.onclick = () => lb.classList.remove("show");
      lb.innerHTML = `<img alt="" />`; document.body.appendChild(lb);
    }
    lb.querySelector("img").src = src; lb.classList.add("show");
  },
};

document.addEventListener("DOMContentLoaded", () => AGUpload.enhance());
