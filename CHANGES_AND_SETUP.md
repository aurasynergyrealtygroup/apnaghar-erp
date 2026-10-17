# ApnaGhar ERP v2.0 — What changed
**Setup instructions: see SETUP_GUIDE.md**

## Critical fixes
- **Saving to Google Sheet never worked**: (1) `config.js` still had `YOUR_SCRIPT_ID`; (2) every save was sent as
  `application/json`, which Google Apps Script blocks from browsers (CORS). Now sent as `text/plain` — saves work.
- **Insecure login removed**: `admin/admin123` was checked in the browser and any API call could edit/delete data.
  Now: server-side login, encrypted (SHA-256) passwords, signed 7-day session token required for all admin actions.
- Broken "Admin" button on the website (`website/admin/login.html` did not exist) → fixed.
- Dates were shifting by one day (timezone) → now formatted in Asia/Kolkata.
- Formula injection blocked (text starting with = + - @ is stored as plain text).

## Backend (apps-script/Code.gs v2.0)
- `setupSheets()` creates/repairs all tabs & columns; never deletes data. New tabs: NEW_PROJECTS, PROPERTY_BOOKINGS,
  WEBSITE_INQUIRIES, MEDIA_LIBRARY (+ all previously missing ones).
- Unknown fields are auto-added as new columns instead of being silently dropped.
- File upload → Google Drive "ApnaGhar ERP Media/<module>", public view link saved in the record + MEDIA_LIBRARY.
- Website forms: inquiry, site visit, Book Now → saved to Sheet, client auto-created, email alert to company Gmail.
- Generic list/get/create/update/delete for every sheet; all old action names still work.

## Admin panel
- Same full sidebar on every page (sidebar.js) + "Open Google Sheet" link.
- New pages: New Launch Projects, Land, Societies, Agents, Rent Agreements, Website Leads, Users & Roles,
  Media Library (bulk upload + copy links), Settings & Setup (test connection, run setup, change password).
- Bookings rebuilt: Project or Property booking, tower/unit/config, auto-fill booking amount, photo+video preview,
  receipt & KYC upload, auto-create client, printable receipt, WhatsApp, delete; property auto-marked Booked/Sold.
- Properties: 6 photos + video + brochure with Upload buttons, project link, featured, owner, amenities.
- Dashboard: Projects / Bookings / Website Leads cards and new quick actions.
- Every list has search, filters and CSV export.

## v2.4 — Hindi
- All Marathi text on the website, admin panel, popups and server messages replaced with Hindi (139 phrases, 56 files). Page language set to `hi`.

## v2.3 — Post Your Ad (Agents / Builders / Owners)
- Website "Post Ad" button → registration (post-ad.html) → admin approval → Partner Portal (partner.html).
- Partners post property ads; Builders also post New Launch Projects + units. Upload photos/video/brochure.
- Admin → Approvals page for accounts and ads (approve / reject with reason). Unapproved ads never show on the website.
- Partners see their own leads (inquiries, site visits, bookings). Server blocks partners from all ERP data.
- New roles: Partner Agent, Builder, Owner. Users page: account type, company, RERA, approve button.

## Website
- New pages: projects.html, project-detail.html, land.html, services.html, about.html, contact.html, /404.html.
- Homepage shows New Launch Projects. Project page: gallery + lightbox, video, brochure, floor plan, amenities,
  highlights, available units, map, Book Now / Free Site Visit / WhatsApp.
- Property page: Book Now, Free Site Visit, up to 6 photos, amenities & brochure from the Sheet.
- Video works for YouTube, Google Drive, Cloudflare Stream and direct files.
