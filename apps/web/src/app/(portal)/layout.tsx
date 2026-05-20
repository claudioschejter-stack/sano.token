import { AppSidebar } from '../../components/layout/AppSidebar';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-terminal-bg">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto bg-terminal-bg p-8 text-terminal-text">{children}</main>
    </div>
  );
}
