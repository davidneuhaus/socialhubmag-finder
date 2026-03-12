import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { extractTextFromPDF } from '../utils/pdfExtractor';
import bcrypt from 'bcryptjs';

/** Build a properly-encoded public Storage URL without relying on getPublicUrl (which double-encodes) */
function encodedPublicUrl(filePath) {
    const base = import.meta.env.VITE_SUPABASE_URL;
    const encoded = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
    return `${base}/storage/v1/object/public/magazines/${encoded}`;
}
const ALLOWED_DOMAINS = ['@maloon.de', '@socialhub.io'];

export default function AdminDashboard() {
    const { admin, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('upload');
    const [magazines, setMagazines] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [loadingMags, setLoadingMags] = useState(true);
    const [loadingAdmins, setLoadingAdmins] = useState(true);

    // Upload state
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [uploadError, setUploadError] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState('');

    // Admin-add state
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [adminError, setAdminError] = useState('');
    const [adminSuccess, setAdminSuccess] = useState('');
    const [addingAdmin, setAddingAdmin] = useState(false);

    useEffect(() => {
        fetchMagazines();
        fetchAdmins();
    }, []);

    async function fetchMagazines() {
        setLoadingMags(true);
        const { data, error } = await supabase
            .from('magazines')
            .select('*')
            .order('uploaded_at', { ascending: false });

        if (!error && data) setMagazines(data);
        setLoadingMags(false);
    }

    async function fetchAdmins() {
        setLoadingAdmins(true);
        const { data, error } = await supabase
            .from('admins')
            .select('id, email, created_at')
            .order('created_at', { ascending: true });

        if (!error && data) setAdmins(data);
        setLoadingAdmins(false);
    }

    async function handleFileUpload(e) {
        const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
        if (files.length === 0) return;

        setUploading(true);
        setUploadError('');
        setUploadSuccess('');

        try {
            for (const file of files) {
                const magName = file.name.replace(/\.pdf$/i, '');
                setUploadProgress(`Processing "${magName}"...`);

                // 1. Upload PDF to Supabase Storage
                const safeName = file.name.replace(/[#?&%+]/g, '_');
                const filePath = `pdfs/${Date.now()}_${safeName}`;
                setUploadProgress(`Uploading "${magName}" to storage...`);

                const { error: storageError } = await supabase.storage
                    .from('magazines')
                    .upload(filePath, file, { contentType: 'application/pdf' });

                if (storageError) throw new Error(`Storage upload failed: ${storageError.message}`);

                // 2. Extract text from PDF client-side
                setUploadProgress(`Extracting text from "${magName}"...`);
                const fileUrl = URL.createObjectURL(file);
                const pages = await extractTextFromPDF(fileUrl, magName);
                URL.revokeObjectURL(fileUrl);

                // 3. Insert magazine record
                const { data: magData, error: magError } = await supabase
                    .from('magazines')
                    .insert({
                        name: magName,
                        file_path: filePath,
                        page_count: pages.length,
                        uploaded_by: admin.email,
                    })
                    .select()
                    .single();

                if (magError) throw new Error(`Magazine insert failed: ${magError.message}`);

                // 4. Insert all page texts
                setUploadProgress(`Indexing ${pages.length} pages for "${magName}"...`);
                const pageRows = pages.map((p) => ({
                    magazine_id: magData.id,
                    page_number: p.page,
                    text_content: p.text,
                }));

                // Batch insert in chunks of 100
                for (let i = 0; i < pageRows.length; i += 100) {
                    const chunk = pageRows.slice(i, i + 100);
                    const { error: pagesError } = await supabase
                        .from('magazine_pages')
                        .insert(chunk);

                    if (pagesError) throw new Error(`Page insert failed: ${pagesError.message}`);
                }
            }

            setUploadSuccess(`Successfully uploaded ${files.length} magazine${files.length > 1 ? 's' : ''}!`);
            fetchMagazines();
        } catch (err) {
            console.error('Upload error:', err);
            setUploadError(err.message || 'Upload failed');
        } finally {
            setUploading(false);
            setUploadProgress('');
            e.target.value = '';
        }
    }

    async function handleDeleteMagazine(mag) {
        if (!confirm(`Delete "${mag.name}" and all its indexed pages?`)) return;

        try {
            // Delete from storage
            await supabase.storage.from('magazines').remove([mag.file_path]);
            // Delete from DB (cascade will remove pages)
            await supabase.from('magazines').delete().eq('id', mag.id);
            fetchMagazines();
        } catch (err) {
            console.error('Delete error:', err);
        }
    }

    async function handleAddAdmin(e) {
        e.preventDefault();
        setAdminError('');
        setAdminSuccess('');

        const email = newEmail.toLowerCase().trim();

        // Validate domain
        const domain = email.substring(email.indexOf('@'));
        if (!ALLOWED_DOMAINS.includes(domain)) {
            setAdminError(`Only ${ALLOWED_DOMAINS.join(' and ')} email addresses are allowed.`);
            return;
        }

        if (newPassword.length < 6) {
            setAdminError('Password must be at least 6 characters.');
            return;
        }

        setAddingAdmin(true);

        try {
            const hash = await bcrypt.hash(newPassword, 10);
            const { error } = await supabase
                .from('admins')
                .insert({ email, password_hash: hash });

            if (error) {
                if (error.code === '23505') {
                    throw new Error('An admin with this email already exists.');
                }
                throw new Error(error.message);
            }

            setAdminSuccess(`Admin "${email}" created successfully!`);
            setNewEmail('');
            setNewPassword('');
            fetchAdmins();
        } catch (err) {
            setAdminError(err.message);
        } finally {
            setAddingAdmin(false);
        }
    }

    async function handleDeleteAdmin(adm) {
        if (adm.email === admin.email) {
            alert("You can't delete your own account!");
            return;
        }
        if (!confirm(`Remove admin "${adm.email}"?`)) return;

        await supabase.from('admins').delete().eq('id', adm.id);
        fetchAdmins();
    }

    return (
        <div className="admin-dashboard">
            <header className="admin-header">
                <div className="admin-header-left">
                    <img
                        src="https://socialhub.io/wp-content/uploads/socialhub_wb_n_primary_RGB.svg"
                        alt="SocialHub"
                        className="admin-logo"
                    />
                    <span className="admin-title">Admin Panel</span>
                </div>
                <div className="admin-header-right">
                    <span className="admin-user">{admin.email}</span>
                    <button className="admin-logout-btn" onClick={logout}>
                        Logout
                    </button>
                </div>
            </header>

            <nav className="admin-tabs">
                <button
                    className={`admin-tab ${activeTab === 'upload' ? 'active' : ''}`}
                    onClick={() => setActiveTab('upload')}
                >
                    📄 Upload Magazines
                </button>
                <button
                    className={`admin-tab ${activeTab === 'admins' ? 'active' : ''}`}
                    onClick={() => setActiveTab('admins')}
                >
                    👥 Manage Admins
                </button>
            </nav>

            <main className="admin-content">
                {activeTab === 'upload' && (
                    <div className="admin-section">
                        <h2>Upload Magazines</h2>
                        <p className="admin-section-desc">
                            Upload PDF magazines. Text will be extracted and indexed for search automatically.
                        </p>

                        <div className="upload-area">
                            <input
                                type="file"
                                id="pdf-upload"
                                accept=".pdf"
                                multiple
                                onChange={handleFileUpload}
                                disabled={uploading}
                                className="upload-input"
                            />
                            <label htmlFor="pdf-upload" className={`upload-label ${uploading ? 'disabled' : ''}`}>
                                {uploading ? (
                                    <>
                                        <span className="button-spinner" />
                                        <span>{uploadProgress}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="upload-icon">📁</span>
                                        <span>Drop PDFs here or click to upload</span>
                                        <span className="upload-hint">Accepts .pdf files</span>
                                    </>
                                )}
                            </label>
                        </div>

                        {uploadError && <div className="admin-error">{uploadError}</div>}
                        {uploadSuccess && <div className="admin-success">{uploadSuccess}</div>}

                        <h3 className="admin-subtitle">Uploaded Magazines ({magazines.length})</h3>
                        {loadingMags ? (
                            <div className="admin-loading"><div className="button-spinner" /></div>
                        ) : magazines.length === 0 ? (
                            <p className="admin-empty">No magazines uploaded yet.</p>
                        ) : (
                            <div className="magazine-list">
                                {magazines.map((mag) => (
                                    <div key={mag.id} className="magazine-item">
                                        <div className="magazine-item-info">
                                            <span className="magazine-item-name">📖 {mag.name}</span>
                                            <span className="magazine-item-meta">
                                                {mag.page_count} pages · uploaded by {mag.uploaded_by} ·{' '}
                                                {new Date(mag.uploaded_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="magazine-item-actions">
                                            <a
                                                href={encodedPublicUrl(mag.file_path)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="admin-btn admin-btn-secondary"
                                                title="Direct download (admin only)"
                                            >
                                                ⬇️ Download
                                            </a>
                                            <button
                                                className="admin-btn admin-btn-danger"
                                                onClick={() => handleDeleteMagazine(mag)}
                                            >
                                                🗑️ Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'admins' && (
                    <div className="admin-section">
                        <h2>Manage Admins</h2>
                        <p className="admin-section-desc">
                            Only <strong>@maloon.de</strong> and <strong>@socialhub.io</strong> email addresses are allowed.
                        </p>

                        <form className="admin-add-form" onSubmit={handleAddAdmin}>
                            <div className="admin-field">
                                <label htmlFor="new-email">Email</label>
                                <input
                                    id="new-email"
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="colleague@socialhub.io"
                                    required
                                />
                            </div>
                            <div className="admin-field">
                                <label htmlFor="new-password">Password</label>
                                <input
                                    id="new-password"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Min. 6 characters"
                                    required
                                    minLength={6}
                                />
                            </div>
                            <button
                                type="submit"
                                className="admin-submit-btn"
                                disabled={addingAdmin}
                            >
                                {addingAdmin ? <span className="button-spinner" /> : 'Add Admin'}
                            </button>
                        </form>

                        {adminError && <div className="admin-error">{adminError}</div>}
                        {adminSuccess && <div className="admin-success">{adminSuccess}</div>}

                        <h3 className="admin-subtitle">Current Admins ({admins.length})</h3>
                        {loadingAdmins ? (
                            <div className="admin-loading"><div className="button-spinner" /></div>
                        ) : (
                            <div className="admin-list">
                                {admins.map((adm) => (
                                    <div key={adm.id} className="admin-item">
                                        <div className="admin-item-info">
                                            <span className="admin-item-email">{adm.email}</span>
                                            <span className="admin-item-date">
                                                Added {new Date(adm.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {adm.email !== admin.email && (
                                            <button
                                                className="admin-btn admin-btn-danger"
                                                onClick={() => handleDeleteAdmin(adm)}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
