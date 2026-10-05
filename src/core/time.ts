/**
 * Wall-clock arithmetic in an IANA time zone, built on Intl so it runs the
 * same in Node, Cloudflare Workers and browsers. A `WallTime` is what a clock
 * in that zone shows; `toInstant` turns it back into a real moment.
 */

export interface WallTime {
	year: number;
	/** 1–12 */
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
	let f = partsFormatters.get(timeZone);
	if (!f) {
		f = new Intl.DateTimeFormat("en-US", {
			timeZone,
			hourCycle: "h23",
			year: "numeric",
			month: "numeric",
			day: "numeric",
			hour: "numeric",
			minute: "numeric",
			second: "numeric",
		});
		partsFormatters.set(timeZone, f);
	}
	return f;
}

/** Throws a RangeError for an unknown zone, like `new Intl.DateTimeFormat` does. */
export function assertTimeZone(timeZone: string): void {
	partsFormatter(timeZone);
}

export function wallTime(instant: Date, timeZone: string): WallTime {
	const p: Record<string, number> = {};
	for (const part of partsFormatter(timeZone).formatToParts(instant)) {
		if (part.type !== "literal") p[part.type] = Number(part.value);
	}
	return { year: p.year!, month: p.month!, day: p.day!, hour: p.hour! % 24, minute: p.minute!, second: p.second! };
}

/** Offset from UTC in minutes for `instant` in `timeZone` (IST → 330). */
export function offsetMinutes(instant: Date, timeZone: string): number {
	const w = wallTime(instant, timeZone);
	const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
	return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/** The instant a clock in `timeZone` shows `w` (first match across DST gaps). */
export function toInstant(w: WallTime, timeZone: string): Date {
	const naive = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
	let guess = naive - offsetMinutes(new Date(naive), timeZone) * 60_000;
	guess = naive - offsetMinutes(new Date(guess), timeZone) * 60_000;
	return new Date(guess);
}

/** Normalise overflowing fields (month 13, day 0, …) like PHP's DateTime does. */
export function normalize(w: WallTime): WallTime {
	const d = new Date(Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second));
	return {
		year: d.getUTCFullYear(),
		month: d.getUTCMonth() + 1,
		day: d.getUTCDate(),
		hour: d.getUTCHours(),
		minute: d.getUTCMinutes(),
		second: d.getUTCSeconds(),
	};
}

export function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** 0 = Sunday … 6 = Saturday, for a calendar date. */
export function weekday(year: number, month: number, day: number): number {
	return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Whole days from date a to date b, ignoring time of day. */
export function calendarDayDiff(a: WallTime, b: WallTime): number {
	return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

export function compareDates(a: WallTime, b: WallTime): number {
	return Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day);
}
