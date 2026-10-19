# Lido Property Management chat

Private two-way office chat (Leasing and Maintenance desks) plus a 24-hour support specialist for the Lido Property Management concept demo.

The visitor widget is loaded from `../index.html` via `chat/widget.js`, which fetches `widget.css` and `widget-body.html` and then wires the desks directly (no script injection through innerHTML). `data-origin` on the dialog stays empty until a shared leasing/maintenance worker exists; until then every desk tells visitors to call (714) 956-0235. Do not deploy a Worker for this demo alone.

The specialist's notes are in `src/knowledge.ts`. It knows only the 20 live AppFolio units from `../listings.js`, the Anaheim office, both DRE numbers and general applicant steps (apply, status, showing) with no fees or timelines. It sends urgent repairs to (714) 956-0235, answers no years, unit counts, specials, hours, ratings or pets, names no staff besides the designated broker, and never asks for Social Security, ID or bank details.
