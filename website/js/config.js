// ============================================================
// ApnaGhar — Configuration
// js/config.js
// ⚠️ Replace APPS_SCRIPT_URL with your deployed Google Apps Script URL
// ============================================================

const CONFIG = {
  // After deploying your Google Apps Script, paste the URL here:
  // Example: https://script.google.com/macros/s/AKfy.../exec
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",

  // Company Info
  COMPANY: {
    name: "ApnaGhar Realty",
    phone: "+917507163733",
    whatsapp: "917507163733",
    email: "aurasynergyrealtygroup@gmail.com",
    address: "Sasane Nagar, Hadapsar, Pune – 411028",
    maps_url: "",
  },

  // Cloudinary (for images)
  CLOUDINARY: {
    cloud_name: "Aurasynergyrealtygroup",
    base_url: "https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/",
    placeholder: "https://placehold.co/600x400/1e3a5f/ffffff?text=ApnaGhar",
  },

  // Pagination
  PAGE_SIZE: 12,
};
