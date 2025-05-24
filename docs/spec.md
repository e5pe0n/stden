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
