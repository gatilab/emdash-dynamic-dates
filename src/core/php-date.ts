/**
 * PHP `date()` / WordPress `wp_date()` formatting, so `format="F j, Y"` means
 * exactly what it meant on WordPress. Month and weekday names come from Intl
 * in the requested locale (English by default, matching PHP's names).
 */
import { daysInMonth, isLeapYear, offsetMinutes, wallTime, weekday, type WallTime } from "./time.js";

const nameCache = new Map<string, string[]>();

function names(locale: string, kind: "month" | "weekday", width: "long" | "short"): string[] {
	const key = `${locale}|${kind}|${width}`;
	let list = nameCache.get(key);
	if (!list) {
		const fmt = new Intl.DateTimeFormat(locale, { [kind]: width, timeZone: "UTC" } as Intl.DateTimeFormatOptions);
		list =
			kind === "month"
				? Array.from({ length: 12 }, (_, m) => fmt.format(new Date(Date.UTC(2021, m, 15))))
				: // 2021-08-01 was a Sunday
					Array.from({ length: 7 }, (_, d) => fmt.format(new Date(Date.UTC(2021, 7, 1 + d))));
		nameCache.set(key, list);
	}
	return list;
}

const pad = (n: number, width = 2) => String(Math.abs(Math.trunc(n))).padStart(width, "0");

function englishSuffix(day: number): string {
	if (day % 100 >= 11 && day % 100 <= 13) return "th";
	return ["th", "st", "nd", "rd"][day % 10] ?? "th";
}

function dayOfYear(w: WallTime): number {
	return (Date.UTC(w.year, w.month - 1, w.day) - Date.UTC(w.year, 0, 1)) / 86_400_000;
}

/** ISO-8601 week number and week-numbering year. */
function isoWeek(w: WallTime): { week: number; year: number } {
	const d = new Date(Date.UTC(w.year, w.month - 1, w.day));
	const dow = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dow);
	const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
	return { week: Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7), year: d.getUTCFullYear() };
}

function formatOffset(minutes: number, colon: boolean): string {
	const sign = minutes < 0 ? "-" : "+";
	const abs = Math.abs(minutes);
	return `${sign}${pad(Math.floor(abs / 60))}${colon ? ":" : ""}${pad(abs % 60)}`;
}

function zoneAbbreviation(instant: Date, timeZone: string, locale: string): string {
	if (timeZone === "UTC" || timeZone === "Etc/UTC") return "UTC";
	const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" })
		.formatToParts(instant)
		.find((p) => p.type === "timeZoneName");
	return part?.value ?? formatOffset(offsetMinutes(instant, timeZone), true);
}

function isDst(instant: Date, timeZone: string): boolean {
	const year = wallTime(instant, timeZone).year;
	const jan = offsetMinutes(new Date(Date.UTC(year, 0, 1)), timeZone);
	const jul = offsetMinutes(new Date(Date.UTC(year, 6, 1)), timeZone);
	return Math.max(jan, jul) !== Math.min(jan, jul) && offsetMinutes(instant, timeZone) === Math.max(jan, jul);
}

export interface PhpDateOptions {
	timeZone?: string;
	/** BCP 47 locale for month and day names. Default "en-US". */
	locale?: string;
}

/** Format `instant` with a PHP date format string, e.g. "F j, Y" → "October 5, 2026". */
export function formatPhpDate(format: string, instant: Date, options: PhpDateOptions = {}): string {
	const timeZone = options.timeZone ?? "UTC";
	const locale = options.locale ?? "en-US";
	const w = wallTime(instant, timeZone);
	const dow = weekday(w.year, w.month, w.day);
	const offset = offsetMinutes(instant, timeZone);
	const hour12 = w.hour % 12 || 12;

	let out = "";
	for (let i = 0; i < format.length; i++) {
		const c = format[i]!;
		switch (c) {
			// Day
			case "d": out += pad(w.day); break;
			case "D": out += names(locale, "weekday", "short")[dow]; break;
			case "j": out += w.day; break;
			case "l": out += names(locale, "weekday", "long")[dow]; break;
			case "N": out += dow === 0 ? 7 : dow; break;
			case "S": out += englishSuffix(w.day); break;
			case "w": out += dow; break;
			case "z": out += dayOfYear(w); break;
			// Week
			case "W": out += pad(isoWeek(w).week); break;
			// Month
			case "F": out += names(locale, "month", "long")[w.month - 1]; break;
			case "m": out += pad(w.month); break;
			case "M": out += names(locale, "month", "short")[w.month - 1]; break;
			case "n": out += w.month; break;
			case "t": out += daysInMonth(w.year, w.month); break;
			// Year
			case "L": out += isLeapYear(w.year) ? 1 : 0; break;
			case "o": out += isoWeek(w).year; break;
			case "X":
			case "Y": out += w.year; break;
			case "x": out += w.year >= 10000 ? `+${w.year}` : w.year; break;
			case "y": out += pad(w.year % 100); break;
			// Time
			case "a": out += w.hour < 12 ? "am" : "pm"; break;
			case "A": out += w.hour < 12 ? "AM" : "PM"; break;
			case "B": {
				const s = (((instant.getTime() / 1000 + 3600) % 86_400) + 86_400) % 86_400;
				out += pad(Math.floor(s / 86.4), 3);
				break;
			}
			case "g": out += hour12; break;
			case "G": out += w.hour; break;
			case "h": out += pad(hour12); break;
			case "H": out += pad(w.hour); break;
			case "i": out += pad(w.minute); break;
			case "s": out += pad(w.second); break;
			case "u": out += "000000"; break;
			case "v": out += pad(instant.getUTCMilliseconds(), 3); break;
			// Time zone
			case "e": out += timeZone; break;
			case "I": out += isDst(instant, timeZone) ? 1 : 0; break;
			case "O": out += formatOffset(offset, false); break;
			case "P": out += formatOffset(offset, true); break;
			case "p": out += offset === 0 ? "Z" : formatOffset(offset, true); break;
			case "T": out += zoneAbbreviation(instant, timeZone, locale); break;
			case "Z": out += offset * 60; break;
			// Full date/time
			case "c": out += formatPhpDate("Y-m-d\\TH:i:sP", instant, options); break;
			case "r": out += formatPhpDate("D, d M Y H:i:s O", instant, { ...options, locale: "en-US" }); break;
			case "U": out += Math.floor(instant.getTime() / 1000); break;
			case "\\":
				i++;
				if (i < format.length) out += format[i];
				break;
			default:
				out += c;
		}
	}
	return out;
}
