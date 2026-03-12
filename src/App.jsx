import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import SearchHero from './components/SearchHero';
import ResultCard from './components/ResultCard';
import PdfPreview from './components/PdfPreview';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminRoute from './components/AdminRoute';
import { searchSupabase } from './utils/supabaseSearch';
import { supabase } from './lib/supabaseClient';
import { useAuth } from './context/AuthContext';

function SearchPage() {
  const [results, setResults] = useState(null);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [totalMags, setTotalMags] = useState(0);
  const { admin } = useAuth();

  // Fetch stats on mount
  useEffect(() => {
    async function fetchStats() {
      const { count: pageCount } = await supabase
        .from('magazine_pages')
        .select('*', { count: 'exact', head: true });

      const { count: magCount } = await supabase
        .from('magazines')
        .select('*', { count: 'exact', head: true });

      setTotalPages(pageCount || 0);
      setTotalMags(magCount || 0);
    }
    fetchStats();
  }, []);

  const handleSearch = async (searchQuery) => {
    setIsSearching(true);
    setQuery(searchQuery);
    setError(null);
    setSelectedResult(null);

    try {
      const searchResults = await searchSupabase(searchQuery);
      setResults(searchResults);
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error('Search error:', err);
    }
    setIsSearching(false);
  };

  return (
    <>
      <SearchHero
        onSearch={handleSearch}
        isLoading={isSearching}
        isIndexing={false}
        indexProgress={100}
      />

      {error && (
        <div className="error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      {results !== null && !isSearching && (
        <section className="results-section">
          <div className={`results-layout ${selectedResult ? 'with-preview' : ''}`}>
            <div className="results-container">
              <div className="results-header">
                <h2 className="results-title">
                  {results.length > 0 ? (
                    <>
                      Found <span className="result-count">{results.length}</span> result
                      {results.length !== 1 ? 's' : ''} for &quot;{query}&quot;
                    </>
                  ) : (
                    <>No results found for &quot;{query}&quot;</>
                  )}
                </h2>
                {results.length > 0 && (
                  <span className="results-subtitle">
                    Searched across {totalPages} pages in {totalMags} magazine
                    {totalMags !== 1 ? 's' : ''}
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
                    isSelected={selectedResult?.id === result.id}
                    onClick={() =>
                      setSelectedResult(
                        selectedResult?.id === result.id ? null : result
                      )
                    }
                  />
                ))}
              </div>
            </div>

            {selectedResult && (
              <PdfPreview
                result={selectedResult}
                query={query}
                onClose={() => setSelectedResult(null)}
                isAdmin={!!admin}
              />
            )}
          </div>
        </section>
      )}

      <footer className="app-footer">
        <p>
          <a href="https://socialhub.io">SocialHub:)</a> Mag Finder · {totalPages} pages indexed from {totalMags} magazine
          {totalMags !== 1 ? 's' : ''}
        </p>
      </footer>
    </>
  );
}

export default function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  if (isAdminRoute) {
    return (
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
      </Routes>
    );
  }

  return (
    <div className="app">
      {/* Branded accent stripe */}
      <div className="accent-stripe">
        <span className="s-yellow" />
        <span className="s-amethyst" />
        <span className="s-mauve" />
        <span className="s-frost" />
        <span className="s-emerald" />
      </div>

      {/* Navbar with SocialHub logo */}
      <nav className="navbar">
        <Link to="/" className="navbar-logo">
          <img
            src="https://socialhub.io/wp-content/uploads/socialhub_wb_n_primary_RGB.svg"
            alt="SocialHub"
            className="navbar-logo-img"
          />
        </Link>
        <span className="navbar-tagline">Magazine Archive</span>
      </nav>

      <Routes>
        <Route path="/" element={<SearchPage />} />
      </Routes>
    </div>
  );
}
