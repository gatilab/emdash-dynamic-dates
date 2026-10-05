/**
 * Resolve shortcodes inside Portable Text without touching the stored value.
 */
import { DateRenderer } from "./renderer.js";
import { resolveShortcodes, type ResolveOptions } from "./shortcodes.js";

/** Keys whose string values are never text: identifiers, URLs, code. */
const SKIP_KEYS = new Set([
	"_type", "_key", "_ref", "_version", "style", "listItem", "marks", "href", "url", "src", "ctaUrl",
	"language", "code", "filename", "mimeType", "provider", "id", "slug",
]);

export interface PortableTextResolveOptions extends ResolveOptions {
	/** Extra keys to leave alone. */
	skipKeys?: Iterable<string>;
	/** Skip blocks of these `_type`s entirely. Default: code blocks. */
	skipTypes?: Iterable<string>;
}

/**
 * Deep-copy `value` with shortcodes resolved in every text span and in the
 * string fields of custom blocks (FAQ answers, callout bodies, …). Values
 * that carry EmDash visual-editing metadata are returned untouched, so the
 * inline editor always edits the raw `[year]`, never "2026".
 */
export function resolvePortableText<T>(value: T, options: PortableTextResolveOptions = {}): T {
	if (!value || typeof value !== "object" || hasEditMetadata(value)) return value;
	const skipKeys = new Set([...SKIP_KEYS, ...(options.skipKeys ?? [])]);
	const skipTypes = new Set(options.skipTypes ?? ["code"]);

	const visit = (node: unknown, key?: string): unknown => {
		if (typeof node === "string") return key && skipKeys.has(key) ? node : resolveShortcodes(node, options);
		if (Array.isArray(node)) return node.map((n) => visit(n));
		if (!node || typeof node !== "object") return node;
		const type = (node as { _type?: string })._type ?? "";
		if (skipTypes.has(type)) return node;
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(node)) out[k] = visit(v, k);
		// Dynamic date blocks may need the entry's dates, which only this call has
		if (type === "dynamicDate") {
			const n = node as { dateType?: string; date?: string; format?: string; region?: string };
			out._value = new DateRenderer(options).render(n.dateType || "year", { date: n.date, format: n.format, region: n.region });
		}
		return out;
	};
	return visit(value) as T;
}

/** EmDash tags editable values with a non-enumerable Symbol.for("__emdash") property. */
export function hasEditMetadata(value: unknown): boolean {
	return !!value && typeof value === "object" && Object.getOwnPropertyDescriptor(value, Symbol.for("__emdash")) !== undefined;
}
