# EquityPro Management chat

Private two-way office chat (Leasing and Maintenance desks) plus a 24-hour support specialist for the EquityPro Management concept demo.

The visitor widget is loaded from `../index.html` via `chat/widget.js`, which fetches `widget.css` and `widget-body.html` and then wires the desks directly (no script injection through innerHTML). `data-origin` on the dialog stays empty until a shared leasing/maintenance worker exists; until then every desk tells visitors to call (562) 632-1707. Do not deploy a Worker for this demo alone.

The specialist's notes are in `src/knowledge.ts`. It can describe the three one-bedroom Whittier units shown on the page (Newlin, Christine and Pickering) and sends tours and applications to (562) 632-1707 or info@equitypromanagement.com. It is told not to answer license numbers, years in business, fees, hours, ratings, or pets, and never to ask for Social Security details.
