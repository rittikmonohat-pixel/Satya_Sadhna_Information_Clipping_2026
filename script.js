const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const progressBar = document.querySelector(".scroll-progress");

document.body.classList.add("is-loaded");

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    document.body.classList.toggle("nav-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  siteNav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      siteNav.classList.remove("is-open");
      document.body.classList.remove("nav-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

const revealTargets = [
  ...document.querySelectorAll(".section-shell, .image-band, .visual-breath, .route-strip"),
];

const staggerTargets = document.querySelectorAll(
  ".pillar-grid, .centre-grid, .events-grid, .path-list, tbody, .recurring-grid, .footer-grid, .hero-metrics",
);

revealTargets.forEach((target) => target.classList.add("reveal"));
staggerTargets.forEach((target) => target.classList.add("stagger"));

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
);

[...revealTargets, ...staggerTargets].forEach((target) => revealObserver.observe(target));

const navLinks = [...document.querySelectorAll(".site-nav a")];
const navSections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
      });
    });
  },
  { threshold: 0.28, rootMargin: "-20% 0px -55% 0px" },
);

navSections.forEach((section) => navObserver.observe(section));

const pathList = document.querySelector(".path-list");
const heroVisual = document.querySelector(".hero-visual");

const updateScrollMotion = () => {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? window.scrollY / scrollable : 0;

  if (progressBar) {
    progressBar.style.transform = `scaleX(${Math.min(Math.max(progress, 0), 1)})`;
  }

  if (pathList) {
    const rect = pathList.getBoundingClientRect();
    const lineProgress = (window.innerHeight * 0.78 - rect.top) / Math.max(rect.height, 1);
    pathList.style.setProperty("--path-progress", String(Math.min(Math.max(lineProgress, 0), 1)));
  }
};

let ticking = false;
window.addEventListener(
  "scroll",
  () => {
    if (ticking) return;
    window.requestAnimationFrame(() => {
      updateScrollMotion();
      ticking = false;
    });
    ticking = true;
  },
  { passive: true },
);

window.addEventListener("resize", updateScrollMotion);
updateScrollMotion();

if (heroVisual && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  heroVisual.addEventListener("pointermove", (event) => {
    const rect = heroVisual.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    heroVisual.style.transform = `rotateX(${y * -3}deg) rotateY(${x * 4}deg)`;
  });

  heroVisual.addEventListener("pointerleave", () => {
    heroVisual.style.transform = "";
  });
}

// ── Live schedule from Google Sheet ─────────────────────────────────────────
// To enable: publish your Google Sheet to web as CSV, then paste the URL below.
// (Google Sheets → File → Share → Publish to web → CSV → copy link)
// Expected columns (with a header row): Dates | Course | Location | Note (optional)
// If empty or fetch fails, the static rows already in the HTML stay as fallback.
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQutDtPOWq6ED4MA00ipySvCv8SHN4fbnQJ5Q5o2V6NxxWuvKzc7zeby4s1bsIKuXIG4uJptEc90nJm/pub?output=csv";

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(cell); cell = ""; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== '\r') cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c && c.trim()));
}

function locClass(loc) {
  const l = (loc || "").toLowerCase();
  if (l.includes("kheyada") || l.includes("kolkata")) return "loc-kheyada";
  if (l.includes("nal") || l.includes("bikaner")) return "loc-nal";
  return "loc-both";
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]),
  );
}

async function loadSchedule() {
  if (!SHEET_CSV_URL) return;
  const list = document.querySelector(".schedule-list");
  if (!list) return;
  try {
    const url = `${SHEET_CSV_URL}${SHEET_CSV_URL.includes("?") ? "&" : "?"}_=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const rows = parseCSV(csv);
    if (rows.length < 2) return;
    const dataRows = rows.slice(1);

    list.querySelectorAll(".schedule-row").forEach((r) => r.remove());

    const frag = document.createDocumentFragment();
    dataRows.forEach(([date, course, location, note]) => {
      const row = document.createElement("div");
      row.className = "schedule-row";
      const noteHtml = note && note.trim()
        ? `<span class="course-note">${escapeHtml(note.trim())}</span>` : "";
      row.innerHTML =
        `<div class="sr-date">${escapeHtml(date)}</div>` +
        `<div class="sr-course">${escapeHtml(course)}${noteHtml}</div>` +
        `<div class="sr-loc"><span class="loc-badge ${locClass(location)}">${escapeHtml(location)}</span></div>`;
      frag.appendChild(row);
    });
    list.appendChild(frag);
  } catch (e) {
    console.warn("Schedule sheet fetch failed, using static fallback:", e);
  }
}

loadSchedule();

document.querySelectorAll(".video-trigger").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    const videoId = trigger.getAttribute("data-video");
    if (!videoId) return;

    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
    iframe.title = "A few words from the teacher";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    trigger.replaceWith(iframe);
  });
});
