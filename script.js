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

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
// Returns the UTC millisecond cutoff at which a course should disappear:
// 17:00 IST (= 11:30 UTC) on the course start date.
function courseCutoffUTC(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split(/\s*[–—-]\s*/);
  const left = (parts[0] || "").trim();
  const right = (parts[1] || "").trim();
  const lt = left.split(/\s+/);
  let day, monStr, year;
  if (lt.length >= 3) { [day, monStr, year] = lt; }
  else if (lt.length === 2) {
    [day, monStr] = lt;
    const rt = right.split(/\s+/);
    year = rt[rt.length - 1];
  } else return null;
  const monIdx = MONTHS[(monStr || "").slice(0, 3).toLowerCase()];
  const d = parseInt(day, 10), y = parseInt(year, 10);
  if (isNaN(d) || monIdx === undefined || isNaN(y)) return null;
  return Date.UTC(y, monIdx, d, 11, 30); // 17:00 IST
}
function isCoursePast(dateStr) {
  const cutoff = courseCutoffUTC(dateStr);
  if (cutoff == null) return false;
  return Date.now() > cutoff;
}

function filterPastStaticRows() {
  document.querySelectorAll(".schedule-list .schedule-row").forEach((row) => {
    const d = (row.querySelector(".sr-date")?.textContent || "").trim();
    if (isCoursePast(d)) row.remove();
  });
}
filterPastStaticRows();

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
    const dataRows = rows.slice(1).filter(([date]) => !isCoursePast(date));

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

// ── Apply modal ───────────────────────────────────────────────────────────────
const applyModal = document.getElementById("applyModal");
const applyCourseSelect = document.getElementById("applyCourse");
const applyNoteBox = document.getElementById("applyNote");
const applyForm = document.getElementById("applyForm");

function isWithinApplyWindow(dateStr) {
  const cutoff = courseCutoffUTC(dateStr);
  if (cutoff == null) return false;
  const now = Date.now();
  const eightWeeks = 56 * 24 * 3600 * 1000;
  return cutoff > now && cutoff <= now + eightWeeks;
}

function populateApplyCourses() {
  if (!applyCourseSelect) return;
  const rows = document.querySelectorAll(".schedule-list .schedule-row");
  applyCourseSelect.innerHTML = '<option value="">Select a course…</option>';
  let count = 0;
  rows.forEach((row) => {
    const date = (row.querySelector(".sr-date")?.textContent || "").trim();
    if (!isWithinApplyWindow(date)) return;
    count++;
    const courseEl = row.querySelector(".sr-course");
    let note = "";
    let courseName = "";
    if (courseEl) {
      const noteEl = courseEl.querySelector(".course-note");
      note = noteEl ? noteEl.textContent.trim() : "";
      courseName = Array.from(courseEl.childNodes)
        .filter((n) => !(n.nodeType === 1 && n.classList.contains("course-note")))
        .map((n) => n.textContent)
        .join("")
        .trim();
    }
    const loc = (row.querySelector(".sr-loc")?.textContent || "").trim();
    const opt = document.createElement("option");
    opt.value = `${date} — ${courseName} — ${loc}`;
    opt.textContent = `${date} · ${courseName} · ${loc}`;
    if (note) opt.dataset.note = note;
    applyCourseSelect.appendChild(opt);
  });
  if (count === 0) {
    applyCourseSelect.innerHTML = '<option value="">No courses currently open for application</option>';
    applyCourseSelect.disabled = true;
  } else {
    applyCourseSelect.disabled = false;
  }
}

function openApplyModal(e) {
  if (e) e.preventDefault();
  if (!applyModal) return;
  populateApplyCourses();
  if (applyNoteBox) { applyNoteBox.hidden = true; applyNoteBox.textContent = ""; }
  applyModal.classList.add("is-open");
  applyModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeApplyModal() {
  if (!applyModal) return;
  applyModal.classList.remove("is-open");
  applyModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

document.querySelectorAll(".apply-trigger").forEach((el) =>
  el.addEventListener("click", openApplyModal),
);
applyModal?.querySelectorAll("[data-close]").forEach((el) =>
  el.addEventListener("click", closeApplyModal),
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && applyModal?.classList.contains("is-open")) closeApplyModal();
});

applyCourseSelect?.addEventListener("change", () => {
  const opt = applyCourseSelect.options[applyCourseSelect.selectedIndex];
  const note = opt?.dataset.note || "";
  if (!applyNoteBox) return;
  if (note) {
    applyNoteBox.textContent = "✦ " + note;
    applyNoteBox.hidden = false;
  } else {
    applyNoteBox.hidden = true;
    applyNoteBox.textContent = "";
  }
});

applyForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!applyForm.reportValidity()) return;
  const fd = new FormData(applyForm);
  const msg =
    `Hello, I'd like to apply for a Satya Sadhna course.\n\n` +
    `Name: *${fd.get("name")}*\n` +
    `Age: *${fd.get("age")}*\n` +
    `Gender: *${fd.get("gender")}*\n` +
    `Address: *${fd.get("address")}*\n` +
    `Course: *${fd.get("course")}*\n\n` +
    `Please share the next steps. Thank you.`;
  const url = `https://wa.me/919836488880?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank", "noopener");
  closeApplyModal();
});

// ── Share schedule on WhatsApp ────────────────────────────────────────────────
function buildScheduleShareText() {
  const rows = document.querySelectorAll(".schedule-list .schedule-row");
  if (!rows.length) return "";
  const lines = ["*Satya Sadhna — Course Schedule*", ""];
  rows.forEach((row) => {
    const date = (row.querySelector(".sr-date")?.textContent || "").trim();
    const courseEl = row.querySelector(".sr-course");
    let course = "";
    let note = "";
    if (courseEl) {
      const noteEl = courseEl.querySelector(".course-note");
      note = noteEl ? noteEl.textContent.trim() : "";
      course = Array.from(courseEl.childNodes)
        .filter((n) => !(n.nodeType === 1 && n.classList.contains("course-note")))
        .map((n) => n.textContent)
        .join("")
        .trim();
    }
    const loc = (row.querySelector(".sr-loc")?.textContent || "").trim();
    lines.push(`• *${date}*`);
    lines.push(`  ${course}`);
    lines.push(`  ${loc}`);
    if (note) lines.push(`  _${note}_`);
    lines.push("");
  });
  lines.push("Apply & full details:");
  lines.push("https://satya-sadhna-information-clipping.vercel.app");
  return lines.join("\n");
}

document.querySelectorAll(".share-schedule").forEach((btn) => {
  btn.addEventListener("click", () => {
    const text = buildScheduleShareText();
    if (!text) return;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  });
});

// ── Share donation details on WhatsApp ────────────────────────────────────────
function buildDonationShareText(card) {
  const centre = card.dataset.centre || (card.querySelector("h4")?.textContent || "").trim();
  const p = card.querySelector(".donation-card-body p");
  if (!p) return "";
  const accountName = (p.querySelector("strong")?.textContent || "").trim();
  // Pull the text after the strong as the address/account block, splitting on <br>
  const html = p.innerHTML;
  const afterStrong = html.split(/<\/strong>/i)[1] || "";
  const lines = afterStrong
    .split(/<br\s*\/?\s*>/i)
    .map((s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const out = [
    `*Satya Sadhna — ${centre}*`,
    "Donations support the running of the centre and the spread of the practice.",
    "",
    `*Account Name:* ${accountName}`,
  ];
  lines.forEach((l) => {
    const m = l.match(/^([^:]+):\s*(.+)$/);
    if (m) out.push(`*${m[1].trim()}:* ${m[2].trim()}`);
    else out.push(l);
  });
  out.push("");
  out.push("_All donations qualify for 80-G tax deduction._");
  out.push("");
  out.push("Full details & UPI QR:");
  out.push("https://satya-sadhna-information-clipping.vercel.app#support");
  return out.join("\n");
}

document.querySelectorAll(".share-donation").forEach((btn) => {
  btn.addEventListener("click", () => {
    const card = btn.closest(".donation-card");
    if (!card) return;
    const text = buildDonationShareText(card);
    if (!text) return;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  });
});
