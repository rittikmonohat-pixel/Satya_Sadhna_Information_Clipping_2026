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

function supportsFileShare() {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    const probe = new File(["x"], "probe.txt", { type: "text/plain" });
    return navigator.canShare({ files: [probe] });
  } catch (e) { return false; }
}
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return true;
  // Touch + coarse pointer is a reliable proxy for "phone/tablet"
  return (
    (navigator.maxTouchPoints || 0) > 0 &&
    window.matchMedia &&
    window.matchMedia("(pointer: coarse)").matches
  );
}
const DONATION_SHARE_MODE =
  isMobileDevice() && supportsFileShare() ? "share" : "download";

const DOWNLOAD_ICON_SVG =
  '<svg class="share-wa-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path fill="currentColor" d="M12 3a1 1 0 0 1 1 1v9.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.4L11 13.6V4a1 1 0 0 1 1-1Zm-7 15a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z"/>' +
  "</svg>";

// Compose a donation-card image (centre label + QR + bank details) on a canvas.
async function composeDonationImage(card) {
  const centre = (card.dataset.centre || "Donation").trim();
  const imgEl = card.querySelector(".donation-card-body img");
  const p = card.querySelector(".donation-card-body p");
  if (!imgEl || !p) return null;

  const accountName = (p.querySelector("strong")?.textContent || "").trim();
  const html = p.innerHTML;
  const afterStrong = html.split(/<\/strong>/i)[1] || "";
  const lines = afterStrong
    .split(/<br\s*\/?\s*>/i)
    .map((s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Load QR image
  const qrImg = await new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = imgEl.src;
  });

  // Canvas layout (2:1.05 portrait-ish, generous padding)
  const W = 1400, H = 760;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // White card background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  // Subtle outer border
  ctx.strokeStyle = "#e8eef3";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // Centre label (amber, uppercase, tracked)
  ctx.font = "800 22px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#C89860";
  ctx.textBaseline = "alphabetic";
  // Letter-spacing trick by drawing char-by-char isn't necessary; spaces are enough visually.
  const label = centre.toUpperCase();
  ctx.fillText(label, 72, 90);

  // Divider line under label
  ctx.strokeStyle = "#e8eef3";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(72, 112);
  ctx.lineTo(W - 72, 112);
  ctx.stroke();

  // QR frame and image
  const qrSize = 420;
  const qrX = 88;
  const qrY = 170;
  ctx.fillStyle = "#fafbfc";
  ctx.strokeStyle = "#e8eef3";
  ctx.lineWidth = 1;
  const pad = 14;
  ctx.fillRect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2);
  ctx.strokeRect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // Bank details on the right
  const textX = qrX + qrSize + 90;
  let y = qrY + 36;

  // Account name (bold)
  ctx.font = "700 34px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#1E3A5F";
  ctx.fillText(accountName, textX, y);
  y += 52;

  // Detail lines (bold the part before ':' for A/C, IFSC, MICR etc.)
  lines.forEach((line) => {
    const m = line.match(/^([^:]+:)\s*(.+)$/);
    if (m) {
      ctx.font = "700 24px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#1E3A5F";
      const labelW = ctx.measureText(m[1] + " ").width;
      ctx.fillText(m[1], textX, y);
      ctx.font = "400 24px Inter, system-ui, sans-serif";
      ctx.fillText(" " + m[2], textX + ctx.measureText(m[1]).width, y);
    } else {
      ctx.font = "400 24px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#1E3A5F";
      ctx.fillText(line, textX, y);
    }
    y += 38;
  });

  // Footer
  ctx.font = "500 18px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#3D6488";
  ctx.fillText("Scan with any UPI app to donate  ·  80-G tax exempt", 72, H - 70);
  ctx.font = "600 17px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#1E3A5F";
  ctx.fillText("satya-sadhna-information-clipping.vercel.app", 72, H - 42);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
}

async function shareDonationCard(card) {
  const text = buildDonationShareText(card);
  const centre = (card.dataset.centre || "donation").replace(/\s+/g, "-");
  try {
    const blob = await composeDonationImage(card);
    if (!blob) return;
    const file = new File([blob], `${centre}-Donation-Details.jpg`, {
      type: "image/jpeg",
    });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        text,
        title: `Satya Sadhna — ${card.dataset.centre || ""}`,
      });
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
    console.warn("Share failed:", e);
  }
}

async function downloadDonationQR(card) {
  const blob = await composeDonationImage(card);
  if (!blob) return;
  const centre = (card.dataset.centre || "donation").replace(/\s+/g, "-");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${centre}-Donation-Details.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

document.querySelectorAll(".share-donation").forEach((btn) => {
  const card = btn.closest(".donation-card");
  const centreShort = (card?.dataset.centre || "").split(" ")[0]; // "Bikaner" / "Kolkata"
  if (DONATION_SHARE_MODE === "download") {
    btn.innerHTML = DOWNLOAD_ICON_SVG;
    btn.title = `Download ${centreShort} QR`;
    btn.setAttribute("aria-label", `Download ${centreShort} UPI QR code`);
    btn.classList.add("download-icon-only");
    // Move into the QR figure so it overlays the QR corner
    const figure = card?.querySelector(".donation-card-body figure");
    if (figure) figure.appendChild(btn);
    btn.addEventListener("click", () => downloadDonationQR(card));
  } else {
    btn.addEventListener("click", () => shareDonationCard(card));
  }
});

// ── Share online (Zoom) schedule ──────────────────────────────────────────────
function buildOnlineShareText() {
  const out = ["*Satya Sadhna — Online Sessions*", ""];

  // Zoom details FIRST
  const zoomBox = document.querySelector(".zoom-box");
  if (zoomBox) {
    out.push("*Zoom Details*");
    const cred = zoomBox.querySelector(".zoom-box-credentials");
    if (cred) {
      cred.innerHTML.split(/<br\s*\/?\s*>/i).forEach((seg) => {
        const text = seg.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        if (!text) return;
        const m = text.match(/^([^:]+):\s*(.+)$/);
        if (m) out.push(`${m[1].trim()}: *${m[2].trim()}*`);
        else out.push(text);
      });
    }
    const joinLink = zoomBox.querySelector(".zoom-cta")?.href;
    if (joinLink) out.push(`Join link: ${joinLink}`);
    out.push("");
    out.push("_Please join 5 minutes before scheduled time._");
    out.push("");
  }

  // Schedule (timings) after Zoom details — only the online grid (the one with the Zoom box)
  const onlineGrid = document.querySelector(".zoom-box")?.closest(".recurring-grid");
  const articles = onlineGrid ? onlineGrid.querySelectorAll(":scope > article") : [];
  articles.forEach((art) => {
    const h3 = art.querySelector("h3")?.textContent.trim();
    if (!h3 || h3.toLowerCase().includes("how to join")) return;
    out.push(`*${h3}*`);
    art.querySelectorAll("ul li").forEach((li) => {
      const strong = li.querySelector(".session-info strong")?.textContent.trim() || "";
      const span = li.querySelector(".session-info span")?.textContent.trim() || "";
      const bullet = span ? `• *${strong}* — ${span}` : `• *${strong}*`;
      out.push(bullet);
    });
    out.push("");
  });

  // Contacts last
  if (zoomBox) {
    const contacts = zoomBox.querySelectorAll(".zoom-contact-item");
    if (contacts.length) {
      out.push("*Need help?*");
      contacts.forEach((c) => {
        const label = c.querySelector(".zoom-contact-text span")?.textContent.trim();
        const value = c.querySelector(".zoom-contact-text a")?.textContent.trim();
        if (label && value) out.push(`${label}: ${value}`);
      });
      out.push("");
    }
  }

  out.push("More info:");
  out.push("https://satya-sadhna-information-clipping.vercel.app");
  return out.join("\n");
}

async function shareOnlineSchedule() {
  const text = buildOnlineShareText();
  // Text-only on both mobile and web (Zoom join link is in the text).
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

document.querySelectorAll(".share-online").forEach((btn) => {
  btn.addEventListener("click", shareOnlineSchedule);
});

// ── Share centre (map + address + contacts) ───────────────────────────────────
function buildCentreShareText(card) {
  const centreName = card.dataset.centre || (card.querySelector("h3")?.textContent || "").trim();
  const city = (card.querySelector(".city")?.textContent || "").trim();
  const mapUrl = card.dataset.mapUrl || "";

  const addressEl = card.querySelector(".centre-address");
  const addressLines = addressEl
    ? addressEl.innerHTML
        .split(/<br\s*\/?\s*>/i)
        .map((s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
    : [];

  const phones = Array.from(card.querySelectorAll(".centre-contact a")).map((a) =>
    a.textContent.trim(),
  );

  const out = [`*Satya Sadhna Kendra — ${centreName}*`];
  if (city) out.push(city);
  out.push("");
  if (addressLines.length) {
    out.push("*Address:*");
    addressLines.forEach((l) => out.push(l));
    out.push("");
  }
  if (phones.length) {
    out.push("*Contact:*");
    phones.forEach((p) => out.push(p));
    out.push("");
  }
  if (mapUrl) {
    out.push("*Directions:*");
    out.push(mapUrl);
    out.push("");
  }
  out.push("More info:");
  out.push("https://satya-sadhna-information-clipping.vercel.app");
  return out.join("\n");
}

async function shareCentre(card) {
  const text = buildCentreShareText(card);
  // Same on mobile and web: text-only WhatsApp share (the maps link in the
  // text opens Google Maps directly; QR is unnecessary).
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

document.querySelectorAll(".share-centre").forEach((btn) => {
  btn.addEventListener("click", () => {
    const card = btn.closest(".centre-card");
    if (card) shareCentre(card);
  });
});

// ── Share About (with video link) ─────────────────────────────────────────────
function buildAboutShareText() {
  const out = ["*About Satya Sadhna*", ""];

  const lead = document.querySelector(".about-lead")?.textContent.trim();
  if (lead) {
    out.push(lead);
    out.push("");
  }

  // YouTube link (rebuild from the iframe's src)
  const iframe = document.querySelector(".about-video iframe");
  if (iframe) {
    const src = iframe.getAttribute("src") || "";
    const m = src.match(/embed\/([^?]+)/);
    if (m) {
      out.push("A few words from the Acharya Shri Jin Chandra Suriji:");
      out.push(`https://youtu.be/${m[1]}`);
      out.push("");
    }
  }

  out.push("More info:");
  out.push("https://satya-sadhna-information-clipping.vercel.app#practice");
  return out.join("\n");
}

document.querySelectorAll(".share-about").forEach((btn) => {
  btn.addEventListener("click", () => {
    const text = buildAboutShareText();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  });
});

// ── Share social links ────────────────────────────────────────────────────────
function buildSocialShareText() {
  const out = ["*Satya Sadhna — Connect With Us*", ""];
  document.querySelectorAll(".social-combined .social-row").forEach((row) => {
    const label = (row.querySelector(".social-row-label strong")?.textContent || "").trim();
    const href = row.getAttribute("href") || "";
    if (label && href) {
      out.push(`*${label}:*`);
      out.push(href);
      out.push("");
    }
  });
  out.push("More info:");
  out.push("https://satya-sadhna-information-clipping.vercel.app#connect");
  return out.join("\n");
}

document.querySelectorAll(".share-social").forEach((btn) => {
  btn.addEventListener("click", () => {
    const text = buildSocialShareText();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  });
});
