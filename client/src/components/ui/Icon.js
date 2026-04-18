"use client";

const ICON_PATHS = {
  add: <path d="M12 5v14M5 12h14" />,
  alternate_email: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
    </>
  ),
  chat_bubble: <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v5A3.5 3.5 0 0 1 15.5 15H11l-5 4v-4.2A3.5 3.5 0 0 1 5 12.5Z" />,
  chat_bubble_outline: <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v5A3.5 3.5 0 0 1 15.5 15H11l-5 4v-4.2A3.5 3.5 0 0 1 5 12.5Z" />,
  cloud_done: (
    <>
      <path d="M8 18h8.5a4.5 4.5 0 0 0 .7-8.95A6 6 0 0 0 5.85 8.2 4.9 4.9 0 0 0 8 18Z" />
      <path d="m9 13 2 2 4-4" />
    </>
  ),
  delete_forever: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />
      <path d="m9 11 6 6M15 11l-6 6" />
    </>
  ),
  devices: (
    <>
      <rect x="3" y="5" width="13" height="10" rx="2" />
      <rect x="14" y="10" width="7" height="9" rx="2" />
      <path d="M7 19h5M9.5 15v4" />
    </>
  ),
  explore: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9Z" />
    </>
  ),
  groups: (
    <>
      <path d="M9 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM15.5 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M13.5 14.2A4.8 4.8 0 0 1 20.5 19" />
    </>
  ),
  help_outline: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.4 2.4 0 0 1 4.5 1.2c0 2-2.3 2.1-2.3 4M12 18h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6M12 7.5h.01" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="14.5" r="3.5" />
      <path d="M10 12 20 2M15 7l2 2M13 9l2 2" />
    </>
  ),
  logout: <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M18 12H9" />,
  more_vert: (
    <>
      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  notifications: (
    <>
      <path d="M18 16H6l1.4-1.7V10a4.6 4.6 0 1 1 9.2 0v4.3Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 0 0 0 18h1.2a2 2 0 0 0 1.4-3.4 1.8 1.8 0 0 1 1.3-3.1H17a4 4 0 0 0 4-4A7.5 7.5 0 0 0 12 3Z" />
      <circle cx="7.5" cy="11" r=".8" fill="currentColor" stroke="none" />
      <circle cx="9.8" cy="7.8" r=".8" fill="currentColor" stroke="none" />
      <circle cx="14" cy="7.5" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  person_outline: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  person_search: (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M3.5 20a6.5 6.5 0 0 1 10.7-5" />
      <circle cx="17" cy="17" r="3" />
      <path d="m19.2 19.2 2 2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 0 1-13.5 5.8M4 12A8 8 0 0 1 17.5 6.2" />
      <path d="M17.5 2.5v3.7h-3.7M6.5 21.5v-3.7h3.7" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  security: (
    <>
      <path d="M12 3 5 6v5.5c0 4.1 2.8 7.9 7 9.5 4.2-1.6 7-5.4 7-9.5V6Z" />
      <path d="m9.2 12 2 2 4-4" />
    </>
  ),
  send: <path d="M4 12 20 4l-4 16-4-6-8-2Z" />,
  settings: (
    <>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="m19 13.5 1.2 1.1-2 3.4-1.6-.5a7.5 7.5 0 0 1-1.7 1l-.3 1.7h-4l-.3-1.7a7.5 7.5 0 0 1-1.7-1L7 18l-2-3.4 1.2-1.1a7.3 7.3 0 0 1 0-2L5 10.4 7 7l1.6.5a7.5 7.5 0 0 1 1.7-1l.3-1.7h4l.3 1.7a7.5 7.5 0 0 1 1.7 1L18.2 7l2 3.4-1.2 1.1a7.3 7.3 0 0 1 0 2Z" />
    </>
  ),
  sync: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M18.5 12A6.5 6.5 0 0 0 7.3 7.5L4 12M5.5 12a6.5 6.5 0 0 0 11.2 4.5L20 12" />
    </>
  ),
  verified: (
    <>
      <path d="m12 3 2.1 2.1 3-.2.7 2.9 2.5 1.6-1.3 2.6 1.3 2.6-2.5 1.6-.7 2.9-3-.2L12 21l-2.1-2.1-3 .2-.7-2.9-2.5-1.6L5 12 3.7 9.4l2.5-1.6.7-2.9 3 .2Z" />
      <path d="m8.7 12.2 2.1 2.1 4.5-4.6" />
    </>
  ),
  verified_user: (
    <>
      <path d="M12 3 5 6v5.5c0 4.1 2.8 7.9 7 9.5 4.2-1.6 7-5.4 7-9.5V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
};

export function Icon({ name, className = "", title }) {
  const path = ICON_PATHS[name] || ICON_PATHS.info;

  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={`inline-block h-[1em] w-[1em] shrink-0 ${className}`}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {path}
    </svg>
  );
}
