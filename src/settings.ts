import { App, Plugin, PluginSettingTab, SettingDefinitionItem } from 'obsidian';

export type CitationLanguage = 'en' | 'fr';

export interface BetterCitationsSettings {
	/** Folder that holds the literature notes (empty = whole vault). */
	literatureFolder: string;
	/** Language of the citations the plugin writes ("et al." forms, "&" or "et"). */
	citationLanguage: CitationLanguage;
	/** Property holding a work's in-text citation, e.g. "(Author et al., 2016)". */
	citationTextProperty: string;
	/** Property holding a work's authors, as "Family, I., Family, I.". */
	authorsProperty: string;
	/** Property holding a work's year. */
	yearProperty: string;
	/** Property holding a work's full reference, in APA style. */
	referenceProperty: string;
	/** Property holding a work's title (used when the reference property is empty). */
	titleProperty: string;
	/** Always use the note name as the citation text. */
	useNoteNameAsCitation: boolean;
	/**
	 * Text of the links to notes that are not literature (outside the
	 * literature folder, without a citation text property): "number", a
	 * superscript number (¹, ²…), or "name", the note name.
	 */
	otherNotesCitation: string;
	/** Property holding a work's DOI, used to recognize works cited by DOI. */
	doiProperty: string;
	/** Rewrite citation links when the cited note is renamed. */
	updateLinksOnRename: boolean;
	/** Seconds the cited passage stays highlighted in the reading view (0: until the next one). */
	highlightSeconds: number;
}

export const DEFAULT_SETTINGS: BetterCitationsSettings = {
	literatureFolder: 'Documents',
	citationLanguage: 'en',
	citationTextProperty: 'Citation_texte',
	authorsProperty: 'Auteurs',
	yearProperty: 'Annee',
	referenceProperty: 'Citation',
	titleProperty: 'Titre',
	useNoteNameAsCitation: false,
	otherNotesCitation: 'number',
	doiProperty: 'DOI',
	updateLinksOnRename: true,
	highlightSeconds: 5,
};

export class BetterCitationsSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly owner: Plugin & {
			onSettingsChanged: () => void;
			settings: BetterCitationsSettings;
			saveSettings: () => Promise<void>;
		},
	) {
		super(app, owner);
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		await super.setControlValue(key, value);
		this.owner.onSettingsChanged();
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Literature folder',
				desc: 'Folder that holds your literature notes: "Insert citation" lists them. Leave empty to use the whole vault.',
				control: {
					type: 'folder',
					key: 'literatureFolder',
					placeholder: 'Documents',
				},
			},
			{
				name: 'Citation language',
				desc: 'Language of the citations the plugin writes, for example "Smith & Jones, 2020" or "Smith et Jones, 2020".',
				control: {
					type: 'dropdown',
					key: 'citationLanguage',
					options: { en: 'English', fr: 'French' },
				},
			},
			{
				type: 'group',
				heading: 'Citations',
				items: [
					{
						name: 'Citation text property',
						desc: 'Property that holds the in-text citation of a work, such as "(Smith et al., 2020)". Copied citation links use it as their text.',
						control: { type: 'text', key: 'citationTextProperty', placeholder: 'Citation_texte' },
					},
					{
						name: 'Authors property',
						desc: 'Property that holds the authors, as "Family, I., Family, I.". Used to build the citation text when the citation text property is empty.',
						control: { type: 'text', key: 'authorsProperty', placeholder: 'Auteurs' },
					},
					{
						name: 'Year property',
						desc: 'Property that holds the year of publication.',
						control: { type: 'text', key: 'yearProperty', placeholder: 'Annee' },
					},
					{
						name: 'Reference property',
						desc: 'Property that holds the full reference of a work, in APA style. Used by "Insert reference list".',
						control: { type: 'text', key: 'referenceProperty', placeholder: 'Citation' },
					},
					{
						name: 'Title property',
						desc: 'Property that holds the title. Used to build a short reference when the reference property is empty.',
						control: { type: 'text', key: 'titleProperty', placeholder: 'Titre' },
					},
					{
						name: 'Always use the note name',
						desc: 'Use the name of the cited note as the citation text, ignoring the properties above.',
						control: { type: 'toggle', key: 'useNoteNameAsCitation' },
					},
					{
						name: 'Citations of other notes',
						desc: 'Text of the links to notes that are not literature (outside the literature folder, without a citation text property), such as course or field notes. Superscript number: ¹, ², in the order the notes are first cited, renumbered when you paste a link or with "Renumber citation numbers"; hover the number to see the note\'s name. Note name: the name of the note.',
						control: {
							type: 'dropdown',
							key: 'otherNotesCitation',
							options: { number: 'Superscript number (¹, ²…)', name: 'Note name' },
						},
					},
					{
						name: 'DOI property',
						desc: 'Property that holds the DOI of a work. A link that cites a DOI opens the note with that DOI, if there is one.',
						control: { type: 'text', key: 'doiProperty', placeholder: 'DOI' },
					},
				],
			},
			{
				type: 'group',
				heading: 'Advanced',
				items: [
					{
						name: 'Update links when a note is renamed',
						desc: 'Rewrite the citation links that point to a note when it is renamed or moved. Obsidian does this for wikilinks, but not for citation links.',
						control: { type: 'toggle', key: 'updateLinksOnRename' },
					},
					{
						name: 'Highlight duration',
						desc: 'Seconds the cited passage stays highlighted when a citation link opens it in the reading view. 0 keeps it until another passage is highlighted.',
						control: { type: 'number', key: 'highlightSeconds', min: 0, max: 600 },
					},
				],
			},
		];
	}
}
