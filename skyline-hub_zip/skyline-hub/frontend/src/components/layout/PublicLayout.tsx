import { Outlet, useLocation } from 'react-router-dom';
import * as React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function PublicLayout(): JSX.Element {
  const location = useLocation();
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
