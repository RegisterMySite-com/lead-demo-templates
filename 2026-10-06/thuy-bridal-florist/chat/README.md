# Thuy Bridal & Florist chat

Private two-way office chat plus a 24-hour support specialist for the Thuy Bridal & Florist concept demo.

- Two 1:1 desks on the leasing and maintenance pattern, named Consultations and Bookings for this business. Each room is one visitor and one staff person, never a group.
- Durable Objects keep each room, the staff inbox, and each specialist transcript. Typing and presence go over hibernated WebSockets. Stamps show Pacific Time as "today at 11:30pm", "yesterday at 11:30pm", or a date like "March 16, 2026".
- The specialist uses Workers AI and only the facts in `src/knowledge.ts`, taken from `../index.html` (this folder has no leads.txt or listings.txt). Missing facts get the phone (714) 839-6588.
- `widget.js` is loaded from `../index.html`. Browser storage keys start with `tbf-`.
- Staff open `/admin` on the worker with the `ADMIN_TOKEN` secret.

Not live yet. `data-origin` on the dialog in `widget-body.html` is empty, so the widget tells visitors to call (714) 839-6588. After `npx wrangler deploy` (worker `thuy-bridal-florist-chat`) and `npx wrangler secret put ADMIN_TOKEN`, put the workers.dev URL in `data-origin`.
