import * as React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function DashboardLayout({ children }: { children?: React.ReactNode }): JSX.Element {
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('skyline_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggle = (): void => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('skyline_sidebar_collapsed', String(next));
      } catch {
        /* noop */
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className={collapsed ? 'lg:pl-[4.75rem]' : 'lg:pl-[16.5rem]'} style={{ transition: 'padding-left .18s ease' }}>
        <Topbar />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
