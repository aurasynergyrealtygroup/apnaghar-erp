# ApnaGhar ERP v2 — Setup Guide (15 minutes, one time)

Your data lives in this Google Sheet:
https://docs.google.com/spreadsheets/d/14SH_L0fsknVQRNqrNPcfSS0lODipe-7mlnFt1pvFFG8/edit

Uploaded photos / videos / PDFs go to Google Drive → folder **"ApnaGhar ERP Media"**,
and their links are saved in the Sheet.

---

## Step 1 — Put the new backend code in Google Apps Script

1. Open the Google Sheet above (logged in as **aurasynergyrealtygroup@gmail.com**).
2. Menu **Extensions → Apps Script**.
3. In `Code.gs`: select everything (Ctrl+A), delete it, and paste the full content of
   **`apps-script/Code.gs` from this ZIP**.
   ⚠️ The first line must say **`ApnaGhar ERP — Google Apps Script Backend (v2.0)`**.
   If it says "Version: 1.0", you pasted the old file.
4. Click the ⚙️ **Project Settings** (left side) → tick **"Show appsscript.json manifest file"**.
   Open `appsscript.json` and make sure it matches `apps-script/appsscript.json` (it already does if you used the one we discussed).
5. Click 💾 **Save**.

## Step 2 — Run the setup once

1. In the toolbar function dropdown choose **`setupSheets`** → click **▶ Run**.
2. A permission popup appears → **Review permissions** → choose your account →
   **Advanced → Go to project (unsafe) → Allow**. (This is normal for your own script.
   It asks for Sheets, Drive (for uploads) and Gmail send (for new-lead email alerts).)
3. Open **Execution log** — you should see lines like `Created NEW_PROJECTS`,
   `Created PROPERTY_BOOKINGS`, `Created user admin / admin123`.

What it does: creates every missing tab, adds missing columns to existing tabs
(never deletes anything), creates the Drive media folder and the first admin login.

## Step 3 — Deploy as a Web App

1. **Deploy → New deployment** → ⚙️ type **Web app**.
2. Execute as: **Me** · Who has access: **Anyone**.
3. **Deploy** → copy the **Web app URL** (ends with `/exec`).

## Step 4 — Connect the website

1. Open `website/js/config.js` and replace

   `APPS_SCRIPT_URL: "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",`

   with your URL from Step 3.
2. Commit & push to GitHub (`aurasynergyrealtygroup/apnaghar-erp`).
   Cloudflare redeploys https://apnaghar-erp.aurasynergyrealtygroup.workers.dev automatically.

   Using GitHub website: open the repo → `website/js/config.js` → ✏️ edit → paste URL → Commit.
   Upload the other changed files the same way (or drag the folders onto "Add file → Upload files").

## Step 5 — First login

1. Open `/admin/login.html` → username **admin**, password **admin123**.
2. Go to **Settings & Setup** → **Test Connection** (should be green) → **Change My Password**.
3. Add other staff in **Users & Roles**.

---

## Daily use

| Task | Where |
|---|---|
| Launch a new project (photos, video, brochure, price, RERA) | Admin → **New Launch Projects → Add Project** |
| Book a unit for a customer | Admin → **Bookings → New Booking** (or 🔖 button on a project row) |
| Website "Book Now" requests | Arrive in **Bookings** with status **Enquiry** + email alert |
| Website inquiries / site-visit requests | **Website Leads** and **Site Visits** |
| Upload many photos / videos at once and copy links | **Media Library** |
| Add sale / rent property with photos | **Properties → Add Property → Images & Video tab → Upload** |
| Print booking receipt | Bookings → 🖨 button → Print / Save as PDF |

**Upload limits:** photos are auto-compressed (any size OK). Videos up to **35 MB** —
for longer videos upload to YouTube (Unlisted) and paste the link instead.

---

## When you change Code.gs later

**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.**
The URL stays the same. (If you skip this, the website keeps using the old code.)

## Troubleshooting

| Message | Fix |
|---|---|
| "An unknown error has occurred" when running `setupSheets` | 1) Use the **v2.1** Code.gs (fixes the 26-column limit). 2) If it still appears: you are signed in to **more than one Google account** in the browser — open the Sheet in an **Incognito window** signed in only as aurasynergyrealtygroup@gmail.com and run again. 3) Run **`diagnose`** and read the Execution log. |
| "Backend not connected" | Step 4 not done — URL missing in `config.js` |
| "Network error" | Web App access is not **Anyone**, or URL copied wrong |
| "Unknown action: ping" / "getNewProjects" | The **old** Code.gs is still deployed — redo Step 1 and deploy a **New version** |
| "Login required" / "Session expired" | Log in again (sessions last 7 days) |
| Upload: "could not be made public" | Your Google account blocks public link sharing — use a normal Gmail account or ask your Workspace admin |
| Images don't show | Make sure the Drive file is shared "Anyone with the link" (uploads through the admin do this automatically) |
