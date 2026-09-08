import { type HttpHandler, HttpResponse, http } from "msw";
import { setupWorker } from "msw/browser";

const API = "http://localhost:3000/api/v1";

type MockHistory = {
  id: number;
  type: "meaning" | "diff" | "free";
  question: string;
  answer: string;
  createdAt: string;
};

// Lives for the life of the page, which is all mock mode needs: the sidebar
// starts with a couple of rows and grows as asks are made.
let nextHistoryId = 3;
const histories: MockHistory[] = [
  {
    id: 2,
    type: "diff",
    question: "/diff affect, effect",
    answer:
      "**affect** is usually the verb and **effect** usually the noun.\n\n- The weather *affects* my mood.\n- The weather has an *effect* on my mood.",
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    id: 1,
    type: "meaning",
    question: "disseminate",
    answer: "To spread widely, scatter, or distribute information.",
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

const toSummary = ({ answer: _answer, ...summary }: MockHistory) => summary;

type MockTest = {
  id: number;
  score: number;
  words: string[];
  createdAt: string;
  questions: {
    position: number;
    word: string;
    answer: string;
    correct: boolean;
    comment: string;
  }[];
};

const TEST_WORDS = [
  "disseminate",
  "ubiquitous",
  "meticulous",
  "resilient",
  "candid",
  "arbitrary",
  "profound",
  "tangible",
  "succinct",
  "pragmatic",
];

let nextTestId = 1;
const tests: MockTest[] = [];

const toTestSummary = ({ questions: _questions, ...summary }: MockTest) =>
  summary;

const handlers: HttpHandler[] = [
  http.get(`${API}/histories`, () => {
    return HttpResponse.json({ histories: histories.map(toSummary) });
  }),

  http.get(`${API}/histories/:id`, ({ params }) => {
    const history = histories.find(
      (candidate) => candidate.id === Number(params.id),
    );
    if (!history) {
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    }
    return HttpResponse.json({ history });
  }),

  http.delete(`${API}/histories/:id`, ({ params }) => {
    const index = histories.findIndex(
      (candidate) => candidate.id === Number(params.id),
    );
    if (index === -1) {
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    }
    histories.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API}/tests/new`, () => {
    return HttpResponse.json({ words: TEST_WORDS });
  }),

  http.get(`${API}/tests`, () => {
    return HttpResponse.json({ tests: tests.map(toTestSummary) });
  }),

  http.get(`${API}/tests/:id`, ({ params }) => {
    const test = tests.find((candidate) => candidate.id === Number(params.id));
    if (!test) {
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    }
    return HttpResponse.json({ test });
  }),

  http.delete(`${API}/tests/:id`, ({ params }) => {
    const index = tests.findIndex(
      (candidate) => candidate.id === Number(params.id),
    );
    if (index === -1) {
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    }
    tests.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // Grades every other answer correct, which is enough to exercise both
  // result states without a model behind it.
  http.post(`${API}/tests`, async ({ request }) => {
    const { answers } = (await request.json()) as {
      answers: { word: string; answer: string }[];
    };

    const questions = answers.map((item, index) => {
      const correct = Boolean(item.answer.trim()) && index % 2 === 0;
      return {
        position: index + 1,
        word: item.word,
        answer: item.answer,
        correct,
        comment: correct
          ? `Nice — "${item.word}" is used with the right meaning here.`
          : `"${item.word}" does not quite fit. Try: The report will ${item.word} the findings.`,
      };
    });

    const test: MockTest = {
      id: nextTestId++,
      score: questions.filter((question) => question.correct).length * 10,
      words: questions.map((question) => question.word),
      createdAt: new Date().toISOString(),
      questions,
    };
    tests.unshift(test);

    return HttpResponse.json({ test });
  }),

  http.post(API, async ({ request }) => {
    const payload = (await request.json()) as {
      type: MockHistory["type"];
      input: string | string[];
    };
    const question =
      payload.type === "meaning"
        ? String(payload.input)
        : `/${payload.type} ${
            Array.isArray(payload.input)
              ? payload.input.join(", ")
              : payload.input
          }`;

    const text =
      'Okay, let\'s break down the word "disseminate."\n\n**Meaning:**\n\n*   **Definition:** To spread widely, scatter, or distribute information, ideas, news, or knowledge.  It often implies a planned or deliberate effort to make something known to a lot of people.\n\n**Example Sentences:**\n\n1.  The organization uses its website to **disseminate** information about its charitable activities.\n2.  The internet has made it easier to **disseminate** propaganda and misinformation.\n3.  The university researchers will **disseminate** their findings through publications and conferences.\n4.  The government is working to **disseminate** public health guidelines during the pandemic.\n5.  Early printing presses allowed scholars to **disseminate** knowledge more rapidly.\n\n**Japanese Translation:**\n\n*   **広める (hiromeru):** This is a very common and versatile translation, meaning "to spread," "to propagate," or "to popularize." It\'s often a good first choice.\n*   **普及させる (fukyū saseru):** This means "to popularize" or "to diffuse."  It emphasizes making something widespread.\n*   **流布する (rufu suru):** This means "to circulate," "to spread," or "to propagate." It often has a slightly negative connotation, implying that something is spreading whether it\'s true or not.\n*   **周知する (shūchi suru):** This means "to make widely known" or "to inform the public." It emphasizes making something known to everyone.\n*   **配信する (haishin suru):** This means "to distribute" or "to broadcast," often referring to digital content like news or information. (Particularly useful for things like newsletters)\n\n**Example Sentences in Japanese Using 広める (hiromeru):**\n\n*   その団体はウェブサイトを使って慈善活動についての情報を**広めて**います。\n    (Sono dantai wa webusaito o tsukatte jizen katsudō ni tsuite no jōhō o **hiromete** imasu.)\n    (The organization uses its website to **disseminate** information about its charitable activities.)\n\n*   インターネットはプロパガンダや偽情報を**広める**のをより簡単にしました。\n    (Intānetto wa puropaganda ya gijōhō o **hiromeru** no o yori kantan ni shimashita.)\n    (The internet has made it easier to **disseminate** propaganda and misinformation.)\n\n**Synonyms:**\n\n*   Spread\n*   Propagate\n*   Circulate\n*   Distribute\n*   Broadcast\n*   Promulgate\n*   Publicize\n*   Make known\n*   Promote\n*   Transmit\n*   Diffuse\n*   Scatter\n*   Convey\n\nWhen choosing a synonym, consider the context.  Some synonyms (like "scatter") imply a less organized approach than "disseminate," while others (like "promulgate") suggest a more formal or official distribution.\n';

    const history: MockHistory = {
      id: nextHistoryId++,
      type: payload.type,
      question,
      answer: text,
      createdAt: new Date().toISOString(),
    };
    histories.unshift(history);

    return HttpResponse.json({ text, history: toSummary(history) });
  }),
];

export const worker = setupWorker(...handlers);
