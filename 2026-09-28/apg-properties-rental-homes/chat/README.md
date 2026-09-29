# APG Properties chat

Private two-way office chat plus a 24-hour support specialist for the APG Properties concept demo.

The visitor widget is in `../index.html`. It stays quiet until `data-origin` on the dialog is set to this worker's URL.

## What it does
- Leasing and Maintenance are separate rooms. Each room is one visitor and one staff person. A second visitor cannot join, and a reconnect replaces the old connection.
- Messages, presence, and the typing signal live in a Cloudflare Durable Object, the same shape as Cloudflare's chat-app template.
- Stamps use Pacific Time: "today at 11:30pm", "yesterday at 11:30pm", or "March 16, 2026".
- The specialist uses Workers AI (`@cf/meta/llama-3.1-8b-instruct`) with a system prompt limited to the verified notes for this demo, the same shape as Cloudflare's llm-chat template. The transcript is stored in its own Durable Object.
- The desk is at `/admin` on the worker. The password is the `ADMIN_TOKEN` secret and is not in the public page.

## Deploy
```
npm install
npx wrangler secret put ADMIN_TOKEN
npx wrangler deploy
```
Then set `data-origin` on `<dialog id="apg-chat">` in `index.html` to the workers.dev URL, with no trailing slash.
