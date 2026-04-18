"use client";

import { TopAppBar } from "@/components/ui/TopAppBar";
import { BottomNavBar } from "@/components/ui/BottomNavBar";
import { Icon } from "@/components/ui/Icon";

import { logoutFromSupabase } from "@/lib/supabase-chat";
import { useRouter } from "next/navigation";

const MOCK_NOTIFICATIONS = [
  { id: 1, type: 'security', title: 'New Key Generated', message: 'Your identity was rotated successfully for improved privacy.', time: '2h ago', icon: 'security' },
  { id: 2, type: 'mention', title: 'Mentioned in "Nova Collective"', message: 'Nova mentioned you in a whisper.', time: '5h ago', icon: 'alternate_email' },
  { id: 3, type: 'system', title: 'Workspace Synced', message: 'All whispers have been successfully decrypted on this device.', time: 'Yesterday', icon: 'sync' },
  { id: 4, type: 'security', title: 'Backup Refreshed', message: 'Your encrypted private key backup was updated on the server.', time: '2 days ago', icon: 'cloud_done' },
];

export default function NotificationsPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await logoutFromSupabase();
    router.replace("/app");
  };
  return (
    <main className="h-screen flex flex-col overflow-hidden bg-surface text-on-surface">
      <TopAppBar onLogout={handleLogout} />
      <div className="flex-1 flex overflow-hidden pt-24 pb-24 md:pb-0 max-w-screen-2xl mx-auto w-full">
        <aside className="hidden md:flex flex-col w-80 bg-surface-container-low h-full rounded-r-3xl mr-6 p-4">
          <div className="px-4 py-2">
            <h2 className="text-xl font-semibold tracking-tight text-on-surface mb-6 font-headline">Activity</h2>
            <div className="space-y-2">
              <button className="w-full text-left p-4 bg-primary-container text-primary font-bold rounded-2xl flex items-center justify-between">
                <span>All Alerts</span>
                <span className="text-xs bg-primary text-on-primary px-2 py-0.5 rounded-full">4</span>
              </button>
              <button className="w-full text-left p-4 hover:bg-surface-container-highest rounded-2xl transition-colors font-medium text-on-surface-variant">
                Security Only
              </button>
            </div>
          </div>
        </aside>

        <section className="flex-1 bg-surface p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <header className="mb-12 flex justify-between items-end">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-on-surface mb-2 font-headline">Notifications</h1>
                <p className="text-on-surface-variant font-light">Stay updated with your whispers and security events.</p>
              </div>
              <button className="text-xs font-bold uppercase tracking-widest text-primary hover:opacity-70">Mark all as read</button>
            </header>

            <div className="space-y-4">
              {MOCK_NOTIFICATIONS.map((notif) => (
                <div key={notif.id} className="bg-surface-container-low p-6 rounded-[2rem] flex items-start gap-4 hover:bg-surface-container shadow-sm transition-colors border border-transparent hover:border-outline-variant/10">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    notif.type === 'security' ? 'bg-amber-100 text-amber-700' : 
                    notif.type === 'mention' ? 'bg-indigo-100 text-indigo-700' : 
                    'bg-primary-container text-primary'
                  }`}>
                    <Icon name={notif.icon} className="text-2xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-on-surface">{notif.title}</h3>
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">{notif.time}</span>
                    </div>
                    <p className="text-sm text-on-surface-variant leading-relaxed font-light">{notif.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <BottomNavBar />
    </main>
  );
}
