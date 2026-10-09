/* EquityPro Management private office chat widget. Loads the branded markup and styles, then wires the desks.
   data-origin on the dialog stays empty until the chat worker is deployed; until then the widget tells visitors to call (562) 632-1707. */
(() => {
  const base = (document.currentScript && document.currentScript.src) ? new URL('./', document.currentScript.src).href : 'chat/';
  const init = () => {
  (function () {
const dlg = document.getElementById("eqp-chat");
const home = document.getElementById("eqp-home");
const room = document.getElementById("eqp-room");
const log = document.getElementById("eqp-log");
const box = document.getElementById("eqp-box");
const who = document.getElementById("eqp-who");
const dot = document.getElementById("eqp-dot");
const typing = document.getElementById("eqp-typing");
const origin = (dlg.getAttribute("data-origin") || "").replace(/\/$/, "");
const phone = "(562) 632-1707";
const storeKey = (suffix) => "eqp-" + suffix;
let mode = "", socket = null, session = null, typer = 0;
function stamp(iso) {
const d = new Date(iso);
if (Number.isNaN(d.getTime())) return "";
const tz = "America/Los_Angeles";
const key = (dt) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(dt);
const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(d).replace(/\s/g, "").toLowerCase();
const today = key(new Date());
const parts = today.split("-").map(Number);
const yest = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] - 1)).toISOString().slice(0, 10);
const mine = key(d);
if (mine === today) return "today at " + time;
if (mine === yest) return "yesterday at " + time;
return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "long", day: "numeric", year: "numeric" }).format(d);
}
function store(key, value) {
try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); }
catch (e) {}
}
function load(key) {
try { return JSON.parse(localStorage.getItem(key) || "null"); }
catch (e) { return null; }
}
function bubble(msg) {
const el = document.createElement("div");
const mine = mode === "specialist" ? msg.role === "user" : msg.role === "visitor";
el.className = mine ? "me" : "them";
const name = document.createElement("strong");
name.textContent = mode === "specialist" ? (msg.role === "user" ? (session && session.name) || "You" : "Specialist") : msg.name;
const body = document.createElement("div");
body.textContent = msg.text || msg.content || "";
const when = document.createElement("div");
when.className = "meta";
when.textContent = stamp(msg.at);
el.append(name, body, when);
return el;
}
function setPeople(people) {
const others = (people || []).filter((p) => p.role !== "visitor");
dot.classList.toggle("on", others.length > 0);
if (!people || !people.length) { who.textContent = "Nobody else is in this chat yet."; return; }
who.textContent = "In this chat: " + people.map((p) => p.name).join(", ");
}
function offline(text) {
const p = document.createElement("p");
p.className = "meta";
p.textContent = text;
log.append(p);
}
function openHome() {
if (socket) { socket.close(); socket = null; }
mode = ""; session = null;
home.hidden = false; room.hidden = true;
dot.classList.remove("on");
who.textContent = "Choose who to reach";
typing.hidden = true;
}
function showRoom() {
home.hidden = true; room.hidden = false;
box.focus();
}
async function startDesk(desk) {
mode = desk;
const saved = load(storeKey(desk));
const name = (saved && saved.name) || window.prompt("Your name", "") || "";
if (!name.trim()) return;
showRoom();
log.replaceChildren();
if (!origin) {
who.textContent = "Chat worker is not deployed yet.";
offline("This page can open the room once the Cloudflare worker is deployed. Until then, call " + phone + ".");
return;
}
session = saved && saved.roomId ? saved : null;
if (!session) {
const res = await fetch(origin + "/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ desk: desk, name: name.trim() }) });
const data = await res.json();
if (!res.ok) { offline(data.error || "Could not open a room."); return; }
session = { roomId: data.roomId, visitorKey: data.visitorKey, name: name.trim() };
store(storeKey(desk), session);
}
const wsUrl = origin.replace(/^http/, "ws") + "/api/room/" + session.roomId + "?key=" + encodeURIComponent(session.visitorKey);
socket = new WebSocket(wsUrl);
socket.addEventListener("message", (ev) => {
const msg = JSON.parse(ev.data);
if (msg.type === "ready") { log.replaceChildren(...msg.messages.map(bubble)); setPeople(msg.presence); }
if (msg.type === "message") { log.append(bubble(msg.message)); log.scrollTop = log.scrollHeight; }
if (msg.type === "presence") setPeople(msg.presence);
if (msg.type === "typing") { typing.hidden = !msg.on; typing.textContent = msg.on ? msg.name + " is typing" : ""; }
if (msg.type === "error") offline(msg.error);
});
socket.addEventListener("error", () => offline("The office chat did not connect. Call " + phone + "."));
}
async function startSpecialist() {
mode = "specialist";
showRoom();
log.replaceChildren();
dot.classList.add("on");
who.textContent = "In this chat: You, Specialist";
if (!origin) {
offline("The specialist runs on the Cloudflare worker, which is not deployed yet. Call " + phone + ".");
return;
}
session = load(storeKey("support"));
if (!session) {
const res = await fetch(origin + "/api/support/start", { method: "POST" });
session = await res.json();
session.name = "You";
store(storeKey("support"), session);
}
const hist = await fetch(origin + "/api/support?key=" + encodeURIComponent(session.visitorKey));
const data = await hist.json();
if (!data.messages || !data.messages.length) {
offline("Ask about the three one-bedroom Whittier rentals on this page, the cities EquityPro serves, a tour, or how to reach the Whittier office. Answers come only from the notes on this page.");
} else {
log.replaceChildren(...data.messages.map((m) => bubble({ role: m.role, content: m.content, at: m.at })));
}
}
document.getElementById("eqp-launcher").addEventListener("click", () => { openHome(); dlg.showModal(); });
const openLink = document.getElementById("eqp-open");
if (openLink) openLink.addEventListener("click", (e) => { e.preventDefault(); openHome(); dlg.showModal(); });
document.getElementById("eqp-close").addEventListener("click", () => dlg.close());
document.getElementById("eqp-back").addEventListener("click", openHome);
dlg.addEventListener("close", () => { if (socket) { socket.close(); socket = null; } });
home.addEventListener("click", (e) => {
const btn = e.target.closest("[data-desk]");
if (!btn) return;
const desk = btn.getAttribute("data-desk");
if (desk === "specialist") startSpecialist();
else startDesk(desk);
});
box.addEventListener("input", () => {
if (!socket || socket.readyState !== 1) return;
socket.send(JSON.stringify({ type: "typing", on: true }));
clearTimeout(typer);
typer = setTimeout(() => socket && socket.readyState === 1 && socket.send(JSON.stringify({ type: "typing", on: false })), 1200);
});
document.getElementById("eqp-form").addEventListener("submit", async (e) => {
e.preventDefault();
const text = box.value.trim();
if (!text) return;
if (mode === "specialist") {
if (!origin || !session) return;
box.value = "";
const at = new Date().toISOString();
log.append(bubble({ role: "user", content: text, at: at }));
typing.hidden = false; typing.textContent = "Specialist is typing";
const res = await fetch(origin + "/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: session.visitorKey, text: text }) });
const data = await res.json();
typing.hidden = true;
if (!res.ok) { offline(data.error || "The specialist did not answer."); return; }
const last = (data.messages || []).filter((m) => m.role === "assistant").pop();
if (last) log.append(bubble(last));
log.scrollTop = log.scrollHeight;
return;
}
if (!socket || socket.readyState !== 1) { offline("Not connected."); return; }
socket.send(JSON.stringify({ type: "chat", text: text }));
socket.send(JSON.stringify({ type: "typing", on: false }));
box.value = "";
});
})();
  };
  const run = async () => {
    try {
      const [css, body] = await Promise.all([
        fetch(base + 'widget.css').then((r) => r.text()),
        fetch(base + 'widget-body.html').then((r) => r.text()),
      ]);
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
      const wrap = document.createElement('div');
      wrap.innerHTML = body;
      for (const n of [...wrap.childNodes]) document.body.appendChild(n);
      init();
    } catch (e) {
      console.error(e);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
