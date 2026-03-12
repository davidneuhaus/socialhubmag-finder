import { supabase } from '../lib/supabaseClient';

/**
 * Search magazine pages using Postgres full-text search via Supabase RPC.
 * Returns results with magazine name, page number, text content, and rank.
 */
export async function searchSupabase(query, limit = 50) {
    if (!query || query.trim().length === 0) return [];

    const { data, error } = await supabase.rpc('search_magazine_pages', {
        search_query: query.trim(),
        result_limit: limit,
    });

    if (error) {
        console.error('Supabase search error:', error);
        // Fallback: do a simple ILIKE search
        return fallbackSearch(query, limit);
    }

    return (data || []).map((row) => ({
        id: row.id,
        magazineId: row.magazine_id,
        magazine: row.magazine_name,
        page: row.page_number,
        totalPages: row.total_pages,
        text: row.text_content,
        score: row.rank,
        matchCount: Math.max(1, Math.round(row.rank * 10)),
        snippet: generateSnippet(
            row.text_content,
            query.toLowerCase().split(/\s+/).filter((t) => t.length > 1),
            200
        ),
    }));
}

/**
 * Fallback search using ILIKE when full-text search RPC isn't available.
 */
async function fallbackSearch(query, limit) {
    const { data, error } = await supabase
        .from('magazine_pages')
        .select('id, magazine_id, page_number, text_content, magazines(name, page_count)')
        .ilike('text_content', `%${query}%`)
        .limit(limit);

    if (error) {
        console.error('Fallback search error:', error);
        return [];
    }

    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);

    return (data || []).map((row) => ({
        id: row.id,
        magazineId: row.magazine_id,
        magazine: row.magazines?.name || 'Unknown',
        page: row.page_number,
        totalPages: row.magazines?.page_count || 0,
        text: row.text_content,
        score: 1,
        matchCount: 1,
        snippet: generateSnippet(row.text_content, terms, 200),
    }));
}

/**
 * Generate a text snippet around the first match, with context.
 */
function generateSnippet(text, terms, maxLength) {
    if (!text || terms.length === 0) return text?.substring(0, maxLength) || '';

    const textLower = text.toLowerCase();
    let firstPos = text.length;

    for (const term of terms) {
        const idx = textLower.indexOf(term);
        if (idx !== -1 && idx < firstPos) {
            firstPos = idx;
        }
    }

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
