const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const startYear = 2026, startMonth = 6;  // July 2026 (0-indexed)
const endYear = 2027, endMonth = 9;      // October 2027

// EVENTS, PALETTE and TRAINING_BLOCKS_RAW are defined in data.js (loaded
// before this file) so the schedule can be edited without touching any
// rendering logic.

const eventsByDate = {};
EVENTS.forEach(ev => {
  const palette = PALETTE[ev.colorIndex % PALETTE.length];
  if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
  eventsByDate[ev.date].push({ ...ev, ...palette });
});

// colorIndex isn't set by hand in data.js - it's looked up here from the
// linked event, so a block can never drift out of sync with its event's
// colour (e.g. after a recolour).
const TRAINING_BLOCKS = TRAINING_BLOCKS_RAW.map(block => {
  const ev = EVENTS.find(e => e.date === block.eventDate);
  return { ...block, colorIndex: ev ? ev.colorIndex : 0 };
});

// Logged-workout state lives only in this browser (localStorage), keyed by
// ISO date. Wrapped in try/catch since storage access can throw (private
// browsing, blocked site data) and a missing "logged" mark should never
// break the calendar.
const LOGGED_STORAGE_KEY = "trainingCalendar.loggedDates";

function loadLoggedDates() {
  try {
    const raw = localStorage.getItem(LOGGED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

const loggedDates = loadLoggedDates();

function saveLoggedDates() {
  try {
    localStorage.setItem(LOGGED_STORAGE_KEY, JSON.stringify([...loggedDates]));
  } catch {
    // Storage unavailable - logged state just won't persist this session.
  }
}

function toggleLogged(isoDate) {
  if (loggedDates.has(isoDate)) {
    loggedDates.delete(isoDate);
  } else {
    loggedDates.add(isoDate);
  }
  saveLoggedDates();
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

function fieldHtml(label, value) {
  const hasValue = value && String(value).trim().length > 0;
  const shown = hasValue ? esc(value) : "Not added yet";
  return `<div><span class="modal-field-label">${esc(label)}</span><span class="modal-field-value${hasValue ? "" : " is-empty"}">${shown}</span></div>`;
}

// Like fieldHtml, but when a URL is present it renders as a clickable link
// using linkLabel as the shortened display text (falling back to the raw
// URL if no label was given).
function linkFieldHtml(label, url, linkLabel) {
  const hasValue = url && String(url).trim().length > 0;
  if (!hasValue) {
    return `<div><span class="modal-field-label">${esc(label)}</span><span class="modal-field-value is-empty">Not added yet</span></div>`;
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
    return `<div><span class="modal-field-label">Set / Details</span><span class="modal-field-value is-empty">Not added yet</span></div>`;
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
        ${fieldHtml("Avg pace", d.pace)}
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
modalCloseBtn.textContent = "×";

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
}

modalBody.addEventListener("click", e => {
  const btn = e.target.closest(".modal-complete-btn");
  if (!btn) return;
  const isoDate = btn.dataset.completeDate;
  toggleLogged(isoDate);
  const isLogged = loggedDates.has(isoDate);
  updateLoggedDot(isoDate, isLogged);
  closeModal();
});

function closeModal() {
  modalOverlay.hidden = true;
  if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  lastFocused = null;
  if (selectedCell) selectedCell.classList.remove("selected");
  selectedCell = null;
  unlockBodyScroll();
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
    // The dialog's only interactive child is the close button, so keep
    // keyboard focus there rather than letting Tab reach calendar cells
    // hidden behind the overlay.
    e.preventDefault();
    modalCloseBtn.focus();
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
  const elevationHtml = elevationParts.length
    ? fieldHtml("Elevation", elevationParts.join(" | "))
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

const eventListOverlay = document.createElement("div");
eventListOverlay.className = "event-list-overlay";
eventListOverlay.hidden = true;

const eventListPanel = document.createElement("div");
eventListPanel.className = "event-list-panel";
eventListPanel.setAttribute("role", "dialog");
eventListPanel.setAttribute("aria-modal", "true");
eventListPanel.setAttribute("aria-label", "Event list");
eventListPanel.tabIndex = -1;

const eventListHeader = document.createElement("div");
eventListHeader.className = "event-list-panel-header";
eventListHeader.innerHTML = `<h2 class="event-list-panel-title">All events</h2>`;

const eventListCloseBtn = document.createElement("button");
eventListCloseBtn.type = "button";
eventListCloseBtn.className = "event-list-close";
eventListCloseBtn.setAttribute("aria-label", "Close");
eventListCloseBtn.textContent = "×";
eventListHeader.appendChild(eventListCloseBtn);

const eventListBody = document.createElement("div");

eventListPanel.appendChild(eventListHeader);
eventListPanel.appendChild(eventListBody);
eventListOverlay.appendChild(eventListPanel);
document.body.appendChild(eventListOverlay);

const eventListTrigger = document.getElementById("event-list-trigger");
let eventListLastFocused = null;

function openEventList() {
  eventListBody.innerHTML = renderEventListPanel();
  eventListOverlay.hidden = false;
  eventListTrigger.setAttribute("aria-expanded", "true");
  eventListLastFocused = document.activeElement;
  eventListPanel.focus();
  lockBodyScroll();
}

function closeEventList() {
  eventListOverlay.hidden = true;
  eventListTrigger.setAttribute("aria-expanded", "false");
  if (eventListLastFocused && typeof eventListLastFocused.focus === "function") eventListLastFocused.focus();
  eventListLastFocused = null;
  unlockBodyScroll();
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

let y = startYear, m = startMonth;
while (y < endYear || (y === endYear && m <= endMonth)) {
  // Blank out each month's leading/trailing filler cells: no grey fill,
  // and borders only where a filler cell actually sits next to a real
  // date.
  const isFillerTrial = true;

  const monthDiv = document.createElement("div");
  monthDiv.className = isFillerTrial ? "month trial-no-divider" : "month";

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
