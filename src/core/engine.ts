/**
 * Date logic ported from the WordPress plugin's DateEngine: the current time
 * in the site's zone, strict date parsing, calendar-day differences, ages,
 * ordinals, US shopping events, and recurring dates.
 */
import { formatPhpDate } from "./php-date.js";
import {
	assertTimeZone,
	calendarDayDiff,
	compareDates,
	daysInMonth,
	normalize,
	toInstant,
	wallTime,
	weekday,
	type WallTime,
} from "./time.js";

export interface EngineOptions {
	/** IANA zone, e.g. "Asia/Kolkata". WordPress's equivalent is Settings → General → Timezone. */
	timeZone?: string;
	/** BCP 47 locale for month and day names. */
	locale?: string;
	/** Fixed "now", for previews and tests. */
	now?: Date;
}

export interface AgeInterval {
	years: number;
	months: number;
	days: number;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const NTH = ["first", "second", "third", "fourth"];

export class DateEngine {
	readonly timeZone: string;
	readonly locale: string;
	private readonly fixedNow?: Date;

	constructor(options: EngineOptions = {}) {
		this.timeZone = options.timeZone || "UTC";
		assertTimeZone(this.timeZone);
		this.locale = options.locale || "en-US";
		this.fixedNow = options.now;
	}

	now(): Date {
		return this.fixedNow ? new Date(this.fixedNow.getTime()) : new Date();
	}

	wall(instant: Date = this.now()): WallTime {
		return wallTime(instant, this.timeZone);
	}

	instant(w: WallTime): Date {
		return toInstant(normalize(w), this.timeZone);
	}

	today(): WallTime {
		return { ...this.wall(), hour: 0, minute: 0, second: 0 };
	}

	format(instantOrWall: Date | WallTime, format: string): string {
		const instant = instantOrWall instanceof Date ? instantOrWall : this.instant(instantOrWall);
		return formatPhpDate(format, instant, { timeZone: this.timeZone, locale: this.locale });
	}

	/** "2025-12-25" (strict), or any date `Date.parse` understands; time of day is dropped. */
	parseDate(value: string): WallTime | null {
		const v = value.trim();
		if (!v) return null;
		const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (m) {
			const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
			if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
			return { year: y, month: mo, day: d, hour: 0, minute: 0, second: 0 };
		}
		const t = Date.parse(v);
		if (Number.isNaN(t)) return null;
		return { ...this.wall(new Date(t)), hour: 0, minute: 0, second: 0 };
	}

	calendarDays(from: WallTime, to: WallTime): number {
		return calendarDayDiff(from, to);
	}

	/** Completed years, months and days since `birthDate`; null for a future or invalid date. */
	ageInterval(birthDate: string): AgeInterval | null {
		const birth = this.parseDate(birthDate);
		const today = this.today();
		if (!birth || compareDates(birth, today) > 0) return null;
		let months = (today.year - birth.year) * 12 + (today.month - birth.month);
		if (today.day < birth.day) months--;
		const anchorYear = birth.year + Math.floor((birth.month - 1 + months) / 12);
		const anchorMonth = ((birth.month - 1 + months) % 12) + 1;
		const anchor = {
			...birth,
			year: anchorYear,
			month: anchorMonth,
			day: Math.min(birth.day, daysInMonth(anchorYear, anchorMonth)),
		};
		return { years: Math.floor(months / 12), months: months % 12, days: calendarDayDiff(anchor, today) };
	}

	formatAge(age: AgeInterval, format = "y", ordinal = false): string {
		if (ordinal) return this.ordinal(age.years);
		const f = format.toLowerCase();
		if (f === "y") return String(age.years);
		const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
		const parts: string[] = [];
		if (age.years > 0) parts.push(plural(age.years, "year", "years"));
		if (age.months > 0) parts.push(plural(age.months, "month", "months"));
		if (f === "ymd" && age.days > 0) parts.push(plural(age.days, "day", "days"));
		if (parts.length) return parts.join(", ");
		return f === "ymd" ? "0 days" : "0 months";
	}

	ordinal(n: number): string {
		const abs = Math.abs(n);
		if (abs % 100 >= 11 && abs % 100 <= 13) return `${n}th`;
		return `${n}${["th", "st", "nd", "rd"][abs % 10] ?? "th"}`;
	}

	/** "fourth thursday of november" → that date in `year`. */
	dateFromRule(rule: string, year: number): WallTime | null {
		const m = rule
			.toLowerCase()
			.trim()
			.replace(/\s+/g, " ")
			.match(/^(first|second|third|fourth|last) (sunday|monday|tuesday|wednesday|thursday|friday|saturday) of (january|february|march|april|may|june|july|august|september|october|november|december)$/);
		if (!m) return null;
		const dow = WEEKDAYS.indexOf(m[2]!);
		const month = MONTHS.indexOf(m[3]!) + 1;
		let day: number;
		if (m[1] === "last") {
			const last = daysInMonth(year, month);
			day = last - ((weekday(year, month, last) - dow + 7) % 7);
		} else {
			const first = 1 + ((dow - weekday(year, month, 1) + 7) % 7);
			day = first + 7 * NTH.indexOf(m[1]!);
		}
		return { year, month, day, hour: 0, minute: 0, second: 0 };
	}

	/** Black Friday and Cyber Monday follow US Thanksgiving. */
	eventDate(event: "blackfriday" | "cybermonday", year: number): WallTime | null {
		const thanksgiving = this.dateFromRule("fourth thursday of november", year);
		if (!thanksgiving) return null;
		return normalize({ ...thanksgiving, day: thanksgiving.day + (event === "blackfriday" ? 1 : 4) });
	}

	/** Next time a yearly date (MM-DD, YYYY-MM-DD) or rule comes round, today included. */
	nextOccurrence(date = "", rule = ""): WallTime | null {
		const today = this.today();
		if (rule.trim()) {
			let occ = this.dateFromRule(rule, today.year);
			if (occ && compareDates(occ, today) < 0) occ = this.dateFromRule(rule, today.year + 1);
			return occ;
		}
		const md = date.trim().match(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
		if (md) {
			// look ahead far enough for February 29
			for (let offset = 0; offset <= 8; offset++) {
				const y = today.year + offset;
				const occ = this.parseDate(`${y}-${md[1]}-${md[2]}`);
				if (occ && compareDates(occ, today) >= 0) return occ;
			}
			return null;
		}
		const full = this.parseDate(date);
		if (!full) return null;
		return this.nextOccurrence(`${String(full.month).padStart(2, "0")}-${String(full.day).padStart(2, "0")}`);
	}

	transformCase(value: string, textCase: string): string {
		switch (textCase.toLowerCase()) {
			case "upper":
				return value.toLocaleUpperCase(this.locale);
			case "lower":
				return value.toLocaleLowerCase(this.locale);
			case "title":
				return value.toLocaleLowerCase(this.locale).replace(/(^|[\s\-'(/])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase(this.locale));
			default:
				return value;
		}
	}
}
