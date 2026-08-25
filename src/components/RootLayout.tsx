import { useLayoutEffect, type ReactElement } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { OrderProvider } from '@/store/OrderContext';
import Header from './Header';
import Footer from './Footer';

export default function RootLayout(): ReactElement {
  const { pathname } = useLocation();

  /* Every route starts at the top. Runs before paint so the new page never
     flashes at the previous page's scroll offset. */
  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <OrderProvider>
      <a className="vm-skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      <main id="main-content" className="vm-main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </OrderProvider>
  );
}
