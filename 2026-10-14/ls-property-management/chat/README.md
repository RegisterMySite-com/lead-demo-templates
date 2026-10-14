# LS Property Management chat

Private two-way office chat (Leasing and Maintenance desks) plus a 24-hour support specialist for the LS Property Management concept demo.

The visitor widget is loaded from `../index.html` via `chat/widget.js`, which fetches `widget.css` and `widget-body.html` and then wires the desks directly (no script injection through innerHTML). `data-origin` on the dialog stays empty until a shared leasing/maintenance worker exists; until then every desk tells visitors to call (562) 696-7001. Do not deploy a Worker for this demo alone.

The specialist's notes are in `src/knowledge.ts`. It knows only the 14363 Dittmar Dr house ($4,100), the Painter Ave office, both DRE numbers and the AppFolio listings link. It sends urgent repairs to (562) 696-7001, answers no years, fees, hours, ratings, pets or commercial questions, and never asks for Social Security, ID or bank details.
