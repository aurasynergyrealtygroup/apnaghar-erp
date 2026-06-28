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
    phone: "+919876543210",
    whatsapp: "919876543210",
    email: "info@apnaghar.in",
    address: "Baner Road, Pune – 411045",
    maps_url: "https://maps.google.com/?q=Baner+Road+Pune",
  },

  // Cloudinary (for images)
  CLOUDINARY: {
    cloud_name: "YOUR_CLOUD_NAME",
    base_url: "https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/",
    placeholder: "https://placehold.co/600x400/1e3a5f/ffffff?text=ApnaGhar",
  },

  // Pagination
  PAGE_SIZE: 12,
};
