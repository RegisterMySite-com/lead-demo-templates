# EXLNT Property Management chat

Private two-way office chat (Leasing and Maintenance desks) plus a 24-hour support specialist for the EXLNT Property Management (Norwalk Realty Inc) concept demo.

The visitor widget is loaded from `../index.html` via `chat/widget.js`, which fetches `widget.css` and `widget-body.html` and then wires the desks directly (no script injection through innerHTML). `data-origin` on the dialog stays empty until a shared leasing/maintenance worker exists; until then every desk tells visitors to call (562) 868-0986. Do not deploy a Worker for this demo alone.

The specialist's notes are in `src/knowledge.ts`. It names no unit, address or price as available and sends availability questions to (562) 868-0986 or info@exlntpropertymanagement.com. It is told not to answer years in business, hours, ratings, or pets, to name no staff besides broker Mike Poff, and never to ask for Social Security details.
