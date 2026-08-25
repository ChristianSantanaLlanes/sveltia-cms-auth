import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '96px 24px' }}>
      <div>
        <h1 style={{ fontSize: 'var(--fs-h1)' }}>Page not found</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>The page you were looking for has moved on.</p>
        <Link to="/" style={{ display: 'inline-block', marginTop: 24, color: 'var(--accent)' }}>Return home</Link>
      </div>
    </main>
  );
}
