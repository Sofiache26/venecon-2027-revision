// Venecon 2027 — interactions: menu, logo banner, countdown, language, routes, planner
// ?shot → static full-page capture for design review
if (location.search.includes("shot")) document.documentElement.classList.add("shot");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── reveal on scroll (staggered per parent) ── */
const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
document.querySelectorAll(".reveal").forEach((el) => {
  const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
  el.style.setProperty("--d", `${Math.min(sibs.indexOf(el), 6) * 0.07}s`);
  io.observe(el);
});

/* ── countdown to opening day (Caracas, UTC-4) ── */
const target = new Date("2027-06-15T09:00:00-04:00").getTime();
const pad = (n) => String(n).padStart(2, "0");
const tick = () => {
  const s = Math.max(0, Math.floor((target - Date.now()) / 1000));
  document.getElementById("cd-d").textContent = Math.floor(s / 86400);
  document.getElementById("cd-h").textContent = pad(Math.floor(s / 3600) % 24);
  document.getElementById("cd-m").textContent = pad(Math.floor(s / 60) % 60);
  document.getElementById("cd-s").textContent = pad(s % 60);
};
tick(); setInterval(tick, 1000);

/* ── menu (phones / narrow screens): one button opens the full list of sections ── */
const menuBtn = document.querySelector(".menu-btn");
const setMenu = (open) => { document.body.classList.toggle("menu-open", open); menuBtn.setAttribute("aria-expanded", String(open)); };
menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("menu-open")) { setMenu(false); menuBtn.focus(); } });

/* ── menu dropdowns (desktop): click or hover opens; Escape, outside click or navigating closes ── */
const navBtns = [...document.querySelectorAll(".nav__btn")];
const closeSubs = (except) => navBtns.forEach((b) => { if (b !== except) b.setAttribute("aria-expanded", "false"); });
navBtns.forEach((b) => b.addEventListener("click", () => { const open = b.getAttribute("aria-expanded") !== "true"; closeSubs(b); b.setAttribute("aria-expanded", String(open)); }));
document.addEventListener("click", (e) => { if (!e.target.closest(".nav__group")) closeSubs(); });
document.addEventListener("keydown", (e) => {
  const open = navBtns.find((b) => b.getAttribute("aria-expanded") === "true");
  if (e.key === "Escape" && open) { closeSubs(); open.focus(); }
});

/* ── logo banner on the home page: hosts + Diamond/Titanium/Platinum sponsors, taken from the Current Sponsors screen
      so a sponsor is added in one place. It scrolls only when the logos don't fit (never with reduced motion). ── */
const marquee = document.querySelector(".home .marquee");
if (marquee) {
  const list = marquee.querySelector(".marquee__list");
  const sources = document.querySelectorAll('#partners [data-group="hosts"] .logo-card, #partners .tier[data-tier="diamond"] .logo-card, #partners .tier[data-tier="titanium"] .logo-card, #partners .tier[data-tier="platinum"] .logo-card');
  sources.forEach((card) => {
    const img = card.querySelector("img");
    if (!img) return;
    const li = document.createElement("li");
    const box = card.href ? Object.assign(document.createElement("a"), { href: card.href, target: "_blank", rel: "noopener" }) : document.createElement("span");
    box.className = "marquee__item" + (card.classList.contains("logo-card--dark") ? " marquee__item--dark" : "");
    box.append(img.cloneNode());
    li.append(box);
    list.append(li);
  });
}
function layoutMarquee() {
  if (!marquee) return;
  const box = marquee.querySelector(".marquee__box"), track = marquee.querySelector(".marquee__track"), list = track.querySelector(".marquee__list");
  track.querySelectorAll('.marquee__list[aria-hidden="true"]').forEach((c) => c.remove());
  if (!box.clientWidth) return;                               // home hidden: lay out when it shows again
  const scroll = list.scrollWidth > box.clientWidth && !reduced;
  marquee.classList.toggle("is-scrolling", scroll);
  if (scroll) {
    const copy = list.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    copy.querySelectorAll("a").forEach((a) => { a.tabIndex = -1; });
    track.append(copy);
    track.style.setProperty("--dur", `${Math.round(list.scrollWidth / 45)}s`);
  }
}
let marqueeTimer;
addEventListener("resize", () => { clearTimeout(marqueeTimer); marqueeTimer = setTimeout(layoutMarquee, 150); });
addEventListener("load", layoutMarquee);

/* ── language: English as authored ↔ Spanish from #i18n-es (inside index.html, so StatiCrypt encrypts it).
      Order: ?lang=es|en, then the saved choice, then the browser language. ── */
const ES = JSON.parse(document.getElementById("i18n-es").textContent);
const swaps = [];
// the editable content (content.json via tools/render.py) carries its own Spanish: data-es, data-es-alt, data-es-aria-label
for (const el of document.querySelectorAll("[data-es]")) { const en = el.textContent, es = el.dataset.es; swaps.push((l) => { el.textContent = l === "es" ? es : en; }); }
for (const a of ["alt", "aria-label"]) for (const el of document.querySelectorAll(`[data-es-${a}]`)) {
  const en = el.getAttribute(a), es = el.getAttribute(`data-es-${a}`);
  swaps.push((l) => el.setAttribute(a, l === "es" ? es : en));
}
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
for (let n; (n = walker.nextNode()); ) {
  const k = n.nodeValue.trim();
  if (k in ES && !n.parentElement.closest("[data-es]")) { const en = n.nodeValue, es = en.replace(k, ES[k]); swaps.push((l) => { n.nodeValue = l === "es" ? es : en; }); }
}
for (const el of document.querySelectorAll("[alt],[aria-label],[placeholder],[title]")) for (const a of ["alt", "aria-label", "placeholder", "title"]) {
  const en = el.getAttribute(a);
  if (en && en in ES && !el.hasAttribute(`data-es-${a}`)) swaps.push((l) => el.setAttribute(a, l === "es" ? ES[en] : en));
}
const saved = { get() { try { return localStorage.getItem("lang"); } catch { return null; } }, set(v) { try { localStorage.setItem("lang", v); } catch { /* private mode */ } } };
let lang = "en";
const tr = (s) => (lang === "es" && ES[s]) || s;
function setLang(l) { lang = l; swaps.forEach((f) => f(l)); document.documentElement.lang = l; }
const asked = new URLSearchParams(location.search).get("lang");
setLang(asked === "es" || asked === "en" ? asked : saved.get() || (navigator.language.startsWith("es") ? "es" : "en"));
document.querySelector(".lang-btn").addEventListener("click", () => { setLang(lang === "es" ? "en" : "es"); saved.set(lang); retitle(); buildCal(); });

/* ── routes: #id shows that .screen (CSS :target); this keeps scroll, tab, title and focus in sync ── */
const HOME_TITLE = document.title;
const currentScreen = () => {
  const el = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  return el && el.classList.contains("screen") ? el : null;
};
const retitle = (screen = currentScreen()) => { document.title = screen ? `${tr(screen.dataset.title)} · Venecon 2027` : tr(HOME_TITLE); };
function route() {
  const screen = currentScreen();
  setMenu(false);
  closeSubs();
  document.querySelectorAll(".tabbar a, #site-nav a, .foot__nav a").forEach((a) => {
    if (a.getAttribute("href") === (screen ? "#" + screen.id : "#")) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  retitle(screen);
  scrollTo(0, 0);
  if (screen) screen.querySelector(".screen__title").focus({ preventScroll: true });
  else layoutMarquee();
}
addEventListener("hashchange", route);
route();
// on a deep link the browser jumps to #fragment and applies :target after our first route(); run it again once loaded
addEventListener("load", route);

/* ── planner (Agenda): day chips, "My agenda" saved in this browser, calendar links ── */
const planItems = [...document.querySelectorAll(".plan__item")];
const planChips = [...document.querySelectorAll("#agenda .chip")];
const planEmpty = document.getElementById("plan-empty");
const planStore = {
  get() { try { return new Set(JSON.parse(localStorage.getItem("venecon-plan") || "[]")); } catch { return new Set(); } },
  set(v) { try { localStorage.setItem("venecon-plan", JSON.stringify([...v])); } catch { /* private mode */ } },
};
const planSaved = planStore.get();
let planDay = "all";
function showPlan() {
  planItems.forEach((li) => { li.hidden = planDay === "saved" ? !planSaved.has(li.id) : planDay !== "all" && li.dataset.day !== planDay; });
  planChips.forEach((c) => c.setAttribute("aria-pressed", c.dataset.day === planDay));
  planEmpty.hidden = !(planDay === "saved" && !planSaved.size);
  document.querySelectorAll(".plan__head").forEach((h) => { h.hidden = !planItems.some((li) => !li.hidden && li.dataset.day === h.dataset.day); });
}
planChips.forEach((c) => c.addEventListener("click", () => { planDay = c.dataset.day; showPlan(); }));
planItems.forEach((li) => {
  const btn = li.querySelector(".save");
  btn.setAttribute("aria-pressed", planSaved.has(li.id));
  btn.addEventListener("click", () => {
    if (planSaved.has(li.id)) planSaved.delete(li.id); else planSaved.add(li.id);
    btn.setAttribute("aria-pressed", planSaved.has(li.id));
    planStore.set(planSaved);
    showPlan();
  });
});
// all-day events while times are to be confirmed; texts come from the page, so they follow the language
function buildCal() {
  const esc = (t) => t.replace(/[\\,;]/g, (m) => "\\" + m);
  planItems.forEach((li) => {
    const d = li.dataset.date.replaceAll("-", ""), next = String(Number(d) + 1);
    const title = `${li.querySelector("h3").textContent} · Venecon 2027`;
    const where = li.querySelector(".plan__where").textContent, note = li.querySelector(".plan__time").textContent;
    li.querySelector(".cal-g").href = "https://calendar.google.com/calendar/render?" +
      new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${d}/${next}`, location: where, details: note });
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Venecon//Venecon 2027//EN", "BEGIN:VEVENT", `UID:${li.id}@venecon.org`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d+/g, "")}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`,
      `SUMMARY:${esc(title)}`, `LOCATION:${esc(where)}`, `DESCRIPTION:${esc(note)}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    li.querySelector(".cal-ics").href = "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
  });
}
showPlan();
buildCal();

/* ── ?selftest → in-page checks (tests/ is never published) ── */
if (location.search.includes("selftest")) addEventListener("load", () => import("./tests/selftest.js"));
