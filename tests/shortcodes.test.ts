import { describe, expect, it } from "vitest";

import { hasDynamicContent, parseAttributes, resolveSeoVariables, resolveShortcodes, shortcodes } from "../src/core/index.js";

const ctx = (iso: string, timeZone = "UTC") => ({ now: new Date(iso), timeZone });
const r = (text: string, iso = "2026-10-05T03:06:17Z", extra = {}) => resolveShortcodes(text, { ...ctx(iso), ...extra });

describe("parsing", () => {
	it("parses WordPress attribute syntax", () => {
		expect(parseAttributes(` date="2008-01-01" format='ym' ordinal=true flag "pos"`)).toEqual({
			date: "2008-01-01",
			format: "ym",
			ordinal: "true",
			"0": "flag",
			"1": "pos",
		});
	});

	it("leaves unknown tags and ordinary brackets alone", () => {
		expect(r("[note] see [1] and [years] in [year]")).toBe("[note] see [1] and [years] in 2026");
	});

	it("prints [[year]] as a literal [year]", () => {
		expect(r("Type [[year]] to get [year].")).toBe("Type [year] to get 2026.");
	});

	it("is case-sensitive like WordPress", () => {
		expect(r("[YEAR] [year]")).toBe("[YEAR] 2026");
	});

	it("handles self-closing tags and repeats", () => {
		expect(r("[year /]-[year]-[year/]")).toBe("2026-2026-2026");
	});

	it("does not confuse [date] with [datepublished]", () => {
		expect(r("[date] / [datepublished]", undefined, { published: "2021-02-02T17:06:34Z" })).toBe("October 5, 2026 / February 2, 2021");
	});
});

describe("WordPress attribute filtering", () => {
	it("ignores attributes the WordPress shortcode ignores", () => {
		// [date] takes no attributes in the plugin, so format= has no effect
		expect(r("[date format=Y]")).toBe("October 5, 2026");
		expect(r("[month case=upper]")).toBe("October");
	});
});

describe("date shortcodes", () => {
	it("rolls months over safely at month end", () => {
		expect(r("[nmonth] [pmonth] [nmonthyear]", "2026-01-31T10:00:00Z")).toBe("February December February 2026");
		expect(r("[pmonthyear]", "2026-01-15T10:00:00Z")).toBe("December 2025");
	});

	it("computes ages across leap days and month ends", () => {
		expect(r("[age date=2024-02-29 format=ymd]", "2025-03-01T00:00:00Z")).toBe("1 year, 1 day");
		expect(r("[age date=2024-01-31 format=ymd]", "2024-03-01T00:00:00Z")).toBe("1 month, 1 day");
		expect(r("[age date=2026-10-05 format=ym]")).toBe("0 months");
		expect(r("[age date=2030-01-01]")).toBe("");
		expect(r("[age date=2025-10-05 ordinal=1] [age date=2014-10-05 rank=yes]")).toBe("1st 12th");
	});

	it("counts calendar days and clamps", () => {
		expect(r("[daysuntil date=2026-10-01]")).toBe("-4");
		expect(r("[daysuntil date=2026-10-01 clamp=true]")).toBe("0");
		expect(r("[dayssince date=2026-10-05]")).toBe("0");
		expect(r("[daysuntil date=not-a-date]")).toBe("");
	});

	it("finds US shopping events", () => {
		expect(r("[blackfriday] [cybermonday]", "2025-06-01T00:00:00Z")).toBe("November 28 December 1");
	});

	it("names seasons for both hemispheres", () => {
		expect(r("[season] [season region=south]", "2026-01-10T00:00:00Z")).toBe("Winter Summer");
		expect(r("[season]", "2026-04-10T00:00:00Z")).toBe("Spring");
	});

	it("uses the site time zone for the current day", () => {
		const late = "2026-12-31T20:00:00Z";
		expect(resolveShortcodes("[year] [dt]", ctx(late, "UTC"))).toBe("2026 31");
		expect(resolveShortcodes("[year] [dt]", ctx(late, "Asia/Kolkata"))).toBe("2027 1");
	});

	it("formats post dates with the configured date format", () => {
		expect(r("[datemodified]", undefined, { modified: "2026-08-22T11:09:53Z", dateFormat: "j M Y" })).toBe("22 Aug 2026");
		expect(r("[datepublished]")).toBe("");
	});
});

describe("SEO variables", () => {
	it("resolves Rank Math and Yoast variables", () => {
		const opts = ctx("2026-10-05T03:06:17Z");
		expect(resolveSeoVariables("Best hosts %currentyear% | %%currentmonth%% %currentday%", opts)).toBe("Best hosts 2026 | October 5");
		expect(resolveShortcodes("%currentyear%", { ...opts, seoVariables: false })).toBe("%currentyear%");
	});

	it("detects dynamic content", () => {
		expect(hasDynamicContent("Top 10 in [year]")).toBe(true);
		expect(hasDynamicContent("%%currentyear%%")).toBe(true);
		expect(hasDynamicContent("No dates [here]")).toBe(false);
	});
});

describe("registry", () => {
	it("lets a site add shortcodes without changing the defaults", () => {
		const mine = shortcodes.clone().register("company", () => "Gatilab");
		expect(mine.resolve("[company] since [year]", ctx("2026-10-05T00:00:00Z"))).toBe("Gatilab since 2026");
		expect(shortcodes.resolve("[company]", ctx("2026-10-05T00:00:00Z"))).toBe("[company]");
	});

	it("supports enclosing shortcodes and attribute defaults", () => {
		const reg = shortcodes.clone().register("upper", {
			defaults: { lang: "en" },
			handler: (atts, _ctx, content) => `${(content ?? "").toUpperCase()}:${atts.lang}:${String("x" in atts)}`,
		});
		expect(reg.resolve('[upper x="1"]hi [year][/upper]', ctx("2026-10-05T00:00:00Z"))).toBe("HI [YEAR]:en:false");
	});

	it("never breaks a page over a failing handler", () => {
		const reg = shortcodes.clone().register("boom", () => {
			throw new Error("nope");
		});
		expect(reg.resolve("a [boom] b", {})).toBe("a [boom] b");
	});
});
