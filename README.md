# Better Citations

An Obsidian plugin to cite a passage of any note with a link that opens it exactly there.

Cite a work, a course note or any note of your vault, "(Author et al., 2016)", with a link that opens the cited note at the exact passage. Preview citations on hover, check them, export a note without them, and write APA reference lists in English or French.

## Features

- **Citation links to a passage.** A link whose text is the citation and whose target is a passage of a note. Nothing is added to the cited note, and the link does not appear in Obsidian's graph view or backlinks. Copy such a link from a selection in one click.
- **Opening and previews.** A click opens the note with the passage selected or highlighted, even if its line breaks, hyphenation or emphasis changed; hovering shows the passage in its context; broken citations are shown in the error color.
- **Checking and export.** Find broken or changed citations, and copy a note without its links for a word processor.
- **APA 7 reference lists.** Insert the reference list of the works a note cites, and bring its in-text citations in line with APA 7th edition, in English or in French.
- **Links kept up to date** when a cited note is renamed or moved.

Better Citations works on its own. With [Literature Graph](https://github.com/lavemile02-afk/Literature-Graph-for-Obsidian), the citation links also become the edges of a graph of your literature (see [Working with Literature Graph](#working-with-literature-graph)).

## Installation

The plugin is not yet in Obsidian's community plugin directory. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/lavemile02-afk/Better_Citations_for_Obsidian/releases/latest), put them in `<vault>/.obsidian/plugins/better-citations/`, then enable **Better Citations** in **Settings → Community plugins**. It requires Obsidian 1.13.7 or later, on desktop.

Then, in the plugin settings, choose the **literature folder** (the folder of your literature notes, listed by **Insert citation**) and the **citation language**, and check the names of the properties that hold each work's citation text, authors, year, reference, title and DOI.

## Citation links

A citation link is an ordinary Markdown link whose text is the citation and whose URL points to a note and a passage in it:

```markdown
([Bourgeois et al., 2016](obsidian://cite?note=Bourgeois%20et%20al.%2C%202016&q=Once%20canopy%20cover%20passed%20a%20threshold))
```

Clicking it opens the note `Bourgeois et al., 2016`, scrolls to the passage that starts with "Once canopy cover passed a threshold" and selects it. Parameters:

| Parameter | Meaning |
|---|---|
| `note` | Note name (resolved like a `[[wikilink]]`) or path from the vault root. |
| `q` | Start of the cited passage, copied word for word from the note's Markdown. Six to fifteen words are usually enough to be unique. Always the last parameter. |
| `qe` | Optional. End of the passage, a few words copied from the note. The passage then runs from `q` to `qe`. |
| `occ` | Optional. Which occurrence of the passage to open, if it appears more than once (starting at 1). |
| `doi` | Optional. DOI of the cited work. If the note does not exist, the link opens `https://doi.org/<doi>` instead. A work that is not in your vault can be cited with `doi` alone. |

Values are percent-encoded, like in any URL. This is the canonical form: it works everywhere, including from other applications when Obsidian is installed. For hand-written links, a readable form between angle brackets is also accepted:

```markdown
([Bourgeois et al., 2016](<obsidian://cite?note=Bourgeois et al., 2016&q=Once canopy cover passed a threshold>))
```

The readable form breaks if the passage contains `>` or a line break, and it may not work outside Obsidian. **Convert readable citation links to encoded** rewrites the readable links of the active note in the canonical form.

### Creating a citation link

In the note of a work, select the passage you want to cite, right-click it and choose **Copy citation link** (or run the command **Copy citation link to selection**, which you can bind to a hotkey). Paste the link where you write. For a long selection, the link keeps its first words (`q`) and last words (`qe`), and the whole passage is selected or highlighted when the link is opened. If the start of the passage appears more than once in the note, the link says which occurrence (`occ`).

The command also works in the reading view: select the passage and run it (bind it to a hotkey for convenience). The selected text is found back in the note's Markdown; if it occurs more than once, the occurrence nearest to the part of the note on screen is cited.

The text of the link comes from the work's properties:

1. the citation text property (by default `Citation_texte`), such as `(Smith et al., 2020)`;
2. otherwise the authors and year properties (by default `Auteurs`, as `Family, I., Family, I.`, and `Annee`);
3. otherwise the note name.

The property names, and the language of the citation ("Smith & Jones" or "Smith et Jones"), can be changed in the plugin settings.

### Citing notes that are not literature

A citation link to a note that is not literature (outside the literature folder, without a citation text property), such as a course or field note, reads as a small superscript number, like a footnote call: `[¹](obsidian://cite?…)`, without parentheses. Notes are numbered in the order they are first cited, and a note cited again keeps its number. A copied link reads `⁰` until it is pasted: pasting it numbers the links of the note. **Renumber citation numbers** puts the numbers back in order after citations are moved or removed. Resting the pointer on a number for a moment opens its preview, which names the note and shows the passage (in the reading view and in the editor, without Ctrl/Cmd). **Citations of other notes**, in the settings, can give these links the note's name instead.

### Citing a whole work

**Insert citation** lists the works of the literature folder (search by author, year or title words) and inserts a citation link to the chosen work at the cursor; the link opens the work at the beginning. **Copy reference of this work** copies the full reference of the active note's work, in the citation language.

### Opening a citation link

Clicking a citation link opens the note, in a new tab, and selects the passage (editing view) or highlights it for a few seconds (reading view). With **Open citations in a new tab** off, a click opens it in the same tab, and Ctrl/Cmd-click or middle-click in a new tab. The passage is found even if line breaks, hyphenation, emphasis or HTML tags differ; if it was changed since, the closest text is shown with a notice.

**Previews.** Hovering a citation link shows the cited work and the passage in its context, like Obsidian's page previews (in the editor, hold Ctrl/Cmd, as for Obsidian's own links). A citation link whose work cannot be found (no note and no DOI) is shown in the error color.

### Checking and exporting

- **Check citations in this note** lists the citation links whose note or passage cannot be found, or whose passage was changed, with a link to each line.
- **Copy note without citation links** copies the note with each link replaced by its text, "(Smith et al., 2020)", for pasting into a word processor, where `obsidian://` links would only work with Obsidian installed.

### Reference list and APA in-text citations

**Insert reference list** inserts, at the cursor, the reference list of the works cited by the note's citation links, and brings the note's in-text citations in line with it, following APA 7th edition (one undoable change):

- **Order** (APA 9.44–9.47): letter by letter on the surnames ("nothing precedes something": Brown before Browning), a one-author work before multi-author works with the same first author, then the year (no date first), then the title without its leading article.
- **In-text citations** (APA 8.17–8.20): when two different works would get the same citation ("Smith et al., 2020"), as many names are written as needed to tell them apart ("Smith, Jones, et al., 2020"; every name if only the last one differs). Only works with the same authors and year get letters (2020a, 2020b), in reference-list order. When different first authors share a surname, their initials are added ("J. M. Taylor, 2020").
- **Language**: references and citations are written in English or in the French adaptation of APA ("et", "(dir.)", "Dans", "(2e éd.)", "(Thèse de doctorat)", "[Prépublication]", "s.d."), whichever form the properties use.

**Update in-text citations (APA)** does the second part alone. A citation link whose text is not a citation of its work (a custom text without the first author and year) is left as written.

Each reference comes from the work's reference property (by default `Citation`); the order and the citations are computed from its authors, year and title properties.

### For scripts and AI agents

Citation links are plain text, so a script or an AI assistant can write and check them without Obsidian:

1. Copy six to fifteen consecutive words of the passage, word for word, from the note's Markdown (not from the PDF).
2. Percent-encode `note` and `q` (and `qe`), including `(`, `)`, `!`, `'` and `*`, with a library function (for example `encodeURIComponent` plus those five characters, or Python's `urllib.parse.quote(value, safe="")`). Put `q` last.
3. Check the link: decode `q` and make sure it occurs in the note after this normalization of both texts, which is what the plugin does: lower case; accents removed (Unicode NFKD, combining marks dropped); `*`, `_`, `` ` ``, `~` and `\` removed; HTML tags removed (`<br>`, `<p>`, `<li>`, `<td>`… count as a space); typographic quotes made straight; every dash or hyphen removed together with the whitespace around it; every other run of whitespace turned into one space. A link whose passage cannot be found this way should not be delivered.

Because citation links are URLs, Obsidian does not treat them as internal links: nothing is added to the cited note, and they do not appear in the graph view or in backlinks.

## Working with Literature Graph

[Literature Graph](https://github.com/lavemile02-afk/Literature-Graph-for-Obsidian) draws the citations between your literature notes as a graph, and reads citation links as citations. Each plugin works alone; together:

- the citation links written with Better Citations become edges of the literature graph, and a cited passage listed in Literature Graph's citations panel opens at the passage;
- hover previews of a work cited by DOI only show its title, from Literature Graph's bibliographic data.

Better Citations makes no network request itself.

The format of citation links (`obsidian://cite?note=…&doi=…&occ=…&qe=…&q=…`) is the interface between the two plugins and with scripts: it will stay stable. Other plugins can use `app.plugins.plugins['better-citations'].api`: `openCitation(url, newTab?)` opens a citation link, and `setDoiTitleProvider(provider)` gives the title of works cited by DOI only.

## Development

Requires [Node.js](https://nodejs.org/) (current LTS) and npm.

```bash
npm install      # install dependencies
npm run dev      # rebuild main.js on every change (watch mode)
npm run build    # type-check and build a production main.js
npm run lint     # lint with the Obsidian ESLint rules
npm test         # run the tests (Node's built-in test runner)
```

The source is in `src/` (TypeScript). The build writes `main.js` at the repository root. To test in a vault, copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/better-citations/` and reload the plugin. The plugin bundles no third-party library.

The project structure follows the official [Obsidian sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin).

### Releasing

Run `npm version <x.y.z>` (updates `manifest.json` and `versions.json`), then push the commit and the tag. A GitHub Action builds the plugin and creates the release with `main.js`, `manifest.json` and `styles.css`.

## License

[MIT](LICENSE)
