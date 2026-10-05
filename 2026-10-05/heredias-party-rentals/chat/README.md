# Heredia's Party Rentals chat

Private two-way office chat plus a 24-hour support specialist for the Heredia's Party Rentals concept demo.

- Two 1:1 desks, leasing and maintenance. Each room is one visitor and one staff person, never a group.
- Durable Objects keep each room, the staff inbox, and each specialist transcript. Typing and presence go over hibernated WebSockets. Stamps show Pacific Time as "today at 11:30pm", "yesterday at 11:30pm", or a date like "March 16, 2026".
- The specialist uses Workers AI and only the facts in `src/knowledge.ts`, taken from `../index.html`. Missing facts get the phone (562) 490-2040.
- `widget.js` is loaded from `../index.html`. Browser storage keys start with `hpr-`.
- Staff open `/admin` on the worker with the `ADMIN_TOKEN` secret.

Not live yet. `data-origin` on the dialog in `widget-body.html` is empty, so the widget tells visitors to call (562) 490-2040. After `npx wrangler deploy` (worker `heredias-party-rentals-chat`) and `npx wrangler secret put ADMIN_TOKEN`, put the workers.dev URL in `data-origin`.
