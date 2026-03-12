import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '../lib/supabaseClient';

/**
 * PDF Page Preview panel — renders a specific page from a PDF stored in Supabase
 * and highlights search terms on the canvas.
 */
export default function PdfPreview({ result, query, onClose, isAdmin }) {
    const canvasRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!result?.magazineId) return;
        renderPage();
    }, [result]);

    async function renderPage() {
        setLoading(true);
        setError(null);

        try {
            // Get magazine to find storage path
            const { data: mag } = await supabase
                .from('magazines')
                .select('file_path')
                .eq('id', result.magazineId)
                .single();

            if (!mag) throw new Error('Magazine not found');

            // Get public URL from Supabase Storage
            const { data: urlData } = supabase.storage
                .from('magazines')
                .getPublicUrl(mag.file_path);

            const pdfUrl = urlData.publicUrl;

            // Load PDF and render specific page
            const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
            const page = await pdf.getPage(result.page);

            const canvas = canvasRef.current;
            if (!canvas) return;

            const container = containerRef.current;
            const containerWidth = container ? container.clientWidth - 32 : 500;

            const unscaledViewport = page.getViewport({ scale: 1 });
            const scale = containerWidth / unscaledViewport.width;
            const viewport = page.getViewport({ scale });

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            // Highlight search terms on the rendered page
            if (query) {
                const textContent = await page.getTextContent();
                const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);

                ctx.fillStyle = 'rgba(255, 247, 99, 0.35)';

                for (const item of textContent.items) {
                    const itemText = item.str.toLowerCase();
                    for (const term of terms) {
                        if (itemText.includes(term)) {
                            // Transform text position to canvas coordinates
                            const tx = pdfjsLib.Util.transform(
                                viewport.transform,
                                item.transform
                            );
                            const x = tx[4];
                            const y = tx[5] - item.height * scale;
                            const w = item.width * scale;
                            const h = item.height * scale * 1.2;

                            ctx.fillRect(x, y, w, h);
                            break;
                        }
                    }
                }
            }

            setLoading(false);
        } catch (err) {
            console.error('PDF preview error:', err);
            setError('Could not load PDF preview');
            setLoading(false);
        }
    }

    // Get direct download URL for admins
    function getDirectDownloadUrl() {
        if (!result?.magazineId) return null;
        // This will be populated after we fetch the mag data
        return null;
    }

    return (
        <div className="pdf-preview-panel" ref={containerRef}>
            <div className="pdf-preview-header">
                <div className="pdf-preview-title">
                    <span className="pdf-preview-mag">{result.magazine}</span>
                    <span className="pdf-preview-page">Page {result.page} of {result.totalPages}</span>
                </div>
                <button className="pdf-preview-close" onClick={onClose} title="Close preview">
                    ✕
                </button>
            </div>

            <div className="pdf-preview-canvas-wrapper">
                {loading && (
                    <div className="pdf-preview-loading">
                        <div className="button-spinner" />
                        <span>Loading preview...</span>
                    </div>
                )}
                {error && <div className="pdf-preview-error">{error}</div>}
                <canvas
                    ref={canvasRef}
                    className="pdf-preview-canvas"
                    style={{ display: loading ? 'none' : 'block' }}
                />
            </div>

            <div className="pdf-preview-actions">
                {isAdmin ? (
                    <AdminDownloadButton magazineId={result.magazineId} />
                ) : (
                    <a
                        href="https://socialhub.io/magazin/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pdf-preview-download-btn"
                    >
                        📥 Download Magazine
                    </a>
                )}
            </div>
        </div>
    );
}

function AdminDownloadButton({ magazineId }) {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        async function getUrl() {
            const { data: mag } = await supabase
                .from('magazines')
                .select('file_path')
                .eq('id', magazineId)
                .single();

            if (mag) {
                const { data } = supabase.storage
                    .from('magazines')
                    .getPublicUrl(mag.file_path);
                setUrl(data.publicUrl);
            }
        }
        getUrl();
    }, [magazineId]);

    if (!url) return null;

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="pdf-preview-download-btn admin-direct-download"
        >
            ⬇️ Direct Download (Admin)
        </a>
    );
}
