// One consistent icon set (Lucide, https://lucide.dev) used everywhere in
// the app, inlined as raw SVG markup rather than loaded from a CDN - this
// app has zero external script dependencies and a CSP that only allows
// same-origin scripts, so inlining avoids adding a new supply-chain
// dependency and a CSP change for a handful of icons. Each entry is the
// exact <path>/<line> content Lucide ships for that icon, at their
// standard 24x24 viewBox/2px stroke - the wrapping <svg> attributes are
// applied by iconSvg() below so every icon renders identically.
const ICONS = {
  menu: '<line x1="4" x2="20" y1="6" y2="6"></line><line x1="4" x2="20" y1="12" y2="12"></line><line x1="4" x2="20" y1="18" y2="18"></line>',
  x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
  calendarDays: '<path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path>',
  gauge: '<path d="m12 14 4-4"></path><path d="M3.34 19a10 10 0 1 1 17.32 0"></path>',
};

function iconSvg(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const startYear = 2026, startMonth = 6;  // July 2026 (0-indexed)
const endYear = 2027, endMonth = 9;      // October 2027

// PALETTE is defined in data.js; EVENTS, TRAINING_BLOCKS_RAW and WORKOUTS
// are fetched from Supabase by supabase.js's loadTrainingData(), assigned
// once init() runs below. Declared here (rather than left implicitly
// global) so every function in this file that closes over them - written
// back when data.js held them as plain consts - keeps working unchanged.
let EVENTS, TRAINING_BLOCKS_RAW, WORKOUTS;

let eventsByDate = {};
let TRAINING_BLOCKS = [];

// Logged-workout state now lives in Supabase (training_logged_workouts),
// not localStorage, so it syncs across devices. loggedDates is a local
// cache populated at startup; toggleLogged writes through to Supabase and
// updates the cache optimistically, then reverts on failure so the UI
// never drifts out of sync with what's actually stored.
let loggedDates = new Set();

async function toggleLogged(isoDate) {
  const wasLogged = loggedDates.has(isoDate);
  if (wasLogged) loggedDates.delete(isoDate);
  else loggedDates.add(isoDate);

  try {
    if (wasLogged) await deleteLoggedDate(isoDate);
    else await insertLoggedDate(isoDate);
  } catch (err) {
    // Revert the optimistic update if the write didn't actually happen,
    // so a dropped connection can't silently desync local state from
    // Supabase.
    if (wasLogged) loggedDates.add(isoDate);
    else loggedDates.delete(isoDate);
    throw err;
  }
}

function trainingBlockFor(isoDate) {
  for (const block of TRAINING_BLOCKS) {
    if (isoDate >= block.start && isoDate <= block.end) return block;
  }
  return null;
}

function pad2(n) { return String(n).padStart(2, "0"); }

function parseIso(isoDate) {
  const [yy, mm, dd] = isoDate.split("-").map(Number);
  return new Date(yy, mm - 1, dd);
}

function formatLongDate(isoDate) {
  const d = parseIso(isoDate);
  return `${dayNames[d.getDay() === 0 ? 6 : d.getDay() - 1]}, ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

// Which training week `endIso` falls in, counting from `startIso` as
// week 1. Uses whole elapsed days (floored), not a rounded average, so
// every day in the same 7-day span reports the same week number -
// Math.round previously bumped anything past the midpoint of week 1
// straight to "week 2".
function weeksBetween(startIso, endIso) {
  const ms = parseIso(endIso) - parseIso(startIso);
  const days = Math.round(ms / (24 * 60 * 60 * 1000)); // whole days, DST-safe
  return Math.floor(days / 7) + 1;
}

// Escapes arbitrary text before it's interpolated into innerHTML, via a
// detached-element textContent round-trip (no manual char-replacing to
// get wrong).
function esc(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}

// --- Pace-benchmark calculator (Paces tab) ---------------------------
// Not wired into WORKOUTS/the day popup yet - this is just the storage +
// live-calculating tables, per the brief. Zone offsets/percentages below
// are named constants specifically so they're easy to tune later without
// hunting through render logic.

// Swim/run zones: a +/- offset in seconds from a base per-distance pace
// ("mm:ss" per 100m for swim, per km for run). [minSeconds, maxSeconds]
// added to the base pace's seconds; CSS/Threshold rows use a negative
// lower bound (i.e. the pace range straddles the benchmark itself).
const SWIM_ZONES = [
  { label: "Easy / Recovery", offset: [20, 30] },
  { label: "Endurance", offset: [10, 20] },
  { label: "Race Effort", offset: [5, 15] },
  { label: "CSS / Threshold", offset: [-5, 5] },
];

const RUN_ZONES = [
  { label: "Easy / Recovery", offset: [60, 90] },
  { label: "Endurance / Long", offset: [45, 75] },
  { label: "Race Pace", offset: [30, 50] },
  { label: "Threshold", offset: [-5, 5] },
];

// Bike zones: a [minPercent, maxPercent] of LTHR, producing a bpm range.
const BIKE_ZONES = [
  { label: "Easy / Recovery", percent: [65, 74] },
  { label: "Endurance", percent: [75, 82] },
  { label: "Race Effort", percent: [83, 88] },
  { label: "Threshold / Hard", percent: [89, 100] },
];

// Parses "mm:ss" (or "m:ss") into total seconds. Returns null for
// anything that isn't a valid pace string, so callers can tell "not
// entered yet" apart from "entered wrong".
function parsePaceToSeconds(pace) {
  if (!pace) return null;
  const match = String(pace).trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatSecondsToPace(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

// Slower paces = bigger mm:ss, so the zone's smaller offset gives the
// faster (smaller-number) end of the displayed range and the bigger
// offset gives the slower end - i.e. offset order maps directly to
// fastest-first without needing to sort.
function paceZoneRange(basePace, offset) {
  const baseSeconds = parsePaceToSeconds(basePace);
  if (baseSeconds == null) return null;
  const fast = formatSecondsToPace(baseSeconds + offset[0]);
  const slow = formatSecondsToPace(baseSeconds + offset[1]);
  return `${fast}-${slow}`;
}

function bikeZoneRange(lthr, percent) {
  const bpm = Number(lthr);
  if (!lthr || !Number.isFinite(bpm) || bpm <= 0) return null;
  const low = Math.round((bpm * percent[0]) / 100);
  const high = Math.round((bpm * percent[1]) / 100);
  return `${low}-${high} bpm`;
}

// --- Day-popup Pace section: matches a workout's free-text details/rpe
// against the zone tables above, so a session that says "Easy / Recovery"
// (or similar wording) shows its resolved pace/bpm range without needing
// every existing session in Supabase re-tagged with a structured zone
// field. Keyword lists are deliberately specific-first (e.g. "threshold"
// checked before the broader "race") so a session mentioning both isn't
// silently matched to only the first one found; a session can match more
// than one zone (e.g. a tempo run's easy warm-up + threshold main set),
// in which case every match gets its own Pace line, per brick/interval
// sessions genuinely needing more than one target.

const ZONES_BY_DISCIPLINE = {
  Swim: { zones: SWIM_ZONES, rangeFor: zone => paceZoneRange(paceBenchmarks.cssPace, zone.offset) },
  Bike: { zones: BIKE_ZONES, rangeFor: zone => bikeZoneRange(paceBenchmarks.cyclingLthr, zone.percent) },
  Run: { zones: RUN_ZONES, rangeFor: zone => paceZoneRange(paceBenchmarks.runThresholdPace, zone.offset) },
};

// Keyed by zone label (shared across disciplines where the wording is the
// same - "Easy / Recovery" reads identically for swim/bike/run). Each
// zone's own keywords, checked most-specific-first per session so
// "CSS / Threshold" isn't also caught by a looser check that happened to
// run first.
const ZONE_KEYWORDS = {
  "Easy / Recovery": ["easy", "recovery"],
  "Endurance": ["endurance"],
  "Endurance / Long": ["endurance", "long"],
  "Race Effort": ["race effort", "race pace", "race-pace", "race"],
  "Race Pace": ["race effort", "race pace", "race-pace", "race"],
  "CSS / Threshold": ["css", "threshold"],
  "Threshold": ["threshold"],
  "Threshold / Hard": ["threshold", "hard"],
};

// Returns [{ label, range }, ...] for every zone this session's text
// matches, in the zone table's own row order (fastest/easiest first).
// Returns [] if the discipline isn't recognised or nothing matched -
// callers render no Pace section at all in that case, rather than an
// empty one.
function matchedPaceZones(session) {
  const disciplineInfo = ZONES_BY_DISCIPLINE[session.discipline];
  if (!disciplineInfo) return [];

  const haystack = `${session.details || ""} ${session.rpe || ""}`.toLowerCase();
  const matches = [];
  disciplineInfo.zones.forEach(zone => {
    const keywords = ZONE_KEYWORDS[zone.label] || [];
    const isMatch = keywords.some(kw => haystack.includes(kw));
    if (!isMatch) return;
    const range = disciplineInfo.rangeFor(zone);
    if (range) matches.push({ label: zone.label, range });
  });
  return matches;
}

function paceFieldHtml(session) {
  const matches = matchedPaceZones(session);
  if (matches.length === 0) return "";
  const lines = matches.map(m => `${esc(m.label)}: ${esc(m.range)}`).join("<br>");
  return `<div><span class="modal-field-label">Pace</span><span class="modal-field-value">${lines}</span></div>`;
}

function fieldHtml(label, value) {
  const hasValue = value && String(value).trim().length > 0;
  // "Not specified" rather than "Not added yet" - the latter implies the
  // value is definitely coming later, which isn't true for every field
  // this renders (some genuinely don't apply to a given event/discipline).
  const shown = hasValue ? esc(value) : "Not specified";
  return `<div><span class="modal-field-label">${esc(label)}</span><span class="modal-field-value${hasValue ? "" : " is-empty"}">${shown}</span></div>`;
}

// True only for http:/https: URLs. esc() escapes HTML special characters
// (<, >, ", &) but doesn't validate the URL scheme - a value like
// "javascript:alert(1)" has none of those characters, so it would pass
// through esc() unchanged and execute if rendered into an href. This data
// comes from Supabase, not a hardcoded constant, so it's treated as
// untrusted input rather than assumed safe.
function isSafeHttpUrl(url) {
  try {
    const parsed = new URL(String(url), window.location.href);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// Like fieldHtml, but when a URL is present it renders as a clickable link
// using linkLabel as the shortened display text (falling back to the raw
// URL if no label was given).
function linkFieldHtml(label, url, linkLabel) {
  const hasValue = url && String(url).trim().length > 0 && isSafeHttpUrl(url);
  if (!hasValue) {
    return `<div><span class="modal-field-label">${esc(label)}</span><span class="modal-field-value is-empty">Not specified</span></div>`;
  }
  const shownText = linkLabel && String(linkLabel).trim().length > 0 ? linkLabel : url;
  return `<div><span class="modal-field-label">${esc(label)}</span><span class="modal-field-value"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(shownText)}</a></span></div>`;
}

function renderBlankModal() {
  return `<p class="modal-empty-note">Nothing scheduled on this day.</p>`;
}

// Splits a set into separate lines, one per category, so each part reads
// as its own row rather than one run-on string. Richer entries use "|" to
// separate categories (e.g. "Workout: ... | Effort: ... | Skills: ...");
// simpler ones just use "+" between parts (e.g. "2 x 150 m endurance +
// 3 x 50 m speed"). A "|"-bearing string is split on "|" only, so the
// "->" steps within its Workout segment stay on one line together.
function setDetailsHtml(details) {
  const hasValue = details && String(details).trim().length > 0;
  if (!hasValue) {
    return `<div><span class="modal-field-label">Set / Details</span><span class="modal-field-value is-empty">Not specified</span></div>`;
  }
  const text = String(details);
  const separator = text.includes("|") ? "|" : "+";
  const parts = text.split(separator).map(p => p.trim()).filter(Boolean);
  const linesHtml = parts.map(p => esc(p)).join("<br>");
  return `<div><span class="modal-field-label">Set / Details</span><span class="modal-field-value">${linesHtml}</span></div>`;
}

function workoutSessionHtml(s) {
  return `
    <div class="modal-discipline">
      <div class="modal-discipline-grid">
        ${fieldHtml("Session", s.session)}
        ${fieldHtml("Duration / Distance", s.duration)}
        ${setDetailsHtml(s.details)}
        ${fieldHtml("Effort (RPE)", s.rpe)}
        ${paceFieldHtml(s)}
      </div>
    </div>
  `;
}

function renderTrainingModal(isoDate, block) {
  const ev = EVENTS.find(e => e.date === block.eventDate);
  const eventName = ev ? ev.name : "Event";
  const totalWeeks = weeksBetween(block.start, block.end);
  const currentWeek = weeksBetween(block.start, isoDate);
  const workout = WORKOUTS[isoDate];

  const weekLine = workout
    ? `Week ${workout.week} of ${totalWeeks} (${workout.phase})`
    : `Week ${currentWeek} of ${totalWeeks}`;

  const sessionsHtml = workout
    ? `<div class="modal-fields">${workout.sessions.map(workoutSessionHtml).join("")}</div>`
    : fieldHtml("Session", "Rest Day");

  const isLogged = loggedDates.has(isoDate);
  const completeButtonHtml = workout
    ? `<button type="button" class="modal-complete-btn${isLogged ? " is-logged" : ""}" data-complete-date="${esc(isoDate)}">${isLogged ? "Marked as complete" : "Mark as complete"}</button>`
    : "";

  return `
    <h2 class="modal-title">${esc(eventName)} Training</h2>
    <p class="modal-date">${esc(formatLongDate(isoDate))}</p>
    <div class="modal-fields">
      ${fieldHtml("Week", weekLine)}
      ${sessionsHtml}
      ${completeButtonHtml}
    </div>
  `;
}

function disciplineHtml(d) {
  return `
    <div class="modal-discipline">
      <div class="modal-discipline-name">${esc(d.discipline || "Discipline")}</div>
      <div class="modal-discipline-grid">
        ${fieldHtml("Type", d.type)}
        ${fieldHtml("Distance", d.distance)}
        ${fieldHtml("Duration", d.duration)}
        ${fieldHtml("Average pace", d.pace)}
      </div>
    </div>
  `;
}

function renderEventModal(ev) {
  const disciplines = (ev.disciplines && ev.disciplines.length)
    ? ev.disciplines
    : [{ discipline: "", type: "", distance: "", duration: "", pace: "" }];
  return `
    <h2 class="modal-title">${esc(ev.name)}</h2>
    <p class="modal-date">${esc(formatLongDate(ev.date))}</p>
    <div class="modal-fields">
      ${fieldHtml("Location", ev.location)}
      ${linkFieldHtml("Garmin Epic Link", ev.garminEpicLink, ev.garminEpicLinkLabel)}
      <div class="modal-fields">
        ${disciplines.map(disciplineHtml).join("")}
      </div>
    </div>
  `;
}

// Shared by both overlays (day modal and event list) so the page behind
// them can't be scrolled while either is open, on desktop or mobile. A
// count rather than a plain boolean means it stays correct even if one
// overlay's open call ever fires while the other is already open.
let scrollLockCount = 0;

function lockBodyScroll() {
  scrollLockCount++;
  document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) document.body.style.overflow = "";
}

const modalOverlay = document.createElement("div");
modalOverlay.className = "modal-overlay";
modalOverlay.hidden = true;

const modalCard = document.createElement("div");
modalCard.className = "modal-card";
modalCard.setAttribute("role", "dialog");
modalCard.setAttribute("aria-modal", "true");
modalCard.tabIndex = -1; // focusable as the dialog itself, not in tab order

const modalCloseBtn = document.createElement("button");
modalCloseBtn.className = "modal-close";
modalCloseBtn.setAttribute("aria-label", "Close");
modalCloseBtn.innerHTML = iconSvg("x", 18);

const modalBody = document.createElement("div");

modalCard.appendChild(modalCloseBtn);
modalCard.appendChild(modalBody);
modalOverlay.appendChild(modalCard);
document.body.appendChild(modalOverlay);

let lastFocused = null;
let selectedCell = null;

function openModal(html, label, cell) {
  modalBody.innerHTML = html;
  modalCard.setAttribute("aria-label", label);
  modalOverlay.hidden = false;
  lastFocused = document.activeElement;
  modalCard.focus();
  lockBodyScroll();
  todayPill.hidden = true;

  if (selectedCell) selectedCell.classList.remove("selected");
  selectedCell = cell || null;
  if (selectedCell) selectedCell.classList.add("selected");
}

// The dot on a day's calendar cell isn't recreated when the modal
// re-renders, so toggling logged state from the popup updates it in place
// by looking it up from the grid.
function updateLoggedDot(isoDate, isLogged) {
  const cell = container.querySelector(`.cell[data-date="${isoDate}"]`);
  const dot = cell ? cell.querySelector(".logged-dot") : null;
  if (dot) dot.classList.toggle("is-logged", isLogged);
  if (cell && cell.dataset.baseLabel) {
    cell.setAttribute("aria-label", cell.dataset.baseLabel + (isLogged ? ", logged as complete" : ", not yet logged"));
  }
}

modalBody.addEventListener("click", e => {
  const btn = e.target.closest(".modal-complete-btn");
  if (!btn) return;
  const isoDate = btn.dataset.completeDate;

  // loggedDates flips synchronously (before the network call) inside
  // toggleLogged, so the dot/modal can update immediately without waiting
  // on the request - the .catch below only fires if the write actually
  // failed and the optimistic change had to be reverted.
  const toggling = toggleLogged(isoDate);
  updateLoggedDot(isoDate, loggedDates.has(isoDate));
  closeModal();

  toggling.catch(() => {
    updateLoggedDot(isoDate, loggedDates.has(isoDate));
    alert("Couldn't save - check your connection and try again.");
  });
});

function closeModal() {
  modalOverlay.hidden = true;
  if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  lastFocused = null;
  if (selectedCell) selectedCell.classList.remove("selected");
  selectedCell = null;
  unlockBodyScroll();
  updateTodayPill();
}

modalCloseBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", e => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener("keydown", e => {
  if (modalOverlay.hidden) return;
  if (e.key === "Escape") {
    closeModal();
  } else if (e.key === "Tab") {
    // Cycle Tab/Shift+Tab between the modal's own focusable elements
    // (close button, plus whatever modalBody's current content adds - e.g.
    // "Mark as complete" - and any link inside it) rather than letting
    // focus leave into calendar cells hidden behind the overlay. Forcing
    // focus to modalCloseBtn unconditionally here previously made any
    // other focusable element (like the complete button) unreachable by
    // keyboard entirely.
    const focusable = modalCard.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

function handleDayClick(isoDate) {
  const cell = container.querySelector(`.cell[data-date="${isoDate}"]`);
  const dayEvents = eventsByDate[isoDate];
  if (dayEvents && dayEvents.length) {
    const html = dayEvents.length > 1
      ? dayEvents.map(renderEventModal).join('<div class="modal-event-divider"></div>')
      : renderEventModal(dayEvents[0]);
    const label = dayEvents.map(ev => `${ev.name}, ${formatLongDate(ev.date)}`).join("; ");
    openModal(html, label, cell);
    return;
  }
  const block = trainingBlockFor(isoDate);
  if (block) {
    const ev = EVENTS.find(e => e.date === block.eventDate);
    openModal(renderTrainingModal(isoDate, block), `${ev ? ev.name : "Event"} training, ${formatLongDate(isoDate)}`, cell);
    return;
  }
  openModal(renderBlankModal(), `${formatLongDate(isoDate)}, no event`, cell);
}

const today = new Date();
const todayIso = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
const container = document.getElementById("calendar");

// Event list overview: a header-triggered panel listing every event
// chronologically, each row expandable for full detail. Entirely additive
// - it doesn't touch day-tile rendering, the logged-dot, or the
// day-detail modal above.
function daysUntil(isoDate) {
  const ms = parseIso(isoDate) - parseIso(todayIso);
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function countdownText(isoDate) {
  const days = daysUntil(isoDate);
  if (days === 0) return "Today";
  if (days > 0) return days === 1 ? "In 1 day" : `In ${days} days`;
  const ago = Math.abs(days);
  return ago === 1 ? "1 day ago" : `${ago} days ago`;
}

// Same three-state read as the logged-workout dot: hollow ring = not yet
// happened (future), filled = happened or happening (current/past). Past
// additionally mutes the whole row, so "done" and "in progress" stay
// visually distinct from each other as well as from "upcoming".
function eventListState(ev, block) {
  if (ev.date < todayIso) return "past";
  if (block && todayIso >= block.start && todayIso <= block.end) return "current";
  if (ev.date === todayIso) return "current";
  return "future";
}

function eventListRowHtml(ev, index) {
  const palette = PALETTE[ev.colorIndex % PALETTE.length];
  const block = TRAINING_BLOCKS.find(b => b.eventDate === ev.date);
  const state = eventListState(ev, block);

  const disciplines = (ev.disciplines && ev.disciplines.length)
    ? ev.disciplines
    : [{ discipline: "", type: "", distance: "", duration: "", pace: "" }];

  const blockFieldsHtml = block
    ? `
      ${fieldHtml("Training block", `${formatLongDate(block.start)} - ${formatLongDate(block.end)}`)}
      ${fieldHtml("Block length", `${weeksBetween(block.start, block.end)} weeks`)}
    `
    : "";

  const elevationParts = disciplines
    .filter(d => d.elevation && String(d.elevation).trim().length > 0)
    .map(d => `${d.discipline || "Discipline"}: ${d.elevation}`);
  // One discipline per line rather than a "|"-joined string, matching how
  // setDetailsHtml already splits multi-part values elsewhere in this
  // file - a raw delimiter character isn't something a reader should see.
  const elevationHtml = elevationParts.length
    ? `<div><span class="modal-field-label">Elevation</span><span class="modal-field-value">${elevationParts.map(p => esc(p)).join("<br>")}</span></div>`
    : "";

  return `
    <div class="event-list-row is-${state}">
      <button type="button" class="event-list-row-head" data-row-index="${index}" aria-expanded="false" aria-controls="event-list-body-${index}">
        <span class="event-list-dot" style="--dot-color:${esc(palette.dot)}" aria-hidden="true"></span>
        <span class="event-list-row-name">${esc(ev.name)}</span>
        <span class="event-list-row-when">${esc(formatLongDate(ev.date))}<br>${esc(countdownText(ev.date))}</span>
        <svg class="event-list-row-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"></polyline></svg>
      </button>
      <div class="event-list-row-body" id="event-list-body-${index}" hidden>
        <div class="modal-fields">
          ${fieldHtml("Location", ev.location)}
          ${elevationHtml}
          ${ev.website ? linkFieldHtml("Website", ev.website, "Official event website") : ""}
          ${ev.garminEpicLink ? linkFieldHtml("Garmin Epic Link", ev.garminEpicLink, ev.garminEpicLinkLabel) : ""}
          ${blockFieldsHtml}
          <div class="modal-fields">
            ${disciplines.map(disciplineHtml).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderEventListPanel() {
  const sorted = [...EVENTS].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return sorted.map(eventListRowHtml).join("");
}

// Settings modal: one overlay/panel shared by two tabs, Events (the
// original event list, unchanged in behaviour) and Paces (the new
// benchmark inputs + calculated zone tables below). The header icon's own
// meaning still primarily reads as "show me the events list" - the modal
// always opens on the Events tab regardless of which tab was showing last
// time it was closed.
const eventListOverlay = document.createElement("div");
eventListOverlay.className = "event-list-overlay";
eventListOverlay.hidden = true;

const eventListPanel = document.createElement("div");
eventListPanel.className = "event-list-panel";
eventListPanel.setAttribute("role", "dialog");
eventListPanel.setAttribute("aria-modal", "true");
eventListPanel.setAttribute("aria-label", "Events and paces");
eventListPanel.tabIndex = -1;

const eventListHeader = document.createElement("div");
eventListHeader.className = "event-list-panel-header";
eventListHeader.innerHTML = `
  <div class="settings-tabs" role="tablist" aria-label="Settings section">
    <button type="button" class="settings-tab is-active" role="tab" aria-selected="true" aria-controls="settings-tab-events" data-tab="events">
      ${iconSvg("calendarDays", 16)}<span>Events</span>
    </button>
    <button type="button" class="settings-tab" role="tab" aria-selected="false" aria-controls="settings-tab-paces" data-tab="paces">
      ${iconSvg("gauge", 16)}<span>Paces</span>
    </button>
  </div>
`;

const eventListCloseBtn = document.createElement("button");
eventListCloseBtn.type = "button";
eventListCloseBtn.className = "event-list-close";
eventListCloseBtn.setAttribute("aria-label", "Close");
eventListCloseBtn.innerHTML = iconSvg("x", 18);
eventListHeader.appendChild(eventListCloseBtn);

const eventListBody = document.createElement("div");
eventListBody.id = "settings-tab-events";
eventListBody.setAttribute("role", "tabpanel");

const pacesBody = document.createElement("div");
pacesBody.id = "settings-tab-paces";
pacesBody.setAttribute("role", "tabpanel");
pacesBody.hidden = true;

eventListPanel.appendChild(eventListHeader);
eventListPanel.appendChild(eventListBody);
eventListPanel.appendChild(pacesBody);
eventListOverlay.appendChild(eventListPanel);
document.body.appendChild(eventListOverlay);

const eventListTrigger = document.getElementById("event-list-trigger");
let eventListLastFocused = null;

function switchSettingsTab(tab) {
  const tabButtons = eventListHeader.querySelectorAll(".settings-tab");
  tabButtons.forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  eventListBody.hidden = tab !== "events";
  pacesBody.hidden = tab !== "paces";
  if (tab === "paces") renderPacesTab();
}

// Current benchmark values - both the Paces tab's inputs and the
// day-detail popup's Pace section read this. Populated from the most
// recent Supabase row once at startup (init(), below), then kept in sync
// with whatever's actually typed in the Paces tab inputs as the source of
// truth for recalculating live; saving writes this same object out as a
// new row.
let paceBenchmarks = { cssPace: "", cyclingLthr: "", runThresholdPace: "" };

function zoneTableHtml(title, unitLabel, zones, rangeForZone) {
  const rows = zones.map(zone => {
    const range = rangeForZone(zone);
    return `
      <tr>
        <td>${esc(zone.label)}</td>
        <td class="paces-zone-value${range ? "" : " is-empty"}">${range ? esc(range) : "Enter a benchmark above"}</td>
      </tr>
    `;
  }).join("");
  return `
    <table class="paces-zone-table">
      <caption>${esc(title)} <span class="paces-zone-unit">${esc(unitLabel)}</span></caption>
      <thead><tr><th scope="col">Zone</th><th scope="col">Target</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderPacesTab() {
  pacesBody.innerHTML = `
    <div class="paces-benchmarks">
      <label class="paces-input-field">
        <span>Swim CSS pace (per 100m)</span>
        <input type="text" inputmode="numeric" placeholder="e.g. 1:35" id="pace-input-css" value="${esc(paceBenchmarks.cssPace)}" autocomplete="off">
      </label>
      <label class="paces-input-field">
        <span>Cycling LTHR (bpm)</span>
        <input type="number" min="0" max="300" placeholder="e.g. 165" id="pace-input-lthr" value="${esc(paceBenchmarks.cyclingLthr)}" autocomplete="off">
      </label>
      <label class="paces-input-field">
        <span>Run threshold pace (per km)</span>
        <input type="text" inputmode="numeric" placeholder="e.g. 4:30" id="pace-input-run" value="${esc(paceBenchmarks.runThresholdPace)}" autocomplete="off">
      </label>
      <button type="button" class="paces-save-btn" id="pace-save-btn">Save benchmarks</button>
      <p class="paces-save-status" id="pace-save-status" role="status" aria-live="polite"></p>
    </div>
    <div class="paces-zone-tables">
      ${zoneTableHtml("Swim", "per 100m", SWIM_ZONES, zone => paceZoneRange(paceBenchmarks.cssPace, zone.offset))}
      ${zoneTableHtml("Bike", "bpm", BIKE_ZONES, zone => bikeZoneRange(paceBenchmarks.cyclingLthr, zone.percent))}
      ${zoneTableHtml("Run", "per km", RUN_ZONES, zone => paceZoneRange(paceBenchmarks.runThresholdPace, zone.offset))}
    </div>
  `;

  const cssInput = document.getElementById("pace-input-css");
  const lthrInput = document.getElementById("pace-input-lthr");
  const runInput = document.getElementById("pace-input-run");
  const saveBtn = document.getElementById("pace-save-btn");
  const saveStatus = document.getElementById("pace-save-status");

  function recalculate() {
    paceBenchmarks = {
      cssPace: cssInput.value.trim(),
      cyclingLthr: lthrInput.value.trim(),
      runThresholdPace: runInput.value.trim(),
    };
    pacesBody.querySelectorAll(".paces-zone-table").forEach((table, i) => {
      const zones = [SWIM_ZONES, BIKE_ZONES, RUN_ZONES][i];
      const rangeForZone = [
        z => paceZoneRange(paceBenchmarks.cssPace, z.offset),
        z => bikeZoneRange(paceBenchmarks.cyclingLthr, z.percent),
        z => paceZoneRange(paceBenchmarks.runThresholdPace, z.offset),
      ][i];
      table.querySelectorAll("tbody tr").forEach((row, rowIndex) => {
        const range = rangeForZone(zones[rowIndex]);
        const valueCell = row.querySelector(".paces-zone-value");
        valueCell.textContent = range || "Enter a benchmark above";
        valueCell.classList.toggle("is-empty", !range);
      });
    });
  }

  [cssInput, lthrInput, runInput].forEach(input => {
    input.addEventListener("input", recalculate);
  });

  saveBtn.addEventListener("click", () => {
    saveStatus.textContent = "Saving...";
    insertPaceBenchmarks(paceBenchmarks).then(() => {
      saveStatus.textContent = "Saved.";
    }).catch(() => {
      saveStatus.textContent = "Couldn't save - check your connection and try again.";
    });
  });
}

eventListHeader.addEventListener("click", e => {
  const tabBtn = e.target.closest(".settings-tab");
  if (tabBtn) switchSettingsTab(tabBtn.dataset.tab);
});

function openEventList() {
  eventListBody.innerHTML = renderEventListPanel();
  eventListOverlay.hidden = false;
  eventListTrigger.setAttribute("aria-expanded", "true");
  eventListLastFocused = document.activeElement;
  eventListPanel.focus();
  lockBodyScroll();
  todayPill.hidden = true;
  switchSettingsTab("events");
}

function closeEventList() {
  eventListOverlay.hidden = true;
  eventListTrigger.setAttribute("aria-expanded", "false");
  if (eventListLastFocused && typeof eventListLastFocused.focus === "function") eventListLastFocused.focus();
  eventListLastFocused = null;
  unlockBodyScroll();
  updateTodayPill();
}

eventListTrigger.addEventListener("click", () => {
  if (eventListOverlay.hidden) openEventList();
  else closeEventList();
});
eventListCloseBtn.addEventListener("click", closeEventList);
eventListOverlay.addEventListener("click", e => {
  if (e.target === eventListOverlay) closeEventList();
});
eventListBody.addEventListener("click", e => {
  const head = e.target.closest(".event-list-row-head");
  if (!head) return;
  const body = document.getElementById(head.getAttribute("aria-controls"));
  const expanded = head.getAttribute("aria-expanded") === "true";

  // Only one row open at a time - collapse every other expanded row
  // before toggling the one that was clicked.
  eventListBody.querySelectorAll(".event-list-row-head[aria-expanded=\"true\"]").forEach(otherHead => {
    if (otherHead === head) return;
    otherHead.setAttribute("aria-expanded", "false");
    const otherBody = document.getElementById(otherHead.getAttribute("aria-controls"));
    if (otherBody) otherBody.hidden = true;
  });

  head.setAttribute("aria-expanded", String(!expanded));
  if (body) body.hidden = expanded;
});
document.addEventListener("keydown", e => {
  if (eventListOverlay.hidden) return;
  if (e.key === "Escape") closeEventList();
});

// Floating "today" pill: persistent summary of today's workout, plus the
// tap-through that scrolls back to the current month. Reads only from
// WORKOUTS/TRAINING_BLOCKS (already loaded by init() before this is ever
// called) - no new data model, no changes to day-tile rendering or the
// logged-dot.
function todayPillContent() {
  const workout = WORKOUTS[todayIso];
  const block = trainingBlockFor(todayIso);

  if (!block) {
    // Outside any training block entirely (before/after the plan's
    // range) - nothing sensible to show.
    return null;
  }

  if (!workout) {
    // Same "no WORKOUTS entry within a block" convention the day-detail
    // modal already uses to mean Rest Day (see renderTrainingModal).
    return { label: "Rest Day" };
  }

  if (workout.sessions.length > 1) {
    // Brick day - name it from the disciplines involved rather than
    // trying to cram multiple durations onto the pill; the day popup
    // (via the pill's tap-through, or tapping the cell directly) has the
    // full breakdown.
    const disciplines = workout.sessions.map(s => s.discipline).filter(Boolean);
    const label = disciplines.length === 2
      ? `${disciplines[0]} to ${disciplines[1].toLowerCase()} brick`
      : "Brick session";
    return { label };
  }

  const s = workout.sessions[0];
  const parts = [s.session, s.duration].filter(Boolean);
  return { label: parts.join(" - ") };
}

function updateTodayPill() {
  const content = todayPillContent();
  if (!content) {
    todayPill.hidden = true;
    return;
  }
  todayPillLabel.textContent = content.label;
  todayPill.hidden = false;
}

// Scrolls the current month's header into view. Used both on initial load
// (instant - just positioning, withPulse false) and from the pill's click
// handler (smooth-scrolled and pulsed, since that's an explicit "take me
// there" the user should be able to see happen).
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function scrollToCurrentMonth(withPulse) {
  const monthEl = container.querySelector(`.month[data-year="${today.getFullYear()}"][data-month="${today.getMonth()}"]`);
  if (!monthEl) return;

  monthEl.scrollIntoView({ block: "start", behavior: (withPulse && !prefersReducedMotion) ? "smooth" : "auto" });

  if (withPulse) {
    const cell = container.querySelector(`.cell[data-date="${todayIso}"]`);
    if (cell) {
      cell.classList.remove("pulse");
      // Force a reflow so re-adding the class restarts the animation even
      // if the pill is tapped twice in quick succession.
      void cell.offsetWidth;
      cell.classList.add("pulse");
      cell.addEventListener("animationend", () => cell.classList.remove("pulse"), { once: true });
    }
  }
}

const todayPill = document.createElement("button");
todayPill.type = "button";
todayPill.className = "today-pill";
todayPill.hidden = true;

const todayPillLabel = document.createElement("span");
todayPillLabel.className = "today-pill-label";
todayPill.appendChild(todayPillLabel);

document.body.appendChild(todayPill);

todayPill.addEventListener("click", () => {
  scrollToCurrentMonth(true);
  // Waits for the smooth scroll to settle before opening today's popup,
  // so the two happen in sequence rather than the modal appearing over a
  // page that's still mid-scroll. A fixed delay rather than the scrollend
  // event, which Safari doesn't fire reliably. With reduced motion the
  // scroll above is instant (no animation to wait for), so the popup can
  // open right away instead of on an artificial delay.
  setTimeout(() => handleDayClick(todayIso), prefersReducedMotion ? 0 : 650);
});

// Builds the whole month grid. Deferred until after Supabase data has
// loaded (see init() below) since every cell reads EVENTS/WORKOUTS/
// TRAINING_BLOCKS.
function renderCalendar() {
let y = startYear, m = startMonth;
while (y < endYear || (y === endYear && m <= endMonth)) {
  // Blank out each month's leading/trailing filler cells: no grey fill,
  // and borders only where a filler cell actually sits next to a real
  // date.
  const isFillerTrial = true;

  const monthDiv = document.createElement("div");
  monthDiv.className = isFillerTrial ? "month trial-no-divider" : "month";
  monthDiv.dataset.year = y;
  monthDiv.dataset.month = m;

  const titleDiv = document.createElement("div");
  titleDiv.className = "month-title";
  const nameSpan = document.createElement("span");
  nameSpan.className = "name";
  nameSpan.textContent = monthNames[m];
  const yearSpan = document.createElement("span");
  yearSpan.className = "year";
  yearSpan.textContent = y;
  titleDiv.appendChild(nameSpan);
  titleDiv.appendChild(yearSpan);
  monthDiv.appendChild(titleDiv);

  const gridWrap = document.createElement("div");
  gridWrap.className = "grid-wrap";

  const firstOfMonth = new Date(y, m, 1);
  let firstWeekday = firstOfMonth.getDay(); // 0=Sun
  firstWeekday = (firstWeekday === 0) ? 6 : firstWeekday - 1; // Mon=0

  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const weekdaysDiv = document.createElement("div");
  weekdaysDiv.className = "weekdays";
  dayNames.forEach((d, i) => {
    const el = document.createElement("div");
    el.textContent = d;
    // A heading sitting above a blank leading filler cell shouldn't
    // draw the divider line under it either.
    if (isFillerTrial && i < firstWeekday) el.className = "blank-heading";
    weekdaysDiv.appendChild(el);
  });
  gridWrap.appendChild(weekdaysDiv);

  const daysDiv = document.createElement("div");
  daysDiv.className = isFillerTrial ? "days trial-edges" : "days";

  for (let i = 0; i < firstWeekday; i++) {
    const el = document.createElement("div");
    // Every leading filler cell only ever borders another filler cell
    // (or the grid's outer edge) on its left, never a real date.
    el.className = isFillerTrial ? "cell empty-blank" : "cell empty";
    daysDiv.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement("div");
    const dateObj = new Date(y, m, d);
    const isoDate = `${y}-${pad2(m + 1)}-${pad2(d)}`;
    const dayEvents = eventsByDate[isoDate];

    let cls = "cell";
    if (dateObj.toDateString() === today.toDateString()) cls += " today";
    el.className = cls;
    el.dataset.date = isoDate;
    el.setAttribute("role", "button");
    el.tabIndex = 0;

    const numSpan = document.createElement("span");
    numSpan.className = "num";
    numSpan.textContent = d;
    el.appendChild(numSpan);

    let ariaLabel = formatLongDate(isoDate);

    if (dayEvents) {
      el.style.background = dayEvents[0].bg;
      dayEvents.forEach(ev => {
        const label = document.createElement("span");
        label.className = "event-label";
        label.style.color = ev.text;
        label.textContent = ev.name;
        el.appendChild(label);
      });
      ariaLabel += `: ${dayEvents.map(ev => ev.name).join(", ")}`;
    } else {
      const block = trainingBlockFor(isoDate);
      if (block) {
        const palette = PALETTE[block.colorIndex % PALETTE.length];
        const ev = EVENTS.find(e => e.date === block.eventDate);
        ariaLabel += `: ${ev ? ev.name : "event"} training`;

        if (WORKOUTS[isoDate]) {
          const isLogged = loggedDates.has(isoDate);
          const dot = document.createElement("span");
          dot.className = "logged-dot" + (isLogged ? " is-logged" : "");
          dot.style.setProperty("--dot-color", palette.dot);
          dot.setAttribute("aria-hidden", "true");
          el.appendChild(dot);
          // The dot itself is aria-hidden (purely decorative colour/shape),
          // so logged state needs a text equivalent in the cell's own
          // label - otherwise it's sighted-only information. Stored as the
          // "base" label (without logged-state suffix) on the element so
          // updateLoggedDot can rebuild it cleanly after a toggle, rather
          // than string-appending onto whatever's already there.
          el.dataset.baseLabel = ariaLabel;
          ariaLabel += isLogged ? ", logged as complete" : ", not yet logged";
        }
      }
    }

    el.setAttribute("aria-label", ariaLabel);

    daysDiv.appendChild(el);
  }

  // Pad the final week out to a full 7 columns too, so the grid always
  // reads as a complete table with borders on every tile, not just a
  // truncated last row.
  const totalCells = firstWeekday + daysInMonth;
  const trailingEmpty = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < trailingEmpty; i++) {
    const el = document.createElement("div");
    // The first trailing filler cell sits right after a real date, so
    // its left border is kept; any after that only border other filler.
    el.className = isFillerTrial ? (i === 0 ? "cell empty-edge" : "cell empty-blank") : "cell empty";
    daysDiv.appendChild(el);
  }

  if (isFillerTrial) {
    // The final row's real dates get their own bottom edge back
    // (since the grid no longer draws one along its full width) -
    // the blank filler cells in that same row don't.
    Array.from(daysDiv.children).slice(-7).forEach(cell => {
      if (!cell.classList.contains("empty-blank") && !cell.classList.contains("empty-edge")) {
        cell.classList.add("row-bottom");
      }
    });
  }

  gridWrap.appendChild(daysDiv);
  monthDiv.appendChild(gridWrap);
  container.appendChild(monthDiv);

  m++;
  if (m > 11) { m = 0; y++; }
}
}

// Event delegation: one pair of listeners handles every day tile, rather
// than one per cell.
container.addEventListener("click", e => {
  const cell = e.target.closest(".cell[data-date]");
  if (cell) handleDayClick(cell.dataset.date);
});
container.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const cell = e.target.closest(".cell[data-date]");
  if (cell) {
    e.preventDefault();
    handleDayClick(cell.dataset.date);
  }
});

async function init() {
  try {
    const data = await loadTrainingData();
    EVENTS = data.EVENTS;
    TRAINING_BLOCKS_RAW = data.TRAINING_BLOCKS_RAW;
    WORKOUTS = data.WORKOUTS;
  } catch (err) {
    container.innerHTML = `<p class="modal-empty-note" style="padding:24px;">Couldn't load the calendar data. Check your connection and reload.</p>`;
    throw err;
  }

  EVENTS.forEach(ev => {
    const palette = PALETTE[ev.colorIndex % PALETTE.length];
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push({ ...ev, ...palette });
  });

  // colorIndex isn't set by hand in Supabase - it's looked up here from
  // the linked event, so a block can never drift out of sync with its
  // event's colour (e.g. after a recolour).
  TRAINING_BLOCKS = TRAINING_BLOCKS_RAW.map(block => {
    const ev = EVENTS.find(e => e.date === block.eventDate);
    return { ...block, colorIndex: ev ? ev.colorIndex : 0 };
  });

  try {
    loggedDates = await fetchLoggedDates();
  } catch {
    // Logged state just won't be pre-populated this load if this fails -
    // the calendar itself (built from EVENTS/WORKOUTS above) still works.
  }

  try {
    const latest = await fetchLatestPaceBenchmarks();
    if (latest) paceBenchmarks = latest;
  } catch {
    // No prior benchmarks (or the fetch failed) - the day popup's Pace
    // section and the Paces tab both just show nothing resolved yet,
    // same as a first-time user with nothing saved.
  }

  renderCalendar();
  updateTodayPill();
  // Page loads showing the top of the calendar (July 2026), not
  // pre-scrolled to the current month - the today-pill's own tap-through
  // (scrollToCurrentMonth(true), unchanged) is still how you jump to today.
}

init();
