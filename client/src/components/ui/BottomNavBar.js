"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

export function BottomNavBar() {
  const pathname = usePathname();

  const navItems = [
    { label: "Messages", icon: "chat_bubble_outline", path: "/app" },
    { label: "Contacts", icon: "person_outline", path: "/app/contacts" },
    { label: "Discover", icon: "explore", path: "/app/discover" },
    { label: "Activity", icon: "notifications", path: "/app/notifications" },
    { label: "Settings", icon: "settings", path: "/app/settings" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 w-full z-50 pt-2 pb-safe shadow-[0_-10px_40px_rgba(48,51,51,0.04)] bg-surface/90 dark:bg-on-background/90 backdrop-blur-2xl">
      <div className="flex justify-around items-center px-10 pb-8">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.label}
              href={item.path}
              className={`flex flex-col items-center justify-center p-4 transition-all ease-out cursor-pointer active:scale-90 ${
                isActive 
                ? "bg-primary-container text-primary rounded-full mb-2" 
                : "text-on-surface/40 hover:text-primary"
              }`}
            >
              <Icon name={item.icon} className="text-2xl" />
              <span className="font-label text-[10px] tracking-[0.05em] uppercase mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
