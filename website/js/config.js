// ============================================================
// ApnaGhar — Configuration   (website/js/config.js)
// ============================================================
// ⚠️ STEP: After deploying apps-script/Code.gs as a Web App, paste its URL below.
//    It looks like: https://script.google.com/macros/s/AKfycb..../exec
// ============================================================

const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwVTakNXFQ_rW7UpNVfNhmrvNrZJRJADaGlpAMU8pWGjk3XwjoB23zcvo48GlQNmfqZ/exec",


  
  // Google Sheet that stores all data (for the "Open Sheet" button in admin)
  SHEET_URL: "https://docs.google.com/spreadsheets/d/14SH_L0fsknVQRNqrNPcfSS0lODipe-7mlnFt1pvFFG8/edit",

  COMPANY: {
    name: "Aura Synergy Realty Group",
    brand: "ApnaGhar",
    phone: "+917507163733",
    phone_display: "+91 75071 63733",
    whatsapp: "917507163733",
    email: "aurasynergyrealtygroup@gmail.com",
    address: "Sasane Nagar, Hadapsar, Pune – 411028",
    maps_url: "https://maps.google.com/?q=Sasane+Nagar+Hadapsar+Pune+411028",
  },

  CLOUDINARY: {
    base_url: "",
    placeholder: "https://placehold.co/600x400/1e3a5f/ffffff?text=ApnaGhar",
  },


  
  UPLOAD: {
    max_image_px: 1600,      // photos are resized in the browser before upload (faster, smaller)
    image_quality: 0.82,
    max_video_mb: 35,        // bigger videos → upload to YouTube and paste the link
    max_doc_mb: 20,
  },

  PAGE_SIZE: 12,
};

// Admin "Settings" page can store a URL override in this browser (handy for testing).
try {
  const o = localStorage.getItem("ag_api_url");
  if (o && /^https:\/\/script\.google\.com\//.test(o)) CONFIG.APPS_SCRIPT_URL = o;
} catch (e) {}
