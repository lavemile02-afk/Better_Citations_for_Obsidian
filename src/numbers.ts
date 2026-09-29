import { citationLinksIn, CitationLink } from './links';

/**
 * Citations of notes that are not literature (course notes, field notes...)
 * are small superscript numbers, like footnote calls: "¹", "²". They are
 * numbered in the order the cited notes first appear in the citing note; a
 * note cited again keeps its number. A new link has "⁰" until the note is
 * renumbered.
 */

const DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** The text of a citation link not numbered yet. */
export const UNNUMBERED = '⁰';

/** A number in superscript digits: 12 → "¹²". */
export function superscript(n: number): string {
	return String(n)
		.split('')
		.map((d) => DIGITS[Number(d)] ?? d)
		.join('');
}

/** Whether a link text is a superscript number (numbered or not yet). */
export function isNumberLabel(text: string): boolean {
	return /^[⁰¹²³⁴⁵⁶⁷⁸⁹]+$/.test(text.trim());
}

/**
 * The changes that renumber the numbered citation links of a text, in order
 * of first appearance of their cited note (`keyOf`: the same key for links to
 * the same work; null when the work cannot be told, which keeps its text).
 */
export function renumberChanges(
	text: string,
	keyOf: (link: CitationLink) => string | null,
): { from: number; to: number; text: string }[] {
	const numbers = new Map<string, number>();
	const changes: { from: number; to: number; text: string }[] = [];
	for (const link of citationLinksIn(text)) {
		if (!isNumberLabel(link.text)) continue;
		const key = keyOf(link);
		if (key === null) continue;
		if (!numbers.has(key)) numbers.set(key, numbers.size + 1);
		const label = superscript(numbers.get(key) ?? 0);
		if (label !== link.text) changes.push({ from: link.from + 1, to: link.from + 1 + link.text.length, text: label });
	}
	return changes;
}
