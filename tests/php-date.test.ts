import { describe, expect, it } from "vitest";

import { formatPhpDate } from "../src/core/php-date.js";

const at = new Date("2026-10-05T03:06:17Z");

describe("formatPhpDate", () => {
	it.each([
		["F j, Y", "October 5, 2026"],
		["jS F Y", "5th October 2026"],
		["D, d M y", "Mon, 05 Oct 26"],
		["l N w z t L", "Monday 1 1 277 31 0"],
		["W o", "41 2026"],
		["g:i a | G:i | h A | H:i:s", "3:06 am | 3:06 | 03 AM | 03:06:17"],
		["U", "1791169577"],
		["c", "2026-10-05T03:06:17+00:00"],
		["r", "Mon, 05 Oct 2026 03:06:17 +0000"],
		["\\Y\\e\\a\\r: Y", "Year: 2026"],
	])("%s", (format, expected) => {
		expect(formatPhpDate(format, at, { timeZone: "UTC" })).toBe(expected);
	});

	it("uses the time zone for wall time and offsets", () => {
		expect(formatPhpDate("Y-m-d H:i P O e", at, { timeZone: "Asia/Kolkata" })).toBe("2026-10-05 08:36 +05:30 +0530 Asia/Kolkata");
		// late UTC evening is already tomorrow in India
		expect(formatPhpDate("j", new Date("2026-10-05T20:00:00Z"), { timeZone: "Asia/Kolkata" })).toBe("6");
	});

	it("knows daylight saving time", () => {
		expect(formatPhpDate("I P", new Date("2026-07-01T12:00:00Z"), { timeZone: "America/New_York" })).toBe("1 -04:00");
		expect(formatPhpDate("I P", new Date("2026-01-01T12:00:00Z"), { timeZone: "America/New_York" })).toBe("0 -05:00");
	});

	it("localizes names", () => {
		expect(formatPhpDate("l j F Y", at, { timeZone: "UTC", locale: "fr-FR" })).toBe("lundi 5 octobre 2026");
	});
});
