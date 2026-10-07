# Nease Property Management chat

Private two-way office chat (Leasing and Maintenance desks) plus a 24-hour support specialist for the Nease Property Management concept demo.

The visitor widget is loaded from `../index.html` via `chat/widget.js`, which fetches `widget.css` and `widget-body.html` and then wires the desks directly (no script injection through innerHTML). `data-origin` on the dialog stays empty until a shared leasing/maintenance worker exists; until then every desk tells visitors to call (714) 525-1750. Do not deploy a Worker for this demo alone.

The specialist's notes are in `src/knowledge.ts`. The only listing it treats as available is the 650 sq ft office suite at 1965 E Chapman Ave ($1,750). It gives no move-in date, offers no home addresses or prices, and is told not to answer years in business, hours, ratings, or pets, sending those to the office phone. Applications and resident sign-in point to the Nease Buildium portal.
