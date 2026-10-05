/**
 * WordPress-compatible shortcode parsing plus a registry.
 *
 * EmDash content is Portable Text, so nothing runs `do_shortcode()` for you:
 * `resolveShortcodes()` is called wherever text is rendered (see the Astro
 * components and the `page:metadata` hook). Parsing follows WordPress:
 * `[tag]`, `[tag a="1" b='2' c=3 flag]`, `[tag /]`, and `[[tag]]` to print a
 * literal `[tag]`. Enclosing shortcodes (`[tag]…[/tag]`) are supported for
 * custom handlers.
 */
import { DateRenderer, type RenderContext } from "./renderer.js";

export type ShortcodeAttributes = Record<string, string>;

export interface ShortcodeContext extends RenderContext {
	/** Lazily created renderer shared by the date shortcodes in one call. */
	readonly renderer: DateRenderer;
}

export type ShortcodeHandler = (attrs: ShortcodeAttributes, ctx: ShortcodeContext, content?: string) => string | null | undefined;

export interface ShortcodeDefinition {
	handler: ShortcodeHandler;
	/** Attribute defaults; when set, only these attributes reach the handler (like `shortcode_atts`). */
	defaults?: ShortcodeAttributes;
}

/** WordPress `shortcode_parse_atts`. */
export function parseAttributes(text: string): ShortcodeAttributes {
	const atts: ShortcodeAttributes = {};
	const re = /([\w-]+)\s*=\s*"([^"]*)"(?:\s|$)|([\w-]+)\s*=\s*'([^']*)'(?:\s|$)|([\w-]+)\s*=\s*([^\s'"]+)(?:\s|$)|"([^"]*)"(?:\s|$)|'([^']*)'(?:\s|$)|(\S+)(?:\s|$)/g;
	const cleaned = text.replace(/[ ​]/g, " ");
	let positional = 0;
	for (const m of cleaned.matchAll(re)) {
		if (m[1]) atts[m[1].toLowerCase()] = m[2]!;
		else if (m[3]) atts[m[3].toLowerCase()] = m[4]!;
		else if (m[5]) atts[m[5].toLowerCase()] = m[6]!;
		else {
			const value = m[7] ?? m[8] ?? m[9] ?? "";
			atts[String(positional++)] = value;
		}
	}
	return atts;
}

export class ShortcodeRegistry {
	private readonly map = new Map<string, ShortcodeDefinition>();

	register(tag: string, handlerOrDefinition: ShortcodeHandler | ShortcodeDefinition): this {
		if (!/^[\w-]+$/.test(tag)) throw new Error(`Invalid shortcode tag "${tag}"`);
		this.map.set(tag, typeof handlerOrDefinition === "function" ? { handler: handlerOrDefinition } : handlerOrDefinition);
		return this;
	}

	unregister(tag: string): boolean {
		return this.map.delete(tag);
	}

	has(tag: string): boolean {
		return this.map.has(tag);
	}

	tags(): string[] {
		return [...this.map.keys()];
	}

	/** A copy, so a site can extend the defaults without changing them for others. */
	clone(): ShortcodeRegistry {
		const copy = new ShortcodeRegistry();
		for (const [tag, def] of this.map) copy.map.set(tag, def);
		return copy;
	}

	/**
	 * Replace registered shortcodes in `text`. Unknown `[tags]` are left as
	 * they are, so ordinary square brackets in prose are safe.
	 */
	resolve(text: string, context: RenderContext = {}): string {
		if (typeof text !== "string" || !text.includes("[") || this.map.size === 0) return text;
		let renderer: DateRenderer | undefined;
		const ctx = {
			...context,
			get renderer() {
				return (renderer ??= new DateRenderer(context));
			},
		} as ShortcodeContext;

		const tags = this.tags()
			.sort((a, b) => b.length - a.length)
			.map((t) => t.replace(/-/g, "\\-"))
			.join("|");
		// Mirrors WordPress get_shortcode_regex(): optional escape brackets, tag,
		// attributes, then self-closing, or an optional enclosed body.
		const re = new RegExp(
			`\\[(\\[?)(${tags})(?![\\w-])([^\\]\\/]*(?:\\/(?!\\])[^\\]\\/]*)*?)(?:(\\/)\\]|\\](?:([^\\[]*(?:\\[(?!\\/\\2\\])[^\\[]*)*)\\[\\/\\2\\])?)(\\]?)`,
			"g", // tags are case-sensitive, as in WordPress
		);
		return text.replace(re, (match, open: string, tag: string, rawAtts: string, _selfClose, content: string | undefined, close: string) => {
			if (open === "[" && close === "]") return match.slice(1, -1); // [[tag]] → literal [tag]
			const def = this.map.get(tag);
			if (!def) return match;
			let atts = parseAttributes(rawAtts ?? "");
			if (def.defaults) {
				const filtered: ShortcodeAttributes = { ...def.defaults };
				for (const key of Object.keys(def.defaults)) if (key in atts) filtered[key] = atts[key]!;
				atts = filtered;
			}
			try {
				const out = def.handler(atts, ctx, content);
				return out == null ? "" : String(out);
			} catch {
				return match; // never break a page over one bad shortcode
			}
		});
	}
}

/**
 * The shortcodes of Dynamic Month & Year into Posts 1.8, with the same
 * attributes WordPress passes to each (anything else is ignored there too).
 */
export function registerDateShortcodes(registry: ShortcodeRegistry): ShortcodeRegistry {
	const plain = (type: string, textCase?: string): ShortcodeDefinition => ({
		defaults: {},
		handler: (_a, ctx) => ctx.renderer.render(type, textCase ? { case: textCase } : {}),
	});
	const withAtts = (type: string, defaults: ShortcodeAttributes): ShortcodeDefinition => ({
		defaults,
		handler: (a, ctx) => ctx.renderer.render(type, a),
	});

	registry
		.register("year", withAtts("year", { n: "0" }))
		.register("nyear", plain("nyear"))
		.register("nnyear", plain("nnyear"))
		.register("pyear", plain("pyear"))
		.register("ppyear", plain("ppyear"))
		.register("month", plain("month"))
		.register("cmonth", plain("month", "title"))
		.register("mon", plain("month_short"))
		.register("cmon", plain("month_short", "title"))
		.register("mm", plain("month_number_zero"))
		.register("mn", plain("month_number"))
		.register("nmonth", plain("next_month"))
		.register("cnmonth", plain("next_month", "title"))
		.register("nmon", plain("next_month_short"))
		.register("cnmon", plain("next_month_short", "title"))
		.register("pmonth", plain("previous_month"))
		.register("cpmonth", plain("previous_month", "title"))
		.register("pmon", plain("previous_month_short"))
		.register("cpmon", plain("previous_month_short", "title"))
		.register("date", plain("date"))
		.register("monthyear", plain("monthyear", "title"))
		.register("nmonthyear", plain("next_month_year", "title"))
		.register("pmonthyear", plain("previous_month_year", "title"))
		.register("dt", plain("day"))
		.register("nd", plain("next_day"))
		.register("pd", plain("previous_day"))
		.register("weekday", plain("weekday"))
		.register("wd", plain("weekday_short"))
		.register("blackfriday", plain("blackfriday"))
		.register("cybermonday", plain("cybermonday"))
		.register("daysuntil", withAtts("daysuntil", { date: "", clamp: "false" }))
		.register("dayssince", withAtts("dayssince", { date: "", clamp: "false" }))
		.register("datepublished", plain("published"))
		.register("datemodified", plain("modified"))
		.register("age", withAtts("age", { date: "", format: "y", ordinal: "", rank: "" }))
		.register("season", withAtts("season", { region: "north" }));
	return registry;
}

/** Rank Math (%currentyear%) and Yoast/SEOPress (%%currentyear%%) date variables. */
export function resolveSeoVariables(text: string, context: RenderContext = {}): string {
	if (typeof text !== "string" || !text.includes("%current")) return text;
	const r = new DateRenderer(context);
	const values: Record<string, () => string> = {
		currentyear: () => r.render("year"),
		currentmonth: () => r.render("month"),
		currentday: () => r.render("day"),
		currentdate: () => r.render("date", { format: context.dateFormat ?? "F j, Y" }),
	};
	return text.replace(/%%?(currentyear|currentmonth|currentday|currentdate)%%?/gi, (match, name: string) => {
		const fn = values[name.toLowerCase()];
		return fn ? fn() : match;
	});
}

/** The default registry: every date shortcode. Clone it before adding your own. */
export const shortcodes = registerDateShortcodes(new ShortcodeRegistry());

export interface ResolveOptions extends RenderContext {
	/** Defaults to the built-in registry. */
	registry?: ShortcodeRegistry;
	/** Also resolve %currentyear% style SEO variables. Default true. */
	seoVariables?: boolean;
}

/** Resolve shortcodes (and SEO date variables) in a string. */
export function resolveShortcodes(text: string, options: ResolveOptions = {}): string {
	if (typeof text !== "string") return text;
	const { registry = shortcodes, seoVariables = true, ...context } = options;
	const out = registry.resolve(text, context);
	return seoVariables ? resolveSeoVariables(out, context) : out;
}

/** True when the text contains something `resolveShortcodes` would change. */
export function hasDynamicContent(text: string, registry: ShortcodeRegistry = shortcodes): boolean {
	if (typeof text !== "string") return false;
	if (/%%?current(year|month|day|date)%%?/i.test(text)) return true;
	return text.includes("[") && registry.tags().some((t) => text.includes(`[${t}`));
}
