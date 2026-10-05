/**
 * Date values by type, ported from the WordPress plugin's DateRenderer.
 * Shortcodes, blocks and SEO variables all render through here.
 */
import { DateEngine, type EngineOptions } from "./engine.js";
import { normalize, type WallTime } from "./time.js";

export type DateArgs = Record<string, string | number | boolean | undefined>;

export interface RenderContext extends EngineOptions {
	/** Entry publish date, for [datepublished]. */
	published?: Date | string | null;
	/** Entry last-modified date, for [datemodified]. */
	modified?: Date | string | null;
	/** PHP date format used where WordPress used Settings → Date Format. Default "F j, Y". */
	dateFormat?: string;
}

const ALIASES: Record<string, string> = {
	cmonth: "month",
	mon: "month_short",
	cmon: "month_short",
	mm: "month_number_zero",
	mn: "month_number",
	nmon: "next_month_short",
	cnmon: "next_month_short",
	pmon: "previous_month_short",
	cpmon: "previous_month_short",
	nmonth: "next_month",
	cnmonth: "next_month",
	pmonth: "previous_month",
	cpmonth: "previous_month",
	nmonthyear: "next_month_year",
	pmonthyear: "previous_month_year",
	dt: "day",
	nd: "next_day",
	pd: "previous_day",
	wd: "weekday_short",
	datepublished: "published",
	datemodified: "modified",
};

/** Every value type `renderDate` understands (after alias resolution). */
export const DATE_TYPES = [
	"year", "nyear", "nnyear", "pyear", "ppyear",
	"month", "month_short", "month_number", "month_number_zero",
	"next_month", "next_month_short", "previous_month", "previous_month_short",
	"date", "monthyear", "next_month_year", "previous_month_year",
	"day", "next_day", "previous_day", "weekday", "weekday_short",
	"published", "modified", "blackfriday", "cybermonday",
	"daysuntil", "dayssince", "age", "age_ym", "age_ymd", "age_ordinal",
	"season", "season_south", "nextoccurrence", "daysuntilnext", "occurrenceyear",
] as const;

function str(args: DateArgs, key: string, fallback = ""): string {
	const v = args[key];
	return v === undefined || v === null || String(v) === "" ? fallback : String(v);
}

function int(args: DateArgs, key: string, fallback = 0): number {
	if (args[key] === undefined) return fallback;
	const n = Number.parseInt(String(args[key]), 10);
	return Number.isNaN(n) ? 0 : n; // PHP (int) cast
}

function bool(args: DateArgs, key: string, fallback = false): boolean {
	const v = args[key];
	if (v === undefined || String(v) === "") return fallback;
	if (typeof v === "boolean") return v;
	return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

function toDate(value: Date | string | null | undefined): Date | null {
	if (!value) return null;
	const d = value instanceof Date ? value : new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}

export class DateRenderer {
	readonly engine: DateEngine;
	private readonly ctx: RenderContext;

	constructor(ctx: RenderContext = {}) {
		this.ctx = ctx;
		this.engine = new DateEngine(ctx);
	}

	/** Render a value type ("year", "monthyear", "age", …) with optional args, then apply `case`. */
	render(type: string, args: DateArgs = {}): string {
		const output = this.value(type.toLowerCase(), args);
		return this.engine.transformCase(output, str(args, "case", "none"));
	}

	private value(rawType: string, args: DateArgs): string {
		const type = ALIASES[rawType] ?? rawType;
		const e = this.engine;
		const now = e.wall();
		const year = now.year;

		switch (type) {
			case "year":
				return String(year + int(args, "offset", int(args, "n")));
			case "nyear":
				return String(year + 1);
			case "nnyear":
				return String(year + 2);
			case "pyear":
				return String(year - 1);
			case "ppyear":
				return String(year - 2);
			case "month":
				return this.month(now, args, "F");
			case "month_short":
				return this.month(now, args, "M");
			case "month_number":
				return this.month(now, args, "n");
			case "month_number_zero":
				return this.month(now, args, "m");
			case "next_month":
				return this.month(now, args, "F", 1);
			case "next_month_short":
				return this.month(now, args, "M", 1);
			case "previous_month":
				return this.month(now, args, "F", -1);
			case "previous_month_short":
				return this.month(now, args, "M", -1);
			case "date":
				return e.format(now, str(args, "format", "F j, Y"));
			case "monthyear":
				return this.month(now, args, "F Y");
			case "next_month_year":
				return this.month(now, args, "F Y", 1);
			case "previous_month_year":
				return this.month(now, args, "F Y", -1);
			case "day":
				return e.format(now, "j");
			case "next_day":
				return e.format(normalize({ ...now, day: now.day + 1 }), "j");
			case "previous_day":
				return e.format(normalize({ ...now, day: now.day - 1 }), "j");
			case "weekday":
				return e.format(now, "l");
			case "weekday_short":
				return e.format(now, "D");
			case "published":
			case "modified": {
				const d = toDate(type === "published" ? this.ctx.published : this.ctx.modified);
				return d ? e.format(d, str(args, "format", this.ctx.dateFormat ?? "F j, Y")) : "";
			}
			case "blackfriday":
			case "cybermonday": {
				const d = e.eventDate(type, year);
				return d ? e.format(d, str(args, "format", "F j")) : "";
			}
			case "daysuntil":
			case "dayssince":
				return this.dayDifference(args, type === "daysuntil");
			case "age":
			case "age_ym":
			case "age_ymd":
			case "age_ordinal": {
				const age = e.ageInterval(str(args, "date"));
				if (!age) return "";
				const format = type === "age_ym" ? "ym" : type === "age_ymd" ? "ymd" : str(args, "format", "y");
				const ordinal = type === "age_ordinal" || bool(args, "ordinal", bool(args, "rank", false));
				return e.formatAge(age, format, ordinal);
			}
			case "season":
			case "season_south":
				return this.season(type, args, now.month);
			case "nextoccurrence": {
				const occ = e.nextOccurrence(str(args, "date"), str(args, "rule"));
				return occ ? e.format(occ, str(args, "format", this.ctx.dateFormat ?? "F j, Y")) : "";
			}
			case "daysuntilnext": {
				const occ = e.nextOccurrence(str(args, "date"), str(args, "rule"));
				return occ ? String(Math.max(0, e.calendarDays(e.today(), occ))) : "";
			}
			case "occurrenceyear": {
				const occ = e.nextOccurrence(str(args, "date"), str(args, "rule"));
				return occ ? String(occ.year) : "";
			}
			default:
				return "";
		}
	}

	/** First of the month, shifted by `offset` (and +1 from `rollover_day` on). */
	private month(now: WallTime, args: DateArgs, format: string, defaultOffset = 0): string {
		let offset = int(args, "offset", defaultOffset);
		const rollover = Math.max(0, Math.min(31, int(args, "rollover_day", int(args, "rolloverDay"))));
		if (rollover > 0 && now.day >= rollover) offset++;
		const target = normalize({ ...now, day: 1, month: now.month + offset });
		return this.engine.format(target, str(args, "format", format));
	}

	private dayDifference(args: DateArgs, until: boolean): string {
		const e = this.engine;
		const target = e.parseDate(str(args, "date"));
		if (!target) return "";
		const days = until ? e.calendarDays(e.today(), target) : e.calendarDays(target, e.today());
		return String(bool(args, "clamp", false) ? Math.max(0, days) : days);
	}

	private season(type: string, args: DateArgs, month: number): string {
		const region = str(args, "region", type === "season_south" ? "south" : "north").toLowerCase();
		let season = month >= 3 && month <= 5 ? "Spring" : month >= 6 && month <= 8 ? "Summer" : month >= 9 && month <= 11 ? "Fall" : "Winter";
		if (region === "south" || region === "southern") {
			season = { Spring: "Fall", Summer: "Winter", Fall: "Spring", Winter: "Summer" }[season]!;
		}
		return season;
	}
}
