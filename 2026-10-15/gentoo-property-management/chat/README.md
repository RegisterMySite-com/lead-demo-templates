# Gentoo Property Management chat

Private two-way office chat (Leasing and Maintenance desks) plus a 24-hour support specialist for the Gentoo Property Management concept demo.

The visitor widget is loaded from `../index.html` via `chat/widget.js`, which fetches `widget.css` and `widget-body.html` and then wires the desks directly (no script injection through innerHTML). `data-origin` on the dialog stays empty until a shared leasing/maintenance worker exists; until then every desk tells visitors to call (562) 274-5489. Do not deploy a Worker for this demo alone.

The specialist's notes are in `src/knowledge.ts`. It knows only the three rentals recently posted in September (each "call to confirm availability"), the Bellflower office, both DRE numbers, the service cities and the no-cash rule. It sends applications and urgent repairs to (562) 274-5489, answers no years, deposits, specials, hours, ratings or pets, and never asks for Social Security, ID or bank details.
