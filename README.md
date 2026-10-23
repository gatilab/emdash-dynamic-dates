# Dynamic Dates for EmDash

`[year]`, `[monthyear]`, `[age date="2008-01-01"]`, `[daysuntil date="2026-12-25"]` and 36 more shortcodes that resolve every time a page renders. Write "Best hosting in [year]" once and it stays current, with no republishing and no cron job.

This is the EmDash port of [Dynamic Month & Year into Posts](https://wordpress.org/plugins/dynamic-month-year-into-posts/). It uses the same shortcodes, attributes and output formats, so content migrated from WordPress renders exactly as it did there. The test suite checks this against output captured from the WordPress plugin.

## Install

```bash
pnpm add @gatilab/emdash-dynamic-dates
```

```js
// astro.config.mjs
import emdash from "emdash/astro";
import { dynamicDates } from "@gatilab/emdash-dynamic-dates";

export default defineConfig({
	integrations: [
		emdash({
			plugins: [dynamicDates({ timeZone: "Asia/Kolkata" })],
		}),
	],
});
```

| Option | Default | |
| --- | --- | --- |
| `timeZone` | site setting, then `UTC` | IANA zone. Decides when "today" rolls over. |
| `locale` | `en-US` | Month and day names. `fr-FR` gives "lundi 5 octobre". |
| `dateFormat` | `F j, Y` | PHP date format for `[datepublished]`, `[datemodified]`, `%currentdate%`. |
| `seoVariables` | `true` | Also resolve Rank Math `%currentyear%` and Yoast `%%currentyear%%`. |
| `resolveMetadata` | `true` | Resolve shortcodes in the SEO tags `<EmDashHead>` renders. |

## Where shortcodes resolve

EmDash stores content as Portable Text and has no global content filter like WordPress's `the_content`. So you resolve shortcodes where text is rendered. The plugin covers the usual places:

**Content.** Swap EmDash's `<PortableText>` for `<DynamicPortableText>`. It resolves text, headings and the string fields of custom blocks, such as FAQ answers. It skips code blocks and URLs.

```astro
---
import { DynamicPortableText } from "@gatilab/emdash-dynamic-dates/astro";
---
<DynamicPortableText value={post.data.content} published={post.data.publishedAt} modified={post.data.updatedAt} />
```

**Titles and other strings.**

```astro
---
import { resolveShortcodes } from "@gatilab/emdash-dynamic-dates/core";
import { DynamicText } from "@gatilab/emdash-dynamic-dates/astro";
---
<title>{resolveShortcodes(seoTitle)}</title>
<h1><DynamicText text={post.data.title} /></h1>
```

**SEO tags.** Shortcodes in the description and in the Open Graph and Twitter tags rendered by `<EmDashHead>` resolve automatically through the plugin's `page:metadata` hook. EmDash doesn't render `<title>`, so resolve that one yourself, as above.

**Visual editing.** In EmDash's inline editor, the raw value is passed through untouched. Editors always see and save `[year]`, never "2026".

## Shortcodes

| Shortcode | Output (on Oct 5, 2026) |
| --- | --- |
| `[year]` `[year n=2]` | 2026, 2028 |
| `[nyear]` `[nnyear]` `[pyear]` `[ppyear]` | 2027, 2028, 2025, 2024 |
| `[month]` `[cmonth]` `[mon]` `[cmon]` | October, October, Oct, Oct |
| `[mm]` `[mn]` | 10, 10 |
| `[nmonth]` `[cnmonth]` `[nmon]` `[cnmon]` | November, November, Nov, Nov |
| `[pmonth]` `[cpmonth]` `[pmon]` `[cpmon]` | September, September, Sep, Sep |
| `[date]` | October 5, 2026 |
| `[monthyear]` `[nmonthyear]` `[pmonthyear]` | October 2026, November 2026, September 2026 |
| `[dt]` `[nd]` `[pd]` | 5, 6, 4 |
| `[weekday]` `[wd]` | Monday, Mon |
| `[blackfriday]` `[cybermonday]` | November 27, November 30 |
| `[daysuntil date="2026-12-25"]` | 81 (add `clamp="true"` to stop at 0) |
| `[dayssince date="2020-01-01"]` | 2469 |
| `[age date="2008-01-01"]` | 18 |
| `[age date="2008-01-01" format="ym"]` | 18 years, 9 months |
| `[age date="2008-01-01" format="ymd"]` | 18 years, 9 months, 4 days |
| `[age date="1990-05-15" ordinal="true"]` | 36th |
| `[season]` `[season region="south"]` | Fall, Spring |
| `[datepublished]` `[datemodified]` | the entry's dates, in `dateFormat` |

Write `[[year]]` to print a literal `[year]`. Unknown `[tags]` and ordinary square brackets are left alone. Like WordPress, tags are case-sensitive, and a shortcode only reads the attributes its WordPress version reads.

## Editor blocks

The plugin adds two blocks to the slash menu:

- **Dynamic date**: any value above, with an optional format, prefix and suffix.
- **Countdown**: days until or since a date, a yearly date (`12-25`), or a rule such as `fourth thursday of november`. The server renders the count, and a few lines of JavaScript recompute it in the browser, so a cached page never shows yesterday's number.

## Your own shortcodes

```ts
import { configureDynamicDates, shortcodes } from "@gatilab/emdash-dynamic-dates/core";

const registry = shortcodes
	.clone()
	.register("company", () => "Gatilab")
	.register("price", { defaults: { plan: "pro" }, handler: ({ plan }) => (plan === "pro" ? "$99" : "$0") });

configureDynamicDates({ registry });
```

Handlers get the attributes, a context with `ctx.renderer` (the date renderer), and the enclosed content for `[tag]…[/tag]`. A handler that throws leaves its shortcode as written instead of breaking the page.

## Core API

`@gatilab/emdash-dynamic-dates/core` has no framework dependencies:

- `resolveShortcodes(text, options)`
- `resolvePortableText(value, options)`
- `resolveSeoVariables(text, options)`
- `formatPhpDate(format, date, { timeZone, locale })`: PHP `date()` formatting
- `DateEngine` and `DateRenderer`: the date logic behind every shortcode
- `ShortcodeRegistry` and `parseAttributes`: WordPress-compatible parsing

## License

MIT. See [LICENSE](./LICENSE).
