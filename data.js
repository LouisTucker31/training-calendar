// Add events here as { date: "YYYY-MM-DD", name: "Event name", colorIndex }.
// colorIndex picks the palette entry below — pick indices so that any two
// chronologically back-to-back training blocks don't land on similar hues.
// Each event has a disciplines[] array (one entry per leg — swim/bike/run
// etc, however many the event has), plus an overall location. Every
// discipline entry can carry a type (e.g. lake/flat), distance, target
// duration and target average pace — shown in the day popup. Left blank
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

// Subtle, professional palette — background tint + matching dot/text shade.
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
// colorIndex isn't set by hand here — it's looked up from the linked
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
