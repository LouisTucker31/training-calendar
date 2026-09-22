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
    garminEpicLink: "https://connect.garmin.com/app/epic/f695c782-210c-4902-8d87-7cc8c40c49fe",
    garminEpicLinkLabel: "Dorney Olympic Epic",
    disciplines: [
      { discipline: "Swim", type: "Lake", distance: "1.5km", duration: "40:00-45:00", pace: "2:40-3:00/100m" },
      { discipline: "Bike", type: "Flat", distance: "40km", duration: "1:15:00-1:30:00", pace: "26.7-31 km/h" },
      { discipline: "Run", type: "Flat", distance: "10km", duration: "55:00-1:00:00", pace: "5:30-6:00/km" },
    ],
  },
  {
    date: "2026-11-15", name: "Bristol Half", colorIndex: 1, // pink
    location: "Bristol, Somerset",
    garminEpicLink: "https://connect.garmin.com/app/epic/1f25310e-61ee-4440-a994-bdb0ba9edd9a",
    garminEpicLinkLabel: "Bristol Half Epic",
    disciplines: [
      { discipline: "Run", type: "Hilly", distance: "21.1km", duration: "2:00:00-2:06:36", pace: "5:41-6:00/km" },
    ],
  },
  {
    date: "2027-01-16", name: "5km Swim", colorIndex: 4, // purple
    location: "TBC (outdoor?)",
    garminEpicLink: "https://connect.garmin.com/app/epic/bebe43f6-403e-4884-8d1f-d9e2e5d3d859",
    garminEpicLinkLabel: "5km Swim Epic",
    disciplines: [
      { discipline: "Swim", type: "Pool", distance: "5,000m", duration: "2:15:00-2:30:00", pace: "2:42-3:00/100m" },
    ],
  },
  {
    date: "2027-04-03", name: "Jurassic Century", colorIndex: 2, // green
    location: "Exeter to Poole",
    garminEpicLink: "",
    disciplines: [
      { discipline: "Bike", type: "Hilly", distance: "180km", duration: "8:00:00-9:00:00", pace: "20-22.5 km/h" },
    ],
  },
  {
    date: "2027-09-05", name: "IRONMAN Belgium", colorIndex: 8, // red
    location: "Knokke-Heist, Belgium",
    garminEpicLink: "",
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
  "2026-11-07": { week: 5, phase: "Peak", sessions: [
    { day: "Sat", discipline: "Run", session: "Long Run + HM Finish", duration: "17 km", details: "Endurance / Long; final 20-30 min at 70.3 Race Pace", rpe: "RPE 4-6/10" },
  ]},

  // --- Week 6 (09-15 Nov 26) - Taper/Race. Race day itself (Sun 15 Nov)
  // is the Bristol Half event above, not repeated here. ---
  "2026-11-10": { week: 6, phase: "Taper / Race", sessions: [
    { day: "Tue", discipline: "Run", session: "Shakeout Run", duration: "20 min total", details: "Easy / Recovery; 4 x 20 sec relaxed strides embedded in final 10 min", rpe: "Easy" },
  ]},

  // --- 5km Swim block: Week 1 (23-29 Nov 26) ---
  "2026-11-23": { week: 1, phase: "Return", sessions: [
    { day: "Mon", discipline: "Swim", session: "Easy / Technique Swim", duration: "1,000 m", details: "200 m Easy / Recovery WU; 8 x 50 m technique (25 m Catch-Up / 25 m Easy, 20 sec rest); 300 m Endurance; 100 m Easy / Recovery CD", rpe: "RPE 3-4/10" },
  ]},
  "2026-11-25": { week: 1, phase: "Return", sessions: [
    { day: "Wed", discipline: "Swim", session: "Quality Swim", duration: "1,100 m", details: "200 m Easy / Recovery WU; 6 x 100 m CSS / Threshold (20-30 sec rest); 300 m Easy / Recovery CD", rpe: "RPE 6-7/10" },
  ]},
  "2026-11-28": { week: 1, phase: "Return", sessions: [
    { day: "Sat", discipline: "Swim", session: "Endurance Swim", duration: "1,400 m", details: "continuous at Endurance effort; settle into a relaxed, sustainable rhythm", rpe: "RPE 4-5/10" },
  ]},

  // --- Week 2 (30 Nov-06 Dec 26) - Build ---
  "2026-11-30": { week: 2, phase: "Build", sessions: [
    { day: "Mon", discipline: "Swim", session: "Easy / Technique Swim", duration: "1,100 m", details: "200 m Easy / Recovery WU; 8 x 50 m technique (4 Catch-Up, 4 Fingertip-Drag, 20 sec rest); 400 m Endurance; 100 m Easy / Recovery CD", rpe: "RPE 3-4/10" },
  ]},
  "2026-12-02": { week: 2, phase: "Build", sessions: [
    { day: "Wed", discipline: "Swim", session: "Quality Swim", duration: "1,300 m", details: "200 m Easy / Recovery WU; 8 x 100 m CSS / Threshold (20-30 sec rest); 300 m Easy / Recovery CD", rpe: "RPE 6-7/10" },
  ]},
  "2026-12-05": { week: 2, phase: "Build", sessions: [
    { day: "Sat", discipline: "Swim", session: "Endurance Swim", duration: "1,800 m", details: "continuous at Endurance effort; smooth, even pacing", rpe: "RPE 4-5/10" },
  ]},

  // --- Week 3 (07-13 Dec 26) - Build ---
  "2026-12-07": { week: 3, phase: "Build", sessions: [
    { day: "Mon", discipline: "Swim", session: "Easy / Technique Swim", duration: "1,200 m", details: "200 m Easy / Recovery WU; 8 x 50 m technique (alternate Catch-Up / Fingertip-Drag, 20 sec rest); 500 m Endurance; 100 m Easy / Recovery CD", rpe: "RPE 3-4/10" },
  ]},
  "2026-12-09": { week: 3, phase: "Build", sessions: [
    { day: "Wed", discipline: "Swim", session: "Quality Swim", duration: "1,400 m", details: "300 m Easy / Recovery WU; 4 x 200 m CSS / Threshold (25-30 sec rest); 300 m Easy / Recovery CD", rpe: "RPE 6-7/10" },
  ]},
  "2026-12-12": { week: 3, phase: "Build", sessions: [
    { day: "Sat", discipline: "Swim", session: "Endurance Swim", duration: "2,200 m", details: "continuous at Endurance effort; maintain technique as distance increases", rpe: "RPE 4-5/10" },
  ]},

  // --- Week 4 (14-20 Dec 26) - Consolidation ---
  "2026-12-14": { week: 4, phase: "Consolidation", sessions: [
    { day: "Mon", discipline: "Swim", session: "Easy / Technique Swim", duration: "1,000 m", details: "200 m Easy / Recovery WU; 6 x 50 m Catch-Up (20 sec rest); 400 m Endurance; 100 m Easy / Recovery CD", rpe: "RPE 3-4/10" },
  ]},
  "2026-12-16": { week: 4, phase: "Consolidation", sessions: [
    { day: "Wed", discipline: "Swim", session: "Quality Swim", duration: "1,200 m", details: "200 m Easy / Recovery WU; 6 x 100 m CSS / Threshold (20-30 sec rest); 200 m Endurance; 200 m Easy / Recovery CD", rpe: "RPE 6/10" },
  ]},
  "2026-12-19": { week: 4, phase: "Consolidation", sessions: [
    { day: "Sat", discipline: "Swim", session: "Endurance Swim", duration: "2,400 m", details: "continuous at Endurance effort; controlled and sustainable throughout", rpe: "RPE 4-5/10" },
  ]},

  // --- Week 5 (21-27 Dec 26) - Build ---
  "2026-12-21": { week: 5, phase: "Build", sessions: [
    { day: "Mon", discipline: "Swim", session: "Easy / Technique Swim", duration: "1,300 m", details: "250 m Easy / Recovery WU; 8 x 50 m technique (alternate Catch-Up / Fingertip-Drag, 20 sec rest); 500 m Endurance; 150 m Easy / Recovery CD", rpe: "RPE 3-4/10" },
  ]},
  "2026-12-23": { week: 5, phase: "Build", sessions: [
    { day: "Wed", discipline: "Swim", session: "Quality Swim", duration: "1,500 m", details: "300 m Easy / Recovery WU; 5 x 200 m CSS / Threshold (25-30 sec rest); 200 m Easy / Recovery CD", rpe: "RPE 6-7/10" },
  ]},
  "2026-12-26": { week: 5, phase: "Build", sessions: [
    { day: "Sat", discipline: "Swim", session: "Endurance Swim", duration: "2,800 m", details: "continuous at Endurance effort; maintain technique as distance increases", rpe: "RPE 4-5/10" },
  ]},

  // --- Week 6 (28 Dec 26-03 Jan 27) - Build ---
  "2026-12-28": { week: 6, phase: "Build", sessions: [
    { day: "Mon", discipline: "Swim", session: "Easy / Technique Swim", duration: "1,400 m", details: "200 m Easy / Recovery WU; 6 x 50 m Catch-Up (20 sec rest); 400 m Endurance; 100 m Easy / Recovery CD", rpe: "RPE 3-4/10" },
  ]},
  "2026-12-30": { week: 6, phase: "Build", sessions: [
    { day: "Wed", discipline: "Swim", session: "Quality Swim", duration: "1,600 m", details: "300 m Easy / Recovery WU; 4 x 200 m CSS / Threshold (25-30 sec rest); 3 x 100 m Endurance; 200 m Easy / Recovery CD", rpe: "RPE 6/10" },
  ]},
  "2027-01-02": { week: 6, phase: "Build", sessions: [
    { day: "Sat", discipline: "Swim", session: "Endurance Swim", duration: "3,200 m", details: "continuous at Endurance effort; controlled and sustainable throughout", rpe: "RPE 4-5/10" },
  ]},

  // --- Week 7 (04-10 Jan 27) - Peak ---
  "2027-01-04": { week: 7, phase: "Peak", sessions: [
    { day: "Mon", discipline: "Swim", session: "Easy / Technique Swim", duration: "1,300 m", details: "200 m Easy / Recovery WU; 8 x 50 m technique (alternate Catch-Up / Fingertip-Drag; 20 sec rest); 600 m Endurance; 100 m Easy / Recovery CD", rpe: "RPE 3-4/10" },
  ]},
  "2027-01-06": { week: 7, phase: "Peak", sessions: [
    { day: "Wed", discipline: "Swim", session: "Quality Swim", duration: "1,500 m", details: "300 m Easy / Recovery WU; 4 x 200 m CSS / Threshold (25-30 sec rest); 4 x 50 m CSS / Threshold (controlled; 20 sec rest); 200 m Easy / Recovery CD", rpe: "RPE 6-7/10" },
  ]},
  "2027-01-09": { week: 7, phase: "Peak", sessions: [
    { day: "Sat", discipline: "Swim", session: "Endurance Swim", duration: "3,800 m", details: "continuous at Endurance effort; prove full Ironman swim distance continuously", rpe: "RPE 4-5/10" },
  ]},

  // --- Week 8 (11-16 Jan 27) - Taper/Challenge. Race day itself (Sat 16 Jan)
  // is the 5km Swim event above, not repeated here. ---
  "2027-01-11": { week: 8, phase: "Taper / Challenge", sessions: [
    { day: "Mon", discipline: "Swim", session: "Easy / Technique Swim", duration: "900 m", details: "200 m Easy / Recovery WU; 4 x 50 m Catch-Up (20 sec rest); 400 m Endurance; 100 m Easy / Recovery CD", rpe: "RPE 2-3/10" },
  ]},
  "2027-01-13": { week: 8, phase: "Taper / Challenge", sessions: [
    { day: "Wed", discipline: "Swim", session: "Quality Swim", duration: "900 m", details: "200 m Easy / Recovery WU; 4 x 100 m CSS / Threshold (30 sec rest; controlled); 300 m Easy / Recovery CD", rpe: "RPE 5-6/10" },
  ]},

  // --- Jurassic Century block: Week 1 (25-31 Jan 27) ---
  "2027-01-29": { week: 1, phase: "Base", sessions: [
    { day: "Fri", discipline: "Bike", session: "Endurance Ride", duration: "2:00 hrs", details: "Endurance; easy return ride, comfortable throughout", rpe: "RPE 4/10" },
  ]},

  // --- Week 2 (01-07 Feb 27) - Base ---
  "2027-02-05": { week: 2, phase: "Base", sessions: [
    { day: "Fri", discipline: "Bike", session: "Endurance Ride", duration: "2:30 hrs", details: "Endurance; smooth, conservative pacing", rpe: "RPE 4/10" },
  ]},

  // --- Week 3 (08-14 Feb 27) - Base ---
  "2027-02-12": { week: 3, phase: "Base", sessions: [
    { day: "Fri", discipline: "Bike", session: "Endurance Ride", duration: "3:00 hrs", details: "Endurance; begin consistent fuelling and hydration practice", rpe: "RPE 4-5/10" },
  ]},

  // --- Week 4 (15-21 Feb 27) - Recovery ---
  "2027-02-19": { week: 4, phase: "Recovery", sessions: [
    { day: "Fri", discipline: "Bike", session: "Recovery Ride", duration: "1:30 hrs", details: "Easy / Recovery; mostly flat, low fatigue, finish fresh", rpe: "RPE 2-3/10" },
  ]},

  // --- Week 5 (22-28 Feb 27) - Build ---
  "2027-02-26": { week: 5, phase: "Build", sessions: [
    { day: "Fri", discipline: "Bike", session: "Long Endurance Ride", duration: "4:00 hrs", details: "Endurance; use hillier terrain and keep climbs controlled", rpe: "RPE 4-5/10" },
  ]},

  // --- Week 6 (01-07 Mar 27) - Build ---
  "2027-03-05": { week: 6, phase: "Build", sessions: [
    { day: "Fri", discipline: "Bike", session: "Long Endurance Ride", duration: "4:30 hrs", details: "Endurance; event-like climbing, avoid attacking hills", rpe: "RPE 4-5/10" },
  ]},

  // --- Week 7 (08-14 Mar 27) - no session given in the plan for this week. ---

  // --- Week 8 (15-21 Mar 27) - Build ---
  "2027-03-19": { week: 8, phase: "Build", sessions: [
    { day: "Fri", discipline: "Bike", session: "Long Endurance Ride", duration: "5:00 hrs", details: "Endurance; full fuelling and hydration rehearsal", rpe: "RPE 4-5/10" },
  ]},

  // --- Week 9 (22-28 Mar 27) - Peak ---
  "2027-03-26": { week: 9, phase: "Peak", sessions: [
    { day: "Fri", discipline: "Bike", session: "Peak Endurance Ride", duration: "6:00 hrs", details: "Endurance; event-like terrain with full kit, fuelling and hydration rehearsal", rpe: "RPE 4-5/10" },
  ]},

  // --- Week 10 (29 Mar-04 Apr 27) - Taper/Challenge. Race day itself
  // (Sat 3 Apr) is the Jurassic Century event above, not repeated here. ---
  "2027-04-02": { week: 10, phase: "Taper", sessions: [
    { day: "Fri", discipline: "Bike", session: "Taper Ride", duration: "3:00 hrs", details: "Easy / Endurance; keep the legs moving without accumulating fatigue", rpe: "RPE 3-4/10" },
  ]},

  // --- IRONMAN Belgium block: Week 1 (12-18 Apr 27) ---
  "2027-04-12": { week: 1, phase: "Base", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "40 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-04-13": { week: 1, phase: "Base", sessions: [
    { day: "Tue", discipline: "Swim", session: "Technique / Endurance Swim", duration: "1,800 m", details: "Workout: 300 m Easy -> 6 x 50 m technique (20 sec rest; catch-up/fingertip-drag) -> 8 x 100 m Endurance (20 sec) -> 4 x 50 m build (20 sec) -> 200 m Easy. | Effort: Easy / Endurance. | Skills: Re-establish feel for the water, relaxed catch and body position.", rpe: "Pool" },
  ]},
  "2027-04-15": { week: 1, phase: "Base", sessions: [
    { day: "Thu", discipline: "Run", session: "Long Aerobic Run", duration: "60 min", details: "Workout: 60 min continuous Easy / Endurance. | Pace: Endurance / Long. | Terrain: Flat to gently rolling.", rpe: "Endurance" },
  ]},
  "2027-04-16": { week: 1, phase: "Base", sessions: [
    { day: "Fri", discipline: "Swim", session: "Endurance Swim", duration: "2,200 m", details: "Workout: 300 m Easy -> 8 x 200 m Endurance (30 sec rest) -> 300 m Easy. | Effort: Endurance. | Skills: Even pacing and relaxed form.", rpe: "Pool endurance" },
  ]},
  "2027-04-17": { week: 1, phase: "Base", sessions: [
    { day: "Sat", discipline: "Bike", session: "Long Endurance Bike", duration: "2:30 hrs", details: "Workout: 20 min Easy -> 110 min Endurance HR -> 20 min Easy. | Terrain: Flat / rolling; keep climbs controlled. | Fuel: Resume consistent fuelling and hydration.", rpe: "Endurance HR" },
  ]},

  // --- Week 2 (19-25 Apr 27) ---
  "2027-04-19": { week: 2, phase: "Base", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "45 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-04-20": { week: 2, phase: "Base", sessions: [
    { day: "Tue", discipline: "Swim", session: "Quality Swim", duration: "2,000 m", details: "Workout: 300 m Easy -> 6 x 50 m technique (20 sec rest) -> 10 x 100 m CSS / Threshold (25 sec) -> 400 m Easy. | Effort: CSS / Threshold on the 100s. | Skills: Hold form under controlled pressure.", rpe: "Pool CSS work" },
  ]},
  "2027-04-22": { week: 2, phase: "Base", sessions: [
    { day: "Thu", discipline: "Run", session: "Long Aerobic Run", duration: "70 min", details: "Workout: 70 min continuous Easy / Endurance. | Pace: Endurance / Long. | Terrain: Flat to gently rolling.", rpe: "Endurance" },
  ]},
  "2027-04-23": { week: 2, phase: "Base", sessions: [
    { day: "Fri", discipline: "Swim", session: "Endurance Swim", duration: "2,400 m", details: "Workout: 300 m Easy -> 9 x 200 m Endurance (30 sec rest) -> 300 m Easy. | Effort: Endurance. | Skills: Consistent stroke length and pacing.", rpe: "Pool endurance" },
  ]},
  "2027-04-24": { week: 2, phase: "Base", sessions: [
    { day: "Sat", discipline: "Bike", session: "Long Endurance Bike", duration: "2:45 hrs", details: "Workout: 20 min Easy -> 125 min Endurance HR -> 20 min Easy. | Terrain: Rolling. | Fuel: Practise regular carbohydrate and fluid intake.", rpe: "Endurance HR" },
  ]},

  // --- Week 3 (26 Apr-02 May 27) ---
  "2027-04-26": { week: 3, phase: "Base", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "45 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-04-27": { week: 3, phase: "Base", sessions: [
    { day: "Tue", discipline: "Swim", session: "Quality Swim", duration: "2,100 m", details: "Workout: 300 m Easy -> 4 x 50 m technique (20 sec) -> 8 x 150 m CSS / Threshold (30 sec rest) -> 4 x 50 m Endurance (20 sec) -> 200 m Easy. | Effort: CSS / Threshold on the 150s. | Skills: Maintain stroke quality as rep length increases.", rpe: "Pool CSS work" },
  ]},
  "2027-04-29": { week: 3, phase: "Base", sessions: [
    { day: "Thu", discipline: "Run", session: "Long Aerobic Run", duration: "80 min", details: "Workout: 80 min continuous Easy / Endurance. | Pace: Endurance / Long. | Terrain: Flat to gently rolling.", rpe: "Endurance" },
  ]},
  "2027-04-30": { week: 3, phase: "Base", sessions: [
    { day: "Fri", discipline: "Swim", session: "Endurance Swim", duration: "2,600 m", details: "Workout: 300 m Easy -> 10 x 200 m Endurance (30 sec rest) -> 300 m Easy. | Effort: Endurance.", rpe: "Pool endurance" },
  ]},
  "2027-05-01": { week: 3, phase: "Base", sessions: [
    { day: "Sat", discipline: "Bike", session: "Long Endurance Bike", duration: "3:00 hrs", details: "Workout: 20 min Easy -> 140 min Endurance HR -> 20 min Easy. | Terrain: Rolling; controlled climbing. | Fuel: Use a repeatable event-style fuelling routine.", rpe: "Endurance HR" },
  ]},

  // --- Week 4 (03-09 May 27) - Recovery ---
  "2027-05-03": { week: 4, phase: "Recovery", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "35 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-05-04": { week: 4, phase: "Recovery", sessions: [
    { day: "Tue", discipline: "Swim", session: "Recovery Swim", duration: "1,600 m", details: "Workout: 300 m Easy -> 6 x 50 m technique (20 sec) -> 8 x 100 m Easy / Recovery (20 sec) -> 200 m Easy. | Effort: Easy / Recovery. | Skills: Relaxed stroke; no pace chasing.", rpe: "Pool easy technique" },
  ]},
  "2027-05-06": { week: 4, phase: "Recovery", sessions: [
    { day: "Thu", discipline: "Run", session: "Controlled Aerobic Run", duration: "60 min", details: "Workout: 10 min Easy -> 40 min Endurance -> 10 min Easy. | Pace: Endurance / Long.", rpe: "Endurance" },
  ]},
  "2027-05-07": { week: 4, phase: "Recovery", sessions: [
    { day: "Fri", discipline: "Swim", session: "Recovery Endurance Swim", duration: "2,000 m", details: "Workout: 300 m Easy -> 7 x 200 m Easy / Endurance (30 sec rest) -> 300 m Easy. | Effort: Easy / Recovery.", rpe: "Pool" },
  ]},
  "2027-05-08": { week: 4, phase: "Recovery", sessions: [
    { day: "Sat", discipline: "Bike", session: "Recovery Endurance Bike", duration: "2:00 hrs", details: "Workout: 2:00 hrs continuous Easy / Endurance HR. | Terrain: Mostly flat / gently rolling; finish fresh.", rpe: "Easy / Endurance HR" },
  ]},

  // --- Week 5 (10-16 May 27) - Build ---
  "2027-05-10": { week: 5, phase: "Build", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "45 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-05-11": { week: 5, phase: "Build", sessions: [
    { day: "Tue", discipline: "Swim", session: "Quality Swim", duration: "2,200 m", details: "Workout: 300 m Easy -> 5 x 200 m CSS / Threshold (30 sec rest) -> 6 x 100 m Endurance (20 sec) -> 300 m Easy. | Effort: CSS / Threshold on the 200s.", rpe: "Pool CSS work" },
  ]},
  "2027-05-13": { week: 5, phase: "Build", sessions: [
    { day: "Thu", discipline: "Run", session: "Long Aerobic Run", duration: "90 min", details: "Workout: 90 min continuous Easy / Endurance. | Pace: Endurance / Long.", rpe: "Endurance" },
  ]},
  "2027-05-14": { week: 5, phase: "Build", sessions: [
    { day: "Fri", discipline: "Swim", session: "Endurance Swim", duration: "2,800 m", details: "Workout: 300 m Easy -> 11 x 200 m Endurance (30 sec rest) -> 300 m Easy. | Effort: Endurance.", rpe: "Pool endurance" },
  ]},
  "2027-05-15": { week: 5, phase: "Build", sessions: [
    { day: "Sat", discipline: "Bike", session: "Long Endurance Bike", duration: "3:15 hrs", details: "Workout: 20 min Easy -> 155 min Endurance HR -> 20 min Easy. | Terrain: Rolling; begin using longer sustained sections. | Fuel: Consistent intake throughout the main block.", rpe: "Endurance HR" },
  ]},

  // --- Week 6 (17-23 May 27) - Build ---
  "2027-05-17": { week: 6, phase: "Build", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "50 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-05-18": { week: 6, phase: "Build", sessions: [
    { day: "Tue", discipline: "Swim", session: "Quality / Endurance Swim", duration: "2,300 m", details: "Workout: 300 m Easy -> 5 x 200 m CSS / Threshold (30 sec rest) -> 6 x 100 m Endurance (20 sec) -> 400 m Easy. | Effort: CSS / Threshold then Endurance.", rpe: "Pool" },
  ]},
  "2027-05-20": { week: 6, phase: "Build", sessions: [
    { day: "Thu", discipline: "Run", session: "Long / IM-Specific Run", duration: "100 min", details: "Workout: 15 min Easy -> 3 x 10 min at Ironman Race Pace with 3 min Easy between reps -> 49 min Easy / Endurance. | Pace: Ironman Race Pace on the blocks. | Terrain: Flat / gently rolling.", rpe: "Race-pace blocks" },
  ]},
  "2027-05-21": { week: 6, phase: "Build", sessions: [
    { day: "Fri", discipline: "Swim", session: "Endurance Swim", duration: "3,000 m", details: "Workout: 300 m Easy -> 12 x 200 m Endurance (30 sec rest) -> 300 m Easy. | Effort: Endurance.", rpe: "Pool endurance" },
  ]},
  "2027-05-22": { week: 6, phase: "Build", sessions: [
    { day: "Sat", discipline: "Bike", session: "Long Endurance Bike", duration: "3:30 hrs", details: "Workout: 20 min Easy -> 170 min Endurance HR -> 20 min Easy. | Terrain: Rolling. | Fuel: Practise planned race carbohydrate and hydration pattern.", rpe: "Endurance HR" },
  ]},

  // --- Week 7 (24-30 May 27) - Build ---
  "2027-05-24": { week: 7, phase: "Build", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "50 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-05-25": { week: 7, phase: "Build", sessions: [
    { day: "Tue", discipline: "Swim", session: "Quality Swim", duration: "2,400 m", details: "Workout: 300 m Easy -> 6 x 200 m CSS / Threshold (30 sec rest) -> 6 x 100 m Endurance (20 sec) -> 300 m Easy. | Effort: CSS / Threshold on the 200s.", rpe: "Pool CSS work" },
  ]},
  "2027-05-27": { week: 7, phase: "Build", sessions: [
    { day: "Thu", discipline: "Run", session: "Long Aerobic Run", duration: "110 min", details: "Workout: 110 min continuous Easy / Endurance. | Pace: Endurance / Long. | Terrain: Flat to gently rolling.", rpe: "Endurance" },
  ]},
  "2027-05-28": { week: 7, phase: "Build", sessions: [
    { day: "Fri", discipline: "Swim", session: "Endurance Swim", duration: "3,200 m", details: "Workout: 400 m Easy -> 12 x 200 m Endurance (30 sec rest) -> 400 m Easy. | Effort: Endurance.", rpe: "Pool endurance" },
  ]},
  "2027-05-29": { week: 7, phase: "Build", sessions: [
    { day: "Sat", discipline: "Bike", session: "Long Endurance Bike", duration: "3:45 hrs", details: "Workout: 25 min Easy -> 175 min Endurance HR -> 25 min Easy. | Terrain: Rolling / hilly; stay disciplined on climbs. | Fuel: Full long-ride fuelling practice.", rpe: "Endurance HR" },
  ]},

  // --- Week 8 (31 May-06 Jun 27) - Build ---
  "2027-05-31": { week: 8, phase: "Build", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "40 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-06-01": { week: 8, phase: "Build", sessions: [
    { day: "Tue", discipline: "Swim", session: "Recovery Swim", duration: "1,800 m", details: "Workout: 300 m Easy -> 6 x 50 m technique (20 sec) -> 10 x 100 m Easy / Recovery (20 sec) -> 200 m Easy. | Effort: Easy / Recovery.", rpe: "Pool easy technique" },
  ]},
  "2027-06-03": { week: 8, phase: "Build", sessions: [
    { day: "Thu", discipline: "Run", session: "Controlled Aerobic Run", duration: "75 min", details: "Workout: 15 min Easy -> 45 min Endurance -> 15 min Easy. | Pace: Endurance / Long.", rpe: "Endurance" },
  ]},
  "2027-06-04": { week: 8, phase: "Build", sessions: [
    { day: "Fri", discipline: "Swim", session: "Endurance Swim", duration: "3,200 m", details: "Workout: 400 m Easy -> 12 x 200 m Endurance (30 sec rest) -> 400 m Easy. | Effort: Endurance. | Skills: Smooth pacing; finish controlled ahead of the holiday.", rpe: "Pool endurance" },
  ]},
  "2027-06-05": { week: 8, phase: "Build", sessions: [
    { day: "Sat", discipline: "Bike", session: "Easy Endurance Bike", duration: "2:30 hrs", details: "Workout: 2:30 hrs continuous Easy / Endurance HR. | Terrain: Flat / rolling; reduced volume before holiday.", rpe: "Easy / Endurance HR" },
  ]},

  // --- Week 9 (07-13 Jun 27) - Holiday: full rest week, every day. ---
  "2027-06-07": { week: 9, phase: "Holiday", sessions: [
    { day: "Mon", discipline: "Rest", session: "Rest", duration: "Holiday", details: "", rpe: "full rest week" },
  ]},
  "2027-06-08": { week: 9, phase: "Holiday", sessions: [
    { day: "Tue", discipline: "Rest", session: "Rest", duration: "Holiday", details: "", rpe: "full rest week" },
  ]},
  "2027-06-09": { week: 9, phase: "Holiday", sessions: [
    { day: "Wed", discipline: "Rest", session: "Rest", duration: "Holiday", details: "", rpe: "" },
  ]},
  "2027-06-10": { week: 9, phase: "Holiday", sessions: [
    { day: "Thu", discipline: "Rest", session: "Rest", duration: "Holiday", details: "", rpe: "full rest week" },
  ]},
  "2027-06-11": { week: 9, phase: "Holiday", sessions: [
    { day: "Fri", discipline: "Rest", session: "Rest", duration: "Holiday", details: "", rpe: "full rest week" },
  ]},
  "2027-06-12": { week: 9, phase: "Holiday", sessions: [
    { day: "Sat", discipline: "Rest", session: "Rest", duration: "Holiday", details: "", rpe: "full rest week" },
  ]},

  // --- Week 10 (14-20 Jun 27) - Build ---
  "2027-06-14": { week: 10, phase: "Build", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "45 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-06-15": { week: 10, phase: "Build", sessions: [
    { day: "Tue", discipline: "Swim", session: "Quality Swim", duration: "2,500 m", details: "Workout: 300 m Easy -> 5 x 200 m CSS / Threshold (30 sec rest) -> 8 x 100 m Endurance (20 sec) -> 400 m Easy. | Effort: CSS / Threshold on the 200s.", rpe: "Pool CSS work" },
  ]},
  "2027-06-17": { week: 10, phase: "Build", sessions: [
    { day: "Thu", discipline: "Run", session: "Long Aerobic Run", duration: "120 min", details: "Workout: 120 min continuous Easy / Endurance. | Pace: Endurance / Long. | Terrain: Flat to gently rolling.", rpe: "Endurance" },
  ]},
  "2027-06-18": { week: 10, phase: "Build", sessions: [
    { day: "Fri", discipline: "Swim", session: "Endurance Swim", duration: "3,300 m", details: "Workout: 400 m Easy -> 5 x 500 m Endurance (40 sec rest) -> 400 m Easy. | Effort: Endurance. | Skills: Longer uninterrupted blocks and relaxed rhythm.", rpe: "Pool endurance" },
  ]},
  "2027-06-19": { week: 10, phase: "Build", sessions: [
    { day: "Sat", discipline: "Bike", session: "Long Endurance Bike", duration: "4:00 hrs", details: "Workout: 30 min Easy -> 180 min Endurance HR -> 30 min Easy. | Terrain: Rolling / hilly. | Fuel: Full long-ride fuelling routine.", rpe: "Endurance HR" },
  ]},

  // --- Week 11 (21-27 Jun 27) - Build ---
  "2027-06-21": { week: 11, phase: "Build", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "50 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-06-22": { week: 11, phase: "Build", sessions: [
    { day: "Tue", discipline: "Swim", session: "Quality Swim", duration: "2,600 m", details: "Workout: 300 m Easy -> 4 x 300 m CSS / Threshold (40 sec rest) -> 7 x 100 m Endurance (20 sec) -> 400 m Easy. | Effort: CSS / Threshold on the 300s.", rpe: "Pool CSS work" },
  ]},
  "2027-06-24": { week: 11, phase: "Build", sessions: [
    { day: "Thu", discipline: "Run", session: "Long / IM-Specific Run", duration: "130 min", details: "Workout: 20 min Easy -> 3 x 15 min at Ironman Race Pace with 5 min Easy between reps -> 55 min Easy / Endurance. | Pace: Ironman Race Pace on the blocks. | Terrain: Flat / gently rolling.", rpe: "Race-pace blocks" },
  ]},
  "2027-06-25": { week: 11, phase: "Build", sessions: [
    { day: "Fri", discipline: "Swim", session: "Endurance Swim", duration: "3,400 m", details: "Workout: 400 m Easy -> 5 x 500 m Endurance (40 sec rest) -> 500 m Easy / Endurance. | Effort: Endurance.", rpe: "Pool endurance" },
  ]},
  "2027-06-26": { week: 11, phase: "Build", sessions: [
    { day: "Sat", discipline: "Bike", session: "Long Endurance Bike", duration: "4:15 hrs", details: "Workout: 30 min Easy -> 195 min Endurance HR -> 30 min Easy. | Terrain: Rolling / hilly. | Fuel: Practise exact race nutrition products where practical.", rpe: "Endurance HR" },
  ]},

  // --- Week 12 (28 Jun-04 Jul 27) - Build ---
  "2027-06-28": { week: 12, phase: "Build", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "50 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-06-29": { week: 12, phase: "Build", sessions: [
    { day: "Tue", discipline: "Swim", session: "Quality Swim", duration: "2,700 m", details: "Workout: 300 m Easy -> 5 x 300 m CSS / Threshold (40 sec rest) -> 6 x 100 m Endurance (20 sec) -> 300 m Easy. | Effort: CSS / Threshold on the 300s.", rpe: "Pool CSS work" },
  ]},
  "2027-07-01": { week: 12, phase: "Build", sessions: [
    { day: "Thu", discipline: "Run", session: "Long Aerobic Run", duration: "140 min", details: "Workout: 140 min continuous Easy / Endurance. | Pace: Endurance / Long. | Terrain: Flat to gently rolling.", rpe: "Endurance" },
  ]},
  "2027-07-02": { week: 12, phase: "Build", sessions: [
    { day: "Fri", discipline: "Swim", session: "Open-Water Swim", duration: "2,500 m", details: "Workout: 300 m Easy settle -> 1,900 m continuous Endurance -> 300 m Easy / controlled. | Environment: Open water. | Effort: Easy / Endurance. | Skills: Sighting, relaxed breathing and straight-line swimming.", rpe: "Sea or lake reintroduction" },
  ]},
  "2027-07-03": { week: 12, phase: "Build", sessions: [
    { day: "Sat", discipline: "Bike", session: "Long Endurance Bike", duration: "4:30 hrs", details: "Workout: 30 min Easy -> 210 min Endurance HR -> 30 min Easy. | Terrain: Rolling / hilly. | Fuel: Race-style fuelling and hydration throughout.", rpe: "Endurance HR" },
  ]},

  // --- Week 13 (05-11 Jul 27) - Recovery ---
  "2027-07-05": { week: 13, phase: "Recovery", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "40 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-07-06": { week: 13, phase: "Recovery", sessions: [
    { day: "Tue", discipline: "Swim", session: "Controlled Swim", duration: "2,000 m", details: "Workout: 300 m Easy -> 8 x 100 m Endurance (20 sec) -> 6 x 100 m Easy (20 sec) -> 300 m Easy. | Effort: Easy / Endurance; controlled throughout.", rpe: "Pool" },
  ]},
  "2027-07-08": { week: 13, phase: "Recovery", sessions: [
    { day: "Thu", discipline: "Run", session: "Controlled Aerobic Run", duration: "100 min", details: "Workout: 15 min Easy -> 70 min Endurance -> 15 min Easy. | Pace: Endurance / Long.", rpe: "Endurance" },
  ]},
  "2027-07-09": { week: 13, phase: "Recovery", sessions: [
    { day: "Fri", discipline: "Swim", session: "Open-Water Swim", duration: "2,400 m", details: "Workout: 300 m Easy settle -> 1,800 m continuous Easy / Endurance -> 300 m Easy. | Environment: Open water if practical. | Skills: Sighting and relaxed rhythm.", rpe: "Controlled endurance" },
  ]},
  "2027-07-10": { week: 13, phase: "Recovery", sessions: [
    { day: "Sat", discipline: "Bike", session: "Controlled Endurance Bike", duration: "3:00 hrs", details: "Workout: 20 min Easy -> 140 min Endurance HR -> 20 min Easy. | Terrain: Flat / rolling. | Fuel: Normal long-ride fuelling; finish with plenty left.", rpe: "Endurance HR" },
  ]},

  // --- Week 14 (12-18 Jul 27) - Specific ---
  "2027-07-12": { week: 14, phase: "Specific", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "45 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-07-13": { week: 14, phase: "Specific", sessions: [
    { day: "Tue", discipline: "Swim", session: "Quality / Endurance Swim", duration: "2,800 m", details: "Workout: 400 m Easy -> 4 x 300 m CSS / Threshold (40 sec rest) -> 4 x 200 m Endurance (30 sec) -> 400 m Easy. | Effort: CSS / Threshold then Endurance.", rpe: "Pool" },
  ]},
  "2027-07-15": { week: 14, phase: "Specific", sessions: [
    { day: "Thu", discipline: "Run", session: "Long / IM-Specific Run", duration: "145 min", details: "Workout: 20 min Easy -> 3 x 20 min at Ironman Race Pace with 5 min Easy between reps -> 55 min Easy / Endurance. | Pace: Ironman Race Pace on the blocks. | Terrain: Flat / race-specific.", rpe: "Race-pace blocks" },
  ]},
  "2027-07-16": { week: 14, phase: "Specific", sessions: [
    { day: "Fri", discipline: "Swim", session: "Open-Water Swim", duration: "2,500 m", details: "Workout: 300 m Easy settle -> 1,900 m continuous Endurance / Ironman Race Effort -> 300 m Easy. | Environment: Open water. | Skills: Sighting, relaxed breathing and straight-line swimming.", rpe: "Sea or lake" },
  ]},
  "2027-07-17": { week: 14, phase: "Specific", sessions: [
    { day: "Sat", discipline: "Bike", session: "Long Brick Bike", duration: "4:45 hrs", details: "Workout: 30 min Endurance -> 2 x 45 min at Ironman Race HR with 15 min Easy between reps -> 150 min Endurance HR. | Terrain: Race-profile style where practical. | Fuel: Full race-fuelling practice.", rpe: "Endurance / Ironman Race HR" },
    { day: "Sat", discipline: "Run", session: "Brick Run", duration: "20 min", details: "Workout: 20 min Easy immediately off the bike. | Terrain: Flat; focus on settling quickly.", rpe: "Easy" },
  ]},

  // --- Week 15 (19-25 Jul 27) - Specific ---
  "2027-07-19": { week: 15, phase: "Specific", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "45 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-07-20": { week: 15, phase: "Specific", sessions: [
    { day: "Tue", discipline: "Swim", session: "Quality / Endurance Swim", duration: "2,800 m", details: "Workout: 400 m Easy -> 3 x 400 m CSS / Threshold (45 sec rest) -> 4 x 200 m Endurance (30 sec) -> 400 m Easy. | Effort: CSS / Threshold then Endurance.", rpe: "Pool" },
  ]},
  "2027-07-22": { week: 15, phase: "Specific", sessions: [
    { day: "Thu", discipline: "Run", session: "Long / IM-Specific Run", duration: "150 min", details: "Workout: 20 min Easy -> 2 x 25 min at Ironman Race Pace with 5 min Easy between reps -> 75 min Easy / Endurance. | Pace: Ironman Race Pace on the blocks.", rpe: "Race-pace blocks" },
  ]},
  "2027-07-23": { week: 15, phase: "Specific", sessions: [
    { day: "Fri", discipline: "Swim", session: "Open-Water Swim", duration: "2,800 m", details: "Workout: 300 m Easy settle -> 2,200 m continuous Endurance / Ironman Race Effort -> 300 m Easy. | Environment: Open water. | Skills: Sighting, pacing and uninterrupted rhythm.", rpe: "Sea or lake" },
  ]},
  "2027-07-24": { week: 15, phase: "Specific", sessions: [
    { day: "Sat", discipline: "Bike", session: "Long Brick Bike", duration: "5:00 hrs", details: "Workout: 30 min Endurance -> 3 x 40 min at Ironman Race HR with 10 min Easy between reps -> 130 min Endurance HR. | Terrain: Race-profile style. | Fuel: Full planned race nutrition and hydration.", rpe: "Endurance / Ironman Race HR" },
    { day: "Sat", discipline: "Run", session: "Brick Run", duration: "30 min", details: "Workout: 10 min Easy -> 20 min at Ironman Race Pace. | Terrain: Flat / race-specific.", rpe: "Controlled" },
  ]},

  // --- Week 16 (26 Jul-01 Aug 27) - Specific ---
  "2027-07-26": { week: 16, phase: "Specific", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "50 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-07-27": { week: 16, phase: "Specific", sessions: [
    { day: "Tue", discipline: "Swim", session: "Quality Swim", duration: "3,000 m", details: "Workout: 400 m Easy -> 5 x 300 m CSS / Threshold (40 sec rest) -> 7 x 100 m Endurance (20 sec) -> 400 m Easy. | Effort: CSS / Threshold then Endurance.", rpe: "Pool" },
  ]},
  "2027-07-29": { week: 16, phase: "Specific", sessions: [
    { day: "Thu", discipline: "Run", session: "Long / IM-Specific Run", duration: "155 min", details: "Workout: 20 min Easy -> 3 x 20 min at Ironman Race Pace with 5 min Easy between reps -> 65 min Easy / Endurance. | Pace: Ironman Race Pace on the blocks.", rpe: "Race-pace blocks" },
  ]},
  "2027-07-30": { week: 16, phase: "Specific", sessions: [
    { day: "Fri", discipline: "Swim", session: "Open-Water Swim", duration: "3,000 m", details: "Workout: 300 m Easy settle -> 2,400 m continuous Endurance with 3 x 10 min at Ironman Race Effort embedded -> 300 m Easy. | Environment: Open water. | Skills: Sighting and holding form as effort changes.", rpe: "Lake / sea endurance" },
  ]},
  "2027-07-31": { week: 16, phase: "Specific", sessions: [
    { day: "Sat", discipline: "Bike", session: "Long Brick Bike", duration: "5:15 hrs", details: "Workout: 30 min Endurance -> 2 x 60 min at Ironman Race HR with 15 min Easy between reps -> 150 min Endurance HR. | Terrain: Race-profile style. | Fuel: Full race-fuelling practice.", rpe: "Endurance / Ironman Race HR" },
    { day: "Sat", discipline: "Run", session: "Brick Run", duration: "45 min", details: "Workout: 10 min Easy -> 30 min Endurance / Ironman Race Pace -> 5 min Easy. | Terrain: Flat / race-specific.", rpe: "Controlled" },
  ]},

  // --- Week 17 (02-08 Aug 27) - Recovery ---
  "2027-08-02": { week: 17, phase: "Recovery", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "40 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-08-03": { week: 17, phase: "Recovery", sessions: [
    { day: "Tue", discipline: "Swim", session: "Controlled Swim", duration: "2,200 m", details: "Workout: 300 m Easy -> 6 x 100 m CSS / Threshold (25 sec rest) -> 10 x 100 m Endurance (20 sec) -> 300 m Easy. | Effort: Controlled quality; finish fresh.", rpe: "Pool" },
  ]},
  "2027-08-05": { week: 17, phase: "Recovery", sessions: [
    { day: "Thu", discipline: "Run", session: "Controlled Aerobic Run", duration: "110 min", details: "Workout: 20 min Easy -> 70 min Endurance -> 20 min Easy. | Pace: Endurance / Long.", rpe: "Endurance" },
  ]},
  "2027-08-06": { week: 17, phase: "Recovery", sessions: [
    { day: "Fri", discipline: "Swim", session: "Open-Water Recovery Swim", duration: "2,500 m", details: "Workout: 300 m Easy settle -> 1,900 m continuous Easy / Endurance -> 300 m Easy. | Environment: Open water if practical. | Skills: Relaxed sighting and rhythm.", rpe: "Controlled" },
  ]},
  "2027-08-07": { week: 17, phase: "Recovery", sessions: [
    { day: "Sat", discipline: "Bike", session: "Reduced Endurance Bike", duration: "3:30 hrs", details: "Workout: 3:30 hrs continuous Easy / Endurance HR. | Terrain: Flat / rolling; reduced volume. | Fuel: Normal long-ride fuelling.", rpe: "Easy / Endurance HR" },
  ]},

  // --- Week 18 (09-15 Aug 27) - Peak ---
  "2027-08-09": { week: 18, phase: "Peak", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "45 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-08-10": { week: 18, phase: "Peak", sessions: [
    { day: "Tue", discipline: "Swim", session: "Race-Specific Swim", duration: "3,000 m", details: "Workout: 400 m Easy -> 3 x 600 m at Ironman Race Effort (45 sec rest) -> 4 x 100 m CSS / Threshold (25 sec) -> 400 m Easy. | Effort: Ironman Race Effort then CSS / Threshold.", rpe: "Pool" },
  ]},
  "2027-08-12": { week: 18, phase: "Peak", sessions: [
    { day: "Thu", discipline: "Run", session: "Long / IM-Specific Run", duration: "160 min", details: "Workout: 20 min Easy -> 2 x 30 min at Ironman Race Pace with 10 min Easy between reps -> 70 min Easy / Endurance. | Pace: Ironman Race Pace on the blocks. | Terrain: Flat / race-specific.", rpe: "Race-pace blocks" },
  ]},
  "2027-08-13": { week: 18, phase: "Peak", sessions: [
    { day: "Fri", discipline: "Swim", session: "Open-Water Swim", duration: "3,400 m", details: "Workout: 400 m Easy settle -> 2,600 m continuous Endurance / Ironman Race Effort -> 400 m Easy. | Environment: Open water. | Skills: Sighting, pacing and sustained rhythm.", rpe: "Race-specific endurance" },
  ]},
  "2027-08-14": { week: 18, phase: "Peak", sessions: [
    { day: "Sat", discipline: "Bike", session: "Peak Brick Bike", duration: "5:45 hrs", details: "Workout: 30 min Endurance -> 3 x 50 min at Ironman Race HR with 10 min Easy between reps -> 145 min Endurance HR. | Terrain: Best available race-profile simulation. | Fuel: Full planned race nutrition, hydration, kit and timing.", rpe: "Endurance / Ironman Race HR" },
    { day: "Sat", discipline: "Run", session: "Brick Run", duration: "45 min", details: "Workout: 10 min Easy -> 30 min at Ironman Race Pace -> 5 min Easy. | Terrain: Flat / race-specific.", rpe: "Race-specific" },
  ]},

  // --- Week 19 (16-22 Aug 27) - Peak ---
  "2027-08-16": { week: 19, phase: "Peak", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "45 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-08-17": { week: 19, phase: "Peak", sessions: [
    { day: "Tue", discipline: "Swim", session: "Race-Specific Swim", duration: "3,000 m", details: "Workout: 400 m Easy -> 4 x 500 m at Ironman Race Effort (45 sec rest) -> 200 m Endurance -> 400 m Easy. | Effort: Ironman Race Effort; hold an even pace across all 500s.", rpe: "Pool" },
  ]},
  "2027-08-19": { week: 19, phase: "Peak", sessions: [
    { day: "Thu", discipline: "Run", session: "Long / IM-Specific Run", duration: "120 min", details: "Workout: 20 min Easy -> 2 x 20 min at Ironman Race Pace with 5 min Easy between reps -> 55 min Easy / Endurance. | Pace: Ironman Race Pace on the blocks. | Terrain: Flat / race-specific.", rpe: "Race-pace blocks" },
  ]},
  "2027-08-20": { week: 19, phase: "Peak", sessions: [
    { day: "Fri", discipline: "Swim", session: "Open-Water Swim", duration: "3,800 m", details: "Workout: 3,800 m continuous race-specific swim; no planned stops. | Environment: Open water if safe and practical; otherwise pool. | Effort: Controlled Ironman Race Effort. | Skills: Race-start control, sighting and uninterrupted rhythm.", rpe: "Full-distance rehearsal" },
  ]},
  "2027-08-21": { week: 19, phase: "Peak", sessions: [
    { day: "Sat", discipline: "Bike", session: "Peak Brick Bike", duration: "6:30 hrs", details: "Workout: 45 min Endurance -> 4 x 45 min at Ironman Race HR with 10 min Easy between reps -> 135 min Endurance HR. | Terrain: Best available race-specific rehearsal; keep climbs controlled. | Fuel: Full planned race nutrition, hydration, kit and timing.", rpe: "Full race-specific rehearsal" },
    { day: "Sat", discipline: "Run", session: "Brick Run", duration: "60 min", details: "Workout: 15 min Easy -> 40 min at Ironman Race Pace -> 5 min Easy. | Terrain: Flat / race-specific; finish controlled, not depleted.", rpe: "Race-specific" },
  ]},

  // --- Week 20 (23-29 Aug 27) - Taper/Race ---
  "2027-08-23": { week: 20, phase: "Taper / Race", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "35 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-08-24": { week: 20, phase: "Taper / Race", sessions: [
    { day: "Tue", discipline: "Swim", session: "Controlled Swim", duration: "2,000 m", details: "Workout: 300 m Easy -> 6 x 100 m CSS / Threshold (25 sec rest) -> 8 x 100 m Endurance (20 sec) -> 300 m Easy. | Effort: Controlled CSS / Threshold; finish fresh.", rpe: "Pool sharpening" },
  ]},
  "2027-08-26": { week: 20, phase: "Taper / Race", sessions: [
    { day: "Thu", discipline: "Run", session: "Controlled / Sharpening Run", duration: "75 min", details: "Workout: 15 min Easy -> 3 x 8 min at Ironman Race Pace with 2 min Easy between reps -> 32 min Easy. | Pace: Ironman Race Pace on the blocks.", rpe: "Ironman pace" },
  ]},
  "2027-08-27": { week: 20, phase: "Taper / Race", sessions: [
    { day: "Fri", discipline: "Swim", session: "Open-Water Swim", duration: "2,200 m", details: "Workout: 300 m Easy settle -> 1,600 m Endurance / Ironman Race Effort -> 300 m Easy. | Environment: Open water if practical. | Skills: Sighting and relaxed race rhythm.", rpe: "Controlled" },
  ]},
  "2027-08-28": { week: 20, phase: "Taper / Race", sessions: [
    { day: "Sat", discipline: "Bike", session: "Taper Endurance Bike", duration: "2:30 hrs", details: "Workout: 30 min Easy -> 3 x 20 min at Ironman Race HR with 10 min Easy between reps -> 40 min Easy / Endurance. | Terrain: Flat / rolling. | Fuel: Normal hydration and race-fuelling rehearsal without fatigue chasing.", rpe: "Easy / Endurance HR" },
  ]},

  // --- Week 21 (30 Aug-05 Sep 27) - Taper/Race. Race day itself (Sun 5 Sep)
  // is the IRONMAN Belgium event above, not repeated here. ---
  "2027-08-30": { week: 21, phase: "Taper / Race", sessions: [
    { day: "Mon", discipline: "Run", session: "Easy Run", duration: "20 min", details: "Easy", rpe: "Easy" },
  ]},
  "2027-08-31": { week: 21, phase: "Taper / Race", sessions: [
    { day: "Tue", discipline: "Swim", session: "Easy Swim", duration: "1,200 m", details: "Workout: 200 m Easy -> 4 x 100 m at Ironman Race Effort (30 sec rest) -> 600 m Easy. | Effort: Short race-effort touches; stay fresh.", rpe: "Pool sharpening" },
  ]},
  "2027-09-02": { week: 21, phase: "Taper / Race", sessions: [
    { day: "Thu", discipline: "Run", session: "Short Sharpening Run", duration: "30 min", details: "Workout: 10 min Easy -> 4 x 2 min at Ironman Race Pace with 1 min Easy between reps -> 9 min Easy. | Pace: Ironman Race Pace on the reps. | Terrain: Flat.", rpe: "Ironman pace" },
  ]},
  "2027-09-03": { week: 21, phase: "Taper / Race", sessions: [
    { day: "Fri", discipline: "Swim", session: "Open-Water Swim", duration: "700 m", details: "Workout: 100 m Easy settle -> 500 m controlled continuous swimming -> 100 m Easy. | Environment: Open water if practical. | Effort: Easy / controlled; familiarisation only.", rpe: "Familiarisation" },
  ]},
  "2027-09-04": { week: 21, phase: "Taper / Race", sessions: [
    { day: "Sat", discipline: "Rest", session: "Rest / Race Prep", duration: "Full rest", details: "", rpe: "equipment, nutrition and transition preparation" },
  ]},
};
