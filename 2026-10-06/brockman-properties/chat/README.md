# Brockman Properties chat

Private two-way office chat (Leasing and Maintenance desks) plus a 24-hour support specialist for the Brockman Properties Corporation concept demo.

The visitor widget is loaded from `../index.html` via `chat/widget.js`, which fetches `widget.css` and `widget-body.html` and then wires the desks directly (no script injection through innerHTML). `data-origin` on the dialog stays empty until a shared leasing/maintenance worker exists; until then every desk tells visitors to call (562) 597-0676. Do not deploy a Worker for this demo alone.

The specialist's notes are in `src/knowledge.ts`. It is told not to answer pets, hours, years in business, unit count, review scores, or the Seal Beach bath count, and to send those questions to the office phone. Applications point to RentCafe only.
