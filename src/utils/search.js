/**
 * Search through indexed pages for a query.
 * Returns results sorted by relevance with highlighted snippets.
 */
export function searchPages(pages, query) {
    if (!query || query.trim().length === 0) return [];

    const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 1);

    if (terms.length === 0) return [];

    const results = [];

    for (const page of pages) {
        const textLower = page.text.toLowerCase();
        let score = 0;
        let matchCount = 0;

        for (const term of terms) {
            const regex = new RegExp(escapeRegex(term), 'gi');
            const matches = page.text.match(regex);
            if (matches) {
                score += matches.length;
                matchCount++;
            }
        }

        // Only include if at least one term matches
        if (matchCount === 0) continue;

        // Bonus for matching all terms
        if (matchCount === terms.length) {
            score *= 2;
        }

        // Check for exact phrase match (big bonus)
        if (textLower.includes(query.toLowerCase())) {
            score *= 3;
        }

        const snippet = generateSnippet(page.text, terms, 200);

        results.push({
            ...page,
            score,
            matchCount,
            snippet,
        });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, 50); // Cap at 50 results
}

/**
 * Generate a text snippet around the first match, with context.
 */
function generateSnippet(text, terms, maxLength) {
    const textLower = text.toLowerCase();

    // Find the position of the first matching term
    let firstPos = text.length;
    for (const term of terms) {
        const idx = textLower.indexOf(term);
        if (idx !== -1 && idx < firstPos) {
            firstPos = idx;
        }
    }

    // Calculate snippet window
    const start = Math.max(0, firstPos - 60);
    const end = Math.min(text.length, start + maxLength);
    let snippet = text.slice(start, end).trim();

    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
}

/**
 * Highlight matching terms in a snippet.
 * Returns an array of { text, highlighted } segments.
 */
export function highlightSnippet(snippet, query) {
    if (!query || !snippet) return [{ text: snippet || '', highlighted: false }];

    const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 1);

    if (terms.length === 0) return [{ text: snippet, highlighted: false }];

    // Build a regex that matches any term
    const pattern = terms.map(escapeRegex).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');

    const segments = [];
    let lastIndex = 0;

    snippet.replace(regex, (match, _group, offset) => {
        if (offset > lastIndex) {
            segments.push({ text: snippet.slice(lastIndex, offset), highlighted: false });
        }
        segments.push({ text: match, highlighted: true });
        lastIndex = offset + match.length;
    });

    if (lastIndex < snippet.length) {
        segments.push({ text: snippet.slice(lastIndex), highlighted: false });
    }

    return segments.length > 0 ? segments : [{ text: snippet, highlighted: false }];
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
