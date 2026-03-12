import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(email, password);
            navigate('/admin');
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="admin-login-page">
            <div className="admin-login-card">
                <div className="admin-login-header">
                    <img
                        src="https://socialhub.io/wp-content/uploads/socialhub_wb_n_primary_RGB.svg"
                        alt="SocialHub"
                        className="admin-login-logo"
                    />
                    <h1>Admin Access</h1>
                    <p>Sign in to manage magazines</p>
                </div>

                <form className="admin-login-form" onSubmit={handleSubmit}>
                    {error && <div className="admin-error">{error}</div>}

                    <div className="admin-field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@maloon.de"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="admin-field">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="admin-submit-btn"
                        disabled={isLoading || !email || !password}
                    >
                        {isLoading ? <span className="button-spinner" /> : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
