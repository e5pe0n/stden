import { http, type HttpHandler, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";

const handlers: HttpHandler[] = [
	http.post("http://localhost:3000/api/v1", () => {
		return HttpResponse.json({ text: "Hello, world!" });
	}),
];

export const worker = setupWorker(...handlers);
