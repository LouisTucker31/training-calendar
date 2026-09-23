// Supabase-backed data layer. Loads EVENTS, TRAINING_BLOCKS_RAW and
// WORKOUTS from Supabase at startup and reshapes them into the exact same
// globals data.js used to define by hand, so script.js needs no changes
// beyond awaiting loadTrainingData() before it reads them. Logged-workout
// state also moves here, from localStorage to the training_logged_workouts
// table, so it now syncs across devices instead of being stuck per-browser.
const SUPABASE_URL = "https://vumsggojkacntpzhprqh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1bXNnZ29qa2FjbnRwemhwcnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MTcwMzMsImV4cCI6MjEwMzk5MzAzM30.6GOt0pXy2hi_sQcIMmrCeb_0UF9_tKJQqmvj6iSGWTU";

async function supabaseRequest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase request failed (${res.status}): ${path} ${text}`);
  }
  // Some writes (DELETE, or POST without Prefer: return=representation)
  // come back with an empty body - guard against JSON-parsing that.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Fetches training_events/training_event_blocks/training_workouts and
// reshapes each row back into the camelCase field names the rest of the
// app (script.js) already expects, matching data.js's old hand-written
// shape exactly.
async function loadTrainingData() {
  const [eventRows, blockRows, workoutRows] = await Promise.all([
    supabaseRequest("training_events?select=*"),
    supabaseRequest("training_event_blocks?select=*"),
    supabaseRequest("training_workouts?select=*"),
  ]);

  const EVENTS = eventRows.map(r => ({
    date: r.date,
    name: r.name,
    colorIndex: r.color_index,
    location: r.location || "",
    website: r.website || "",
    garminEpicLink: r.garmin_epic_link || "",
    garminEpicLinkLabel: r.garmin_epic_link_label || "",
    disciplines: r.disciplines || [],
  }));

  const TRAINING_BLOCKS_RAW = blockRows.map(r => ({
    start: r.start_date,
    end: r.end_date,
    eventDate: r.event_date,
  }));

  const WORKOUTS = {};
  workoutRows.forEach(r => {
    WORKOUTS[r.date] = { week: r.week, phase: r.phase, sessions: r.sessions || [] };
  });

  return { EVENTS, TRAINING_BLOCKS_RAW, WORKOUTS };
}

async function fetchLoggedDates() {
  const rows = await supabaseRequest("training_logged_workouts?select=date");
  return new Set(rows.map(r => r.date));
}

async function insertLoggedDate(isoDate) {
  await supabaseRequest("training_logged_workouts", {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates" },
    body: JSON.stringify({ date: isoDate }),
  });
}

async function deleteLoggedDate(isoDate) {
  await supabaseRequest(`training_logged_workouts?date=eq.${encodeURIComponent(isoDate)}`, {
    method: "DELETE",
  });
}

// Returns the most recent pace-benchmark row (or null if none exist yet),
// reshaped to camelCase. Every save inserts a new row rather than
// updating one in place (see insertPaceBenchmarks below), so this is
// always "the latest values", not "the only values" - past rows are
// never read back by the app yet, just preserved for later.
async function fetchLatestPaceBenchmarks() {
  const rows = await supabaseRequest("training_pace_benchmarks?select=*&order=set_at.desc&limit=1");
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    cssPace: r.css_pace || "",
    cyclingLthr: r.cycling_lthr ?? null,
    runThresholdPace: r.run_threshold_pace || "",
  };
}

// Always an insert, never an update - see the table comment in
// supabase-schema.sql for why (preserves benchmark history over time).
async function insertPaceBenchmarks({ cssPace, cyclingLthr, runThresholdPace }) {
  await supabaseRequest("training_pace_benchmarks", {
    method: "POST",
    body: JSON.stringify({
      css_pace: cssPace || null,
      cycling_lthr: cyclingLthr === "" || cyclingLthr == null ? null : Number(cyclingLthr),
      run_threshold_pace: runThresholdPace || null,
    }),
  });
}
