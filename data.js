// Add events here as { date: "YYYY-MM-DD", name: "Event name", colorIndex }.
// colorIndex picks the palette entry below - pick indices so that any two
// chronologically back-to-back training blocks don't land on similar hues.
// Each event has a disciplines[] array (one entry per leg - swim/bike/run
// etc, however many the event has), plus an overall location. Every
// discipline entry can carry a type (e.g. lake/flat), distance, target
// duration and target average pace - shown in the day popup. Left blank
// for now where details aren't confirmed yet.
const EVENTS = [
  {
    date: "2026-09-26", name: "Dorney Olympic", colorIndex: 0, // blue
    location: "Dorney Lake, Windsor",
    disciplines: [
      { discipline: "Swim", type: "Lake", distance: "1.5km", duration: "40:00-45:00", pace: "2:40-3:00/100m" },
      { discipline: "Bike", type: "Flat", distance: "40km", duration: "1:15:00-1:30:00", pace: "26.7-31 km/h" },
      { discipline: "Run", type: "Flat", distance: "10km", duration: "55:00-1:00:00", pace: "5:30-6:00/km" },
    ],
  },
  {
    date: "2026-11-15", name: "Bristol Half", colorIndex: 1, // pink
    location: "Bristol, Somerset",
    disciplines: [
      { discipline: "Run", type: "Hilly", distance: "21.1km", duration: "2:00:00-2:06:36", pace: "5:41-6:00/km" },
    ],
  },
  {
    date: "2027-01-16", name: "5km Swim", colorIndex: 4, // purple
    location: "TBC (outdoor?)",
    disciplines: [
      { discipline: "Swim", type: "Pool", distance: "5,000m", duration: "2:15:00-2:30:00", pace: "2:42-3:00/100m" },
    ],
  },
  {
    date: "2027-04-03", name: "Jurassic Century", colorIndex: 2, // green
    location: "Exeter to Poole",
    disciplines: [
      { discipline: "Bike", type: "Hilly", distance: "180km", duration: "8:00:00-9:00:00", pace: "20-22.5 km/h" },
    ],
  },
  {
    date: "2027-09-05", name: "IRONMAN Belgium", colorIndex: 8, // red
    location: "Knokke-Heist, Belgium",
    disciplines: [
      { discipline: "Swim", type: "River", distance: "3.8km", duration: "1:41:00-1:54:00", pace: "2:40-3:00/100m" },
      { discipline: "Bike", type: "Flat", distance: "180km", duration: "7:30:00-8:00:00", pace: "22.5-24 km/h" },
      { discipline: "Run", type: "Flat", distance: "42.2km", duration: "4:15:00-5:00:00", pace: "6:00-7:00/km" },
    ],
  },
];

// Subtle, professional palette - background tint + matching dot/text shade.
const PALETTE = [
  { bg: "#d7e2ef", dot: "#4a7ab5", text: "#355d8f" }, // 0 blue
  { bg: "#eed8e5", dot: "#b34d88", text: "#8a3f68" }, // 1 pink
  { bg: "#dce9de", dot: "#5f9a68", text: "#457348" }, // 2 green
  { bg: "#f2e7d5", dot: "#c3903f", text: "#7e5a1f" }, // 3 amber
  { bg: "#e7deee", dot: "#9268b0", text: "#71508c" }, // 4 purple
  { bg: "#d8e9e6", dot: "#4f9b8c", text: "#397569" }, // 5 teal
  { bg: "#f0e2da", dot: "#bb7c56", text: "#93603f" }, // 6 terracotta
  { bg: "#dee1f2", dot: "#6b78c4", text: "#4d599e" }, // 7 indigo
  { bg: "#f2dad8", dot: "#c4574f", text: "#96382f" }, // 8 red
];

// Training blocks: every day from start to end is tinted with the same
// colour as the event it builds towards, at low opacity. The event's
// own day keeps its own distinct (stronger) event colour separately.
// colorIndex isn't set by hand here - it's looked up from the linked
// event in script.js, so a block can never drift out of sync with its
// event's colour (e.g. after a recolour). In date order: blue -> pink ->
// purple -> green -> red, so no two consecutive blocks share a similar
// hue.
// strongColorForFuture: upcoming (not-yet-passed) training days use the
// same solid colour as their event day itself, rather than the usual
// subtle tint; once a training day is in the past it drops back to the
// subtle tint (the score-through already marks it as done).
const TRAINING_BLOCKS_RAW = [
  { start: "2026-07-06", end: "2026-09-25", eventDate: "2026-09-26", strongColorForFuture: true }, // Dorney Olympic
  { start: "2026-10-05", end: "2026-11-14", eventDate: "2026-11-15", strongColorForFuture: true }, // Bristol Half
  { start: "2026-11-23", end: "2027-01-15", eventDate: "2027-01-16", strongColorForFuture: true }, // 5km Swim
  { start: "2027-01-25", end: "2027-04-02", eventDate: "2027-04-03", strongColorForFuture: true }, // Jurassic Century, 10 weeks
  { start: "2027-04-12", end: "2027-09-04", eventDate: "2027-09-05", strongColorForFuture: true }, // IRONMAN Belgium, 21 weeks
];

// Day-by-day workouts for training-block days that have a specific planned
// session (as opposed to the generic "Week X of Y" popup shown when no
// entry exists here). Keyed by ISO date; each entry's sessions[] holds one
// object per workout that day - most days have one, brick days (e.g. bike
// straight into a run) have two, shown stacked in the popup in order.
const WORKOUTS = {
  // --- Dorney Olympic block: Week 1 (06-12 Jul 26) ---
  "2026-07-06": { week: 1, phase: "Base", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "30 min", details: "4 x 15 sec relaxed strides", rpe: "RPE 3-4/10" },
  ]},
  "2026-07-07": { week: 1, phase: "Base", sessions: [
    { day: "Tue", discipline: "Swim", session: "Technique Swim", duration: "400 m", details: "Catch-up + fingertip-drag drills", rpe: "Easy technique" },
  ]},
  "2026-07-09": { week: 1, phase: "Base", sessions: [
    { day: "Thu", discipline: "Run", session: "Quality Run", duration: "35 min", details: "4 x 1 min; 2 min jog recovery", rpe: "RPE 6/10" },
  ]},
  "2026-07-10": { week: 1, phase: "Base", sessions: [
    { day: "Fri", discipline: "Swim", session: "Endurance Swim", duration: "550 m", details: "3 x 100 m steady front crawl", rpe: "Steady" },
  ]},
  "2026-07-11": { week: 1, phase: "Base", sessions: [
    { day: "Sat", discipline: "Bike", session: "Endurance Bike", duration: "80 min", details: "Easy continuous ride; cadence 85-95 rpm", rpe: "RPE 3-4/10" },
  ]},

  // --- Week 2 (13-19 Jul 26) ---
  "2026-07-13": { week: 2, phase: "Base", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "35 min", details: "Continuous conversational run", rpe: "RPE 3-4/10" },
  ]},
  "2026-07-14": { week: 2, phase: "Base", sessions: [
    { day: "Tue", discipline: "Swim", session: "Technique Swim", duration: "500 m", details: "Catch-up, fingertip-drag + sighting drills", rpe: "Easy technique" },
  ]},
  "2026-07-16": { week: 2, phase: "Base", sessions: [
    { day: "Thu", discipline: "Run", session: "Quality Run", duration: "40 min", details: "5 x 1 min; 2 min jog recovery", rpe: "RPE 6-7/10" },
  ]},
  "2026-07-17": { week: 2, phase: "Base", sessions: [
    { day: "Fri", discipline: "Swim", session: "Endurance Swim", duration: "650 m", details: "4 x 100 m steady front crawl", rpe: "Steady" },
  ]},
  "2026-07-18": { week: 2, phase: "Base", sessions: [
    { day: "Sat", discipline: "Bike", session: "Endurance Bike", duration: "90 min", details: "Easy ride; smooth cadence", rpe: "RPE 3-4/10" },
  ]},

  // --- Week 3 (20-26 Jul 26) ---
  "2026-07-20": { week: 3, phase: "Base", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "35 min", details: "Easy continuous run", rpe: "RPE 3-4/10" },
  ]},
  "2026-07-21": { week: 3, phase: "Base", sessions: [
    { day: "Tue", discipline: "Swim", session: "Technique Swim", duration: "600 m", details: "Catch-up, fingertip-drag, sighting + touch-turn drills", rpe: "Easy technique" },
  ]},
  "2026-07-23": { week: 3, phase: "Base", sessions: [
    { day: "Thu", discipline: "Run", session: "Quality Run", duration: "40 min", details: "6 x 1 min; 90 sec jog recovery", rpe: "RPE 6-7/10" },
  ]},
  "2026-07-24": { week: 3, phase: "Base", sessions: [
    { day: "Fri", discipline: "Swim", session: "Endurance Swim", duration: "750 m", details: "2 x 200 m continuous front crawl", rpe: "Steady" },
  ]},
  "2026-07-25": { week: 3, phase: "Base", sessions: [
    { day: "Sat", discipline: "Bike", session: "Endurance Bike", duration: "100 min", details: "Easy continuous ride, rolling terrain", rpe: "RPE 3-4/10" },
  ]},

  // --- Week 4 (27 Jul-02 Aug 26) ---
  "2026-07-27": { week: 4, phase: "Base", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "30 min", details: "Recovery-week run", rpe: "RPE 2-3/10" },
  ]},
  "2026-07-28": { week: 4, phase: "Base", sessions: [
    { day: "Tue", discipline: "Swim", session: "Technique Swim", duration: "450 m", details: "Catch-up + sighting drills", rpe: "Easy recovery" },
  ]},
  "2026-07-30": { week: 4, phase: "Base", sessions: [
    { day: "Thu", discipline: "Run", session: "Quality Run", duration: "30 min", details: "4 x 1 min; 2 min jog recovery", rpe: "RPE 6/10" },
  ]},
  "2026-07-31": { week: 4, phase: "Base", sessions: [
    { day: "Fri", discipline: "Swim", session: "Endurance Swim", duration: "600 m", details: "3 x 100 m relaxed front crawl", rpe: "Easy recovery" },
  ]},
  "2026-08-01": { week: 4, phase: "Base", sessions: [
    { day: "Sat", discipline: "Bike", session: "Brick Bike", duration: "65 min", details: "Easy recovery ride; no hard climbs", rpe: "RPE 2-3/10" },
    { day: "Sat", discipline: "Run", session: "Brick Run", duration: "10 min", details: "Straight off the bike; short easy steps", rpe: "RPE 2-3/10" },
  ]},

  // --- Week 5 (03-09 Aug 26) ---
  "2026-08-03": { week: 5, phase: "Base", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "40 min", details: "Continuous conversational run", rpe: "RPE 3-4/10" },
  ]},
  "2026-08-04": { week: 5, phase: "Base", sessions: [
    { day: "Tue", discipline: "Swim", session: "Technique Swim", duration: "700 m", details: "Technique drills + 2 x 100 m front crawl", rpe: "Easy-steady" },
  ]},
  "2026-08-06": { week: 5, phase: "Base", sessions: [
    { day: "Thu", discipline: "Run", session: "Quality Run", duration: "45 min", details: "7 x 1 min; 90 sec jog recovery", rpe: "RPE 7/10" },
  ]},
  "2026-08-07": { week: 5, phase: "Base", sessions: [
    { day: "Fri", discipline: "Swim", session: "Endurance Swim", duration: "950 m", details: "300 m + 200 m continuous; 2 x 50 m easy", rpe: "Steady" },
  ]},
  "2026-08-08": { week: 5, phase: "Base", sessions: [
    { day: "Sat", discipline: "Bike", session: "Endurance Bike", duration: "110 min", details: "Easy ride; 3 x 5 min aero posture", rpe: "RPE 3-4/10" },
  ]},

  // --- Week 6 (10-16 Aug 26) ---
  "2026-08-10": { week: 6, phase: "Build", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "40 min", details: "Easy continuous run", rpe: "RPE 3-4/10" },
  ]},
  "2026-08-11": { week: 6, phase: "Build", sessions: [
    { day: "Tue", discipline: "Swim", session: "Interval Swim", duration: "1,000 m", details: "6 x 100 m front crawl + 3 x 50 m speed", rpe: "RPE 6/10 main set" },
  ]},
  "2026-08-13": { week: 6, phase: "Build", sessions: [
    { day: "Thu", discipline: "Run", session: "Interval Run", duration: "45 min", details: "6 x 3 min; 2 min jog recovery", rpe: "RPE 7-8/10" },
  ]},
  "2026-08-14": { week: 6, phase: "Build", sessions: [
    { day: "Fri", discipline: "Swim", session: "Endurance Swim", duration: "1,100 m", details: "400 m + 300 m continuous front crawl", rpe: "Steady" },
  ]},
  "2026-08-15": { week: 6, phase: "Build", sessions: [
    { day: "Sat", discipline: "Bike", session: "Tempo Bike", duration: "115 min", details: "40 min tempo block; cadence 85-95 rpm", rpe: "RPE 5-6/10" },
  ]},

  // --- Week 7 (17-23 Aug 26) ---
  "2026-08-17": { week: 7, phase: "Build", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "45 min", details: "Easy continuous run", rpe: "RPE 3-4/10" },
  ]},
  "2026-08-18": { week: 7, phase: "Build", sessions: [
    { day: "Tue", discipline: "Swim", session: "Pool Swim", duration: "1,350 m", details: "8 x 100 m endurance + 7 x 50 m speed", rpe: "Steady / controlled" },
  ]},
  "2026-08-20": { week: 7, phase: "Build", sessions: [
    { day: "Thu", discipline: "Run", session: "Interval Run", duration: "50 min", details: "7 x 3 min; 2 min jog recovery", rpe: "RPE 7-8/10" },
  ]},
  "2026-08-21": { week: 7, phase: "Build", sessions: [
    { day: "Fri", discipline: "Swim", session: "Open-Water Swim", duration: "400-600 m", details: "Easy continuous swim; wetsuit + sighting practice", rpe: "Easy" },
  ]},
  "2026-08-22": { week: 7, phase: "Build", sessions: [
    { day: "Sat", discipline: "Bike", session: "Tempo Bike", duration: "125 min", details: "45 min tempo; 4 x 5 min race posture", rpe: "RPE 5-6/10" },
  ]},

  // --- Week 8 (24-30 Aug 26) ---
  "2026-08-24": { week: 8, phase: "Build", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "35 min", details: "Recovery-week run", rpe: "RPE 2-3/10" },
  ]},
  "2026-08-25": { week: 8, phase: "Build", sessions: [
    { day: "Tue", discipline: "Swim", session: "Pool Swim", duration: "1,000 m", details: "3 x 150 m + 1 x 100 m endurance; 5 x 50 m speed", rpe: "Controlled" },
  ]},
  "2026-08-27": { week: 8, phase: "Build", sessions: [
    { day: "Thu", discipline: "Run", session: "Quality Run", duration: "35 min", details: "5 x 2 min; 2 min jog recovery", rpe: "Moderate-hard" },
  ]},
  "2026-08-28": { week: 8, phase: "Build", sessions: [
    { day: "Fri", discipline: "Swim", session: "Open-Water Swim", duration: "600-800 m", details: "Relaxed continuous swim + sighting practice", rpe: "Easy" },
  ]},
  "2026-08-29": { week: 8, phase: "Build", sessions: [
    { day: "Sat", discipline: "Bike", session: "Brick Bike", duration: "75 min", details: "Easy spin; no tempo work", rpe: "RPE 2-3/10" },
    { day: "Sat", discipline: "Run", session: "Brick Run", duration: "10 min", details: "Straight off the bike; quick, light cadence", rpe: "Very easy" },
  ]},

  // --- Week 9 (31 Aug-06 Sep 26) ---
  "2026-08-31": { week: 9, phase: "Build", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "45 min", details: "Easy continuous run", rpe: "RPE 3-4/10" },
  ]},
  "2026-09-01": { week: 9, phase: "Build", sessions: [
    { day: "Tue", discipline: "Swim", session: "Pool Swim", duration: "1,700 m", details: "4 x 200 m + 2 x 150 m endurance; 8 x 50 m speed", rpe: "Steady / controlled" },
  ]},
  "2026-09-03": { week: 9, phase: "Build", sessions: [
    { day: "Thu", discipline: "Run", session: "Interval Run", duration: "50 min", details: "8 x 3 min; 90 sec jog recovery", rpe: "RPE 7-8/10" },
  ]},
  "2026-09-04": { week: 9, phase: "Build", sessions: [
    { day: "Fri", discipline: "Swim", session: "Open-Water Swim", duration: "800-1,000 m", details: "Longer continuous swim + navigation practice", rpe: "Steady" },
  ]},
  "2026-09-05": { week: 9, phase: "Build", sessions: [
    { day: "Sat", discipline: "Bike", session: "Tempo Bike", duration: "135 min", details: "50 min tempo + full fuelling rehearsal", rpe: "RPE 5-6/10" },
  ]},

  // --- Week 10 (07-13 Sep 26) ---
  "2026-09-07": { week: 10, phase: "Build", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "50 min", details: "Easy continuous run", rpe: "RPE 3-4/10" },
  ]},
  "2026-09-08": { week: 10, phase: "Build", sessions: [
    { day: "Tue", discipline: "Swim", session: "Pool Swim", duration: "1,500 m", details: "3 x 250 m + 1 x 200 m endurance; 7 x 50 m speed", rpe: "Controlled" },
  ]},
  "2026-09-10": { week: 10, phase: "Build", sessions: [
    { day: "Thu", discipline: "Run", session: "Race-Pace Run", duration: "10 km / ~80 min", details: "10 km at Olympic effort (~5:45-5:55/km)", rpe: "Race effort" },
  ]},
  "2026-09-11": { week: 10, phase: "Build", sessions: [
    { day: "Fri", discipline: "Swim", session: "Open-Water Swim", duration: "1,000-1,200 m", details: "Comfortable race-specific continuous swim", rpe: "Controlled race-specific" },
  ]},
  "2026-09-12": { week: 10, phase: "Build", sessions: [
    { day: "Sat", discipline: "Bike", session: "Race-Pace Bike", duration: "40 km / 150 min", details: "40 km at race effort; full fuelling rehearsal", rpe: "RPE 6/10" },
  ]},

  // --- Week 11 (14-20 Sep 26) ---
  "2026-09-14": { week: 11, phase: "Peak", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "30 min", details: "Freshness-focused continuous run", rpe: "Easy" },
  ]},
  "2026-09-15": { week: 11, phase: "Peak", sessions: [
    { day: "Tue", discipline: "Swim", session: "Pool Swim", duration: "1,200 m", details: "2 x 300 m + 1 x 150 m endurance; 5 x 50 m speed", rpe: "Controlled" },
    { day: "Tue", discipline: "Bike", session: "Transition Bike", duration: "10 min", details: "Easy spin straight off the swim; T1 rehearsal", rpe: "Easy" },
  ]},
  "2026-09-17": { week: 11, phase: "Peak", sessions: [
    { day: "Thu", discipline: "Run", session: "Interval Run", duration: "35 min", details: "4 x 1 km at goal race pace; 90 sec jog recovery", rpe: "Race-pace reps" },
  ]},
  "2026-09-18": { week: 11, phase: "Peak", sessions: [
    { day: "Fri", discipline: "Swim", session: "Open-Water Swim", duration: "800-1,000 m", details: "Race-rehearsal continuous swim", rpe: "Controlled; do not race" },
  ]},
  "2026-09-19": { week: 11, phase: "Peak", sessions: [
    { day: "Sat", discipline: "Bike", session: "Brick Bike", duration: "28 km / 100 min", details: "27-30 km at race effort; full race kit + nutrition", rpe: "RPE 6/10" },
    { day: "Sat", discipline: "Run", session: "Brick Run", duration: "15 min", details: "Straight off bike; settle into Olympic effort", rpe: "Controlled race effort" },
  ]},

  // --- Week 12 (21-27 Sep 26) - Taper/Race. Race day itself (Sat 26 Sep)
  // is the Dorney Olympic event above, not repeated here. ---
  "2026-09-21": { week: 12, phase: "Taper / Race", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "20 min", details: "Very easy jog", rpe: "Easy" },
  ]},
  "2026-09-22": { week: 12, phase: "Taper / Race", sessions: [
    { day: "Tue", discipline: "Swim", session: "Pool Swim", duration: "600 m", details: "2 x 150 m endurance + 3 x 50 m speed", rpe: "Easy / sharp" },
  ]},
  "2026-09-24": { week: 12, phase: "Taper / Race", sessions: [
    { day: "Thu", discipline: "Run", session: "Strides Run", duration: "20 min", details: "4 x 20 sec relaxed strides; full recovery", rpe: "Easy with short pickups" },
  ]},
  "2026-09-25": { week: 12, phase: "Taper / Race", sessions: [
    { day: "Fri", discipline: "Swim", session: "Easy Swim", duration: "500 m", details: "4 x 50 m race-effort pickups", rpe: "Easy with short pickups" },
  ]},

  // --- Bristol Half block: Week 1 (05-11 Oct 26) ---
  "2026-10-06": { week: 1, phase: "Build", sessions: [
    { day: "Tue", discipline: "Run", session: "Quality Run", duration: "40 min", details: "10 min WU; 5 x 3 min Threshold; 2:30 jog between reps; 5 min CD", rpe: "RPE 7/10" },
  ]},
  "2026-10-08": { week: 1, phase: "Build", sessions: [
    { day: "Thu", discipline: "Swim", session: "Maintenance Swim", duration: "1,200 m", details: "100 m WU; 5 x 200 m Endurance (30 sec rest); 100 m CD", rpe: "RPE 5-6/10" },
  ]},
  "2026-10-10": { week: 1, phase: "Build", sessions: [
    { day: "Sat", discipline: "Run", session: "Long Run", duration: "12 km", details: "Endurance / Long; continuous easy running", rpe: "RPE 4-5/10" },
  ]},

  // --- Week 2 (12-18 Oct 26) ---
  "2026-10-13": { week: 2, phase: "Build", sessions: [
    { day: "Tue", discipline: "Run", session: "Quality Run", duration: "40 min", details: "10 min WU; 4 x 4 min Threshold; 3 min jog between reps; 5 min CD", rpe: "RPE 7-8/10" },
  ]},
  "2026-10-15": { week: 2, phase: "Build", sessions: [
    { day: "Thu", discipline: "Run", session: "Easy Run", duration: "30 min", details: "Easy / Recovery; conversational effort", rpe: "RPE 3-4/10" },
  ]},
  "2026-10-17": { week: 2, phase: "Build", sessions: [
    { day: "Sat", discipline: "Run", session: "Long Run", duration: "14 km", details: "Endurance / Long; controlled and even", rpe: "RPE 4-5/10" },
  ]},

  // --- Week 3 (19-25 Oct 26) - Deload ---
  "2026-10-20": { week: 3, phase: "Deload", sessions: [
    { day: "Tue", discipline: "Run", session: "Easy Run", duration: "25 min", details: "Easy / Recovery; genuinely light", rpe: "RPE 3/10" },
  ]},
  "2026-10-22": { week: 3, phase: "Deload", sessions: [
    { day: "Thu", discipline: "Swim", session: "Maintenance Swim", duration: "1,200 m", details: "100 m WU; 5 x 200 m Endurance (30 sec rest); 100 m CD", rpe: "RPE 5-6/10" },
  ]},
  "2026-10-24": { week: 3, phase: "Deload", sessions: [
    { day: "Sat", discipline: "Run", session: "Long Run", duration: "9 km", details: "Endurance / Long; reduced-volume long run", rpe: "RPE 3-4/10" },
  ]},

  // --- Week 4 (26 Oct-01 Nov 26) - Peak ---
  "2026-10-27": { week: 4, phase: "Peak", sessions: [
    { day: "Tue", discipline: "Run", session: "Tempo Run", duration: "45 min", details: "10 min WU; 3 x 8 min Threshold; 3 min jog between reps; 5 min CD", rpe: "RPE 7/10" },
  ]},
  "2026-10-29": { week: 4, phase: "Peak", sessions: [
    { day: "Thu", discipline: "Run", session: "Easy Run", duration: "30 min", details: "Easy / Recovery; conversational effort", rpe: "RPE 3-4/10" },
  ]},
  "2026-10-31": { week: 4, phase: "Peak", sessions: [
    { day: "Sat", discipline: "Run", session: "Long Run + HM Finish", duration: "15 km", details: "Endurance / Long; final 15-20 min at 70.3 Race Pace", rpe: "RPE 4-6/10" },
  ]},

  // --- Week 5 (02-08 Nov 26) - Peak ---
  "2026-11-03": { week: 5, phase: "Peak", sessions: [
    { day: "Tue", discipline: "Run", session: "HM-Specific Run", duration: "40 min", details: "10 min WU; 20 min continuous at 70.3 Race Pace; 10 min CD", rpe: "Controlled" },
  ]},
  "2026-11-05": { week: 5, phase: "Peak", sessions: [
    { day: "Thu", discipline: "Swim", session: "Maintenance Swim", duration: "1,200 m", details: "100 m WU; 5 x 200 m Endurance (30 sec rest); 100 m CD", rpe: "RPE 5-6/10" },
  ]},
  "2026-11-07": { week: 5, phase: "Peak", sessions: [
    { day: "Sat", discipline: "Run", session: "Long Run + HM Finish", duration: "17 km", details: "Endurance / Long; final 20-30 min at 70.3 Race Pace", rpe: "RPE 4-6/10" },
  ]},

  // --- Week 6 (09-15 Nov 26) - Taper/Race. Race day itself (Sun 15 Nov)
  // is the Bristol Half event above, not repeated here. ---
  "2026-11-10": { week: 6, phase: "Taper / Race", sessions: [
    { day: "Tue", discipline: "Run", session: "Shakeout Run", duration: "20 min total", details: "Easy / Recovery; 4 x 20 sec relaxed strides embedded in final 10 min", rpe: "Easy" },
  ]},
  "2026-11-12": { week: 6, phase: "Taper / Race", sessions: [
    { day: "Thu", discipline: "Swim", session: "Optional Recovery Swim", duration: "800-1,000 m", details: "200 m WU; 400-600 m Easy / Recovery; 200 m CD; skip if fatigued", rpe: "RPE 2-3/10" },
  ]},
};
