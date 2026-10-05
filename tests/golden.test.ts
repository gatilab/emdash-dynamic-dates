/**
 * Byte-for-byte parity with the WordPress plugin. The expected string was
 * produced by Dynamic Month & Year into Posts 1.8.1 on gatilab.com:
 *
 *   wp eval 'echo do_shortcode("…"); echo wp_date("c");'
 *   → … at 2026-10-05T03:06:17+00:00 (site timezone UTC)
 */
import { describe, expect, it } from "vitest";

import { resolveShortcodes } from "../src/core/index.js";

const INPUT =
	"[year]|[nyear]|[pyear]|[month]|[cmonth]|[mon]|[mm]|[mn]|[nmonth]|[pmonth]|[nmon]|[pmon]|[date]|[monthyear]|[nmonthyear]|[pmonthyear]|[dt]|[nd]|[pd]|[weekday]|[wd]|[blackfriday]|[cybermonday]|[daysuntil date=2026-12-25]|[dayssince date=2020-01-01]|[age date=2008-01-01]|[age date=1990-05-15 ordinal=true]|[age date=2008-01-01 format=ym]|[age date=2008-01-01 format=ymd]|[season]|[season region=south]|[year n=2]|[date format=Y]";
const WORDPRESS =
	"2026|2027|2025|October|October|Oct|10|10|November|September|Nov|Sep|October 5, 2026|October 2026|November 2026|September 2026|5|6|4|Monday|Mon|November 27|November 30|81|2469|18|36th|18 years, 9 months|18 years, 9 months, 4 days|Fall|Spring|2028|October 5, 2026";

describe("WordPress parity", () => {
	it("renders exactly what the WordPress plugin rendered", () => {
		expect(resolveShortcodes(INPUT, { now: new Date("2026-10-05T03:06:17Z"), timeZone: "UTC" })).toBe(WORDPRESS);
	});
});
