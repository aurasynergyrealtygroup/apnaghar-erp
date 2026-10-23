# ApnaGhar ERP v2.0 — What changed
**Setup instructions: see SETUP_GUIDE.md**

## v2.5 — Agent listings, 45 / 60 day auto-hide, area / society / address search
**After pasting the new `apps-script/Code.gs`: run `setupSheets` once, then Deploy → Manage deployments → Edit → Version: New → Deploy.**

- **Agent login (own ads only)** — agents use the existing Partner login (`website/partner.html`). They see and manage **only their own** ads.
  ERP staff with the role *Agent* are also limited to their own Properties / Land in the admin panel. Admin / Manager see everything.
- **Agent details stored** — approving an Agent account auto-creates a row in **AGENTS** and links it to the login (`AGENTS.user_id`, `USERS.agent_id`).
  Agents fill **My Profile** (alt mobile, WhatsApp, address, RERA, PAN, Aadhaar *last 4 digits only*, bank). PAN / bank are never public.
- **Agents can post Rent, Sale and Land** — new *Post Land* tab. Every ad stores the agent (`agent_id`). Land from partners needs admin approval like other ads.
- **Rent hides after 45 days, Sale after 60 days** — days are in the **LISTING_RULES** tab (admin → *Listing Rules*). Land = 0 (never hides) until you set a number.
  Hidden ads are removed from the website for everyone; the agent still sees them marked ⛔ and can press **Renew**.
  **Edit / save / Renew = manual update → live again, clock restarts.** (Admin saving a listing also renews it.)
- **Nightly job** — `deactivateExpiredListings` writes `listing_active` (Yes/No), `expiry_date`, `deactivated_on` into the sheet and logs to **LISTING_LOG**.
  Installed automatically by `setupSheets` (or run `installDailyTrigger` once). Even if the job is off, expired ads stay hidden — the date is the rule.
- **Search** — website Properties page: Area, Society, society/flat address keyword, min/max price (rent price for Rent ads, sale price for Sale ads).
  Agent portal *My Ads*: filter by Rent / Sale / Land, status (Live / Hidden / Expiring), area, society / address, price.
- **Society name + address** — SOCIETIES now has address, landmark, pincode. Picking a society on an ad auto-fills area + name and shows the address on the website.
- **Existing listings are safe** — on first setup every existing listing gets today's date, so nothing disappears on day 1.
- New admin pages: **Listing Rules** (with *Run auto-hide now*) and **Listing Log**. Admin Properties / Land show 🟢 days left / ⛔ hidden and a Renew button. Approvals now include Land.
- Public `getSocieties` no longer exposes the secretary's name / mobile.
- **Automatic new Google Sheet** — `createNewDatabase()` (Apps Script editor, or Admin → Settings → *Create New Google Sheet*) makes a brand-new empty Google Sheet in your Drive with all 30 tabs + headers, roles, listing rules, the `admin / admin123` login and the nightly trigger, then switches the whole system to it (saved in Script Properties — no code edit needed). The old sheet is untouched; go back with `useExistingDatabase("<sheet id>")`. Admin → Settings also has *Current database* (link to the active sheet).
- Reference workbook: `ApnaGhar_ERP_v2.5_Sheet_Additions.xlsx` (new columns + tab layouts).

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
