class RegexRules {
    constructor(settings) {
        this.update(settings);
    }

    update(settings) {
        this.headingsRegex = /^ {0,3}(#{1,6}) +([^\n]+?) ?((?: *#\S+)*) *$/gim;
        this.wikiImageLinks = /!\[\[(.*\.(?:png|jpg|jpeg|gif|bmp|svg|tiff)).*?\]\]/gim;
        this.markdownImageLinks = /!\[\]\((.*\.(?:png|jpg|jpeg|gif|bmp|svg|tiff))\)/gim;
        this.wikiAudioLinks = /!\[\[(.*\.(?:mp3|webm|wav|m4a|ogg|3gp|flac)).*?\]\]/gim;
        this.obsidianCodeBlock = /(?:```(?:.*?\n?)+?```)(?:\n|$)/gim;
        this.codeBlock = /<code\b[^>]*>(.*?)<\/code>/gims;
        this.mathBlock = /(\$\$)(.*?)(\$\$)/gis;
        this.mathInline = /(\$)(.*?)(\$)/gi;
        this.cardsDeckLine = /cards-deck: [\p{L}]+/giu;
        this.cardsToDelete = /^\s*(?:\n)(?:(?:\^|<!--anki:)(\d{13})(?:-->)?)(?:\n\s*?)?/gm;
        this.globalTagsSplitter = /\[\[(.*?)\]\]|#([\p{L}\d:\-_/]+)|([\p{L}\d:\-_/]+)/gimu;
        this.tagHierarchy = /\//gm;

        let flags = "gimu";
        let cardTag = settings.flashcardsTag;

        let multilinePattern = "( {0,3}[#]*)([^\\n]+?)(#" + cardTag + "(?:[/-]reverse)?)((?: *#[\\p{Number}\\p{Letter}\\-\\/_]+)*) *?\\n+((?:[^\\n]\\n?)*?(?=(?:\\^|<!--anki:)\\d{13}(?:-->)?|$))(?:(?:\\^|<!--anki:)(\\d{13})(?:-->)?)?";
        this.flashscardsWithTag = new RegExp(multilinePattern, flags);

        let m = settings.inlineSeparator.length >= settings.inlineSeparatorReverse.length ? settings.inlineSeparator : settings.inlineSeparatorReverse;
        let a = settings.inlineSeparator.length < settings.inlineSeparatorReverse.length ? settings.inlineSeparator : settings.inlineSeparatorReverse;

        let inlinePattern;
        if (settings.inlineID) {
            inlinePattern = "( {0,3}[#]{0,6})?(?:(?:[\\t ]*)(?:\\d+\\.|[-+*]|#{1,6})[\\t ])?(.+?) ?(" + m + "|" + a + ") ?(.+?)((?: *#[\\p{Letter}\\-\\/_]+)+)?(?:\\s+(?:\\^|<!--anki:)(\\d{13})(?:-->)?|$)"
        } else {
            inlinePattern = "( {0,3}[#]{0,6})?(?:(?:[\\t ]*)(?:\\d+\\.|[-+*]|#{1,6})[\\t ])?(.+?) ?(" + m + "|" + a + ") ?(.+?)((?: *#[\\p{Letter}\\-\\/_]+)+|$)(?:\\r?\\n(?:\\^|<!--anki:)(\\d{13})(?:-->)?)?"
        }
        this.cardsInlineStyle = new RegExp(inlinePattern, flags);

        let spacedPattern = "( {0,3}[#]*)([^\\n]+?)(#" + cardTag + "[/-]spaced)((?: *#[\\p{Letter}-]+)*) *\\n?(?:(?:\\^|<!--anki:)(\\d{13})(?:-->)?)?";
        this.cardsSpacedStyle = new RegExp(spacedPattern, flags);

        let clozePattern = "( {0,3}[#]{0,6})?(?:(?:[\\t ]*)(?:\\d+\\.|[-+*]|#{1,6})[\\t ])?(.*?(==.+?==|\\{.+?\\}).*?)((?: *#[\\w\\-\\/_]+)+|$)(?:\\r?\\n(?:\\^|<!--anki:)(\\d{13})(?:-->)?)?";
        this.cardsClozeWholeLine = new RegExp(clozePattern, flags);

        this.singleClozeCurly = /((?:{)(?:[cC]?(\d):?)?(.+?)(?:}))/g;
        this.singleClozeHighlight = /((?:==)(.+?)(?:==))/g;
        this.embedBlock = /!\[\[(.*?)(?<!\.(?:png|jpg|jpeg|gif|bmp|svg|tiff|mp3|webm|wav|m4a|ogg|3gp|flac))\]\]/g;
    }
}

// =====================================================================================
// 5. REGEX-BASED CARD PARSER ENGINE
// =====================================================================================

class MDFormatter {
    static makeHtml(md, vaultName = "") {
        if (!md) return "";
        let html = md;

        let placeholders = [];
        let placeholderCounter = 0;

        function store(block) {
            const ph = `\uFFFCPLH${placeholderCounter++}\uFFFC`;
            placeholders.push({ placeholder: ph, content: block });
            return ph;
        }

        // 1. Fenced Code Blocks: Extract and protect
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const escapedCode = MDFormatter.escapeHtml(code.trim());
            const langClass = lang ? ` class="language-${lang}"` : '';
            return store(`<pre><code${langClass}>${escapedCode}</code></pre>`);
        });

        // 2. Inline Code: Extract and protect
        html = html.replace(/`(.*?)`/g, (match, code) => {
            return store(`<code>${MDFormatter.escapeHtml(code)}</code>`);
        });

        // 3. Math blocks: Extract and protect
        html = html.replace(/\$\$(.*?)\$\$/gs, (match, formula) => {
            return store(`<anki-mathjax block="true">${formula.trim()}</anki-mathjax>`);
        });

        // 4. Math inline: Extract and protect
        html = html.replace(/\$(.*?)\$/g, (match, formula) => {
            return store(`<anki-mathjax>${formula.trim()}</anki-mathjax>`);
        });

        // 5. Protect pre-existing HTML tags
        html = html.replace(/<[^>]+>/g, (match) => {
            return store(match);
        });

        // 6. Wikilinks images: Extract and protect
        html = html.replace(/!\[\[(.*\.(?:png|jpg|jpeg|gif|bmp|svg|tiff))(?:\|.*?)?\]\]/gim, (match, file) => {
            return store(`<img src="${file}">`);
        });

        // 7. Markdown images: Extract and protect
        html = html.replace(/!\[\]\((.*\.(?:png|jpg|jpeg|gif|bmp|svg|tiff))\)/gim, (match, file) => {
            return store(`<img src="${file}">`);
        });

        // 8. Wikilinks audio: Extract and protect
        html = html.replace(/!\[\[(.*\.(?:mp3|webm|wav|m4a|ogg|3gp|flac))\]\]/gim, (match, file) => {
            return store(`[sound:${file}]`);
        });

        // 9. Standard Markdown links: Extract and protect
        html = html.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
            return store(`<a href="${url}">${text}</a>`);
        });

        // 10. Obsidian Wikilinks: Convert, extract and protect
        let encVault = encodeURIComponent(vaultName);
        html = html.replace(/\[\[(.+?)(?:\|(.+?))?\]\]/gim, (match, path, alias) => {
            let encPath = encodeURIComponent(path);
            let linkHtml = `<a href="obsidian://open?vault=${encVault}&file=${encPath}.md">${alias || path}</a>`;
            return store(linkHtml);
        });

        // 10.5 Convert Bullet Lists
        // Wraps consecutive list items in <ul><li>...</li></ul>
        html = html.replace(/(?:^|\n)( {0,4}(?:[-*+]|\d+\.) .*?(?:\r?\n|$))+/g, (match) => {
            let prefix = match.startsWith('\n') || match.startsWith('\r\n') ? match.match(/^\r?\n/)[0] : '';
            let listType = match.match(/^\s*\n?\s*\d+\./) ? 'ol' : 'ul';
            let items = match.trim().split(/\r?\n/);
            let listHtml = items.map(item => {
                let content = item.replace(/^ {0,4}(?:[-*+]|\d+\.) /, '');
                return `<li>${content}</li>`;
            }).join('');
            return `${prefix}<${listType} style="text-align: left;">${listHtml}</${listType}>\n`;
        });

        // 11. Apply basic inline Markdown formatting safely on unshielded text
        // Bold + Italic combinations: ***text*** or ___text___ -> <b><i>text</i></b>
        html = html.replace(/\*\*\*(.*?)\*\*\*/g, "<b><i>$1</i></b>");
        html = html.replace(/___(.*?)___/g, "<b><i>$1</i></b>");
        html = html.replace(/\*\*_(.*?)_\*\*/g, "<b><i>$1</i></b>");
        html = html.replace(/_\*\*(.*?)\*\*_/g, "<b><i>$1</i></b>");

        // Bold: **text** or __text__ -> <b>text</b>
        html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
        html = html.replace(/__(.*?)__/g, "<b>$1</b>");

        // Italic: *text* or _text_ -> <i>text</i>
        html = html.replace(/\*(.*?)\*/g, "<i>$1</i>");
        html = html.replace(/_(.*?)_/g, "<i>$1</i>");

        // Highlight: ==text== -> <mark>text</mark>
        html = html.replace(/==(.*?)==/g, "<mark>$1</mark>");

        // Headers: e.g. # Header -> <h1>Header</h1>
        html = html.replace(/^ {0,3}(#{1,6}) +(.*?)$/gm, (match, hashes, content) => {
            const level = hashes.length;
            return `<h${level}>${content}</h${level}>`;
        });

        // 12. Convert newlines to <br>
        html = html.replace(/\r?\n/g, "<br>");

        // 13. Restore all protected placeholders from end to start (safely avoiding special $ replacement tokens)
        for (let i = placeholders.length - 1; i >= 0; i--) {
            const ph = placeholders[i];
            html = html.replace(ph.placeholder, () => ph.content);
        }

        // Rimuove eventuali <br> finali rimasti
        html = html.replace(/(?:<br\s*\/?>)+$/i, "");

        return html;
    }

    static escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// =====================================================================================
// 2. MODULAR FLASHCARD REPRESENTATIONS
// =====================================================================================

class Card {
    constructor(id, deckName, initialContent, fields, reversed, initialOffset, endOffset, tags, inserted, mediaNames) {
        this.id = id;
        this.deckName = deckName;
        this.initialContent = initialContent;
        this.fields = fields;
        this.reversed = reversed;
        this.initialOffset = initialOffset;
        this.endOffset = endOffset;
        this.tags = tags;
        this.inserted = inserted;
        this.mediaNames = mediaNames;
        this.mediaBase64Encoded = [];
        this.oldTags = [];
        this.deletedFromAnki = false;
        this.modelName = "";
    }

    match(ankiNote) {
        for (let [name, value] of Object.entries(this.fields)) {
            let ankiField = ankiNote.fields[name];
            if (!ankiField) return false;
            if (ankiField.value !== value) return false;
        }
        return this.arraysEqual(ankiNote.tags, this.tags);
    }

    arraysEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null || a.length !== b.length) return false;
        a.sort();
        b.sort();
        for (let i = 0; i < a.length; ++i) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }
}


class InlineCard extends Card {
    constructor(id = -1, deckName, initialContent, fields, reversed, initialOffset, endOffset, tags = [], inserted = false, mediaNames = [], settings) {
        super(id, deckName, initialContent, fields, reversed, initialOffset, endOffset, tags, inserted, mediaNames);
        this.modelName = this.reversed ? settings.reversedModel : settings.basicModel;
    }
    getCard(includeId = false) {
        let card = { deckName: this.deckName, modelName: this.modelName, fields: this.fields, tags: this.tags };
        if (includeId) card.id = this.id;
        return card;
    }
    getMedias() {
        let medias = [];
        this.mediaBase64Encoded.forEach((data, i) => {
            medias.push({ filename: this.mediaNames[i], data: data });
        });
        return medias;
    }
    getIdFormat() {
        return "<!--anki:" + this.id.toString() + "-->";
    }
}


class MultilineCard extends Card {
    constructor(id = -1, deckName, initialContent, fields, reversed, initialOffset, endOffset, tags = [], inserted = false, mediaNames = [], settings) {
        super(id, deckName, initialContent, fields, reversed, initialOffset, endOffset, tags, inserted, mediaNames);
        this.modelName = this.reversed ? settings.reversedModel : settings.basicModel;
    }
    getCard(includeId = false) {
        let card = { deckName: this.deckName, modelName: this.modelName, fields: this.fields, tags: this.tags };
        if (includeId) card.id = this.id;
        return card;
    }
    getMedias() {
        let medias = [];
        this.mediaBase64Encoded.forEach((data, i) => {
            medias.push({ filename: this.mediaNames[i], data: data });
        });
        return medias;
    }
    getIdFormat() {
        return "<!--anki:" + this.id.toString() + "-->\n";
    }
}


class SpacedCard extends Card {
    constructor(id = -1, deckName, initialContent, fields, reversed = false, initialOffset, endOffset, tags = [], inserted = false, mediaNames = [], settings) {
        super(id, deckName, initialContent, fields, reversed, initialOffset, endOffset, tags, inserted, mediaNames);
        this.modelName = settings.spacedModel;
    }
    getCard(includeId = false) {
        let card = { deckName: this.deckName, modelName: this.modelName, fields: this.fields, tags: this.tags };
        if (includeId) card.id = this.id;
        return card;
    }
    getMedias() {
        let medias = [];
        this.mediaBase64Encoded.forEach((data, i) => {
            medias.push({ filename: this.mediaNames[i], data: data });
        });
        return medias;
    }
    getIdFormat() {
        return "<!--anki:" + this.id.toString() + "-->\n";
    }
}


class ClozeCard extends Card {
    constructor(id = -1, deckName, initialContent, fields, reversed = false, initialOffset, endOffset, tags = [], inserted = false, mediaNames = [], settings) {
        super(id, deckName, initialContent, fields, reversed, initialOffset, endOffset, tags, inserted, mediaNames);
        this.modelName = settings.clozeModel;
    }
    getCard(includeId = false) {
        let card = { deckName: this.deckName, modelName: this.modelName, fields: this.fields, tags: this.tags };
        if (includeId) card.id = this.id;
        return card;
    }
    getMedias() {
        let medias = [];
        this.mediaBase64Encoded.forEach((data, i) => {
            medias.push({ filename: this.mediaNames[i], data: data });
        });
        return medias;
    }
    getIdFormat() {
        return "\n<!--anki:" + this.id.toString() + "-->";
    }
}

// =====================================================================================
// 3. ANKI CONNECT CLIENT (Async/Fetch-Based API Wrapper)
// =====================================================================================

class CardParser {
    constructor(regex, settings) {
        this.regex = regex;
        this.settings = settings;
    }

    generateFlashcards(fileContent, deckName, vaultName, fileName, globalTags = []) {
        let isContextAware = this.settings.contextAwareMode;
        let cards = [];
        let headings = Array.from(fileContent.matchAll(this.regex.headingsRegex));
        let encVault = encodeURIComponent(vaultName);
        let encFile = encodeURIComponent(fileName);
        let fileSourceLink = `obsidian://open?vault=${encVault}&file=${encFile}.md`;

        // 1. Create a masked copy of the file content to prevent false matches inside exclusion zones
        let tempChars = Array.from(fileContent);

        function maskRange(start, end) {
            for (let i = start; i < end; i++) {
                if (tempChars[i] !== '\n' && tempChars[i] !== '\r') {
                    tempChars[i] = '\uFFFC';
                }
            }
        }

        // 0. Mask YAML Frontmatter
        let yamlMatches = Array.from(fileContent.matchAll(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/g));
        yamlMatches.forEach(b => maskRange(b.index, b.index + b[0].length));
        let currentContent = tempChars.join("");

        // A. Mask Fenced Code Blocks
        let fencedMatches = Array.from(fileContent.matchAll(/(?:```(?:.*?\n?)+?```)(?:\n|$)/gim));
        fencedMatches.forEach(b => maskRange(b.index, b.index + b[0].length));
        currentContent = tempChars.join("");

        // B. Mask Inline Code Blocks
        let inlineCodeMatches = Array.from(currentContent.matchAll(/`([^`\n]+?)`/g));
        inlineCodeMatches.forEach(b => maskRange(b.index, b.index + b[0].length));
        currentContent = tempChars.join("");

        // C. Mask Multiline Math Blocks
        let mathBlockMatchesExact = Array.from(currentContent.matchAll(/\$\$(.*?)\$\$/gs));
        mathBlockMatchesExact.forEach(b => maskRange(b.index, b.index + b[0].length));
        currentContent = tempChars.join("");

        // D. Mask Inline Math Blocks
        let mathInlineMatches = Array.from(currentContent.matchAll(/\$(.*?)\$/g));
        mathInlineMatches.forEach(b => maskRange(b.index, b.index + b[0].length));
        currentContent = tempChars.join("");

        // Now compute actual exclusion ranges for cloze & separator replacement callbacks
        let codeBlocks = Array.from(fileContent.matchAll(/(?:```(?:.*?\n?)+?```)(?:\n|$)/gim));
        let inlineCodes = Array.from(currentContent.matchAll(/`([^`\n]+?)`/g));
        let mathBlocks = Array.from(currentContent.matchAll(/\$\$(.*?)\$\$/gs));
        let mathInlines = Array.from(currentContent.matchAll(/\$(.*?)\$/g));
        let yamlFrontmatter = Array.from(fileContent.matchAll(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/g));

        let allExclusionBlocks = [...codeBlocks, ...inlineCodes, ...mathBlocks, ...mathInlines, ...yamlFrontmatter].map(b => [b.index, b.index + b[0].length]);

        function isIndexExcluded(index) {
            return allExclusionBlocks.some(eb => index >= eb[0] && index < eb[1]);
        }

        // 1. Spaced Cards
        let spacedMatches = Array.from(currentContent.matchAll(this.regex.cardsSpacedStyle));
        for (let m of spacedMatches) {
            let tagIndex = m.index + m[0].indexOf(m[3]);
            if (isIndexExcluded(tagIndex)) continue;

            let indentLevel = m[1] ? (m[1].trim().length > 0 ? m[1].trim().length : -1) : -1;
            let context = isContextAware ? this.getContext(headings, m.index - 1, indentLevel) : [];

            let m2Start = m.index + m[0].indexOf(m[2]);
            let rawFront = fileContent.substring(m2Start, m2Start + m[2].length).trim();
            let finalFront = isContextAware ? [...context, rawFront].join(this.settings.contextSeparator) : rawFront;

            let mediaNames = this.getImageLinks(finalFront).concat(this.getAudioLinks(finalFront));
            finalFront = this.parseLine(finalFront, vaultName);

            let cardTags = this.parseTags(m[4], globalTags);
            let id = m[5] ? Number(m[5]) : -1;
            let inserted = !!m[5];

            let fields = { Prompt: finalFront };
            if (this.settings.sourceSupport) fields.Source = fileSourceLink;

            cards.push(new SpacedCard(id, deckName, rawFront, fields, false, m.index, m.index + m[0].length, cardTags, inserted, mediaNames, this.settings));
        }

        // 2. Cloze Cards
        let clozeMatches = Array.from(currentContent.matchAll(this.regex.cardsClozeWholeLine));
        for (let m of clozeMatches) {
            let indentLevel = m[1] ? (m[1].trim().length > 0 ? m[1].trim().length : -1) : -1;
            let context = isContextAware ? this.getContext(headings, m.index - 1, indentLevel) : [];

            let m2Start = m.index + m[0].indexOf(m[2]);
            let rawFront = fileContent.substring(m2Start, m2Start + m[2].length);

            // Shield code blocks, inline code, and math blocks inside rawFront using placeholders
            let placeholders = [];
            let placeholderCounter = 0;
            function store(block) {
                const ph = `\uFFFCPLH${placeholderCounter++}\uFFFC`;
                placeholders.push({ placeholder: ph, content: block });
                return ph;
            }

            let maskedFront = rawFront;
            maskedFront = maskedFront.replace(/(?:```(?:.*?\n?)+?```)(?:\n|$)/gim, store);
            maskedFront = maskedFront.replace(/`([^`\n]+?)`/g, store);
            maskedFront = maskedFront.replace(/\$\$(.*?)\$\$/gs, store);
            maskedFront = maskedFront.replace(/\$(.*?)\$/g, store);

            let withClozeText = maskedFront.replace(this.regex.singleClozeCurly, (full, brace, clozeIdx, value) => {
                return clozeIdx ? `{{c${clozeIdx}::${value}}}` : `{{c1::${value}}}`;
            });

            withClozeText = withClozeText.replace(this.regex.singleClozeHighlight, (full, brace, value) => {
                return `{{c1::${value}}}`;
            });

            // Restore shielded blocks
            for (let i = placeholders.length - 1; i >= 0; i--) {
                const ph = placeholders[i];
                withClozeText = withClozeText.replace(ph.placeholder, () => ph.content);
            }

            if (withClozeText === rawFront) continue;

            let rawFrontTrimmed = rawFront.trim();
            let finalFront = isContextAware ? [...context, withClozeText.trim()].join(this.settings.contextSeparator) : withClozeText.trim();

            let mediaNames = this.getImageLinks(finalFront).concat(this.getAudioLinks(finalFront));
            finalFront = this.parseLine(finalFront, vaultName);

            let cardTags = this.parseTags(m[4], globalTags);
            let id = m[5] ? Number(m[5]) : -1;
            let inserted = !!m[5];

            let fields = { Text: finalFront, Extra: "" };
            if (this.settings.sourceSupport) fields.Source = fileSourceLink;

            cards.push(new ClozeCard(id, deckName, rawFrontTrimmed, fields, false, m.index, m.index + m[0].length, cardTags, inserted, mediaNames, this.settings));
        }

        // 3. Inline Cards
        let inlineMatches = Array.from(currentContent.matchAll(this.regex.cardsInlineStyle));
        for (let m of inlineMatches) {
            if (m[2].toLowerCase().startsWith("cards-deck") || m[2].toLowerCase().startsWith("tags")) continue;

            let separatorIndex = m.index + m[0].indexOf(m[3]);
            if (isIndexExcluded(separatorIndex)) continue;

            let isReversed = m[3] === this.settings.inlineSeparatorReverse;
            let indentLevel = m[1] ? (m[1].trim().length > 0 ? m[1].trim().length : -1) : -1;
            let context = isContextAware ? this.getContext(headings, m.index - 1, indentLevel) : [];

            let m2Start = m.index + m[0].indexOf(m[2]);
            let rawFront = fileContent.substring(m2Start, m2Start + m[2].length).trim();
            let finalFront = isContextAware ? [...context, rawFront].join(this.settings.contextSeparator) : rawFront;

            let m4Start = m.index + m[0].indexOf(m[4]);
            let rawBack = fileContent.substring(m4Start, m4Start + m[4].length).trim();

            let mediaNames = this.getImageLinks(finalFront).concat(this.getImageLinks(rawBack)).concat(this.getAudioLinks(rawBack));
            finalFront = this.parseLine(finalFront, vaultName);
            let finalBack = this.parseLine(rawBack, vaultName);

            let cardTags = this.parseTags(m[5], globalTags);
            let id = m[6] ? Number(m[6]) : -1;
            let inserted = !!m[6];

            let fields = { Front: finalFront, Back: finalBack };
            if (this.settings.sourceSupport) fields.Source = fileSourceLink;

            cards.push(new InlineCard(id, deckName, rawFront, fields, isReversed, m.index, m.index + m[0].length, cardTags, inserted, mediaNames, this.settings));
        }

        // 4. Multiline tagged cards (#card)
        let tagMatches = Array.from(currentContent.matchAll(this.regex.flashscardsWithTag));
        for (let m of tagMatches) {
            let tagIndex = m.index + m[0].indexOf(m[3]);
            if (isIndexExcluded(tagIndex)) continue;

            let isReversed = m[3].trim().toLowerCase() === `#${this.settings.flashcardsTag}-reverse` || m[3].trim().toLowerCase() === `#${this.settings.flashcardsTag}/reverse`;
            let indentLevel = m[1].trim().length > 0 ? m[1].length : -1;
            let context = isContextAware ? this.getContext(headings, m.index - 1, indentLevel) : [];

            let m2Start = m.index + m[0].indexOf(m[2]);
            let rawFrontLine = fileContent.substring(m2Start, m2Start + m[2].length).trim();
            // If multilineCards is enabled, extend rawFront backward to include preceding non-empty lines
            let rawFront = this.settings.multilineCards
                ? this.getMultilineFront(fileContent, m.index, rawFrontLine)
                : rawFrontLine;
            let finalFront = isContextAware ? [...context, rawFront].join(this.settings.contextSeparator) : rawFront;

            let m5Start = m.index + m[0].indexOf(m[5]);
            let rawBack = fileContent.substring(m5Start, m5Start + m[5].length).trim();

            let mediaNames = this.getImageLinks(finalFront).concat(this.getImageLinks(rawBack)).concat(this.getAudioLinks(rawBack));
            finalFront = this.parseLine(finalFront, vaultName);
            rawBack = this.parseLine(rawBack, vaultName);

            let cardTags = this.parseTags(m[4], globalTags);
            let id = m[6] ? Number(m[6]) : -1;
            let inserted = !!m[6];

            let fields = { Front: finalFront, Back: rawBack };
            if (this.settings.sourceSupport) fields.Source = fileSourceLink;

            cards.push(new MultilineCard(id, deckName, rawFront, fields, isReversed, m.index, m.index + m[0].length, cardTags, inserted, mediaNames, this.settings));
        }

        cards.sort((a, b) => a.endOffset - b.endOffset);

        let defaultTag = this.settings.defaultAnkiTag;
        if (defaultTag) {
            for (let c of cards) {
                if (!c.tags.includes(defaultTag)) c.tags.push(defaultTag);
            }
        }

        return cards;
    }

    getContext(headings, activeIndex, indentLevel) {
        let context = [];
        let currentLevel = 7;

        for (let i = headings.length - 1; i >= 0; i--) {
            let h = headings[i];
            if (h.index < activeIndex) {
                let level = h[1].length;
                if (level < currentLevel) {
                    context.unshift(h[2].trim());
                    currentLevel = level;
                    activeIndex = h.index;
                }
            }
        }
        return context;
    }

    parseLine(text, vaultName) {
        return MDFormatter.makeHtml(text, vaultName);
    }

    getImageLinks(text) {
        let i = text.matchAll(this.regex.wikiImageLinks);
        let g = text.matchAll(this.regex.markdownImageLinks);
        let matches = [];
        for (let m of i) matches.push(m[1]);
        for (let m of g) matches.push(decodeURIComponent(m[1]));
        return matches;
    }

    getAudioLinks(text) {
        let i = text.matchAll(this.regex.wikiAudioLinks);
        let matches = [];
        for (let m of i) matches.push(m[1]);
        return matches;
    }

    parseTags(tagString, globalTags) {
        let tags = [...globalTags];
        if (tagString) {
            for (let t of tagString.split("#")) {
                let trimmed = t.trim();
                if (trimmed) {
                    trimmed = trimmed.replace(this.regex.tagHierarchy, "::");
                    if (!tags.includes(trimmed)) tags.push(trimmed);
                }
            }
        }
        return tags;
    }

    getAnkiIDsBlocks(fileContent) {
        return Array.from(fileContent.matchAll(/(?:\^|<!--anki:)(\d{13})(?:-->)?/gm));
    }

    getCardsToDelete(fileContent) {
        return Array.from(fileContent.matchAll(this.regex.cardsToDelete)).map(m => Number(m[1]));
    }

    // When multilineFront is enabled, scan backward from the #card match position
    // to collect all consecutive non-empty lines above it (until an empty line,
    // YAML frontmatter boundary, Anki ID block, or another card tag is found).
    getMultilineFront(fileContent, cardMatchIndex, singleLineFront) {
        let lines = [singleLineFront];
        let pos = cardMatchIndex - 1;

        // Skip newlines immediately before the matched card line
        while (pos >= 0 && (fileContent[pos] === '\n' || fileContent[pos] === '\r')) {
            pos--;
        }

        while (pos >= 0) {
            // Find the start of the preceding line by scanning backward
            let lineEnd = pos;
            while (pos >= 0 && fileContent[pos] !== '\n') {
                pos--;
            }
            let lineStart = pos + 1;
            let line = fileContent.substring(lineStart, lineEnd + 1).trim();

            // Stop at: empty lines, YAML frontmatter boundary, Anki ID blocks, another card tag
            if (line === '' || line === '---') break;
            if (/<!--anki:\d{13}-->/.test(line) || /\^\d{13}/.test(line)) break;
            if (new RegExp('#' + this.settings.flashcardsTag + '(?:[\\/-]\\S+)?\\s*$').test(line)) break;

            lines.unshift(line);
            pos--; // move past the \n
        }

        return lines.join('\n');
    }
}

// =====================================================================================
// 6. CORE SYNCHRONIZATION PIPELINE ENGINE
// =====================================================================================


class ApkgExporter {
    constructor(app, settings) {
        this.app = app;
        this.settings = settings;
    }

    async export(cards, deckName) {
        const adapter = this.app.vault.adapter;
        const pluginPath = this.app.vault.configDir + "/plugins/flashcards-extended-mobile";

        if (!window.initSqlJs) {
            const sqlJsCode = await adapter.read(pluginPath + "/sql-asm.js");
            const m = { exports: {} };
            const initSqlJsFn = new Function("module", "exports", sqlJsCode + "; return module.exports;");
            window.initSqlJs = initSqlJsFn(m, m.exports);
        }
        const SQL = await window.initSqlJs();

        const jszipCode = await adapter.read(pluginPath + "/jszip.min.js");
        const initJSZip = new Function(jszipCode + "; return JSZip;");
        const JSZip = initJSZip();

        const db = new SQL.Database();
        
        db.run(`
          CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
          CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
          CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
          CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
          CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
          CREATE INDEX ix_notes_usn ON notes (usn);
          CREATE INDEX ix_cards_usn ON cards (usn);
          CREATE INDEX ix_revlog_usn ON revlog (usn);
          CREATE INDEX ix_cards_nid ON cards (nid);
          CREATE INDEX ix_cards_sched ON cards (did, queue, due);
          CREATE INDEX ix_revlog_cid ON revlog (cid);
          CREATE INDEX ix_notes_csum ON notes (csum);
        `);

        const crt = Math.floor(Date.now() / 1000);
        const modTimestamp = Date.now();
        const deckId = 1500000000000 + Math.floor(Math.random() * 100000000);

        const decks = {
            "1": { "id": 1, "mod": crt, "name": "Default", "usn": 0, "lrnToday": [0, 0], "revToday": [0, 0], "newToday": [0, 0], "timeToday": [0, 0], "collapsed": true, "browserCollapsed": true, "desc": "", "dyn": 0, "conf": 1, "extendNew": 0, "extendRev": 0, "reviewLimit": null, "newLimit": null, "reviewLimitToday": null, "newLimitToday": null, "desiredRetention": null }
        };
        decks[deckId.toString()] = { "id": deckId, "mod": crt, "name": deckName, "usn": 0, "lrnToday": [0, 0], "revToday": [0, 0], "newToday": [0, 0], "timeToday": [0, 0], "collapsed": false, "browserCollapsed": false, "desc": "", "dyn": 0, "conf": 1, "extendNew": 0, "extendRev": 0, "reviewLimit": null, "newLimit": null, "reviewLimitToday": null, "newLimitToday": null, "desiredRetention": null };

        const dconf = {
            "1": { "id": 1, "mod": crt, "name": "Default", "usn": 0, "maxTaken": 60, "autoplay": true, "timer": 0, "replayq": true, "new": { "bury": false, "delays": [1.0, 10.0], "initialFactor": 2500, "ints": [1, 4, 0], "order": 1, "perDay": 20 }, "rev": { "bury": false, "ease4": 1.3, "ivlFct": 1.0, "maxIvl": 36500, "perDay": 200, "hardFactor": 1.2 }, "lapse": { "delays": [10.0], "leechAction": 1, "leechFails": 8, "minInt": 1, "mult": 0.0 }, "dyn": false, "newMix": 0, "newPerDayMinimum": 0, "interdayLearningMix": 0, "reviewOrder": 0, "newSortOrder": 0, "newGatherPriority": 0, "buryInterdayLearning": false, "fsrsWeights": [], "fsrsParams5": [], "fsrsParams6": [], "desiredRetention": 0.9, "ignoreRevlogsBeforeDate": "", "easyDaysPercentages": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], "stopTimerOnAnswer": false, "secondsToShowQuestion": 0.0, "secondsToShowAnswer": 0.0, "questionAction": 0, "answerAction": 0, "waitForAudio": true, "sm2Retention": 0.9, "weightSearch": "" }
        };

        const conf = { "estTimes": true, "schedVer": 2, "addToCur": true, "creationOffset": -120, "curModel": 1600000000001, "newSpread": 0, "nextPos": 2, "activeDecks": [1, deckId], "dayLearnFirst": false, "curDeck": deckId, "sortType": "noteFld", "timeLim": 0, "collapseTime": 1200, "sched2021": true, "dueCounts": true, "sortBackwards": false };

        const css = this.settings.customCss || `body {
    background-color: #000000;
    margin: 0;
    padding: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
}
.card {
    background-color: #000000;
    color: #ffffff;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 22px;
    text-align: center;
    line-height: 1.6;
    border: 1px solid #ffffff;
    border-radius: 15px;
    padding: 30px;
    width: 80%;
    max-width: 600px;
    margin: auto;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(255, 255, 255, 0.15);
}
.source-link {
    color: #a0a0a0;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    transition: color 0.35s, transform 0.35s;
}
.source-link:hover {
    color: #3b82f6;
    transform: scale(1.05);
}
b, strong {
    color: #FF005E;
    text-shadow: 0 0 8px rgba(255, 0, 94, 0.6), 0 0 15px rgba(255, 0, 94, 0.4);
}
i, em {
    color: #5EFF00;
    text-shadow: 0 0 8px rgba(94, 255, 0, 0.6), 0 0 15px rgba(94, 255, 0, 0.4);
}
b i, strong em, i b, em strong {
    color: #005EFF;
    text-shadow: 0 0 8px rgba(0, 94, 255, 0.6), 0 0 20px rgba(0, 94, 255, 0.5);
}

/* TTS */
.solo-desktop, .solo-mobile {
    display: none;
}
.desktop .solo-desktop {
    display: block;
}
.mobile .solo-mobile {
    display: block;
}`;

        const sourceSupport = this.settings.sourceSupport;
        const sourceFieldHtml = sourceSupport ? `\n\n{{#Source}}\n<br><br>\n<a href="{{Source}}" class="source-link" title="Source">\n<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-origami-icon lucide-origami"><path d="M12 12V4a1 1 0 0 1 1-1h6.297a1 1 0 0 1 .651 1.759l-4.696 4.025"/><path d="m12 21-7.414-7.414A2 2 0 0 1 4 12.172V6.415a1.002 1.002 0 0 1 1.707-.707L20 20.009"/><path d="m12.214 3.381 8.414 14.966a1 1 0 0 1-.167 1.199l-1.168 1.163a1 1 0 0 1-.706.291H6.351a1 1 0 0 1-.625-.219L3.25 18.8a1 1 0 0 1 .631-1.781l4.165.027"/></svg>\n</a>\n<script>\n    (function() {\n        var link = document.querySelector('.source-link');\n        if (link) {\n            var href = link.getAttribute('href');\n            if (href) {\n                var match = href.match(/[?&]file=([^&]+)/);\n                if (match) {\n                    var file = decodeURIComponent(match[1]);\n                    if (file.endsWith('.md')) {\n                        file = file.substring(0, file.length - 3);\n                    }\n                    var noteName = file.split('/').pop();\n                    link.setAttribute('title', noteName);\n                }\n            }\n        }\n    })();\n</script>\n{{/Source}}` : "";

        const front = `{{Front}}\n{{tts it_IT speed=1.2:Front}}`;
        const back = `{{FrontSide}}\n<hr id=answer>\n{{Back}}${sourceFieldHtml}\n{{tts it_IT speed=1.2:Back}}`;
        const frontReversed = `{{Back}}\n{{tts it_IT speed=1.2:Back}}`;
        const backReversed = `{{FrontSide}}\n<hr id=answer>\n{{Front}}${sourceFieldHtml}\n{{tts it_IT speed=1.2:Front}}`;
        const promptFront = `{{Prompt}}\n{{tts it_IT speed=1.2:Prompt}}`;
        const promptBack = `{{FrontSide}}\n<hr id=answer>🧠 Review done.${sourceFieldHtml}`;
        const clozeFront = `{{cloze:Text}}\n{{tts it_IT speed=1.2:Text}}`;
        const clozeBack = `{{cloze:Text}}\n<br>{{Extra}}${sourceFieldHtml}\n{{tts it_IT speed=1.2:Text}}`;

        let models = {};
        
        // 1. Fallback: Generazione deterministica per TUTTI i modelli
        const classicFields = ["Front", "Back"];
        if (sourceSupport) classicFields.push("Source");
        const promptFields = ["Prompt"];
        if (sourceSupport) promptFields.push("Source");
        const clozeFields = ["Text", "Extra"];
        if (sourceSupport) clozeFields.push("Source");

        const modelConfigs = [
            { id: 1779801336249, name: this.settings.basicModel || "Obsidian-basic", fields: classicFields, tmpls: [{ name: "Front / Back", ord: 0, qfmt: front, afmt: back }], type: 0 },
            { id: 1779713593654, name: this.settings.reversedModel || "Obsidian-basic-reversed", fields: classicFields, tmpls: [{ name: "Front / Back", ord: 0, qfmt: front, afmt: back }, { name: "Back / Front", ord: 1, qfmt: frontReversed, afmt: backReversed }], type: 0 },
            { id: 1779713593663, name: this.settings.clozeModel || "Obsidian-cloze", fields: clozeFields, tmpls: [{ name: "Cloze", ord: 0, qfmt: clozeFront, afmt: clozeBack }], type: 1 },
            { id: 1779713593659, name: this.settings.spacedModel || "Obsidian-spaced", fields: promptFields, tmpls: [{ name: "Spaced", ord: 0, qfmt: promptFront, afmt: promptBack }], type: 0 }
        ];

        const generateDeterministicId = (modelId, name, type) => {
            let str = modelId.toString() + type + name;
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = (hash << 5) - hash + str.charCodeAt(i);
                hash |= 0;
            }
            return Math.abs(hash) + 1000000000;
        };

        for (const conf of modelConfigs) {
            models[conf.id.toString()] = {
                "id": conf.id, "name": conf.name, "type": conf.type, "mod": 0, "usn": 0, "css": css, "sortf": 0,
                "flds": conf.fields.map((f, i) => ({ "name": f, "ord": i, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "description": "", "plainText": false, "collapsed": false, "excludeFromSearch": false, "id": generateDeterministicId(conf.id, f, "fld"), "tag": null, "preventDeletion": false, "media": [] })),
                "tmpls": conf.tmpls.map(t => ({ "name": t.name, "ord": t.ord, "qfmt": t.qfmt, "afmt": t.afmt, "bqfmt": "", "bafmt": "", "did": null, "bfont": "", "bsize": 0, "id": generateDeterministicId(conf.id, t.name, "tmpl") })),
                "tags": [], "did": deckId, "req": [[0, "any", [0]]], "originalStockKind": 1
            };
        }

        // 2. DNA Merge: Sovrascrive i fallback con il vero DNA recuperato da Anki se esiste
        if (this.settings.ankiModelsDna && Object.keys(this.settings.ankiModelsDna).length > 0) {
            for (let dnaMid in this.settings.ankiModelsDna) {
                let dnaModel = Object.assign({}, this.settings.ankiModelsDna[dnaMid]);
                let replacedId = null;
                for (let fallbackMid in models) {
                    if (models[fallbackMid].name === dnaModel.name) {
                        replacedId = fallbackMid;
                        break;
                    }
                }
                if (replacedId) {
                    let fallbackModel = models[replacedId];
                    // Se dnaModel è "parziale" (proveniente dal Desktop tramite AnkiConnect), lo arricchiamo!
                    if (!dnaModel.tmpls) dnaModel.tmpls = fallbackModel.tmpls;
                    if (dnaModel.type === undefined) dnaModel.type = fallbackModel.type;
                    if (dnaModel.mod === undefined) dnaModel.mod = fallbackModel.mod;
                    if (dnaModel.usn === undefined) dnaModel.usn = fallbackModel.usn;
                    if (dnaModel.sortf === undefined) dnaModel.sortf = fallbackModel.sortf;
                    if (dnaModel.did === undefined) dnaModel.did = fallbackModel.did;
                    if (!dnaModel.tags) dnaModel.tags = fallbackModel.tags;
                    if (!dnaModel.css) dnaModel.css = fallbackModel.css;
                    if (!dnaModel.req) dnaModel.req = fallbackModel.req;
                    if (dnaModel.originalStockKind === undefined) dnaModel.originalStockKind = fallbackModel.originalStockKind;
                    
                    if (dnaModel.flds) {
                        dnaModel.flds = dnaModel.flds.map((f, i) => {
                            let fbFld = fallbackModel.flds[i] || {};
                            return {
                                name: f.name || fbFld.name,
                                ord: f.ord !== undefined ? f.ord : i,
                                sticky: f.sticky !== undefined ? f.sticky : false,
                                rtl: f.rtl !== undefined ? f.rtl : false,
                                font: f.font || fbFld.font || "Arial",
                                size: f.size || fbFld.size || 20,
                                description: f.description || "",
                                plainText: f.plainText !== undefined ? f.plainText : false,
                                collapsed: f.collapsed !== undefined ? f.collapsed : false,
                                excludeFromSearch: f.excludeFromSearch !== undefined ? f.excludeFromSearch : false,
                                id: f.id || fbFld.id || generateDeterministicId(dnaModel.id, f.name, "fld"),
                                tag: f.tag || null,
                                preventDeletion: f.preventDeletion !== undefined ? f.preventDeletion : false,
                                media: f.media || []
                            };
                        });
                    } else {
                        dnaModel.flds = fallbackModel.flds;
                    }

                    delete models[replacedId]; // Rimuovi il fallback clonato
                }
                models[dnaMid] = dnaModel; // Inserisci il modello reale dal DNA
            }
        }

        let modelsStr = JSON.stringify(models);
        // RIPRISTINO INTERI 64-BIT PROTETTI
        // I numeri oltre le 15 cifre erano stati salvati come stringhe. Li rimettiamo come numeri raw nel JSON.
        modelsStr = modelsStr.replace(/"id":\s*"(-?\d{15,})"/g, '"id": $1');

        db.run(
            `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [ 1, crt, modTimestamp, modTimestamp, 11, 0, 0, 0, JSON.stringify(conf), modelsStr, JSON.stringify(decks), JSON.stringify(dconf), "{}" ]
        );

        const stripHTML = (html) => html.replace(/<[^>]*>/g, "").trim();
        const getChecksum = (str) => { let hash = 0; for (let i = 0; i < str.length; i++) { hash = (hash << 5) - hash + str.charCodeAt(i); hash |= 0; } return Math.abs(hash); };
        const generateGuid = () => { const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let result = ""; for (let i = 0; i < 10; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); } return result; };

        const mediaMap = {};
        const mediaFiles = {};
        let mediaCounter = 0;

        let addedCount = 0;

        for (const card of cards) {
            let mid = null;
            for (const mId in models) { if (models[mId].name === card.modelName) { mid = Number(mId); break; } }
            if (mid === null) {
                // Se per qualche motivo strano non lo trova, assegniamo il basic
                for (const mId in models) { if (models[mId].name.includes("basic")) { mid = Number(mId); break; } }
            }

            let fldsList = [];
            const targetModel = models[mid.toString()];
            if (targetModel && targetModel.flds) {
                // Generazione dinamica esatta basata sull'ordine e sui nomi del DNA di Anki
                for (const f of targetModel.flds) {
                    let fieldVal = "";
                    if (card instanceof ClozeCard && f.name === "Text") fieldVal = card.fields["Text"] || "";
                    else if (card instanceof ClozeCard && f.name === "Extra") fieldVal = card.fields["Extra"] || "";
                    else if (card instanceof SpacedCard && f.name === "Prompt") fieldVal = card.fields["Prompt"] || "";
                    else if (f.name === "Front") fieldVal = card.fields["Front"] || "";
                    else if (f.name === "Back") fieldVal = card.fields["Back"] || "";
                    else if (f.name === "Source") fieldVal = card.fields["Source"] || "";
                    fldsList.push(fieldVal);
                }
            } else {
                // Fallback (non dovrebbe mai scattare)
                fldsList = [card.fields["Front"] || card.fields["Prompt"] || card.fields["Text"], card.fields["Back"] || card.fields["Extra"] || ""];
            }

            const flds = fldsList.join("\x1f");
            const sfld = stripHTML(fldsList[0]);
            const csum = getChecksum(sfld);
            const guid = generateGuid();

            card.mediaBase64Encoded.forEach((data, idx) => {
                const originalName = card.mediaNames[idx];
                if (!mediaMap[originalName]) {
                    const indexStr = mediaCounter.toString();
                    mediaMap[originalName] = indexStr;
                    mediaFiles[indexStr] = data;
                    mediaCounter++;
                }
            });

            db.run(`INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [ card.id, guid, mid, crt, -1, " " + card.tags.join(" ") + " ", flds, sfld, csum, 0, "" ]
            );

            const numCards = card.reversed ? 2 : 1;
            for (let ord = 0; ord < numCards; ord++) {
                addedCount++;
                db.run(`INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [ card.id + ord, card.id, deckId, ord, crt, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "" ]
                );
            }
        }

        const dbBinary = db.export();
        db.close();

        const zip = new JSZip();
        zip.file("collection.anki2", dbBinary);
        zip.file("collection.anki21", dbBinary); // Anki 2.1 Compatible Mode uses anki21 without Zstd

        
        const mediaManifest = {};
        for (const originalName in mediaMap) {
            const indexStr = mediaMap[originalName];
            mediaManifest[indexStr] = originalName;
            const base64Data = mediaFiles[indexStr];
            const binaryString = window.atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
            zip.file(indexStr, bytes.buffer);
        }
        zip.file("media", JSON.stringify(mediaManifest));

        const blob = await zip.generateAsync({ type: "blob", mimeType: "application/apkg" });
        return { blob, addedCount };
    }
}



const { Plugin, Notice, Setting, PluginSettingTab, parseFrontMatterEntry, addIcon } = require("obsidian");

const parseFME = parseFrontMatterEntry || ((fm, key) => fm ? fm[key] : undefined);

const DEFAULT_SETTINGS = {
    contextAwareMode: true,
    folderBasedDeck: true,
    deck: "Default",
    inlineID: false,
    contextSeparator: " > ",
    flashcardsTag: "card",
    inlineSeparator: "::",
    inlineSeparatorReverse: ":::",
    defaultAnkiTag: "obsidian"
};

class ObsidianFlashcard extends Plugin {
    async onload() {
        addIcon("mobile-icon", `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-smartphone-icon lucide-smartphone"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/><path d="M 13.265 12.829 C 12.046 11.997 12.064 12.003 10.859 12.829 C 9.875 13.503 9.29 13.072 9.637 11.942 C 10.067 10.544 10.088 10.521 8.894 9.653 C 7.914 8.941 8.175 8.235 9.363 8.214 C 10.815 8.195 11.131 7.35 11.315 6.793 C 11.69 5.661 12.443 5.668 12.822 6.797 C 13.291 8.19 13.309 8.209 14.763 8.209 C 15.956 8.209 16.226 8.925 15.238 9.641 C 14.061 10.496 14.063 10.5 14.492 11.936 C 14.839 13.096 14.247 13.495 13.265 12.829" transform="matrix(0.965926, -0.258819, 0.258819, 0.965926, 0, 0)" transform-origin="12.068 9.549" /></svg>`);

        let localData = await this.loadData() || {};
        this.settings = Object.assign({}, DEFAULT_SETTINGS, localData);
        try {
            const desktopConfigPath = this.app.vault.configDir + "/plugins/flashcards-extended/data.json";
            if (await this.app.vault.adapter.exists(desktopConfigPath)) {
                const desktopData = await this.app.vault.adapter.read(desktopConfigPath);
                const desktopSettings = JSON.parse(desktopData);
                this.settings = Object.assign(this.settings, desktopSettings);
                console.log("Forced desktop settings for parity:", desktopSettings);
            }
        } catch(e) {
            console.error("Could not load desktop settings", e);
        }
        this.addSettingTab(new FlashcardsSettingTab(this.app, this));

        this.addCommand({
            id: 'export-flashcards-current-file',
            name: 'Export flashcards to APKG (current file)',
            checkCallback: (checking) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile) {
                    if (!checking) {
                        this.exportCards(activeFile);
                    }
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'remove-ids-current-file',
            name: 'Remove Anki IDs from current file',
            checkCallback: (checking) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile) {
                    if (!checking) {
                        this.removeIds(activeFile);
                    }
                    return true;
                }
                return false;
            }
        });

        this.addRibbonIcon('mobile-icon', 'Export flashcards to APKG', () => {
            const activeFile = this.app.workspace.getActiveFile();
            if (activeFile) {
                this.exportCards(activeFile);
            } else {
                new Notice("Open a file before exporting.");
            }
        });
    }

    async removeIds(file) {
        let content = await this.app.vault.read(file);
        let newContent = content.replace(/<!--anki:\d+-->/g, "").replace(/\^\d{13}/g, "");
        if (newContent !== content) {
            await this.app.vault.modify(file, newContent);
            new Notice("Removed Anki IDs from the file.");
        } else {
            new Notice("No Anki IDs found in the file.");
        }
    }

    async generateMediaLinks(cards, filePath) {
        function arrayBufferToBase64(buffer) {
            var binary = '';
            var bytes = new Uint8Array(buffer);
            var len = bytes.byteLength;
            for (var i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); }
            return window.btoa(binary);
        }

        const promises = [];

        for (let c of cards) {
            const cardPromises = c.mediaNames.map(async (m) => {
                let file = this.app.metadataCache.getFirstLinkpathDest(decodeURIComponent(m), filePath);
                if (file) {
                    try {
                        let content = await this.app.vault.readBinary(file);
                        return arrayBufferToBase64(content);
                    } catch (e) {
                        console.error(`Flashcards: Could not read media file ${m}:`, e);
                        return null;
                    }
                }
                return null;
            });

            promises.push(
                Promise.all(cardPromises).then(results => {
                    for (const res of results) {
                        if (res !== null) {
                            c.mediaBase64Encoded.push(res);
                        }
                    }
                })
            );
        }

        await Promise.all(promises);
    }

    parseGlobalTags(fileContent, file) {
        let tags = [];
        if (file && this.app && this.app.metadataCache) {
            const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
            if (frontmatter) {
                const cardsTags = frontmatter["cards-tags"];
                if (cardsTags) {
                    let rawList = [];
                    if (Array.isArray(cardsTags)) {
                        rawList = cardsTags;
                    } else if (typeof cardsTags === "string") {
                        rawList = cardsTags.split(/[,\s]+/).filter(Boolean);
                    }
                    
                    for (let t of rawList) {
                        let clean = t.toString()
                            .replace("#", "")
                            .replace(/\//g, "::")
                            .replace(/\[\[(.*)\]\]/, "$1")
                            .trim()
                            .replace(/ /g, "-");
                        if (clean && !tags.includes(clean)) {
                            tags.push(clean);
                        }
                    }
                    return tags;
                }
            }
        }

        // Fallback to manual parsing if file/metadataCache is not available (only for cards-tags!)
        let match = fileContent.match(/cards-tags: ?(.*)/im);
        if (match) {
            let yamlRest = fileContent.substring(match.index + match[0].length);
            let listLines = [];
            if (match[1].trim().startsWith("[")) {
                let inlineMatch = match[1].match(/\[(.*?)\]/);
                if (inlineMatch) {
                    listLines = inlineMatch[1].split(/[,\s]+/).filter(Boolean);
                }
            } else if (match[1].trim()) {
                listLines = match[1].split(/[,\s]+/).filter(Boolean);
            } else {
                let lines = yamlRest.split(/\r?\n/);
                for (let line of lines) {
                    if (line.trim().startsWith("-")) {
                        listLines.push(line.replace(/^\s*-\s*/, "").trim());
                    } else if (line.trim() === "" || line.includes(":") || line.trim() === "---") {
                        break;
                    }
                }
            }

            for (let t of listLines) {
                let clean = t.replace("#", "")
                    .replace(/\//g, "::")
                    .replace(/\[\[(.*)\]\]/, "$1")
                    .trim()
                    .replace(/ /g, "-");
                if (clean && !tags.includes(clean)) {
                    tags.push(clean);
                }
            }
        }
        return tags;
    }

    async exportCards(file) {
        try {
            const regex = new RegexRules(this.settings);
            const parser = new CardParser(regex, this.settings);
            
            let fileContent = await this.app.vault.read(file);
            if (!fileContent.endsWith("\n")) fileContent += "\n";

            let deckName = this.settings.deck;
            if (this.settings.folderBasedDeck && file.parent && file.parent.path !== "/" && file.parent.path !== "") {
                deckName = file.parent.path.split("/").join("::");
            }
            const metadata = this.app.metadataCache.getFileCache(file);
            const frontmatter = metadata ? metadata.frontmatter : null;
            if (frontmatter && frontmatter["cards-deck"]) {
                deckName = frontmatter["cards-deck"];
            }

            let globalTags = this.parseGlobalTags(fileContent, file);
            if (this.settings.folderBasedTag && file.parent && file.parent.path !== "/" && file.parent.path !== "") {
                let folderTag = file.parent.path.split("/").join("::").replace(/ /g, "-");
                if (folderTag && !globalTags.includes(folderTag)) {
                    globalTags.push(folderTag);
                }
            }

            let currentCards = parser.generateFlashcards(fileContent, deckName, this.app.vault.getName(), file.basename, globalTags);
            
            let newCards = currentCards.filter(c => !c.inserted);

            if (newCards.length === 0) {
                new Notice("No new cards to export (all cards already have Anki IDs).");
                return;
            }

            await this.generateMediaLinks(newCards, file.path);

            let ts = Date.now();
            for (let c of newCards) {
                c.id = ts;
                ts += 2; 
            }

            const exporter = new ApkgExporter(this.app, this.settings);
            const { blob, addedCount } = await exporter.export(newCards, deckName);

            let safeDeckName = deckName.replace(/[^a-zA-Z0-9_-]/g, "");
            if (!safeDeckName) safeDeckName = "Deck";
            
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            const timestamp = `${yyyy}${mm}${dd}${hh}${min}${ss}`;
            
            const exportPath = `${safeDeckName}_${timestamp}.apkg`;
            
            // Replicando il vecchio script: creiamo il file in modo nativo dentro il vault
            await this.app.vault.createBinary(exportPath, await blob.arrayBuffer());
            
            // Tentiamo di aprire il file appena creato con l'app predefinita (AnkiDroid)
            this.app.openWithDefaultApp(exportPath);
            
            new Notice(`Esportato ${addedCount} carte in ${exportPath} e aperto in AnkiDroid`);

        } catch(e) {
            console.error("Export Error:", e);
            new Notice("Error exporting flashcards: " + e.message);
        }
    }

    async onunload() {
        await this.saveData(this.settings);
    }
}

class FlashcardsSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const {containerEl} = this;
        containerEl.empty();
        containerEl.createEl('h2', {text: 'Flashcards Mobile Exporter Settings'});
        
        new Setting(containerEl)
            .setName('Default Deck')
            .setDesc('Deck to use if not specified')
            .addText(text => text
                .setPlaceholder('Default')
                .setValue(this.plugin.settings.deck)
                .onChange(async (value) => {
                    this.plugin.settings.deck = value;
                    await this.plugin.saveData(this.plugin.settings);
                }));

        containerEl.createEl('h3', {text: 'Sincronizzazione DNA Anki (Anti-Duplicazione)'});
        containerEl.createEl('p', {text: 'Per evitare cloni dei tipi di nota (es. "Obsidian-basic+"), esporta un file .apkg da Anki attivando l\'opzione "Supporta versioni precedenti (Compatible Mode)", poi caricalo qui. Il plugin estrarrà la struttura esatta dei modelli originali.', cls: 'setting-item-description'});
        
        const inputWrap = containerEl.createEl('div', { cls: 'setting-item' });
        inputWrap.style.display = "flex";
        inputWrap.style.alignItems = "center";
        inputWrap.style.gap = "15px";

        const input = inputWrap.createEl('input', { type: 'file', accept: '.apkg' });
        
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const arrayBuffer = await file.arrayBuffer();
                const adapter = this.plugin.app.vault.adapter;
                const pluginPath = this.plugin.app.vault.configDir + "/plugins/flashcards-extended-mobile";
                
                const jszipCode = await adapter.read(pluginPath + "/jszip.min.js");
                const initJSZip = new Function(jszipCode + "; return JSZip;");
                const JSZip = initJSZip();
                
                if (!window.initSqlJs) {
                    const sqlJsCode = await adapter.read(pluginPath + "/sql-asm.js");
                    const m = { exports: {} };
                    const initSqlJsFn = new Function("module", "exports", sqlJsCode + "; return module.exports;");
                    window.initSqlJs = initSqlJsFn(m, m.exports);
                }
                const SQL = await window.initSqlJs();
                
                const zip = await JSZip.loadAsync(arrayBuffer);
                let dbBinary;
                if (zip.files["collection.anki21"]) {
                    dbBinary = await zip.files["collection.anki21"].async("uint8array");
                } else if (zip.files["collection.anki2"]) {
                    dbBinary = await zip.files["collection.anki2"].async("uint8array");
                } else {
                    new Notice("File APKG non valido: nessun database compatibile trovato. Assicurati di esportare in 'Compatible Mode'.");
                    return;
                }
                
                const db = new SQL.Database(dbBinary);
                const res = db.exec("SELECT models FROM col");
                if (res.length > 0 && res[0].values.length > 0) {
                    const modelsStr = res[0].values[0][0];
                    // PREVENZIONE PERDITA PRECISIONE INT 64-BIT JS
                    // Gli id di flds e tmpls in Anki sono a 19 cifre. JS taglia tutto ciò che supera le 16 cifre.
                    const modelsStrSafe = modelsStr.replace(/"id":\s*(-?\d{15,})/g, '"id": "$1"');
                    const allModels = JSON.parse(modelsStrSafe);
                    const obsidianModels = {};
                    for (const mid in allModels) {
                        if (allModels[mid].name && allModels[mid].name.startsWith("Obsidian-")) {
                            obsidianModels[mid] = allModels[mid];
                        }
                    }
                    
                    if (Object.keys(obsidianModels).length > 0) {
                        if (!this.plugin.settings.ankiModelsDna) {
                            this.plugin.settings.ankiModelsDna = {};
                        }
                        let added = 0;
                        for (let k in obsidianModels) {
                            // Rimuoviamo vecchie versioni dello stesso modello se l'ID è cambiato
                            for (let oldK in this.plugin.settings.ankiModelsDna) {
                                if (this.plugin.settings.ankiModelsDna[oldK].name === obsidianModels[k].name) {
                                    delete this.plugin.settings.ankiModelsDna[oldK];
                                }
                            }
                            this.plugin.settings.ankiModelsDna[k] = obsidianModels[k];
                            added++;
                        }
                        await this.plugin.saveData(this.plugin.settings);
                        new Notice(`Perfetto! Sincronizzati o aggiornati con successo ${added} modelli dal DNA di Anki!`);
                    } else {
                        new Notice("Nessun modello che inizia con 'Obsidian-' è stato trovato in questo file.");
                    }
                }
                db.close();
            } catch (err) {
                console.error("Errore import DNA:", err);
                new Notice("Errore durante la lettura dell'APKG: " + err.message);
            }
        });
        
        const resetWrap = containerEl.createEl('div', { cls: 'setting-item' });
        const resetButton = resetWrap.createEl('button', { text: 'Resetta DNA' });
        resetButton.onclick = async () => {
            this.plugin.settings.ankiModelsDna = null;
            await this.plugin.saveData(this.plugin.settings);
            new Notice("DNA cancellato. Il plugin tornerà a usare gli ID generati automaticamente.");
        };
    }
}

module.exports = ObsidianFlashcard;
