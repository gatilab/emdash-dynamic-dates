/**
 * Site-wide defaults. Set them once through the plugin descriptor
 * (`dynamicDates({ timeZone: "Asia/Kolkata" })`); components and helpers
 * read them, and per-call options override them.
 */
import type { ShortcodeRegistry } from "./shortcodes.js";

export interface DynamicDatesOptions {
	/** IANA time zone. Falls back to the EmDash site setting, then UTC. */
	timeZone?: string;
	/** BCP 47 locale for month and day names. Default "en-US". */
	locale?: string;
	/** PHP date format for [datepublished], [datemodified] and %currentdate%. Default "F j, Y". */
	dateFormat?: string;
	/** Resolve %currentyear%-style SEO variables too. Default true. */
	seoVariables?: boolean;
	/** Resolve shortcodes in SEO meta tags through the page:metadata hook. Default true. */
	resolveMetadata?: boolean;
	/** A registry with your own shortcodes (see `shortcodes.clone()`). */
	registry?: ShortcodeRegistry;
}

let current: DynamicDatesOptions = {};

export function configureDynamicDates(options: DynamicDatesOptions): void {
	current = { ...current, ...options };
}

export function getDynamicDatesConfig(): Readonly<DynamicDatesOptions> {
	return current;
}
