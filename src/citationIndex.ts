import { App, Events, TAbstractFile, TFile, TFolder } from 'obsidian';
import { CITE_URL_PREFIX, CitationTarget } from './citation';
import { CitationLink, citationLinksIn } from './links';
import { resolveCitedNote } from './navigation';
import type { BetterCitationsSettings } from './settings';

/** What a citation points to: a note of the vault, a DOI outside it, or nothing. */
export type CitedWork =
	| { kind: 'note'; file: TFile }
	| { kind: 'doi'; doi: string }
	| { kind: 'broken'; text: string };

/** Lower case, without the https://doi.org/ prefix. */
export function normalizeDoi(doi: string): string {
	return doi
		.trim()
		.replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//i, '')
		.replace(/^doi:\s*/i, '')
		.toLowerCase();
}

const DOI_IN_TEXT = /doi\.org\/(10\.\d{4,9}\/[^\s)\]>"']+)/i;
/** How far from the start of a note its own DOI is looked for, without a DOI property. */
const DOI_SEARCH_LENGTH = 5000;
/** A heading that opens a reference list, whose DOIs are other works'. */
const REFERENCE_HEADING =
	/^#{1,6}\s+[*_]*(?:\d+(?:\.\d+)*\.?\s+)?(?:references|literature cited|works cited|bibliograph(?:y|ie)|références|liste des références)\b/im;

/**
 * An index of the citation links of the vault, kept up to date as notes change.
 *
 * Obsidian does not index obsidian:// links (on purpose: they stay out of the
 * graph view and backlinks), so the plugin reads the notes itself. Links are
 * stored as written and resolved when queried, so a link to a DOI starts
 * pointing to a note as soon as a note with that DOI is added.
 */
export class CitationIndex extends Events {
	/** Citation links of each note that has some, by path. */
	private readonly linksByPath = new Map<string, CitationLink[]>();
	/** Notes of the vault by DOI (from the DOI property, else the first doi.org URL). */
	private readonly fileByDoi = new Map<string, string>();
	private readonly doiByPath = new Map<string, string>();

	constructor(
		private readonly app: App,
		private readonly settings: () => BetterCitationsSettings,
	) {
		super();
	}

	/** Whether a note is in the literature folder (every note when the setting is empty). */
	isLiterature(file: TFile): boolean {
		const folder = this.settings().literatureFolder.replace(/\/+$/, '');
		return folder === '' || file.path.startsWith(`${folder}/`);
	}

	/** Reads every Markdown note. */
	async build(): Promise<void> {
		this.linksByPath.clear();
		this.fileByDoi.clear();
		this.doiByPath.clear();
		for (const file of this.app.vault.getMarkdownFiles()) await this.indexFile(file, false);
		this.trigger('changed');
	}

	/** Re-reads one note; triggers "changed" only when its links or its DOI changed. */
	async indexFile(file: TFile, notify = true): Promise<void> {
		const text = await this.app.vault.cachedRead(file);
		const before = this.signature(file.path);
		const links = text.includes(CITE_URL_PREFIX) ? citationLinksIn(text) : [];
		if (links.length > 0) this.linksByPath.set(file.path, links);
		else this.linksByPath.delete(file.path);
		this.setDoi(file.path, this.doiOf(file, text));
		if (notify && this.signature(file.path) !== before) this.trigger('changed');
	}

	private signature(path: string): string {
		return [
			(this.linksByPath.get(path) ?? []).map((l) => `${l.text}\u0000${l.url}`).join('\u0001'),
			this.doiByPath.get(path) ?? '',
		].join('\u0002');
	}

	/** Forgets a deleted note. */
	removeFile(path: string): void {
		this.linksByPath.delete(path);
		this.setDoi(path, null);
		this.trigger('changed');
	}

	/** Moves the entries of a renamed note (its links are unchanged). */
	renameFile(file: TFile, oldPath: string): void {
		const links = this.linksByPath.get(oldPath);
		this.linksByPath.delete(oldPath);
		if (links) this.linksByPath.set(file.path, links);
		const doi = this.doiByPath.get(oldPath) ?? null;
		this.setDoi(oldPath, null);
		this.setDoi(file.path, doi);
		this.trigger('changed');
	}

	private doiOf(file: TFile, text: string): string | null {
		const value: unknown = this.app.metadataCache.getFileCache(file)?.frontmatter?.[this.settings().doiProperty];
		if (typeof value === 'string' && value.trim()) return normalizeDoi(value);
		// Without the property, the note's own DOI is the first one near its
		// start, before any reference list (whose DOIs are other works').
		const references = REFERENCE_HEADING.exec(text);
		const head = (references ? text.slice(0, references.index) : text).slice(0, DOI_SEARCH_LENGTH);
		const inText = DOI_IN_TEXT.exec(head);
		return inText?.[1] ? normalizeDoi(inText[1].replace(/[.,;]+$/, '')) : null;
	}

	private setDoi(path: string, doi: string | null): void {
		const old = this.doiByPath.get(path);
		if (old && this.fileByDoi.get(old) === path) this.fileByDoi.delete(old);
		if (doi) {
			this.doiByPath.set(path, doi);
			if (!this.fileByDoi.has(doi)) this.fileByDoi.set(doi, path);
		} else {
			this.doiByPath.delete(path);
		}
	}

	/** The note of the vault with this DOI, if any. */
	fileForDoi(doi: string): TFile | null {
		const path = this.fileByDoi.get(normalizeDoi(doi));
		const file = path ? this.app.vault.getAbstractFileByPath(path) : null;
		return file instanceof TFile ? file : null;
	}

	/** What a citation target points to, resolved now. */
	resolve(target: CitationTarget, text = ''): CitedWork {
		const byNote = target.note ? resolveCitedNote(this.app, target.note) : null;
		if (byNote) return { kind: 'note', file: byNote };
		if (target.doi) {
			const byDoi = this.fileForDoi(target.doi);
			return byDoi ? { kind: 'note', file: byDoi } : { kind: 'doi', doi: normalizeDoi(target.doi) };
		}
		return { kind: 'broken', text: target.note ?? text };
	}

	/** Citation links of a note. */
	linksFrom(file: TFile): CitationLink[] {
		return this.linksByPath.get(file.path) ?? [];
	}

	/** Paths of notes whose links name `oldPath` (by name or path) or a file under a renamed folder. */
	linksNaming(renamed: TAbstractFile, oldPath: string): { path: string; links: CitationLink[] }[] {
		const oldNoPath = oldPath.replace(/\.md$/, '');
		const oldName = oldNoPath.split('/').pop() ?? oldNoPath;
		const names = (note: string) => {
			const n = note.replace(/\.md$/, '');
			if (renamed instanceof TFolder) return n.startsWith(`${oldPath}/`);
			return n === oldNoPath || n === oldName;
		};
		const result: { path: string; links: CitationLink[] }[] = [];
		for (const [path, links] of this.linksByPath) {
			const matching = links.filter((l) => l.target.note !== undefined && names(l.target.note));
			if (matching.length > 0) result.push({ path, links: matching });
		}
		return result;
	}
}
