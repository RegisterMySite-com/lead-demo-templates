# Hoag Property Management chat

Private two-way office chat (Leasing and Maintenance desks) plus a 24-hour support specialist for the Hoag Property Management concept demo.

The visitor widget is loaded from `../index.html` via `chat/widget.js`, which fetches `widget.css` and `widget-body.html` and then wires the desks directly (no script injection through innerHTML). `data-origin` on the dialog stays empty until a shared leasing/maintenance worker exists; until then every desk tells visitors to call (562) 869-1556. Do not deploy a Worker for this demo alone.

The specialist's notes are in `src/knowledge.ts`. It knows only the two live AppFolio units (7808 2nd St Unit 07, $2,100; 5309-5311 Boswell Pl, $2,500), the Downey office, both DRE numbers, services and service cities. It sends emergencies to (562) 833-1454, answers no years, fees, hours, ratings, pets or branches, and never asks for Social Security, ID or bank details.
