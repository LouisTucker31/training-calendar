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

// colorIndex isn't set by hand in data.js — it's looked up here from the
// linked event, so a block can never drift out of sync with its event's
// colour (e.g. after a recolour).
const TRAINING_BLOCKS = TRAINING_BLOCKS_RAW.map(block => {
  const ev = EVENTS.find(e => e.date === block.eventDate);
  return { ...block, colorIndex: ev ? ev.colorIndex : 0 };
});

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
// every day in the same 7-day span reports the same week number —
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

function renderBlankModal() {
  return `<p class="modal-empty-note">Nothing scheduled on this day.</p>`;
}

function workoutSessionHtml(s) {
  return `
    <div class="modal-discipline">
      <div class="modal-discipline-name">${esc(s.day ? `${s.day} — ${s.discipline}` : (s.discipline || "Workout"))}</div>
      <div class="modal-discipline-grid">
        ${fieldHtml("Session", s.session)}
        ${fieldHtml("Duration / Distance", s.duration)}
        ${fieldHtml("Set / Details", s.details)}
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
    ? `Week ${workout.week} of ${totalWeeks} — ${workout.phase}`
    : `Week ${currentWeek} of ${totalWeeks}`;

  const sessionsHtml = workout
    ? `<div class="modal-fields">${workout.sessions.map(workoutSessionHtml).join("")}</div>`
    : "";

  return `
    <h2 class="modal-title">${esc(eventName)} — Training</h2>
    <p class="modal-date">${esc(formatLongDate(isoDate))}</p>
    <div class="modal-fields">
      ${fieldHtml("Event day", formatLongDate(block.eventDate))}
      ${fieldHtml("Week", weekLine)}
      ${sessionsHtml}
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
      <div class="modal-fields">
        ${disciplines.map(disciplineHtml).join("")}
      </div>
    </div>
  `;
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

function openModal(html, label) {
  modalBody.innerHTML = html;
  modalCard.setAttribute("aria-label", label);
  modalOverlay.hidden = false;
  lastFocused = document.activeElement;
  modalCard.focus();
}

function closeModal() {
  modalOverlay.hidden = true;
  if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  lastFocused = null;
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
  const dayEvents = eventsByDate[isoDate];
  if (dayEvents && dayEvents.length) {
    const html = dayEvents.length > 1
      ? dayEvents.map(renderEventModal).join('<div class="modal-event-divider"></div>')
      : renderEventModal(dayEvents[0]);
    const label = dayEvents.map(ev => `${ev.name}, ${formatLongDate(ev.date)}`).join("; ");
    openModal(html, label);
    return;
  }
  const block = trainingBlockFor(isoDate);
  if (block) {
    const ev = EVENTS.find(e => e.date === block.eventDate);
    openModal(renderTrainingModal(isoDate, block), `${ev ? ev.name : "Event"} training, ${formatLongDate(isoDate)}`);
    return;
  }
  openModal(renderBlankModal(), `${formatLongDate(isoDate)}, no event`);
}

const today = new Date();
const todayIso = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
const container = document.getElementById("calendar");

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
        const isUpcoming = isoDate >= todayIso;
        el.style.background = (block.strongColorForFuture && isUpcoming)
          ? palette.bg
          : hexToRgba(palette.dot, 0.11);
        const ev = EVENTS.find(e => e.date === block.eventDate);
        ariaLabel += `: ${ev ? ev.name : "event"} training`;
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
    // (since the grid no longer draws one along its full width) —
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
