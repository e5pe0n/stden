# Specification

## Features

- explain english word meanings
- history
- test
- activity

## Input Patterns

- "xxx" meanings with example sentences, Japanese translation and synonyms.
- "xxx" vs. "yyy" (vs. "zzz")*

## Data

- save history at local

```ts
{
  en: string;
  input: string;
  output: string;
  numTouches: number;
  createdAt: Date;  // UTC
  updatedAt: Date;  // UTC
}
```

## Naming

- **Learn** and **Test** are the two features, and the two buttons at the top
  of the sidebar.
- **Activity** is the overview of how often both are used. It spans the two
  features, so it sits at the bottom of the sidebar rather than beside them.
- An **ask** is one interaction inside Learn — a meaning, a `/diff` or a
  `/free` question. It is the unit the history records, not a feature name.

## Test

- A test set is `10` words chosen from the words already asked about, favouring
  the ones most likely forgotten — see [Word selection](#word-selection).
- Each word is shown on its own; the user writes one example sentence using it.
- Gemini judges whether the word is used correctly and writes a comment. The
  verdict and the comment stay hidden until the test is finished.
- The result lists every word with the user's answer, the verdict and the
  comment, headed by how many of the words were used correctly out of how many
  were asked.
- A test reaches the database only once it has been answered and graded, so an
  abandoned run leaves nothing behind.

```ts
{
  createdAt: Date;  // UTC
  questions: {
    position: number;
    word: string;
    answer: string;
    correct: boolean | null;  // null: the grader gave no verdict
    comment: string;
  }[];
}
```

### Word selection

- Each word has a **half-life** `h`: how long until the chance of recalling it
  falls to one half. It is replayed from the word's graded answers, oldest
  first, starting at `1` day:
  - correct → `h × 2`, or `h × 3` if more than `h` had passed since the word's
    previous test; capped at `365` days.
  - incorrect → back to `1` day.
  - not graded → ignored.
- The chance of recalling it now is `p = 2^(−days since last graded test / h)`.
- A test fills its slots in this order:
  1. up to `7` **due** words — tested, `p < 0.9`, not tested in the last `12`
     hours — lowest `p` first;
  2. **untested** words, most looked-up first, then oldest first;
  3. if still short: the remaining due words, then well-known words (`p ≥ 0.9`),
     then words tested in the last `12` hours, each lowest `p` first.
- The chosen words are shuffled, so reviews and new words don't come in blocks.

## Activity

- A calendar of the past year, one square per day and one column per week
  (Sunday on top), shaded by how many asks and finished tests that day had —
  in `4` steps scaled to the busiest day shown, plus empty.
- Hovering or focusing a square shows that day's asks and tests; arrow keys
  move between days.
- Beside it: asks and tests over the past year, the current streak and the
  longest streak.
  - A **streak** is consecutive days with at least one ask or test. The
    current one still counts if today has nothing yet but yesterday did.
  - The longest streak is all-time, not just the calendar's year.
- A new Learn chat shows the same overview under the greeting, until the
  first ask.
- Days are cut at the learner's local midnight: the browser sends its IANA
  time zone and the server groups by it.
- Nothing is stored for this: it is counted from `histories` and `tests`, so
  deleting an ask or a test removes it from the calendar too.
