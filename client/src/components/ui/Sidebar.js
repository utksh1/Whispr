"use client";

export function Sidebar({ contacts, selectedPeer, onSelectPeer }) {
  const getInitials = (name = "") => {
    return name.slice(0, 1).toUpperCase() || "W";
  };

  return (
    <aside className="hidden md:flex flex-col w-80 bg-surface-container-low h-full border-r border-outline-variant p-4 overflow-y-auto">
      <div className="mb-8 px-4">
        <h2 className="text-xl font-semibold tracking-tight text-on-surface mb-6">Recent Whispers</h2>
        {contacts.map((contact) => (
          <div
            key={contact.$id || contact.username}
            onClick={() => onSelectPeer(contact)}
            className={`flex items-center gap-4 p-4 rounded-2xl mb-2 cursor-pointer transition-all ${
              selectedPeer?.username === contact.username
                ? "bg-surface-container-lowest shadow-[0_10px_30px_rgba(48,51,51,0.04)]"
                : "hover:bg-surface-container-highest"
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold ${
              selectedPeer?.username === contact.username ? "bg-primary text-on-primary" : "bg-primary-container text-on-primary-container"
            }`}>
              {getInitials(contact.username)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className={`truncate ${selectedPeer?.username === contact.username ? "font-bold" : "font-medium"} text-on-surface`}>
                  {contact.username}
                </h3>
              </div>
              <p className="text-sm text-on-surface-variant truncate font-body font-light">
                {contact.hasPublicKey ? "Encrypted connection" : "Waiting for key..."}
              </p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
