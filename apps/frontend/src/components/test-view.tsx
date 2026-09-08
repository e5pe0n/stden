import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  Loader2Icon,
  RotateCcwIcon,
  SquareCheckBigIcon,
  XIcon,
} from "lucide-react";
import { type FC, type KeyboardEvent, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  fetchNewTestWords,
  NotEnoughWordsError,
  submitTest,
  TEST_WORD_COUNT,
  type TestEntry,
  type TestQuestion,
} from "@/lib/test";
import { cn } from "@/lib/utils";

/**
 * Where the run has got to. Answers live in `running` rather than beside it so
 * that leaving the run — by finishing it, or by opening a past test — cannot
 * leave a half-filled draft behind to reappear on the next one.
 */
type Phase =
  | { kind: "start" }
  | { kind: "running"; words: string[]; index: number; answers: string[] }
  | { kind: "grading" }
  | { kind: "result"; test: TestEntry };

type TestViewProps = {
  /** A past test opened from the sidebar, or null to offer a new one. */
  initialTest: TestEntry | null;
  onCompleted: (test: TestEntry) => void;
};

export const TestView: FC<TestViewProps> = ({ initialTest, onCompleted }) => {
  const [phase, setPhase] = useState<Phase>(() =>
    initialTest ? { kind: "result", test: initialTest } : { kind: "start" },
  );
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    try {
      const words = await fetchNewTestWords();
      setPhase({
        kind: "running",
        words,
        index: 0,
        answers: words.map(() => ""),
      });
    } catch (caught) {
      setError(
        caught instanceof NotEnoughWordsError
          ? `You need ${caught.required} looked-up words to take a test — you have ${caught.available} so far.`
          : "Couldn't start a test.",
      );
    } finally {
      setIsStarting(false);
    }
  }, []);

  const handleFinish = useCallback(
    async (words: string[], answers: string[]) => {
      setPhase({ kind: "grading" });
      setError(null);
      try {
        const test = await submitTest(
          words.map((word, index) => ({ word, answer: answers[index] ?? "" })),
        );
        setPhase({ kind: "result", test });
        onCompleted(test);
      } catch {
        // Back to the last question with every answer intact: grading is one
        // call, so a failed one costs a retry, not the whole run.
        setPhase({
          kind: "running",
          words,
          index: words.length - 1,
          answers,
        });
        setError("Couldn't grade this test. Try finishing again.");
      }
    },
    [onCompleted],
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
        {error ? (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
          >
            {error}
          </p>
        ) : null}

        {phase.kind === "start" ? (
          <StartScreen isStarting={isStarting} onStart={handleStart} />
        ) : phase.kind === "running" ? (
          <RunningScreen
            words={phase.words}
            index={phase.index}
            answers={phase.answers}
            onChange={(value) =>
              setPhase((current) =>
                current.kind === "running"
                  ? {
                      ...current,
                      answers: current.answers.map((answer, index) =>
                        index === current.index ? value : answer,
                      ),
                    }
                  : current,
              )
            }
            onMove={(delta) =>
              setPhase((current) =>
                current.kind === "running"
                  ? { ...current, index: current.index + delta }
                  : current,
              )
            }
            onFinish={() => handleFinish(phase.words, phase.answers)}
          />
        ) : phase.kind === "grading" ? (
          <GradingScreen />
        ) : (
          <ResultScreen
            test={phase.test}
            onRestart={() => setPhase({ kind: "start" })}
          />
        )}
      </div>
    </div>
  );
};

const StartScreen: FC<{ isStarting: boolean; onStart: () => void }> = ({
  isStarting,
  onStart,
}) => (
  <div className="flex flex-col items-center gap-4 py-16 text-center">
    <SquareCheckBigIcon className="text-muted-foreground size-8" />
    <div className="space-y-1">
      <h1 className="text-xl font-medium">Test yourself</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        {TEST_WORD_COUNT} words drawn at random from the ones you have looked
        up. Write a sentence that uses each one — you will see how you did at
        the end.
      </p>
    </div>
    <Button size="lg" disabled={isStarting} onClick={onStart}>
      {isStarting ? <Loader2Icon className="animate-spin" /> : null}
      Start test
    </Button>
  </div>
);

type RunningScreenProps = {
  words: string[];
  index: number;
  answers: string[];
  onChange: (value: string) => void;
  onMove: (delta: number) => void;
  onFinish: () => void;
};

const RunningScreen: FC<RunningScreenProps> = ({
  words,
  index,
  answers,
  onChange,
  onMove,
  onFinish,
}) => {
  const isLast = index === words.length - 1;
  const answered = answers.filter((answer) => answer.trim()).length;

  // The answer is one sentence, so Enter has nothing to do inside the box —
  // it advances, and Shift+Enter is still there for anyone who wants a break.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (isLast) onFinish();
    else onMove(1);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>
            Word {index + 1} of {words.length}
          </span>
          <span>{answered} answered</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={words.length}
          aria-label="Test progress"
          className="bg-foreground/10 h-1 overflow-hidden rounded-full"
        >
          <div
            className="bg-foreground h-full rounded-full transition-[width] duration-200"
            style={{ width: `${((index + 1) / words.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-medium">{words[index]}</h1>
        <label htmlFor="test-answer" className="text-muted-foreground text-sm">
          Write one sentence that uses this word.
        </label>
        {/* Keyed by index so React replaces the box between words: the value
            is controlled either way, but a fresh node re-runs autoFocus and
            drops the previous word's undo stack and cursor position. */}
        <textarea
          key={index}
          id="test-answer"
          // biome-ignore lint/a11y/noAutofocus: the answer box is the only thing on the screen to type into, and the word changes under it
          autoFocus
          rows={3}
          value={answers[index] ?? ""}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Your sentence…"
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 field-sizing-content min-h-20 w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-3"
        />
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowLeftIcon />
          Previous
        </Button>

        {isLast ? (
          <Button onClick={onFinish}>
            <CheckIcon />
            Finish
          </Button>
        ) : (
          <Button onClick={() => onMove(1)}>
            Next
            <ArrowRightIcon />
          </Button>
        )}
      </div>
    </div>
  );
};

const GradingScreen: FC = () => (
  <div
    role="status"
    className="text-muted-foreground flex flex-col items-center gap-3 py-24 text-sm"
  >
    <Loader2Icon className="size-6 animate-spin" />
    Grading your answers…
  </div>
);

const ResultScreen: FC<{ test: TestEntry; onRestart: () => void }> = ({
  test,
  onRestart,
}) => {
  const correct = test.questions.filter((question) => question.correct).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">Used correctly</p>
          <p className="text-4xl font-medium">
            {correct}
            <span className="text-muted-foreground text-xl">
              {" "}
              / {test.questions.length}
            </span>
          </p>
        </div>
        <Button variant="outline" onClick={onRestart}>
          <RotateCcwIcon />
          New test
        </Button>
      </div>

      <ol className="flex flex-col gap-3">
        {test.questions.map((question) => (
          <ResultCard key={question.position} question={question} />
        ))}
      </ol>
    </div>
  );
};

const ResultCard: FC<{ question: TestQuestion }> = ({ question }) => (
  <li className="border-border rounded-lg border p-4">
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full",
          question.correct
            ? "bg-foreground/10 text-foreground"
            : "bg-destructive/15 text-destructive",
        )}
      >
        {question.correct ? (
          <CheckIcon className="size-3.5" />
        ) : (
          <XIcon className="size-3.5" />
        )}
      </span>
      <h2 className="font-medium">{question.word}</h2>
      <span
        className={cn(
          "ms-auto text-xs",
          question.correct ? "text-muted-foreground" : "text-destructive",
        )}
      >
        {question.correct ? "Correct" : "Incorrect"}
      </span>
    </div>

    <p className="text-muted-foreground mt-3 text-xs uppercase">Your answer</p>
    <p
      className={cn(
        "text-sm",
        question.answer.trim() ? null : "text-muted-foreground italic",
      )}
    >
      {question.answer.trim() || "No answer"}
    </p>

    <p className="text-muted-foreground mt-3 text-xs uppercase">Comment</p>
    <p className="text-sm">{question.comment}</p>
  </li>
);
