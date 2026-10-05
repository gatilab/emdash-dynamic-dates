/**
 * Astro components. EmDash loads `blockComponents` (the descriptor's
 * `componentsEntry`) for the two editor blocks; the rest are for templates.
 */
import Countdown from "./Countdown.astro";
import DynamicDate from "./DynamicDate.astro";
import DynamicPortableText from "./DynamicPortableText.astro";
import DynamicText from "./DynamicText.astro";

export { Countdown, DynamicDate, DynamicPortableText, DynamicText };
export { renderOptions, type RenderOverrides } from "./options.js";

/** Renderers keyed by Portable Text `_type`. */
export const blockComponents = {
	dynamicDate: DynamicDate,
	countdown: Countdown,
};
