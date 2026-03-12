import { highlightSnippet } from '../utils/supabaseSearch';

export default function ResultCard({ result, query, index, isSelected, onClick }) {
    const segments = highlightSnippet(result.snippet, query);

    return (
        <article
            className={`result-card ${isSelected ? 'result-card-selected' : ''}`}
            style={{ animationDelay: `${index * 0.05}s` }}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
        >
            <div className="result-header">
                <div className="result-magazine">
                    <span className="magazine-icon">📖</span>
                    <span className="magazine-name">{result.magazine}</span>
                </div>
                <div className="result-meta">
                    <span className="result-page">
                        Page {result.page} of {result.totalPages}
                    </span>
                    <span className="result-score" title="Relevance score">
                        {result.matchCount} match{result.matchCount !== 1 ? 'es' : ''}
                    </span>
                </div>
            </div>
            <div className="result-snippet">
                {segments.map((seg, i) =>
                    seg.highlighted ? (
                        <mark key={i} className="highlight">
                            {seg.text}
                        </mark>
                    ) : (
                        <span key={i}>{seg.text}</span>
                    )
                )}
            </div>
            <div className="result-card-hint">
                {isSelected ? 'Click to close preview' : 'Click to preview page'}
            </div>
        </article>
    );
}
