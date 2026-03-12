import { useState, useEffect, useRef } from 'react';
import SearchHero from './components/SearchHero';
import ResultCard from './components/ResultCard';
import { extractAllPDFs } from './utils/pdfExtractor';
import { searchPages } from './utils/search';

// Magazine list — hardcoded for Phase 1
const MAGAZINES = [
  { url: '/mags/socialhub-mag-10.pdf', name: 'SocialHub Mag #10' },
];

export default function App() {
  const [pages, setPages] = useState([]);
  const [results, setResults] = useState(null);
  const [query, setQuery] = useState('');
  const [isIndexing, setIsIndexing] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [indexProgress, setIndexProgress] = useState(0);
  const [error, setError] = useState(null);
  const pagesRef = useRef([]);

  // Index PDFs on mount
  useEffect(() => {
    let cancelled = false;

    async function indexPDFs() {
      try {
        const allPages = await extractAllPDFs(MAGAZINES, (done, total) => {
          if (!cancelled) setIndexProgress((done / total) * 100);
        });
        if (!cancelled) {
          pagesRef.current = allPages;
          setPages(allPages);
          setIsIndexing(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to index magazines. Please refresh and try again.');
          setIsIndexing(false);
          console.error('Indexing error:', err);
        }
      }
    }

    indexPDFs();
    return () => { cancelled = true; };
  }, []);

  const handleSearch = (searchQuery) => {
    setIsSearching(true);
    setQuery(searchQuery);
    setError(null);

    // Use requestAnimationFrame to let the UI update first
    requestAnimationFrame(() => {
      try {
        const searchResults = searchPages(pagesRef.current, searchQuery);
        setResults(searchResults);
      } catch (err) {
        setError('Search failed. Please try again.');
        console.error('Search error:', err);
      }
      setIsSearching(false);
    });
  };

  return (
    <div className="app">
      {/* Branded accent stripe at the very top */}
      <div className="accent-stripe">
        <span className="s-yellow" />
        <span className="s-amethyst" />
        <span className="s-mauve" />
        <span className="s-frost" />
        <span className="s-emerald" />
      </div>

      {/* Navbar with SocialHub:) logo */}
      <nav className="navbar">
        <div className="navbar-logo">
          <span className="navbar-logo-text">SocialHub</span>
          <span className="navbar-logo-smiley">:)</span>
        </div>
        <span className="navbar-tagline">Magazine Archive</span>
      </nav>

      <SearchHero
        onSearch={handleSearch}
        isLoading={isSearching}
        isIndexing={isIndexing}
        indexProgress={indexProgress}
      />

      {error && (
        <div className="error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      {results !== null && !isSearching && (
        <section className="results-section">
          <div className="results-container">
            <div className="results-header">
              <h2 className="results-title">
                {results.length > 0 ? (
                  <>
                    Found <span className="result-count">{results.length}</span> result
                    {results.length !== 1 ? 's' : ''} for "{query}"
                  </>
                ) : (
                  <>No results found for "{query}"</>
                )}
              </h2>
              {results.length > 0 && (
                <span className="results-subtitle">
                  Searched across {pages.length} pages in {MAGAZINES.length} magazine
                  {MAGAZINES.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {results.length === 0 && (
              <div className="no-results">
                <div className="no-results-icon">🔍</div>
                <p>Try different keywords or a shorter search term</p>
              </div>
            )}

            <div className="results-list">
              {results.map((result, i) => (
                <ResultCard
                  key={`${result.magazine}-${result.page}`}
                  result={result}
                  query={query}
                  index={i}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="app-footer">
        <p>
          <a href="https://socialhub.io">SocialHub:)</a> Mag Finder · {pages.length} pages indexed from {MAGAZINES.length} magazine
          {MAGAZINES.length !== 1 ? 's' : ''}
        </p>
      </footer>
    </div>
  );
}
