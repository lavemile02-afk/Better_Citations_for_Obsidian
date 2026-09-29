import { Editor, Events, MarkdownFileInfo, MarkdownView, Notice, PaneType, Plugin, TFile } from 'obsidian';
import { CitationCheckModal, checkCitations } from './check';
import { CitationIndex } from './citationIndex';
import { CITE_ACTION, parseCitationParams, parseCitationUrl } from './citation';
import { buildCitationLink, citationUrl } from './citationLink';
import { registerCitationClicks } from './clicks';
import { registerCitationHover } from './hover';
import { registerBrokenLinkMarks } from './decorations';
import { InsertCitationModal } from './insertCitation';
import { setHighlightDuration } from './highlight';
import { citationLinksIn, withCanonicalCitationLinks, withoutCitationLinks } from './links';
import { findExactPassages, findPassage } from './passage';
import { apaWorkOf, buildReferenceList, citedWorks, inTextCitations, localizeReference } from './references';
import { updateLinksAfterRename } from './rename';
import { openCitation, resolveCitedNote } from './navigation';
import {
	DEFAULT_SETTINGS,
	BetterCitationsSettings,
	BetterCitationsSettingTab,
} from './settings';

/**
 * Workspace event triggered, with the API, once the plugin is ready: a plugin
 * loaded before Better Citations learns this way that it can use the API.
 */
export const API_READY_EVENT = 'better-citations:api-ready';

/**
 * What other plugins can use, as `app.plugins.plugins['better-citations'].api`
 * (Literature Graph uses it when both are installed).
 */
export interface BetterCitationsApi {
	/** Opens a citation link (its obsidian://cite URL) at the cited passage. */
	openCitation(url: string, newTab?: PaneType | boolean): Promise<void>;
	/** Gives the title of works cited by DOI only, for hover previews (null: none). */
	setDoiTitleProvider(provider: ((doi: string) => Promise<string | null>) | null): void;
}

export default class BetterCitationsPlugin extends Plugin {
	settings!: BetterCitationsSettings;
	index!: CitationIndex;
	private doiTitleProvider: ((doi: string) => Promise<string | null>) | null = null;

	readonly api: BetterCitationsApi = {
		openCitation: async (url, newTab = false) => {
			const target = parseCitationUrl(url);
			if (target) await openCitation(this.app, target, newTab, (doi) => this.index.fileForDoi(doi));
		},
		setDoiTitleProvider: (provider) => {
			this.doiTitleProvider = provider;
		},
	};

	async onload() {
		await this.loadSettings();
		setHighlightDuration(Number(this.settings.highlightSeconds));
		this.addSettingTab(new BetterCitationsSettingTab(this.app, this));

		this.index = new CitationIndex(this.app, () => this.settings);
		const fileForDoi = (doi: string) => this.index.fileForDoi(doi);
		this.app.workspace.onLayoutReady(() => {
			void this.startIndex();
			(this.app.workspace as Events).trigger(API_READY_EVENT, this.api);
		});

		this.registerObsidianProtocolHandler(CITE_ACTION, (params) => {
			void openCitation(this.app, parseCitationParams(params), false, fileForDoi);
		});
		registerCitationClicks(this, fileForDoi);
		registerCitationHover(this, this.index, () => this.settings, (doi) => this.doiTitleProvider?.(doi) ?? Promise.resolve(null));
		registerBrokenLinkMarks(this, this.index);

		this.addCommand({
			id: 'copy-citation-link',
			name: 'Copy citation link to selection',
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view?.file) return false;
				if (view.getMode() === 'source') {
					if (!view.editor.somethingSelected()) return false;
					if (!checking) void this.copyCitationLink(view.editor, view);
					return true;
				}
				// Reading view: the selected text is rendered text.
				const selected = activeWindow.getSelection()?.toString().trim() ?? '';
				if (!selected) return false;
				if (!checking) void this.copyCitationLinkFromReading(view, selected);
				return true;
			},
		});
		this.addCommand({
			id: 'insert-reference-list',
			name: 'Insert reference list',
			editorCallback: (editor) => this.insertReferenceList(editor),
		});
		this.addCommand({
			id: 'insert-citation',
			name: 'Insert citation',
			editorCallback: (editor) => new InsertCitationModal(this.app, editor, this.index, this.settings).open(),
		});
		this.addCommand({
			id: 'copy-reference',
			name: 'Copy reference of this work',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				const stored: unknown = file ? this.app.metadataCache.getFileCache(file)?.frontmatter?.[this.settings.referenceProperty] : null;
				if (typeof stored !== 'string' || !stored.trim()) return false;
				if (!checking) {
					void navigator.clipboard.writeText(localizeReference(stored.trim(), this.settings.citationLanguage));
					new Notice('Reference copied.');
				}
				return true;
			},
		});
		this.addCommand({
			id: 'update-in-text-citations',
			name: 'Update in-text citations (APA)',
			editorCallback: (editor) => this.updateInTextCitations(editor),
		});
		this.addCommand({
			id: 'check-citations',
			name: 'Check citations in this note',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== 'md') return false;
				if (!checking) void this.checkNote(file);
				return true;
			},
		});
		this.addCommand({
			id: 'convert-readable-citation-links',
			name: 'Convert readable citation links to encoded',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== 'md') return false;
				if (!checking) void this.convertReadableLinks(file);
				return true;
			},
		});
		this.addCommand({
			id: 'copy-without-citation-links',
			name: 'Copy note without citation links',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== 'md') return false;
				if (!checking) void this.copyWithoutCitationLinks(file);
				return true;
			},
		});
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu, editor, info) => {
				if (!editor.somethingSelected() || !info.file) return;
				menu.addItem((item) =>
					item
						.setSection('selection')
						.setTitle('Copy citation link')
						.setIcon('quote')
						.onClick(() => void this.copyCitationLink(editor, info)),
				);
			}),
		);
	}

	/** Copies a citation link to the selected passage to the clipboard. */
	async copyCitationLink(editor: Editor, info: MarkdownView | MarkdownFileInfo) {
		const file = info.file;
		if (!file) return;
		const text = editor.getValue();
		const from = editor.posToOffset(editor.getCursor('from'));
		const to = editor.posToOffset(editor.getCursor('to'));
		const link = buildCitationLink(this.app, file, text, from, to, this.settings);
		if (!link) return;
		await navigator.clipboard.writeText(link);
		new Notice('Citation link copied.');
	}

	/**
	 * Copies a citation link to a passage selected in the reading view. The
	 * rendered text is found back in the note's Markdown by the same
	 * normalized search that opens links; when it occurs more than once, the
	 * occurrence nearest to the part of the note on screen is used.
	 */
	async copyCitationLinkFromReading(view: MarkdownView, selected: string) {
		const file = view.file;
		if (!file) return;
		const text = await this.app.vault.cachedRead(file);
		const words = selected.split(/\s+/).filter(Boolean);
		const q = words.slice(0, 12).join(' ');
		const qe = words.length > 15 ? words.slice(-6).join(' ') : undefined;
		const matches = findExactPassages(text, q);
		if (matches.length === 0) {
			new Notice('The selection was not found in the note; select the passage in the editing view instead.');
			return;
		}
		const lineOf = (offset: number) => text.slice(0, offset).split('\n').length - 1;
		const onScreen = view.previewMode.getScroll();
		let occ = 1;
		matches.forEach((m, i) => {
			const best = matches[occ - 1];
			if (best && Math.abs(lineOf(m.from) - onScreen) < Math.abs(lineOf(best.from) - onScreen)) occ = i + 1;
		});
		const range = findPassage(text, q, qe, occ);
		if (!range) return;
		const link = buildCitationLink(this.app, file, text, range.from, range.to, this.settings);
		if (!link) return;
		await navigator.clipboard.writeText(link);
		new Notice('Citation link copied.');
	}

	/** Builds the citation index, then keeps it up to date. */
	private async startIndex() {
		await this.index.build();
		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => void this.index.indexFile(file)),
		);
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile) this.index.removeFile(file.path);
			}),
		);
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile && file.extension === 'md') this.index.renameFile(file, oldPath);
				if (this.settings.updateLinksOnRename) {
					void updateLinksAfterRename(this.app, this.index, file, oldPath);
				}
			}),
		);
	}

	/**
	 * Inserts, at the cursor, the reference list of the works cited in the note,
	 * and says which in-text citations need a letter (2020a, 2020b).
	 */
	insertReferenceList(editor: Editor) {
		const fileForDoi = (doi: string) => this.index.fileForDoi(doi);
		const list = buildReferenceList(this.app, editor.getValue(), this.settings, fileForDoi);
		if (!list.text) {
			new Notice('This note cites no work of the vault.');
			return;
		}
		// One undoable change: the in-text citations, then the list at the cursor.
		const at = editor.posToOffset(editor.getCursor('from'));
		const end = editor.posToOffset(editor.getCursor('to'));
		const { changes, skipped } = this.citationTextChanges(editor.getValue(), list.citations);
		editor.transaction({
			changes: [
				...changes.map((c) => ({ from: editor.offsetToPos(c.from), to: editor.offsetToPos(c.to), text: c.text })),
				{ from: editor.offsetToPos(at), to: editor.offsetToPos(end), text: `${list.text}\n` },
			],
		});
		const messages: string[] = [];
		if (changes.length > 0) messages.push(`Updated ${changes.length} in-text citation${changes.length > 1 ? 's' : ''} to follow APA.`);
		if (list.disambiguated.length > 0) {
			messages.push(`Told apart as APA requires: ${list.disambiguated.map((d) => d.citation).join('; ')}.`);
		}
		if (skipped > 0) messages.push(`${skipped} citation link${skipped > 1 ? 's were' : ' was'} left as written (custom text).`);
		if (list.skipped.length > 0) messages.push(`Not in the list (no note in the vault): ${list.skipped.join('; ')}.`);
		if (messages.length > 0) new Notice(messages.join('\n\n'), 15000);
	}

	/** Rewrites the in-text citations of the active note so that they follow APA 7. */
	updateInTextCitations(editor: Editor) {
		const fileForDoi = (doi: string) => this.index.fileForDoi(doi);
		const { files } = citedWorks(this.app, editor.getValue(), fileForDoi);
		const labels = new Map([...inTextCitations(this.app, files, this.settings)].map(([path, c]) => [path, c.label]));
		const { changes, skipped } = this.citationTextChanges(editor.getValue(), labels);
		if (changes.length > 0) {
			editor.transaction({
				changes: changes.map((c) => ({ from: editor.offsetToPos(c.from), to: editor.offsetToPos(c.to), text: c.text })),
			});
		}
		const parts = [
			changes.length === 0
				? 'The in-text citations already follow APA.'
				: `Updated ${changes.length} in-text citation${changes.length > 1 ? 's' : ''} to follow APA.`,
		];
		if (skipped > 0) parts.push(`${skipped} left as written (custom text).`);
		new Notice(parts.join(' '));
	}

	/**
	 * The changes that give each citation link of a text its APA citation. A
	 * link whose text does not look like a citation of its work (a custom
	 * text, without the first author and the year) is left as written.
	 */
	citationTextChanges(text: string, labels: Map<string, string>): { changes: { from: number; to: number; text: string }[]; skipped: number } {
		const changes: { from: number; to: number; text: string }[] = [];
		let skipped = 0;
		const plain = (t: string) => t.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
		for (const link of citationLinksIn(text)) {
			const { note, doi } = link.target;
			const file = (note ? resolveCitedNote(this.app, note) : null) ?? (doi ? this.index.fileForDoi(doi) : null);
			const label = file ? labels.get(file.path) : undefined;
			if (!file || !label) continue;
			const current = link.text.replace(/\\([[\]])/g, '$1');
			if (current === label) continue;
			const work = apaWorkOf(this.app, file, this.settings);
			const family = work.authors[0]?.family ?? '';
			const year = work.year.replace(/\D/g, '');
			if (!family || !plain(current).includes(plain(family)) || (year && !current.includes(year))) {
				skipped++;
				continue;
			}
			changes.push({ from: link.from + 1, to: link.from + 1 + link.text.length, text: label.replace(/([[\]])/g, '\\$1') });
		}
		return { changes, skipped };
	}


	/** Checks the citation links of a note and lists those that need attention. */
	async checkNote(file: TFile) {
		const results = await checkCitations(this.app, await this.app.vault.read(file), (doi) =>
			this.index.fileForDoi(doi),
		);
		if (results.length === 0) {
			new Notice('This note has no citation links.');
			return;
		}
		new CitationCheckModal(this.app, file, results).open();
	}

	/** Rewrites the note's citation links in their canonical encoded form. */
	async convertReadableLinks(file: TFile) {
		let changed = 0;
		await this.app.vault.process(file, (text) => {
			const result = withCanonicalCitationLinks(text, (link) => citationUrl(link.target));
			changed = result.changed;
			return result.text;
		});
		new Notice(changed === 0 ? 'Every citation link is already encoded.' : `Converted ${changed} citation link${changed > 1 ? 's' : ''}.`);
	}

	/** Copies the note with each citation link replaced by its text, for export. */
	async copyWithoutCitationLinks(file: TFile) {
		await navigator.clipboard.writeText(withoutCitationLinks(await this.app.vault.read(file)));
		new Notice('Note copied without citation links.');
	}

	/** Called when a setting changes in the settings tab. */
	onSettingsChanged() {
		setHighlightDuration(Number(this.settings.highlightSeconds));
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<BetterCitationsSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
