# Top Flight Mechanic chat

Private two-way office chat plus a 24-hour support specialist for the Top Flight Mechanic concept demo.

- Two 1:1 desks, leasing and maintenance. Each room is one visitor and one staff person, never a group.
- Durable Objects keep each room, the staff inbox, and each specialist transcript. Typing and presence go over hibernated WebSockets. Stamps show Pacific Time as "today at 11:30pm", "yesterday at 11:30pm", or a date like "March 16, 2026".
- The specialist uses Workers AI and only the facts in `src/knowledge.ts`, taken from `../index.html`. Missing facts get the phone (562) 285-2634.
- `widget.js` is loaded from `../index.html`. Browser storage keys start with `tfm-`.
- Staff open `/admin` on the worker with the `ADMIN_TOKEN` secret.

Not live yet. `data-origin` on the dialog in `widget-body.html` is empty, so the widget tells visitors to call (562) 285-2634. After `npx wrangler deploy` (worker `top-flight-mechanic-chat`) and `npx wrangler secret put ADMIN_TOKEN`, put the workers.dev URL in `data-origin`.
