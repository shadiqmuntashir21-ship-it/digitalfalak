export default function Icon({ name, size = 18, className = "" }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
  };

  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-5.5h5V20"/></>,
    clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
    qibla: <><circle cx="12" cy="12" r="8.5"/><path d="m14.8 8.2-2 5.2-5.2 2 2-5.2 5.2-2Z"/><path d="M12 3.5V2M12 22v-1.5M3.5 12H2M22 12h-1.5"/></>,
    sun: <><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></>,
    moon: <path d="M19.5 14.2A7.7 7.7 0 0 1 9.8 4.5a8.2 8.2 0 1 0 9.7 9.7Z"/>,
    calendar: <><rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M7.5 3v5M16.5 3v5M3.5 10h17"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1a1.7 1.7 0 0 0-1.4-1.65 1.7 1.7 0 0 0-1.55.46l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3v-4h.1a1.7 1.7 0 0 0 1.65-1.4 1.7 1.7 0 0 0-.46-1.55l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1.4 1.65 1.7 1.7 0 0 0 1.55-.46l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.6.56.94 1.6 1v4c-1.04.06-1.44.4-1.6 1Z"/></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.3"/></>,
    chevron: <path d="m9 6 6 6-6 6"/>,
    admin: <><path d="M8 3.5h8l1 3.5h2v13H5V7h2l1-3.5Z"/><path d="M9 11h6M9 15h4"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.4 5.2-5.2 2.4 2.4-5.2 5.2-2.4Z"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M18.5 16.5A8 8 0 1 1 19.8 9"/></>,
    book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23V5.5Z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23V5.5Z"/></>,
    check: <path d="m5 12.5 4.2 4.2L19 7"/>,
    warning: <><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4.5M12 17h.01"/></>,
    logout: <><path d="M10 4H5v16h5"/><path d="m14 8 4 4-4 4M18 12H9"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    save: <><path d="M5 3h12l2 2v16H5V3Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></>,
    flask: <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 16h9"/></>,
  };

  return <svg {...common}>{paths[name] || paths.home}</svg>;
}
