# Changelog

## 0.1.0 (2026-10-05)

First release: an EmDash port of Dynamic Month & Year into Posts 1.8.1.

- 36 shortcodes with the WordPress plugin's attributes and output, verified against output captured from it.
- PHP `date()` format support for `format` attributes, in any IANA time zone and locale.
- `<DynamicPortableText>`, `<DynamicText>`, `resolveShortcodes()`, `resolvePortableText()`.
- `page:metadata` hook that resolves shortcodes in description, Open Graph and Twitter tags.
- Rank Math `%currentyear%` and Yoast `%%currentyear%%` variables.
- Dynamic date and Countdown editor blocks; the countdown corrects itself in the browser.
- Shortcode registry for site-specific shortcodes.
