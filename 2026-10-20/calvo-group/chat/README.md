# Calvo Group chat

Private two-way office chat (Leasing and Maintenance desks) plus a 24-hour support specialist for the Calvo Group concept demo.

The visitor widget is loaded from `../index.html` via `chat/widget.js`, which fetches `widget.css` and `widget-body.html` and then wires the desks directly (no script injection through innerHTML). `data-origin` on the dialog stays empty until a shared leasing/maintenance worker exists; until then every desk tells visitors to call (626) 814-8000. Do not deploy a Worker for this demo alone.

The specialist's notes are in `src/knowledge.ts`. It knows only the eight featured communities from `../listings.js` (each "call for current availability", no rents), the West Covina office and both DRE numbers. It sends applications, rent payments and urgent repairs to (626) 814-8000, gives no outside links, answers no rents, years, hours, ratings or pets, names no staff besides the designated broker, and never asks for Social Security, ID, bank or card details.
