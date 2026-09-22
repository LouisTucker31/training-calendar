// EVENTS, TRAINING_BLOCKS_RAW and WORKOUTS now live in Supabase (tables
// training_events, training_event_blocks, training_workouts - see
// supabase-schema.sql) and are loaded at startup by supabase.js, which
// reshapes them back into these same three globals so the rest of the app
// is unchanged. Only PALETTE (pure theme config, not data to edit) stays
// hardcoded here.

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
