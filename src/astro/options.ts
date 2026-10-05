/**
 * Effective render options for components: per-call props, then plugin
 * options, then the EmDash site's timezone setting, then UTC.
 */
import { getSiteSettings } from "emdash";

import { getDynamicDatesConfig } from "../core/config.js";
import type { ResolveOptions } from "../core/shortcodes.js";

export type RenderOverrides = Partial<Pick<ResolveOptions, "timeZone" | "locale" | "dateFormat" | "published" | "modified" | "now">>;

export async function renderOptions(overrides: RenderOverrides = {}): Promise<ResolveOptions> {
	const config = getDynamicDatesConfig();
	let siteTimeZone: string | undefined;
	if (!overrides.timeZone && !config.timeZone) {
		try {
			siteTimeZone = (await getSiteSettings())?.timezone || undefined;
		} catch {
			// outside an EmDash request (tests, static builds): fall back to UTC
		}
	}
	const defined = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined));
	return {
		registry: config.registry,
		seoVariables: config.seoVariables,
		locale: config.locale,
		dateFormat: config.dateFormat,
		timeZone: config.timeZone ?? siteTimeZone,
		...defined,
	};
}
