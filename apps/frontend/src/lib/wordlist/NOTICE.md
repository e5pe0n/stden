# English word list

`english-words.txt` is generated data, not hand-maintained. It backs the word autocomplete in the chat
composer (`src/lib/word-suggestions.ts`).

Regenerate it with:

```bash
pnpm --filter frontend wordlist:generate
```

The generator lives at `apps/frontend/scripts/generate-wordlist.ts`. It never runs from `dev`, `build`
or Docker, so the build stays offline and the shipped bytes are reviewable in git. The
`Refresh word list` workflow runs it on the 1st of each month and opens a pull request when upstream
has changed something.

## Format

One lowercase word per line, `/^[a-z]{2,}$/`, in **descending corpus frequency order**. A line's index is
therefore its frequency rank, which is what lets the runtime return "most common first" from a plain
prefix scan.

Current contents: 79,093 words (61,454 frequency-ranked, 17,639 unranked and sorted alphabetically after
them), 734 KiB.

## Sources

**Spellings** — the English Speller Database (ESDB, previously SCOWL), size 60, US spelling, diacritics
stripped, via <https://app.aspell.net/create>.

> Copyright 2000-2026 by Kevin Atkinson
>
> Permission to use, copy, modify, distribute, and sell any part of the English Speller Database (ESDB,
> previously known as SCOWLv2), or word lists created from it, is hereby granted without fee, provided
> that the above copyright notice appears in all copies and that both the above copyright notice and this
> notice appear in supporting documentation. Kevin Atkinson makes no representations about the suitability
> of this database for any purpose. It is provided "as is" without express or implied warranty.

ESDB is derived from many sources, most of which are in the public domain — primarily 12dicts and
ENABLE2K by Alan Beale — with 3-gram data from the Corpus of Contemporary American English (COCA). See
<https://wordlist.aspell.net> for the full notice.

**Frequencies** — Peter Norvig's unigram counts from the Google Web Trillion Word Corpus,
<https://norvig.com/ngrams/count_1w.txt>, described in *Natural Language Corpus Data* (Beautiful Data,
O'Reilly, 2009). Used for ordering only; no words are added from it.
