/** Durable Object room implementations for the private office chat. */

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
export interface Env {
  CHAT: DurableObjectNamespace;
  INBOX: DurableObjectNamespace;
  SUPPORT: DurableObjectNamespace;
  AI: { run(model: string, input: unknown): Promise<{ response?: string }> };
  ADMIN_TOKEN?: string;
  ASSETS: Fetcher;
}
interface SocketMeta { role: "visitor" | "staff"; name: string }
interface ChatMsg { id: string; role: "visitor" | "staff"; name: string; text: string; at: string }
interface RoomMeta { roomId: string; desk: "orders" | "pickup"; visitorName: string; preview: string; at: string }
interface SupportMsg { role: "user" | "assistant"; content: string; at: string }

const MAX_TEXT = 1500;
const MAX_HISTORY = 200;

function cleanName(value: unknown, fallback: string) {
  const name = String(value || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40);
  return name || fallback;
}

function cleanText(value: unknown) {
  return String(value || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, MAX_TEXT);
}

function safeEqual(a: string, b: string) {
  const aa = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  const len = Math.max(aa.length, bb.length);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

export class ChatRoom {
  constructor(private ctx: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/init" && request.method === "POST") {
      const body = await request.json() as { roomId: string; visitorKey: string; desk: "orders" | "pickup"; name: string };
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
      if (!row || row.exp < Date.now()) return Response.json({ error: "expired" }, { status: 401 });
      await this.ctx.storage.delete("ticket:" + ticket);
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
