const test = require('node:test');
const assert = require('node:assert/strict');
const mockObsidian = { Plugin: class {}, Notice: class {}, Setting: class {}, PluginSettingTab: class {}, parseFrontMatterEntry: () => {}, addIcon: () => {} };
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request) {
  if (request === 'obsidian') return mockObsidian;
  return originalRequire.apply(this, arguments);
};

const { MDFormatter } = require('../main.js');

test('MDFormatter.makeHtml', async (t) => {

    await t.test('handles empty input', () => {
        assert.equal(MDFormatter.makeHtml(''), '');
        assert.equal(MDFormatter.makeHtml(null), '');
        assert.equal(MDFormatter.makeHtml(undefined), '');
    });

    await t.test('converts basic formatting: bold, italic, highlight', () => {
        // Bold
        assert.equal(MDFormatter.makeHtml('**bold**'), '<b>bold</b>');
        assert.equal(MDFormatter.makeHtml('__bold__'), '<b>bold</b>');

        // Italic
        assert.equal(MDFormatter.makeHtml('*italic*'), '<i>italic</i>');
        assert.equal(MDFormatter.makeHtml('_italic_'), '<i>italic</i>');

        // Bold + Italic
        assert.equal(MDFormatter.makeHtml('***bold-italic***'), '<b><i>bold-italic</i></b>');
        assert.equal(MDFormatter.makeHtml('___bold-italic___'), '<b><i>bold-italic</i></b>');
        assert.equal(MDFormatter.makeHtml('**_bold-italic_**'), '<b><i>bold-italic</i></b>');
        assert.equal(MDFormatter.makeHtml('_**bold-italic**_'), '<b><i>bold-italic</i></b>');

        // Highlight
        assert.equal(MDFormatter.makeHtml('==highlight=='), '<mark>highlight</mark>');

        // Mixed
        assert.equal(MDFormatter.makeHtml('Some **bold** and *italic* text.'), 'Some <b>bold</b> and <i>italic</i> text.');
    });

    await t.test('converts headers', () => {
        assert.equal(MDFormatter.makeHtml('# H1 Header'), '<h1>H1 Header</h1>');
        assert.equal(MDFormatter.makeHtml('## H2 Header'), '<h2>H2 Header</h2>');
        assert.equal(MDFormatter.makeHtml('### H3 Header'), '<h3>H3 Header</h3>');
        assert.equal(MDFormatter.makeHtml('#### H4 Header'), '<h4>H4 Header</h4>');
        assert.equal(MDFormatter.makeHtml('##### H5 Header'), '<h5>H5 Header</h5>');
        assert.equal(MDFormatter.makeHtml('###### H6 Header'), '<h6>H6 Header</h6>');

        assert.equal(MDFormatter.makeHtml('#NoSpace'), '#NoSpace');

        assert.equal(MDFormatter.makeHtml('   # Indented H1'), '<h1>Indented H1</h1>');
    });

    await t.test('converts newlines to <br>', () => {
        assert.equal(MDFormatter.makeHtml('Line 1\nLine 2'), 'Line 1<br>Line 2');
        assert.equal(MDFormatter.makeHtml('Line 1\r\nLine 2'), 'Line 1<br>Line 2');

        // Strips trailing <br>
        assert.equal(MDFormatter.makeHtml('Line 1\n'), 'Line 1');
        assert.equal(MDFormatter.makeHtml('Line 1\n\n'), 'Line 1');
    });

    await t.test('protects HTML tags', () => {
        assert.equal(MDFormatter.makeHtml('<span>Hello</span>'), '<span>Hello</span>');
        assert.equal(MDFormatter.makeHtml('<a href="**link**">Hello</a>'), '<a href="**link**">Hello</a>');
    });

    await t.test('handles standard Markdown links', () => {
        assert.equal(MDFormatter.makeHtml('[OpenAI](https://openai.com)'), '<a href="https://openai.com">OpenAI</a>');
        assert.equal(MDFormatter.makeHtml('[Some **bold** text](https://example.com)'), '<a href="https://example.com">Some **bold** text</a>');
    });

    await t.test('handles Obsidian Wikilinks', () => {
        const vaultName = 'MyVault';
        assert.equal(MDFormatter.makeHtml('[[Note Name]]', vaultName), '<a href="obsidian://open?vault=MyVault&file=Note%20Name.md">Note Name</a>');
        assert.equal(MDFormatter.makeHtml('[[Note Name|Custom Alias]]', vaultName), '<a href="obsidian://open?vault=MyVault&file=Note%20Name.md">Custom Alias</a>');
        assert.equal(MDFormatter.makeHtml('[[Note]]', 'Vault With Space'), '<a href="obsidian://open?vault=Vault%20With%20Space&file=Note.md">Note</a>');
    });

    await t.test('handles images', () => {
        // Wikilink images
        assert.equal(MDFormatter.makeHtml('![[image.png]]'), '<img src="image.png">');
        assert.equal(MDFormatter.makeHtml('![[image.jpg]]'), '<img src="image.jpg">');
        assert.equal(MDFormatter.makeHtml('![[image.png|100x100]]'), '<img src="image.png">');

        // Markdown images
        assert.equal(MDFormatter.makeHtml('![](image.png)'), '<img src="image.png">');
        assert.equal(MDFormatter.makeHtml('![](path/to/image.jpg)'), '<img src="path/to/image.jpg">');
    });

    await t.test('handles audio', () => {
        assert.equal(MDFormatter.makeHtml('![[audio.mp3]]'), '[sound:audio.mp3]');
        assert.equal(MDFormatter.makeHtml('![[sound.wav]]'), '[sound:sound.wav]');
    });

    await t.test('protects code blocks', () => {
        const input = '```js\nconsole.log("**bold**");\n```';
        const expected = '<pre><code class="language-js">console.log(&quot;**bold**&quot;);</code></pre>';
        assert.equal(MDFormatter.makeHtml(input), expected);

        const noLang = '```\nplain text\n```';
        const noLangExpected = '<pre><code>plain text</code></pre>';
        assert.equal(MDFormatter.makeHtml(noLang), noLangExpected);
    });

    await t.test('protects inline code', () => {
        assert.equal(MDFormatter.makeHtml('Use `**bold**`'), 'Use <code>**bold**</code>');
        assert.equal(MDFormatter.makeHtml('Code `<script>alert(1)</script>`'), 'Code <code>&lt;script&gt;alert(1)&lt;/script&gt;</code>');
    });

    await t.test('protects math blocks', () => {
        const input = '$$\nE = mc^2\n$$';
        const expected = '<anki-mathjax block="true">E = mc^2</anki-mathjax>';
        assert.equal(MDFormatter.makeHtml(input), expected);
    });

    await t.test('protects inline math', () => {
        const input = 'The formula $E=mc^2$ is famous.';
        const expected = 'The formula <anki-mathjax>E=mc^2</anki-mathjax> is famous.';
        assert.equal(MDFormatter.makeHtml(input), expected);
    });

    await t.test('converts bullet lists', () => {
        const ulInput = '- Item 1\n- Item 2\n- Item 3';
        const expected = '<ul style="text-align: left;"><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';
        assert.equal(MDFormatter.makeHtml(ulInput), expected);
    });

    await t.test('converts numbered lists', () => {
        const olInput = '1. Item 1\n2. Item 2\n3. Item 3';
        const expected = '<ol style="text-align: left;"><li>Item 1</li><li>Item 2</li><li>Item 3</li></ol>';
        assert.equal(MDFormatter.makeHtml(olInput), expected);
    });
});
