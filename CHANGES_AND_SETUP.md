# ApnaGhar ERP — Changes in this delivery

## Blocking bugs fixed (required for anything below to work)
1. **Broken script paths** — every admin page (`admin/*.html`) referenced `../js/config.js`
   and `../js/api.js`, but those files actually live at `website/js/`. This silently broke
   *all* admin data loading/saving. Fixed across all 14 admin pages to point to
   `../website/js/config.js` and `../website/js/api.js`.
2. **`SPREADSHEET_ID`** in `apps-script/Code.gs` was a full Google Sheets URL instead of the
   bare Sheet ID. Fixed to the bare ID extracted from your sheet's URL:
   `14SH_L0fsknVQRNqrNPcfSS0lODipe-7mlnFt1pvFFG8`. Please confirm this is still your
   correct, current spreadsheet.

## New: Bookings feature (`admin/bookings.html` + `admin/bookings.js`)
- Tracks token-amount property reservations made before a full Sale Deal.
- New backend sheet/actions in `Code.gs`: `PROPERTY_BOOKINGS` sheet;
  `getBookings`, `getBooking`, `addBooking`, `updateBooking`, `deleteBooking`.
- **Selecting a property in the New Booking form shows a live media preview**:
  up to 4 property photos (click to enlarge) plus the property's video
  (YouTube, Cloudflare Stream, or a direct video file — auto-detected).
- Added a "Bookings" link to the sidebar of every existing admin page.

### ⚠️ Manual step required
Add a new sheet tab named **`PROPERTY_BOOKINGS`** to your Google Sheet with this header
layout (row 1 = title, row 2 = column headers, per your existing sheet convention):
```
booking_id | property_id | client_id | agent_id | token_amount | booking_date |
expected_registration_date | booking_status | payment_mode | notes
```

## Rent Payments — now shows property media too
- The Rent Payment form now resolves the property behind each rental Agreement and shows
  the same photo gallery + video preview as Bookings, so staff can see what's being rented
  without leaving the page.
- Added a Property column (thumbnail + title) to the Rent Payments table.

## Website (public) — video support broadened
- The property detail page's video tab only recognized YouTube links; a Cloudflare Stream
  or direct video URL would silently show nothing. It now renders all three formats
  correctly — this fixes video display for **rental listings** too, since Sale and Rent
  properties share the same detail page.
- Listing cards (homepage/search results) now show a small ▶ badge on any property —
  sale or rent — that has a video attached.

## Business identity updated (this round)
- **Logo**: your uploaded logo (`Logo_Main.png`) now replaces the 🏠 emoji everywhere — website navbar,
  website footer, every admin sidebar, and the admin login screen. A small optimized copy
  (`images/logo-small.png`) is used for these; the full-resolution original is also kept
  (`images/logo.png`) in case you need it for print/letterhead.
- **Phone**: all real contact links (`tel:`, WhatsApp `wa.me`, displayed numbers) on the public
  website updated to **7507163733**. (Form *input placeholders*, e.g. "9876543210" as a hint
  for a visitor's own number, were correctly left alone — those aren't your number.)
- **Email**: footer contact updated to **aurasynergyrealtygroup@gmail.com**.
- **Address**: `js/config.js` already had "Sasane Nagar, Hadapsar, Pune – 411028" set, but the
  website footer/contact section still had a stale placeholder ("Baner Road, Pune – 411045") —
  synced both to the correct address.
- **Copyright line**: footer now reads "© 2026 Aura Synergy Realty Group. All Rights Reserved."
  (was "ApnaGhar Realty").
- Left as-is: the "ApnaGhar" / "ApnaGhar ERP" product name still appears in page titles, the
  admin sidebar text, and browser tab titles — that's the platform's own name, distinct from
  Aura Synergy Realty Group as the operating business. Let me know if you'd like that renamed
  too, site-wide.

## Still open (not touched this round, since you asked to skip the full repair pass)
- Sidebar nav is not fully standardized across all pages (only the Bookings link was added).
- Missing pages from earlier sessions (`land.html`, `societies.html`, `agents.html`,
  `agreements.html`, `users.html`, etc.) are still not present in this ZIP.
- Cloudflare Images/Stream upload widget (for adding new photos/video from the admin panel)
  was not rebuilt this round.
