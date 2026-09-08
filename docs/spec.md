# Specification

## Features

- explain english word meanings
- history
- test
- statistics

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
- An **ask** is one interaction inside Learn — a meaning, a `/diff` or a
  `/free` question. It is the unit the history records, not a feature name.

## Test

- A test set is `10` words drawn at random from the words already asked about.
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
    correct: boolean;
    comment: string;
  }[];
}
```
