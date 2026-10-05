/**
 * @gatilab/emdash-dynamic-dates
 *
 * Dynamic dates for EmDash, ported from the Dynamic Month & Year into Posts
 * WordPress plugin: `[year]`, `[monthyear]`, `[age date="2008-01-01"]`,
 * `[daysuntil date="2026-12-25"]` and 36 more shortcodes that resolve on
 * every render, so "Best X in [year]" never goes stale.
 *
 * - Content: render Portable Text with `<DynamicPortableText>` (or call
 *   `resolvePortableText`) and shortcodes resolve in text, headings, and the
 *   string fields of custom blocks.
 * - Titles and any other string: `resolveShortcodes()` or `<DynamicText>`.
 * - SEO tags rendered by `<EmDashHead>` (description, Open Graph, Twitter)
 *   are resolved automatically by this plugin's `page:metadata` hook.
 * - Editors also get two blocks: Dynamic date and Countdown.
 *
 * @example
 * ```js
 * // astro.config.mjs
 * import { dynamicDates } from "@gatilab/emdash-dynamic-dates";
 * emdash({ plugins: [dynamicDates({ timeZone: "Asia/Kolkata" })] })
 * ```
 */
import { definePlugin } from "emdash";
import type { PageMetadataContribution, PluginDescriptor, PortableTextBlockConfig, ResolvedPlugin } from "emdash";

import { configureDynamicDates, type DynamicDatesOptions } from "./core/config.js";
import { hasDynamicContent, resolveShortcodes } from "./core/shortcodes.js";

export const PLUGIN_ID = "dynamic-dates";
export const PLUGIN_VERSION = "0.1.0";
export const PACKAGE_NAME = "@gatilab/emdash-dynamic-dates";

/** Descriptor factory for the `plugins` array of the emdash() integration. */
export function dynamicDates(options: DynamicDatesOptions = {}): PluginDescriptor<DynamicDatesOptions> {
	// Components rendered in this process read the same defaults.
	configureDynamicDates(options);
	const { registry: _registry, ...serializable } = options;
	return {
		id: PLUGIN_ID,
		version: PLUGIN_VERSION,
		format: "native",
		entrypoint: PACKAGE_NAME,
		componentsEntry: `${PACKAGE_NAME}/astro`,
		options: serializable,
	};
}

const DATE_TYPE_OPTIONS = [
	["year", "Current year (2026)"],
	["nyear", "Next year"],
	["pyear", "Previous year"],
	["month", "Current month (October)"],
	["monthyear", "Month and year (October 2026)"],
	["nmonth", "Next month"],
	["pmonth", "Previous month"],
	["date", "Today's date"],
	["weekday", "Day of the week"],
	["season", "Season"],
	["age", "Age / years since a date"],
	["age_ym", "Age in years and months"],
	["age_ymd", "Age in years, months and days"],
	["age_ordinal", "Ordinal age (18th)"],
	["daysuntil", "Days until a date"],
	["dayssince", "Days since a date"],
	["nextoccurrence", "Next yearly occurrence of a date"],
	["blackfriday", "Black Friday"],
	["cybermonday", "Cyber Monday"],
	["published", "Published date"],
	["modified", "Last modified date"],
] as const;

const text = (action_id: string, label: string, placeholder?: string) => ({
	type: "text_input" as const,
	action_id,
	label,
	...(placeholder ? { placeholder } : {}),
});

/** Editor blocks: a standalone date and a live countdown. */
export const PORTABLE_TEXT_BLOCKS: PortableTextBlockConfig[] = [
	{
		type: "dynamicDate",
		label: "Dynamic date",
		icon: "calendar",
		category: "Dynamic dates",
		description: "A year, month, date, age or countdown that updates itself",
		fields: [
			{
				type: "select",
				action_id: "dateType",
				label: "Show",
				options: DATE_TYPE_OPTIONS.map(([value, label]) => ({ value, label })),
				initial_value: "year",
			},
			text("date", "Date (for ages and countdowns)", "YYYY-MM-DD"),
			text("format", "Format (optional, PHP date format)", "F j, Y"),
			{
				type: "select",
				action_id: "region",
				label: "Hemisphere (for seasons)",
				options: [
					{ value: "north", label: "Northern" },
					{ value: "south", label: "Southern" },
				],
				initial_value: "north",
			},
			text("prefix", "Text before"),
			text("suffix", "Text after"),
		],
	},
	{
		type: "countdown",
		label: "Countdown",
		icon: "clock",
		category: "Dynamic dates",
		description: "Days until or since a date; corrects itself in the browser on cached pages",
		fields: [
			text("date", "Date", "YYYY-MM-DD, or MM-DD to repeat yearly"),
			text("rule", "Or a rule (repeats yearly)", "fourth thursday of november"),
			{
				type: "select",
				action_id: "mode",
				label: "Count",
				options: [
					{ value: "until", label: "Days until" },
					{ value: "since", label: "Days since" },
				],
				initial_value: "until",
			},
			{ type: "toggle", action_id: "repeat", label: "Repeat every year", initial_value: false },
			text("prefix", "Text before", "Only"),
			text("labelSingular", "Singular label", "day"),
			text("labelPlural", "Plural label", "days"),
			text("suffix", "Text after", "left"),
		],
	},
];

/** Runtime entry. EmDash imports it by name and passes the descriptor's options. */
export function createPlugin(options: DynamicDatesOptions = {}): ResolvedPlugin {
	configureDynamicDates(options);
	return definePlugin({
		id: PLUGIN_ID,
		version: PLUGIN_VERSION,
		capabilities: [],
		admin: { portableTextBlocks: PORTABLE_TEXT_BLOCKS },
		hooks: {
			// Like the WordPress plugin's Rank Math / Yoast integrations: shortcodes
			// in SEO fields resolve in every tag EmDashHead renders.
			"page:metadata": async (event) => {
				if (options.resolveMetadata === false) return null;
				const page = event.page;
				const ctx = {
					timeZone: options.timeZone,
					locale: options.locale,
					dateFormat: options.dateFormat,
					seoVariables: options.seoVariables,
					published: page.articleMeta?.publishedTime ?? null,
					modified: page.articleMeta?.modifiedTime ?? null,
				};
				const out: PageMetadataContribution[] = [];
				const pageTitle = page.seo?.ogTitle ?? page.pageTitle ?? page.title;
				const description = page.seo?.ogDescription ?? page.description;
				if (pageTitle && hasDynamicContent(pageTitle)) {
					const title = resolveShortcodes(pageTitle, ctx);
					out.push({ kind: "property", property: "og:title", content: title }, { kind: "meta", name: "twitter:title", content: title });
				}
				if (description && hasDynamicContent(description)) {
					const desc = resolveShortcodes(description, ctx);
					out.push(
						{ kind: "meta", name: "description", content: desc },
						{ kind: "property", property: "og:description", content: desc },
						{ kind: "meta", name: "twitter:description", content: desc },
					);
				}
				return out.length ? out : null;
			},
		},
	});
}

export default createPlugin;

export * from "./core/index.js";
