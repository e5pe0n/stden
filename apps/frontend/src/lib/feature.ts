/**
 * The two things this app does. "Learn" is the mode; an "ask" is one
 * interaction inside it — the word lookups, diffs and free questions the
 * history records. "Test" is the mode that checks what that learning stuck.
 */
export const FEATURES = ["learn", "test"] as const;

export type Feature = (typeof FEATURES)[number];
