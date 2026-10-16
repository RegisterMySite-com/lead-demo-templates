# Skyline Properties chat

Private two-way office chat (Leasing and Maintenance desks) plus a 24-hour support specialist for the Skyline Properties concept demo.

The visitor widget is loaded from `../index.html` via `chat/widget.js`, which fetches `widget.css` and `widget-body.html` and then wires the desks directly (no script injection through innerHTML). `data-origin` on the dialog stays empty until a shared leasing/maintenance worker exists; until then every desk tells visitors to call (562) 920-2440. Do not deploy a Worker for this demo alone.

The specialist's notes are in `src/knowledge.ts`. It knows only the seven live AppFolio units on the page, the Lakewood office, both DRE numbers and the service area. It sends applications to each unit's AppFolio link and urgent repairs to (562) 920-2440, answers no years, specials, hours, ratings or pets, names no staff besides the designated broker, and never asks for Social Security, ID or bank details.
