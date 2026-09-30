/**
 * Private two-way chat for the AllStar Property Management demo.
 * Follows Cloudflare's chat-app template: one Durable Object per room,
 * hibernated WebSockets, messages kept in DO storage.
 * The support specialist follows the llm-chat template: Workers AI plus
 * a system prompt, with the transcript kept in its own Durable Object.
 * A room only ever has two people: the visitor and one staff desk.
 */

import { KNOWLEDGE, SYSTEM } from './knowledge';
import { ChatRoom, Inbox, SupportRoom } from './rooms';
export { ChatRoom, Inbox, SupportRoom };


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


export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(request) });
    }
    if (url.pathname === "/admin") return adminPage(env, request);
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
      let answer = "I can't reach the specialist right now. Call 714-386-1126 and the office can help.";
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
        answer = "The specialist is offline right now. Call 714-386-1126.";
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

async function adminPage(env: Env, request: Request) {
  const asset = await env.ASSETS.fetch(new URL('/admin.html', request.url));
  if (!asset.ok) {
    return new Response('Desk page missing. Add chat/admin.html under public/ or assets.', { status: 500 });
  }
  const html = await asset.text();
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

