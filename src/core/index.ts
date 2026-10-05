/**
 * Framework-free core: usable from Astro pages, API routes, scripts and tests.
 */
export { DateEngine, type AgeInterval, type EngineOptions } from "./engine.js";
export { DateRenderer, DATE_TYPES, type DateArgs, type RenderContext } from "./renderer.js";
export { formatPhpDate, type PhpDateOptions } from "./php-date.js";
export {
	hasDynamicContent,
	parseAttributes,
	registerDateShortcodes,
	resolveSeoVariables,
	resolveShortcodes,
	ShortcodeRegistry,
	shortcodes,
	type ResolveOptions,
	type ShortcodeAttributes,
	type ShortcodeContext,
	type ShortcodeDefinition,
	type ShortcodeHandler,
} from "./shortcodes.js";
export { hasEditMetadata, resolvePortableText, type PortableTextResolveOptions } from "./portable-text.js";
export { configureDynamicDates, getDynamicDatesConfig, type DynamicDatesOptions } from "./config.js";
