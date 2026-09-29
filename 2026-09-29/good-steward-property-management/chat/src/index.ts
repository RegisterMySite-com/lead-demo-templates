/**
 * Private two-way chat for the Good Steward Property Management demo.
 * Follows Cloudflare's chat-app template: one Durable Object per room,
 * hibernated WebSockets, messages kept in DO storage.
 * The support specialist follows the llm-chat template: Workers AI plus
 * a system prompt, with the transcript kept in its own Durable Object.
 * A room only ever has two people: the visitor and one staff desk.
 */

export interface Env {
  CHAT: DurableObjectNamespace;
  INBOX: DurableObjectNamespace;
  SUPPORT: DurableObjectNamespace;
  AI: { run(model: string, input: unknown): Promise<{ response?: string }> };
  ADMIN_TOKEN?: string;
  ASSETS: Fetcher;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}
interface DurableObjectId { toString(): string }
interface DurableObjectStub { fetch(input: Request | string, init?: RequestInit): Promise<Response> }
interface DurableObjectState {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<boolean>;
    list<T>(opts?: { prefix?: string }): Promise<Map<string, T>>;
  };
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
}
interface SocketMeta { role: "visitor" | "staff"; name: string }
interface ChatMsg { id: string; role: "visitor" | "staff"; name: string; text: string; at: string }
interface RoomMeta { roomId: string; desk: "leasing" | "maintenance"; visitorName: string; preview: string; at: string }

const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const MAX_TEXT = 1500;
const MAX_HISTORY = 200;

const KNOWLEDGE = `
This is a RegisterMySite concept demo, not the official Good Steward Property Management website and not orangepropertymanager.com.
Company: Good Steward Property Management, the DBA of broker Jeffrey Andres Terreros Ugarte, California DRE 01918337. Jeff Terreros is the property manager. The company site brands itself for the Orange area. The office on that site is in Yorba Linda, not in the city of Orange.
Office: 19631 Yorba Linda Blvd, Yorba Linda, CA 92886.
Main phone: (714) 398-8476.
Email printed on the page: Jeff@GoodStewardPM.com. No other email address is printed.
Public site the listing facts were read from: https://www.orangepropertymanager.com/ . The page says those facts were read on September 29, 2026 (PT) and can change.
The on-page tour and application form stays on the page. It does not email Good Steward and it is not an application.
What the page says the company handles: they market each rental, screen applicants, and collect rent on a set schedule. Maintenance is dispatched through the office. Owners can pull monthly and yearly financial statements, and leases are revisited each year.
Team named on the page:
- Jeff Terreros, property manager. Broker license CA DRE 01918337, Jeffrey Andres Terreros Ugarte. DBA Good Steward Property Management.
- Elyse Terreros, leasing manager. Salesperson license CA DRE 01986038 on the same broker record.
- Rose Briceno, assistant property manager.
- Silvino Briceno, maintenance manager.
- Jeffrey Simons, listing manager.
The page does not give a DRE mailing address. It does not list other offices.
The public rental board on this page lists four homes. The Placentia house leads.
1. Lead listing: 1760 Taylor Ln, Placentia, CA 92870. Single-family house in a gated community. Rent $4,600 per month. Deposit $5,000. 4 bedrooms. Baths: 3 on the card, and 2 full plus 1 half on the detail. 1,817 sq ft. Available immediately. Pets: yes, dogs and cats. The page also says a $40 monthly pet fee, 1 pet max, up to 30 pounds. Hardwood floors, a garage, and a community pool are on the feature list. The page asks people to call or text (714) 916-2880 for gate instructions. It still prints an open house for Sunday, September 27, 1:30–2:30 p.m. Listing page: https://www.orangepropertymanager.com/orange-homes-for-rent/215/1760-taylor-ln-placentia-ca-92870 . Photo files on this demo: placentia-1, placentia-2, and placentia-3. Do not describe what a photo shows.
2. 1604 Avenida Del Vista, Corona, CA 92882. Single-family. Rent $3,900 per month. Deposit $4,000. 4 bedrooms, 2 baths, about 2,050 sq ft. Available immediately. Pets: yes, dogs and cats. Solar, a large backyard, and room listed for an RV or trailer plus more vehicles. The page says the property is being worked on and will be completely painted. Listing page: https://www.orangepropertymanager.com/orange-homes-for-rent/209/1604-avenida-del-vista-corona-ca-92882 . Photo files on this demo: corona-1, corona-2, and corona-3. Do not describe what a photo shows.
3. 5154 Merrill Ave, Riverside, CA 92504. Single-family. Rent $3,500 per month. Deposit $4,000. 4 bedrooms, 2 baths, about 2,008 sq ft. Available October 16, 2026. Pets: yes, dogs and cats. The page lists granite counters, a fenced patio, and drop-in times on September 27 and October 4, both 11 a.m.–12 p.m. Listing page: https://www.orangepropertymanager.com/orange-homes-for-rent/213/5154-merrill-ave-riverside-ca-92504 . Photo files on this demo: riverside-1, riverside-2, and riverside-3. Do not describe what a photo shows.
4. 9608 Nova Pl., Rancho Cucamonga, CA 91730. Townhouse. Rent $2,900 per month. Deposit $3,000. 2 bedrooms. Baths: 3 on the card, and the description says two full and one half. About 1,164 sq ft. Available immediately. Pets: no. A garage, a stacked washer and dryer, and a community pool, gym, and jacuzzi are on the feature list. The page mentions an open house Sunday, November 24, 1–2 p.m., and does not give a year. Listing page: https://www.orangepropertymanager.com/orange-homes-for-rent/73/9608-nova-pl-rancho-cucamonga-ca-91730 . Photo files on this demo: rancho-1, rancho-2, and rancho-3. Do not describe what a photo shows.
Do not mention reviews, star ratings, Birdeye, or Google scores. Do not invent a listing, a rent, a deposit, a size, a pet rule, an availability date, a DRE number, an email, or a photo. If a fact is not written above, say you don't have it and give the office phone (714) 398-8476.
`.trim();

const SYSTEM = `You are the after-hours support specialist on a concept demo of the Good Steward Property Management website. You are not a human, and you are not official staff at orangepropertymanager.com. This page is a concept demo, not the company's official site. Help people looking at the houses on this page, or who need maintenance or leasing contact info. Use only the facts in the knowledge. If a fact is not there, say you don't have it and give the office phone (714) 398-8476. Never invent a listing, a price, an availability date, a DRE number, an email, or a photo. Keep answers short, in plain sentences.

Knowledge:
${KNOWLEDGE}`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(request) });
    }
    if (url.pathname === "/admin") return adminPage();
    if (url.pathname === "/health") return json(request, { ok: true });

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const body = await readJson(request);
      if (body.desk !== "leasing" && body.desk !== "maintenance") {
        return json(request, { error: "Choose leasing or maintenance." }, 400);
      }
      const desk = body.desk;
      const name = cleanName(body.name, "Visitor");
      const roomId = crypto.randomUUID();
      const visitorKey = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const stub = env.CHAT.get(env.CHAT.idFromName(roomId));
      const init = await stub.fetch("https://room/init", {
        method: "POST",
        body: JSON.stringify({ roomId, visitorKey, desk, name }),
      });
      if (!init.ok) return json(request, { error: "Could not open a room." }, 500);
      return json(request, { roomId, visitorKey, desk });
    }

    const roomMatch = url.pathname.match(/^\/api\/room\/([0-9a-f-]{36})$/i);
    if (roomMatch) {
      const roomId = roomMatch[1];
      const stub = env.CHAT.get(env.CHAT.idFromName(roomId));
      if (request.headers.get("Upgrade") === "websocket") {
        // Forward the original upgrade. The room checks the visitor key,
        // or consumes a one-time staff ticket. A query flag alone is never trusted.
        return stub.fetch(request);
      }
      if (request.method === "GET") {
        const key = url.searchParams.get("key") || "";
        const res = await stub.fetch("https://room/history?key=" + encodeURIComponent(key));
        const data = await res.json();
        return json(request, data, res.status);
      }
    }

    if (url.pathname === "/api/ticket" && request.method === "POST") {
      if (!env.ADMIN_TOKEN) return json(request, { error: "ADMIN_TOKEN is not set on the worker." }, 503);
      if (!safeEqual(bearer(request), env.ADMIN_TOKEN)) return json(request, { error: "Wrong desk password." }, 401);
      const body = await readJson(request);
      const ticket = crypto.randomUUID();
      const name = cleanName(body.name, "Office");
      const inbox = env.INBOX.get(env.INBOX.idFromName("inbox"));
      await inbox.fetch("https://inbox/ticket", { method: "POST", body: JSON.stringify({ ticket, name }) });
      return json(request, { ticket });
    }

    if (url.pathname === "/api/inbox" && request.method === "GET") {
      if (!env.ADMIN_TOKEN) return json(request, { error: "ADMIN_TOKEN is not set on the worker." }, 503);
      if (!safeEqual(bearer(request), env.ADMIN_TOKEN)) return json(request, { error: "Wrong desk password." }, 401);
      const inbox = env.INBOX.get(env.INBOX.idFromName("inbox"));
      const res = await inbox.fetch("https://inbox/list");
      return json(request, await res.json());
    }

    if (url.pathname === "/api/support/start" && request.method === "POST") {
      const visitorKey = crypto.randomUUID().replace(/-/g, "");
      const stub = env.SUPPORT.get(env.SUPPORT.idFromName(visitorKey));
      await stub.fetch("https://support/init", { method: "POST", body: JSON.stringify({ visitorKey }) });
      return json(request, { visitorKey });
    }

    if (url.pathname === "/api/support" && request.method === "GET") {
      const key = url.searchParams.get("key") || "";
      const stub = env.SUPPORT.get(env.SUPPORT.idFromName(key));
      const res = await stub.fetch("https://support/history?key=" + encodeURIComponent(key));
      return json(request, await res.json(), res.status);
    }

    if (url.pathname === "/api/support" && request.method === "POST") {
      const body = await readJson(request);
      const key = String(body.key || "");
      const text = cleanText(body.text);
      if (!key || !text) return json(request, { error: "Say what you need help with." }, 400);
      const stub = env.SUPPORT.get(env.SUPPORT.idFromName(key));
      const saved = await stub.fetch("https://support/user", {
        method: "POST",
        body: JSON.stringify({ key, text }),
      });
      if (!saved.ok) return json(request, await saved.json(), saved.status);
      const prior = await saved.json() as { messages: { role: string; content: string }[] };
      let answer = "I can't reach the specialist right now. Call (714) 398-8476 and the office can help.";
      try {
        const result = await env.AI.run(MODEL, {
          messages: [
            { role: "system", content: SYSTEM },
            ...prior.messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
          ],
          max_tokens: 400,
        });
        if (result && typeof result.response === "string" && result.response.trim()) {
          answer = result.response.trim().slice(0, 2000);
        }
      } catch {
        answer = "The specialist is offline right now. Call (714) 398-8476.";
      }
      const done = await stub.fetch("https://support/assistant", {
        method: "POST",
        body: JSON.stringify({ key, text: answer }),
      });
      return json(request, await done.json(), done.status);
    }

    if ((request.method === "GET" || request.method === "HEAD") && !url.pathname.startsWith("/api")) {
      return env.ASSETS.fetch(request);
    }
    return json(request, { error: "Not found." }, 404);
  },
};

export class ChatRoom {
  constructor(private ctx: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/init" && request.method === "POST") {
      const body = await request.json() as { roomId: string; visitorKey: string; desk: "leasing" | "maintenance"; name: string };
      if (await this.ctx.storage.get("visitorKey")) return new Response("exists", { status: 409 });
      await this.ctx.storage.put("visitorKey", body.visitorKey);
      await this.ctx.storage.put("roomId", body.roomId);
      await this.ctx.storage.put("desk", body.desk);
      await this.ctx.storage.put("visitorName", body.name);
      await this.ctx.storage.put("messages", [] as ChatMsg[]);
      return new Response("ok");
    }
    if (url.pathname === "/history") {
      const key = url.searchParams.get("key") || "";
      if (!await this.visitorOk(key)) return Response.json({ error: "Unknown room." }, { status: 401 });
      const messages = (await this.ctx.storage.get<ChatMsg[]>("messages")) || [];
      return Response.json({ messages, presence: this.people(), desk: await this.ctx.storage.get("desk") });
    }
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a websocket.", { status: 426 });

    let role: SocketMeta["role"] = "visitor";
    let name = cleanName(await this.ctx.storage.get<string>("visitorName"), "Visitor");
    if (url.searchParams.get("role") === "staff") {
      const ticket = url.searchParams.get("ticket") || "";
      const inbox = this.env.INBOX.get(this.env.INBOX.idFromName("inbox"));
      const used = await inbox.fetch("https://inbox/consume?ticket=" + encodeURIComponent(ticket));
      if (!used.ok) return new Response("Unauthorized.", { status: 401 });
      const info = await used.json() as { name?: string };
      role = "staff";
      name = cleanName(info.name, "Office");
    } else if (!await this.visitorOk(url.searchParams.get("key") || "")) {
      return new Response("Unknown room.", { status: 401 });
    }
    const pair = new WebSocketPair();
    const server = pair[1];
    this.ctx.acceptWebSocket(server, [role]);
    for (const other of this.ctx.getWebSockets(role)) {
      if (other !== server) other.close(4000, "replaced");
    }
    server.serializeAttachment({ role, name } satisfies SocketMeta);
    const messages = (await this.ctx.storage.get<ChatMsg[]>("messages")) || [];
    server.send(JSON.stringify({ type: "ready", messages, presence: this.people() }));
    this.broadcast({ type: "presence", presence: this.people() });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const meta = ws.deserializeAttachment() as SocketMeta | null;
    if (!meta) return;
    let data: { type?: string; text?: string; on?: boolean };
    try { data = JSON.parse(typeof raw === "string" ? raw : ""); }
    catch { return; }
    if (data.type === "typing") {
      this.broadcast({ type: "typing", role: meta.role, name: meta.name, on: !!data.on }, ws);
      return;
    }
    if (data.type !== "chat") return;
    const text = cleanText(data.text);
    if (!text) return;
    const now = Date.now();
    const recent = (await this.ctx.storage.get<number[]>("recent")) || [];
    const windowed = recent.filter((t) => now - t < 30000);
    if (windowed.length >= 12) {
      ws.send(JSON.stringify({ type: "error", error: "Slow down a moment, then send again." }));
      return;
    }
    windowed.push(now);
    await this.ctx.storage.put("recent", windowed);
    const msg: ChatMsg = { id: crypto.randomUUID(), role: meta.role, name: meta.name, text, at: new Date(now).toISOString() };
    const messages = (await this.ctx.storage.get<ChatMsg[]>("messages")) || [];
    messages.push(msg);
    await this.ctx.storage.put("messages", messages.slice(-MAX_HISTORY));
    this.broadcast({ type: "message", message: msg });
    const roomId = await this.ctx.storage.get<string>("roomId");
    const desk = await this.ctx.storage.get<RoomMeta["desk"]>("desk");
    const visitorName = await this.ctx.storage.get<string>("visitorName");
    if (roomId && desk) {
      const inbox = this.env.INBOX.get(this.env.INBOX.idFromName("inbox"));
      await inbox.fetch("https://inbox/touch", {
        method: "POST",
        body: JSON.stringify({ roomId, desk, visitorName: visitorName || "Visitor", preview: text.slice(0, 140), at: msg.at } satisfies RoomMeta),
      }).catch(() => undefined);
    }
  }

  async webSocketClose() {
    this.broadcast({ type: "presence", presence: this.people() });
  }

  private async visitorOk(key: string) {
    const saved = await this.ctx.storage.get<string>("visitorKey");
    return !!saved && !!key && safeEqual(saved, key);
  }

  private people() {
    return this.ctx.getWebSockets()
      .filter((ws) => ws.readyState === 1)
      .map((ws) => ws.deserializeAttachment() as SocketMeta)
      .filter((m) => m && (m.role === "visitor" || m.role === "staff"));
  }

  private broadcast(payload: unknown, except?: WebSocket) {
    const text = JSON.stringify(payload);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== except && ws.readyState === 1) ws.send(text);
    }
  }
}

export class Inbox {
  constructor(private ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ticket" && request.method === "POST") {
      const body = await request.json() as { ticket: string; name: string };
      await this.ctx.storage.put("ticket:" + body.ticket, { name: body.name, exp: Date.now() + 120000 });
      return Response.json({ ok: true });
    }
    if (url.pathname === "/consume") {
      const ticket = url.searchParams.get("ticket") || "";
      const row = await this.ctx.storage.get<{ name: string; exp: number }>("ticket:" + ticket);
      await this.ctx.storage.delete("ticket:" + ticket);
      if (!row || row.exp < Date.now()) return Response.json({ error: "expired" }, { status: 401 });
      return Response.json({ name: row.name });
    }
    if (url.pathname === "/touch" && request.method === "POST") {
      const body = await request.json() as RoomMeta;
      await this.ctx.storage.put("room:" + body.roomId, body);
      return Response.json({ ok: true });
    }
    if (url.pathname === "/list") {
      const listed = await this.ctx.storage.list<RoomMeta>({ prefix: "room:" });
      const rooms = [...listed.values()].sort((a, b) => (a.at < b.at ? 1 : -1));
      return Response.json({ rooms });
    }
    return new Response("no", { status: 404 });
  }
}

interface SupportMsg { role: "user" | "assistant"; content: string; at: string }

export class SupportRoom {
  constructor(private ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/init" && request.method === "POST") {
      const body = await request.json() as { visitorKey: string };
      if (!await this.ctx.storage.get("key")) await this.ctx.storage.put("key", body.visitorKey);
      if (!await this.ctx.storage.get("messages")) await this.ctx.storage.put("messages", [] as SupportMsg[]);
      return Response.json({ ok: true });
    }
    const key = url.searchParams.get("key") || "";
    if (request.method === "POST") {
      const body = await request.json() as { key?: string; text?: string };
      if (!await this.owns(String(body.key || ""))) return Response.json({ error: "Unknown session." }, { status: 401 });
      if (url.pathname === "/user") {
        const text = cleanText(body.text);
        if (!text) return Response.json({ error: "Empty." }, { status: 400 });
        const messages = await this.push({ role: "user", content: text, at: new Date().toISOString() });
        return Response.json({ messages: messages.map(({ role, content }) => ({ role, content })) });
      }
      if (url.pathname === "/assistant") {
        const messages = await this.push({ role: "assistant", content: String(body.text || "").slice(0, 2000), at: new Date().toISOString() });
        return Response.json({ messages });
      }
    }
    if (url.pathname === "/history") {
      if (!await this.owns(key)) return Response.json({ error: "Unknown session." }, { status: 401 });
      const messages = (await this.ctx.storage.get<SupportMsg[]>("messages")) || [];
      return Response.json({ messages });
    }
    return new Response("no", { status: 404 });
  }

  private async owns(key: string) {
    const saved = await this.ctx.storage.get<string>("key");
    return !!saved && !!key && safeEqual(saved, key);
  }

  private async push(msg: SupportMsg) {
    const messages = (await this.ctx.storage.get<SupportMsg[]>("messages")) || [];
    messages.push(msg);
    const kept = messages.slice(-MAX_HISTORY);
    await this.ctx.storage.put("messages", kept);
    return kept;
  }
}

function cleanName(value: unknown, fallback: string) {
  const name = String(value || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40);
  return name || fallback;
}

function cleanText(value: unknown) {
  return String(value || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, MAX_TEXT);
}

function bearer(request: Request) {
  const header = request.headers.get("Authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function safeEqual(a: string, b: string) {
  const aa = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  const len = Math.max(aa.length, bb.length);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try { return await request.json() as Record<string, unknown>; }
  catch { return {}; }
}

function cors(request: Request, extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("Access-Control-Allow-Origin", request.headers.get("Origin") || "*");
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Cache-Control", "no-store");
  return headers;
}

function json(request: Request, data: unknown, status = 200) {
  const headers = cors(request);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { status, headers });
}

function adminPage() {
  return new Response(ADMIN_HTML, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Good Steward desk</title>
<style>
  :root { --ink:#1c1914; --forest:#1e3b32; --clay:#a24c2e; --sand:#f3ecdf; --card:#fffaf3; --line:#e0d4c2; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--sand); color:var(--ink); font:16px/1.45 "Segoe UI", Helvetica, Arial, sans-serif; }
  h1,h2 { font-family: Georgia, Palatino, serif; font-weight:600; }
  header { background:var(--forest); color:var(--sand); padding:1rem 1.2rem; display:flex; justify-content:space-between; gap:1rem; align-items:center; }
  main { display:grid; grid-template-columns: 280px 1fr; min-height: calc(100vh - 64px); }
  aside, section { padding:1rem; }
  aside { border-right:1px solid var(--line); }
  button, input { font:inherit; }
  button { background:var(--clay); color:#fff; border:0; border-radius:999px; padding:.45rem .8rem; cursor:pointer; }
  button.quiet { background:#fff; color:var(--ink); border:1px solid var(--line); }
  input { width:100%; padding:.45rem .55rem; border:1px solid var(--line); border-radius:6px; }
  ul { list-style:none; padding:0; margin:0; display:grid; gap:.4rem; }
  li button { width:100%; text-align:left; background:#fff; color:var(--ink); border:1px solid var(--line); border-radius:8px; }
  #log { display:grid; gap:.6rem; align-content:start; min-height:50vh; }
  .me, .them { max-width:36rem; padding:.55rem .7rem; border-radius:10px; }
  .me { background:#efe4d4; justify-self:end; }
  .them { background:#fff; border:1px solid var(--line); }
  .meta { color:#5e574c; font-size:.78rem; }
  form.row { display:flex; gap:.4rem; }
  #gate { max-width:28rem; margin:2rem auto; background:var(--card); padding:1rem; border:1px solid var(--line); }
  [hidden] { display:none !important; }
  :focus-visible { outline:3px solid #8c3d22; outline-offset:2px; }
  @media (max-width:800px) { main { grid-template-columns:1fr; } }
</style>
</head>
<body>
<header>
  <h1 style="margin:0;font-size:1.3rem">Good Steward desk</h1>
  <p id="who" style="margin:0"></p>
</header>
<div id="gate">
  <h2>Open the desk</h2>
  <p>This password is the worker secret. It never goes on the public page.</p>
  <form id="login">
    <label>Your name <input id="staffName" autocomplete="name" value="Good Steward office"></label>
    <label style="display:block;margin:.6rem 0">Desk password <input id="token" type="password" autocomplete="current-password" required></label>
    <button type="submit">Open inbox</button>
    <p id="loginErr" role="alert"></p>
  </form>
</div>
<main id="app" hidden>
  <aside>
    <h2 style="margin-top:0">Private rooms</h2>
    <p class="meta">Each room is one visitor and you. Nobody else can join.</p>
    <ul id="rooms"></ul>
  </aside>
  <section>
    <p id="presence" class="meta">Pick a conversation.</p>
    <p id="typing" class="meta" hidden></p>
    <div id="log" aria-live="polite"></div>
    <form class="row" id="send">
      <input id="box" aria-label="Message" maxlength="1500" placeholder="Reply to this visitor">
      <button type="submit">Send</button>
    </form>
  </section>
</main>
<script>
const $ = (id) => document.getElementById(id);
let token = "", ticket = "", socket = null, roomId = "";
function stamp(iso) {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return "";
  const tz = "America/Los_Angeles";
  const key = (dt) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year:"numeric", month:"2-digit", day:"2-digit" }).format(dt);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour:"numeric", minute:"2-digit", hour12:true }).format(d).replace(/\\s/g,"").toLowerCase();
  const today = key(new Date());
  const [y,m,day] = today.split("-").map(Number);
  const yest = new Date(Date.UTC(y, m - 1, day - 1)).toISOString().slice(0, 10);
  const mine = key(d);
  if (mine === today) return "today at " + time;
  if (mine === yest) return "yesterday at " + time;
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, month:"long", day:"numeric", year:"numeric" }).format(d);
}
function bubble(msg) {
  const el = document.createElement("div");
  el.className = msg.role === "staff" ? "me" : "them";
  const who = document.createElement("strong"); who.textContent = msg.name;
  const body = document.createElement("div"); body.textContent = msg.text;
  const when = document.createElement("div"); when.className = "meta"; when.textContent = stamp(msg.at);
  el.append(who, body, when); return el;
}
$("login").addEventListener("submit", async (e) => {
  e.preventDefault();
  token = $("token").value;
  const res = await fetch("/api/inbox", { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) { $("loginErr").textContent = "That password did not open the desk."; return; }
  $("gate").hidden = true; $("app").hidden = false;
  $("who").textContent = $("staffName").value;
  loadInbox();
});
async function loadInbox() {
  const res = await fetch("/api/inbox", { headers: { Authorization: "Bearer " + token } });
  const data = await res.json();
  $("rooms").replaceChildren();
  for (const room of data.rooms || []) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    const title = document.createElement("strong"); title.textContent = room.visitorName + " · " + room.desk;
    const preview = document.createElement("div"); preview.className = "meta"; preview.textContent = room.preview;
    btn.append(title, preview);
    btn.addEventListener("click", () => openRoom(room.roomId));
    li.append(btn); $("rooms").append(li);
  }
  if (!(data.rooms || []).length) $("rooms").textContent = "No messages yet.";
}
async function openRoom(id) {
  roomId = id;
  if (socket) socket.close();
  const res = await fetch("/api/ticket", { method:"POST", headers:{ Authorization:"Bearer " + token, "Content-Type":"application/json" }, body: JSON.stringify({ name: $("staffName").value }) });
  const data = await res.json();
  if (!res.ok) { $("presence").textContent = data.error || "Could not join."; return; }
  const wsUrl = (location.origin.replace(/^http/, "ws")) + "/api/room/" + id + "?role=staff&ticket=" + encodeURIComponent(data.ticket);
  socket = new WebSocket(wsUrl);
  socket.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "ready") { $("log").replaceChildren(...msg.messages.map(bubble)); paintPresence(msg.presence); }
    if (msg.type === "message") $("log").append(bubble(msg.message));
    if (msg.type === "presence") paintPresence(msg.presence);
    if (msg.type === "typing") { $("typing").hidden = !msg.on; $("typing").textContent = msg.on ? msg.name + " is typing" : ""; }
    if (msg.type === "error") $("presence").textContent = msg.error;
  });
}
function paintPresence(people) {
  const names = (people || []).map((p) => p.name + (p.role === "staff" ? " (you)" : ""));
  $("presence").textContent = names.length ? "In this chat: " + names.join(", ") : "Nobody is in this chat.";
}
let typingTimer = 0;
$("box").addEventListener("input", () => {
  if (socket && socket.readyState === 1) socket.send(JSON.stringify({ type:"typing", on:true }));
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => { if (socket && socket.readyState === 1) socket.send(JSON.stringify({ type:"typing", on:false })); }, 1200);
});
$("send").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("box").value.trim();
  if (!text || !socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify({ type:"chat", text }));
  socket.send(JSON.stringify({ type:"typing", on:false }));
  $("box").value = "";
});
setInterval(() => { if (!$("app").hidden) loadInbox(); }, 15000);
</script>
</body>
</html>`;
