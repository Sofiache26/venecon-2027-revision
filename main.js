// Venecon 2027 — interactions + 3D terrain hero
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

/* ── banner: El Ávila in 3D from real elevation data. assets/avila-height.bin = 384×192 Uint16 metres,
      rows north→south (lat 10.63…10.46), columns west→east (lon -67.02…-66.68); AWS Terrain Tiles (SRTM, public domain) ── */
if (!document.documentElement.classList.contains("shot")) initTerrain().catch(() => { /* no WebGL or no data → the CSS background stays */ });

async function initTerrain() {
  const canvas = document.getElementById("terrain");
  const [THREE, buf] = await Promise.all([
    import("three"),
    fetch("assets/avila-height.bin").then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }),
  ]);
  const DW = 384, DH = 192, dem = new Uint16Array(buf);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  const small = innerWidth < 760;
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 220);

  // 150 × 76 world units ≈ 37 × 19 km, seen from Caracas (south) looking north; heights ×2.4 so the ridge reads
  const SX = 150, SZ = 76, M2U = (SX / 37200) * 2.4;
  const geo = new THREE.PlaneGeometry(SX, SZ, small ? 191 : 383, small ? 95 : 191);
  geo.rotateX(-Math.PI / 2);                       // plane top (north) → far side, z = -SZ/2
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) / SX + 0.5) * (DW - 1), v = (pos.getZ(i) / SZ + 0.5) * (DH - 1);
    const x0 = Math.min(Math.floor(u), DW - 2), y0 = Math.min(Math.floor(v), DH - 2), fx = u - x0, fy = v - y0;
    const a = dem[y0 * DW + x0], b = dem[y0 * DW + x0 + 1], c = dem[(y0 + 1) * DW + x0], d = dem[(y0 + 1) * DW + x0 + 1];
    pos.setY(i, ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy) * M2U);
  }
  const uniforms = {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2() },
    uMax: { value: 2730 * M2U },
    uC1: { value: new THREE.Color("#5e3a8f") }, uC2: { value: new THREE.Color("#d3263a") },
    uC3: { value: new THREE.Color("#e6862f") }, uC4: { value: new THREE.Color("#f2b43c") },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      uniform vec2 uMouse;
      varying float vH; varying float vDepth;
      void main(){
        vec3 p = position;
        float d = length(p.xz - vec2(uMouse.x * 40., 8. - uMouse.y * 12.));
        p.y += 1.2 * exp(-d * d / 70.);                // gentle swell under the cursor
        vH = p.y;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uC1, uC2, uC3, uC4; uniform float uTime, uMax;
      varying float vH; varying float vDepth;
      vec3 ramp(float t){ t = clamp(t, 0., 1.);
        return t < .33 ? mix(uC1, uC2, t / .33) : t < .66 ? mix(uC2, uC3, (t - .33) / .33) : mix(uC3, uC4, (t - .66) / .34); }
      void main(){
        float k = vH * 2.2;                            // a contour every ~45 m
        float d1 = min(fract(k), 1. - fract(k));
        float line = 1. - smoothstep(0., fwidth(k) * 1.2, d1);
        float k5 = k / 5.;
        float d5 = min(fract(k5), 1. - fract(k5));
        float major = 1. - smoothstep(0., fwidth(k5) * 1.8, d5);
        float pulse = .5 + .5 * sin(vH * .7 - uTime * .9);   // glow travelling up the slopes
        float fog = smoothstep(120., 22., vDepth);
        float near = smoothstep(2., 10., vDepth);
        float land = step(.08, vH);                    // the Caribbean stays dark
        float a = (line * (.4 + .5 * pulse) + major * .5) * fog * near * land;
        gl_FragColor = vec4(ramp(vH / uMax) * (1. + major * .7), a);
      }`,
  });
  scene.add(new THREE.Mesh(geo, mat));

  // floating particles for depth
  const n = small ? 260 : 520, dpos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { dpos[i * 3] = (Math.random() - .5) * 130; dpos[i * 3 + 1] = 4 + Math.random() * 22; dpos[i * 3 + 2] = -40 + Math.random() * 70; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
  const dots = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xf2b43c, size: small ? .09 : .07, transparent: true, opacity: .55, depthWrite: false }));
  scene.add(dots);

  const size = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return; // hidden (a screen is open) — keep the last good size
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 760 ? 62 : 48;
    camera.updateProjectionMatrix();
  };
  size();

  const mouse = new THREE.Vector2(), target2 = new THREE.Vector2();
  addEventListener("pointermove", (e) => target2.set(e.clientX / innerWidth - .5, .5 - e.clientY / innerHeight), { passive: true });

  let visible = true, running = false, last = performance.now(), time = 0;
  const start = () => { if (running || reduced) return; running = true; last = performance.now(); requestAnimationFrame(loop); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(canvas);
  const look = new THREE.Vector3(0, 16, -10);
  function frame(dt) {
    time += dt;
    mouse.lerp(target2, .04);
    uniforms.uTime.value = time;
    uniforms.uMouse.value.copy(mouse);
    camera.position.set(mouse.x * 4 + Math.sin(time * .07) * 3, 11 + mouse.y * 1.5, 30);
    camera.lookAt(look);
    dots.rotation.y = time * .01;
    dots.position.y = Math.sin(time * .3) * .3;
    renderer.render(scene, camera);
  }
  function loop(now) {
    if (!visible) { running = false; return; }
    const dt = Math.min((now - last) / 1000, .05); last = now;
    frame(dt);
    requestAnimationFrame(loop);
  }
  // a resize clears the canvas; with reduced motion there is no loop to repaint it
  new ResizeObserver(() => { size(); if (reduced) frame(0); }).observe(canvas);
  if (reduced) frame(0); else start();
  canvas.dataset.terrain = "avila";
  canvas.classList.add("is-ready");
}

/* ── language: English as authored ↔ Spanish from #i18n-es (inside index.html, so StatiCrypt encrypts it).
      Order: ?lang=es|en, then the saved choice, then the browser language. ── */
const ES = JSON.parse(document.getElementById("i18n-es").textContent);
const swaps = [];
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
for (let n; (n = walker.nextNode()); ) {
  const k = n.nodeValue.trim();
  if (k in ES) { const en = n.nodeValue, es = en.replace(k, ES[k]); swaps.push((l) => { n.nodeValue = l === "es" ? es : en; }); }
}
for (const el of document.querySelectorAll("[alt],[aria-label],[placeholder],[title]")) for (const a of ["alt", "aria-label", "placeholder", "title"]) {
  const en = el.getAttribute(a);
  if (en && en in ES) swaps.push((l) => el.setAttribute(a, l === "es" ? ES[en] : en));
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
  document.querySelectorAll(".tabbar a, #site-nav a, .foot__nav a").forEach((a) => {
    if (a.getAttribute("href") === (screen ? "#" + screen.id : "#")) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  retitle(screen);
  scrollTo(0, 0);
  if (screen) screen.querySelector(".screen__title").focus({ preventScroll: true });
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
