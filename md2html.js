// md2html.js - A self-executing Markdown to HTML converter
const Md2Html = (function() {
    
    function isExternalUrl(url) {
        return /^https?:\/\//i.test(url) || url.startsWith('magnet:') || url.endsWith('.pdf');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function parseTimestamp(match, dd, mm, yyyy, hh, min) {
        const date = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd),
            hh ? parseInt(hh) : 0, min ? parseInt(min) : 0);
        if (isNaN(date.getTime())) return match;
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        if (hh) { options.hour = '2-digit'; options.minute = '2-digit'; }
        return '<time datetime="' + date.toISOString() + '">' + date.toLocaleString(undefined, options) + '</time>';
    }

    function parseInlineFormatting(text) {
        // Inline code: `code` (process first to protect code content)
        text = text.replace(/`(.*?)`/g, '<code>$1</code>');

        // Timestamp: $$DD.MM.YYYY$$ or $$DD.MM.YYYY@HH.MM$$ → local time
        text = text.replace(/\$\$(\d{2})\.(\d{2})\.(\d{4})(?:@(\d{2})\.(\d{2}))?\$\$/g, parseTimestamp);

        // Spoiler: !!text!! → click to reveal
        text = text.replace(/!!(.*?)!!/g, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');

        // Bold: **text**
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Italic: *text*
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Strikethrough: ~~text~~
        text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');

        // Underline: __text__
        text = text.replace(/__([^_]+?)__/g, '<u>$1</u>');

        // Fill-in blank: __ (2+ underscores with no content between)
        text = text.replace(/_{2,}/g, '<input type="text" style="border:none;border-bottom:2px solid currentColor;min-width:100px;font:inherit;background:transparent;color:inherit;">');

        // Images: ![alt](url) — must come before links
        text = text.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');

        // Links: [text](url) — external links open in new tab
        text = text.replace(/\[(.*?)\]\((.*?)\)/g, function(_, linkText, url) {
            if (isExternalUrl(url)) {
                return `<a href="${url}" target="_blank">${linkText}</a>`;
            }
            return `<a href="${url}">${linkText}</a>`;
        });

        // Checkboxes: [x] checked, [ ] unchecked
        text = text.replace(/\[x\]/gi, '<input type="checkbox" checked>');
        text = text.replace(/\[ \]/g, '<input type="checkbox">');

        // Auto-link bare URLs and magnet links (only after whitespace or start of string)
        text = text.replace(/(^|\s)((?:https?:\/\/|magnet:\?)[^\s<]+)/g, function(_, prefix, url) {
            return `${prefix}<a href="${url}" target="_blank">${url}</a>`;
        });

        return text;
    }

    function md2html(markdownText, options = {}) {
        const {
            wrapInContainer = false,
            containerClass = 'md2html-container'
        } = options;

        let htmlContent = '';
        const lines = markdownText.trim().split(/\r?\n/);
        let inBlockquote = false;
        let inCodeBlock = false;
        let codeBlockContent = '';
        let codeBlockLang = '';
        let inTable = false;
        let tableRows = [];
        function closeOpenBlocks() {
            if (inBlockquote) { htmlContent += '</blockquote>\n'; inBlockquote = false; }
            if (inTable) { flushTable(); }
        }

        function flushTable() {
            if (tableRows.length === 0) return;
            let html = '<table>\n';
            tableRows.forEach((row, i) => {
                const cells = row.split('|').slice(1, -1);
                // Skip separator row (e.g. |---|---|)
                if (i === 1 && cells.every(c => c.trim().match(/^[-:]+$/))) return;
                const tag = i === 0 ? 'th' : 'td';
                html += '<tr>';
                cells.forEach(cell => {
                    html += `<${tag}>${parseInlineFormatting(cell.trim())}</${tag}>`;
                });
                html += '</tr>\n';
            });
            html += '</table>\n';
            htmlContent += html;
            tableRows = [];
            inTable = false;
        }

        lines.forEach(line => {
            let processedLine = '';

            // Fenced code blocks: ```
            if (line.trim().startsWith('```')) {
                if (!inCodeBlock) {
                    closeOpenBlocks();
                    inCodeBlock = true;
                    codeBlockContent = '';
                    codeBlockLang = line.trim().substring(3).trim();
                } else {
                    const langClass = codeBlockLang ? ` class="language-${codeBlockLang}"` : '';
                    processedLine = `<pre><code${langClass}>${escapeHtml(codeBlockContent)}</code></pre>`;
                    inCodeBlock = false;
                    codeBlockContent = '';
                    codeBlockLang = '';
                }
                if (inCodeBlock) return;
                htmlContent += processedLine + '\n';
                return;
            }

            if (inCodeBlock) {
                codeBlockContent += (codeBlockContent ? '\n' : '') + line;
                return;
            }

            // Table rows: | cell | cell |
            if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                if (!inTable) {
                    closeOpenBlocks();
                    inTable = true;
                }
                tableRows.push(line.trim());
                return;
            } else if (inTable) {
                flushTable();
            }

            // Headers
            if (line.startsWith('# ')) {
                closeOpenBlocks();
                processedLine = `<h1>${parseInlineFormatting(line.substring(2))}</h1>`;
            } else if (line.startsWith('## ')) {
                closeOpenBlocks();
                processedLine = `<h2>${parseInlineFormatting(line.substring(3))}</h2>`;
            } else if (line.startsWith('### ')) {
                closeOpenBlocks();
                processedLine = `<h3>${parseInlineFormatting(line.substring(4))}</h3>`;
            } else if (line.startsWith('#### ')) {
                closeOpenBlocks();
                processedLine = `<h4>${parseInlineFormatting(line.substring(5))}</h4>`;
            } else if (line.startsWith('##### ')) {
                closeOpenBlocks();
                processedLine = `<h5>${parseInlineFormatting(line.substring(6))}</h5>`;
            } else if (line.startsWith('###### ')) {
                closeOpenBlocks();
                processedLine = `<h6>${parseInlineFormatting(line.substring(7))}</h6>`;
            }
            // Blockquotes
            else if (line.startsWith('> ') || line.trim() === '>') {
                const content = line.trim() === '>' ? '' : line.substring(2);
                if (!inBlockquote) {
                    processedLine = content
                        ? `<blockquote><p>${parseInlineFormatting(content)}</p>`
                        : '<blockquote>';
                    inBlockquote = true;
                } else if (content) {
                    processedLine = `<p>${parseInlineFormatting(content)}</p>`;
                }
            }
            // Horizontal rule
            else if (line.match(/^[-*]{3,}$/)) {
                closeOpenBlocks();
                processedLine = '<hr>';
            }
            // Empty line - close open blocks or add spacing
            else if (line.trim() === '') {
                if (inBlockquote) {
                    processedLine = '</blockquote>';
                    inBlockquote = false;
                } else {
                    processedLine = '<p>&nbsp;</p>';
                }
            }
            // HTML passthrough: lines starting with < are passed through as-is
            else if (line.trim().match(/^<[a-zA-Z\/]/)) {
                closeOpenBlocks();
                processedLine = line;
            }
            // Regular paragraph
            else {
                processedLine = `<p>${parseInlineFormatting(line)}</p>`;
            }

            htmlContent += processedLine + '\n';
        });

        // Close any open elements at the end
        if (inCodeBlock) {
            const langClass = codeBlockLang ? ` class="language-${codeBlockLang}"` : '';
            htmlContent += `<pre><code${langClass}>${escapeHtml(codeBlockContent)}</code></pre>`;
        }
        if (inBlockquote) htmlContent += '</blockquote>';
        if (inTable) flushTable();

        if (wrapInContainer) {
            return `<div class="${containerClass}">${htmlContent}</div>`;
        }

        return htmlContent;
    }

    // Auto-execute function to process script tags
    function processScriptTags() {
        // Find all script tags with the data-md2html attribute
        const scripts = document.querySelectorAll('script[data-md2html]');

        scripts.forEach(script => {
            const markdownFile = script.getAttribute('data-md2html');
            const wrapInContainer = script.hasAttribute('data-wrap-container');
            const containerClass = script.getAttribute('data-container-class') || 'md2html-container';

            if (markdownFile) {
                // Fetch and parse from file
                fetch(markdownFile)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Failed to load markdown file: ${markdownFile}`);
                        }
                        return response.text();
                    })
                    .then(data => {
                        const htmlContent = md2html(data, {
                            wrapInContainer: wrapInContainer,
                            containerClass: containerClass
                        });

                        const container = document.createElement('div');
                        container.innerHTML = htmlContent;
                        script.parentNode.replaceChild(container, script);

                        console.log(`Markdown content loaded from: ${markdownFile}`);
                    })
                    .catch(error => {
                        console.error('Error loading markdown:', error);
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'md2html-error';
                        errorDiv.innerHTML = `<p>Error loading content: ${error.message}</p>`;
                        script.parentNode.replaceChild(errorDiv, script);
                    });
            } else {
                // Parse inline content from the script tag
                const inlineMarkdown = script.textContent;
                if (inlineMarkdown.trim()) {
                    const htmlContent = md2html(inlineMarkdown, {
                        wrapInContainer: wrapInContainer,
                        containerClass: containerClass
                    });

                    const container = document.createElement('div');
                    container.innerHTML = htmlContent;
                    script.parentNode.replaceChild(container, script);
                }
            }
        });
    }

    // Process div.markdown elements by converting their text content to HTML
    function processMarkdownDivs() {
        const divs = document.querySelectorAll('div.markdown');

        divs.forEach(div => {
            const markdownText = div.textContent;
            if (markdownText.trim()) {
                div.innerHTML = md2html(markdownText);
                div.classList.remove('markdown');
                div.classList.add('markdown-rendered');
            }
        });
    }

    // Process all markdown sources when DOM is ready
    function processAll() {
        processScriptTags();
        processMarkdownDivs();
        // Apply syntax highlighting if highlight.js is loaded
        if (typeof hljs !== 'undefined') {
            hljs.highlightAll();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processAll);
    } else {
        processAll();
    }

    // Public API
    return {
        md2html,
        parseInlineFormatting,
        processScriptTags,
        processMarkdownDivs
    };
})();