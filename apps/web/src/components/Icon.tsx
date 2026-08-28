export type IconName =
  | "chantier" | "dashboard" | "users" | "building" | "settings" | "report"
  | "menu" | "close" | "back" | "search" | "filter" | "plus" | "camera"
  | "eye" | "eye-off" | "more" | "zoom-in" | "zoom-out" | "locate"
  | "warning" | "check" | "target" | "rotate";

interface IconProps { name: IconName; size?: number; className?: string }

const paths: Record<IconName, JSX.Element> = {
  chantier: <><path d="M2 17h16M4 17V8h12v9M7 8V4h6v4M8 12h4" /></>,
  dashboard: <><rect x="2.5" y="2.5" width="6" height="6"/><rect x="11.5" y="2.5" width="6" height="6"/><rect x="2.5" y="11.5" width="6" height="6"/><rect x="11.5" y="11.5" width="6" height="6"/></>,
  users: <><circle cx="7" cy="7" r="3"/><path d="M2 17c.4-3.2 2-5 5-5s4.6 1.8 5 5M13 4.5a3 3 0 0 1 0 5.5M14 12c2.3.3 3.6 2 4 5"/></>,
  building: <><path d="M3 18V3h10v15M13 8h4v10M6 6h2M6 10h2M6 14h2"/></>,
  settings: <><circle cx="10" cy="10" r="3"/><path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M15.8 4.2l-1.4 1.4M5.6 14.4l-1.4 1.4"/></>,
  report: <><path d="M4 2h8l4 4v12H4zM12 2v4h4M7 10h6M7 14h6"/></>,
  menu: <path d="M2 5h16M2 10h16M2 15h16"/>, close: <path d="M4 4l12 12M16 4L4 16"/>,
  back: <path d="M16 10H4M9 5l-5 5 5 5"/>, search: <><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l5 5"/></>,
  filter: <path d="M2 4h16l-6.2 7v5l-3.6 2v-7z"/>, plus: <path d="M10 3v14M3 10h14"/>,
  camera: <><path d="M2 7h4l1.5-2h5L14 7h4v10H2z"/><circle cx="10" cy="12" r="3"/></>,
  eye: <><path d="M1.5 10s3-5 8.5-5 8.5 5 8.5 5-3 5-8.5 5-8.5-5-8.5-5z"/><circle cx="10" cy="10" r="2.5"/></>,
  "eye-off": <><path d="M3 3l14 14M7 5.5A8 8 0 0 1 10 5c5.5 0 8.5 5 8.5 5a14 14 0 0 1-2.2 2.7M12.5 14.6A8 8 0 0 1 10 15c-5.5 0-8.5-5-8.5-5a14 14 0 0 1 2.1-2.6"/></>,
  more: <><circle cx="4" cy="10" r="1"/><circle cx="10" cy="10" r="1"/><circle cx="16" cy="10" r="1"/></>,
  "zoom-in": <><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l5 5M8.5 5.5v6M5.5 8.5h6"/></>,
  "zoom-out": <><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l5 5M5.5 8.5h6"/></>,
  locate: <><circle cx="10" cy="10" r="5"/><path d="M10 1v3M10 16v3M1 10h3M16 10h3"/></>,
  warning: <><path d="M10 2l8 15H2z"/><path d="M10 7v4M10 14h.01"/></>, check: <path d="M3 10l4 4 10-10"/>,
  target: <><circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="2"/><path d="M10 1v3M10 16v3M1 10h3M16 10h3"/></>,
  rotate: <><path d="M15.5 6A7 7 0 1 1 13 4"/><path d="M16 2v4.3h-4.3"/></>,
};

export default function Icon({ name, size = 20, className }: IconProps) {
  return <svg className={className} width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">{paths[name]}</svg>;
}
