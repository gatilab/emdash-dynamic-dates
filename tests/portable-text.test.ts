import { describe, expect, it } from "vitest";

import { resolvePortableText } from "../src/core/index.js";

const opts = { now: new Date("2026-10-05T03:06:17Z"), timeZone: "UTC" };

const doc = [
	{ _type: "block", _key: "a", style: "h2", markDefs: [{ _key: "l", _type: "link", href: "/best-[year]/" }], children: [{ _type: "span", _key: "s", text: "Best hosts in [year]", marks: ["l"] }] },
	{ _type: "code", _key: "c", code: "echo '[year]';", language: "php" },
	{ _type: "faq", _key: "f", items: [{ _key: "q0", question: "Still good in [year]?", answer: "<p>Yes, as of [monthyear].</p>" }] },
	{ _type: "dynamicDate", _key: "d", dateType: "modified", format: "F Y" },
];

describe("resolvePortableText", () => {
	it("resolves text and custom block strings, but not code, URLs or keys", () => {
		const out = resolvePortableText(doc, { ...opts, modified: "2026-08-22T00:00:00Z" }) as any[];
		expect(out[0].children[0].text).toBe("Best hosts in 2026");
		expect(out[0].markDefs[0].href).toBe("/best-[year]/");
		expect(out[1].code).toBe("echo '[year]';");
		expect(out[2].items[0].question).toBe("Still good in 2026?");
		expect(out[2].items[0].answer).toBe("<p>Yes, as of October 2026.</p>");
		expect(out[3]._value).toBe("August 2026");
	});

	it("never mutates the stored value", () => {
		const copy = structuredClone(doc);
		resolvePortableText(doc, opts);
		expect(doc).toEqual(copy);
	});

	it("passes visual-editing values through untouched", () => {
		const editable = structuredClone(doc);
		Object.defineProperty(editable, Symbol.for("__emdash"), { value: { collection: "posts", id: "1", field: "content" }, enumerable: false });
		expect(resolvePortableText(editable, opts)).toBe(editable);
	});
});
