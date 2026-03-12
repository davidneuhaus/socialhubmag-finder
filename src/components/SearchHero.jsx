import { useState, useRef, useEffect } from 'react';

export default function SearchHero({ onSearch, isLoading, isIndexing, indexProgress }) {
    const [query, setQuery] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim() && !isLoading && !isIndexing) {
            onSearch(query.trim());
        }
    };

    return (
        <section className="search-hero">
            <div className="hero-content">
                <div className="hero-badge">
                    <span className="badge-icon">📚</span>
                    <span>SocialHub Magazine Archive</span>
                </div>
                <h1 className="hero-title">
                    Find anything in
                    <span className="gradient-text"> your SocialHub Magazines</span>
                </h1>
                <p className="hero-subtitle">
                    Search across all SocialHub magazines instantly.
                    Every page, every article, every insight — at your fingertips.
                </p>
                <form className="search-form" onSubmit={handleSubmit}>
                    <div className="search-input-wrapper">
                        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            ref={inputRef}
                            type="text"
                            className="search-input"
                            placeholder="Search for topics, keywords, articles..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            disabled={isIndexing}
                        />
                        <button
                            type="submit"
                            className="search-button"
                            disabled={!query.trim() || isLoading || isIndexing}
                        >
                            {isLoading ? (
                                <span className="button-spinner" />
                            ) : (
                                'Search'
                            )}
                        </button>
                    </div>
                </form>
                {isIndexing && (
                    <div className="indexing-status">
                        <div className="indexing-bar">
                            <div
                                className="indexing-fill"
                                style={{ width: `${indexProgress}%` }}
                            />
                        </div>
                        <span className="indexing-text">
                            Indexing magazines... {Math.round(indexProgress)}%
                        </span>
                    </div>
                )}
            </div>

            {/* Brand visual elements */}
            <div className="hero-glow" />
            <div className="hero-dots" />
            <div className="hero-dots-left" />
            <div className="hero-blob" />
        </section>
    );
}
