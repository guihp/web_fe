import type { ReactNode, SVGProps } from 'react';

export type AppIconName =
  | 'home'
  | 'merchandising'
  | 'briefcase'
  | 'clipboard'
  | 'calendar'
  | 'tag'
  | 'cart'
  | 'chart'
  | 'target'
  | 'money'
  | 'building'
  | 'archive'
  | 'dollar'
  | 'puzzle'
  | 'trend'
  | 'shield'
  | 'user'
  | 'userPlus'
  | 'users'
  | 'check'
  | 'pin'
  | 'store'
  | 'factory'
  | 'idCard'
  | 'search'
  | 'rocket'
  | 'trash'
  | 'menu'
  | 'chevronLeft'
  | 'chevronRight'
  | 'arrowUpRight'
  | 'file'
  | 'lightbulb'
  | 'medal'
  | 'warning'
  | 'save'
  | 'play'
  | 'arrowLeft'
  | 'bell';

type Props = {
  name: AppIconName;
  size?: number;
  className?: string;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, 'name'>;

function Svg({
  size = 20,
  children,
  className,
  title,
  ...rest
}: {
  size?: number;
  children: ReactNode;
  className?: string;
  title?: string;
} & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export default function AppIcon({ name, size = 20, className, title, ...rest }: Props) {
  const props = { size, className, title, ...rest };

  switch (name) {
    case 'home':
      return (
        <Svg {...props}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20h14V9.5" />
          <path d="M10 20v-6h4v6" />
        </Svg>
      );
    case 'merchandising':
      return (
        <Svg {...props}>
          <path d="M6 8h12l-1 12H7L6 8Z" />
          <path d="M9 8a3 3 0 0 1 6 0" />
        </Svg>
      );
    case 'briefcase':
      return (
        <Svg {...props}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 12h18" />
        </Svg>
      );
    case 'clipboard':
      return (
        <Svg {...props}>
          <rect x="6" y="4" width="12" height="17" rx="2" />
          <path d="M9 4.5h6a1.5 1.5 0 0 0-3 0H9Z" />
          <path d="M9 11h6M9 15h4" />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </Svg>
      );
    case 'tag':
      return (
        <Svg {...props}>
          <path d="M20 12 12 4H5v7l8 8 7-7Z" />
          <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
        </Svg>
      );
    case 'cart':
      return (
        <Svg {...props}>
          <path d="M3 4h2l2.2 11h10.3l2-7H7.2" />
          <circle cx="10" cy="20" r="1.4" />
          <circle cx="17" cy="20" r="1.4" />
        </Svg>
      );
    case 'chart':
      return (
        <Svg {...props}>
          <path d="M4 19V5M4 19h16" />
          <path d="M8 16v-5M12 16V8M16 16v-8" />
        </Svg>
      );
    case 'target':
      return (
        <Svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </Svg>
      );
    case 'money':
      return (
        <Svg {...props}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M7 10v4M17 10v4" />
        </Svg>
      );
    case 'building':
      return (
        <Svg {...props}>
          <path d="M4 20V6l8-3 8 3v14" />
          <path d="M9 20v-5h6v5M9 9h.01M12 9h.01M15 9h.01M9 13h.01M12 13h.01M15 13h.01" />
        </Svg>
      );
    case 'archive':
      return (
        <Svg {...props}>
          <rect x="3" y="4" width="18" height="5" rx="1.5" />
          <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
          <path d="M10 13h4" />
        </Svg>
      );
    case 'dollar':
      return (
        <Svg {...props}>
          <path d="M12 3v18" />
          <path d="M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 2.5 4 3 4 1.4 4 3-1.8 3-4 3-4-1.3-4-3" />
        </Svg>
      );
    case 'puzzle':
      return (
        <Svg {...props}>
          <path d="M10 4a2 2 0 1 1 4 0v2h3a1 1 0 0 1 1 1v3h2a2 2 0 1 1 0 4h-2v3a1 1 0 0 1-1 1h-3v2a2 2 0 1 1-4 0v-2H7a1 1 0 0 1-1-1v-3H4a2 2 0 1 1 0-4h2V7a1 1 0 0 1 1-1h3V4Z" />
        </Svg>
      );
    case 'trend':
      return (
        <Svg {...props}>
          <path d="M3 17 10 10l4 4 7-7" />
          <path d="M14 7h7v7" />
        </Svg>
      );
    case 'shield':
      return (
        <Svg {...props}>
          <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
        </Svg>
      );
    case 'user':
      return (
        <Svg {...props}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </Svg>
      );
    case 'userPlus':
      return (
        <Svg {...props}>
          <circle cx="10" cy="8" r="3.5" />
          <path d="M3.5 20a6.5 6.5 0 0 1 13 0" />
          <path d="M19 8v6M16 11h6" />
        </Svg>
      );
    case 'users':
      return (
        <Svg {...props}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M14 20a4.5 4.5 0 0 1 6.5-4" />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </Svg>
      );
    case 'pin':
      return (
        <Svg {...props}>
          <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </Svg>
      );
    case 'store':
      return (
        <Svg {...props}>
          <path d="M4 10 6 4h12l2 6" />
          <path d="M4 10v10h16V10" />
          <path d="M10 20v-6h4v6" />
        </Svg>
      );
    case 'factory':
      return (
        <Svg {...props}>
          <path d="M3 21V10l6 4V10l6 4V8h6v13" />
          <path d="M7 21v-3M12 21v-3M17 21v-3" />
        </Svg>
      );
    case 'idCard':
      return (
        <Svg {...props}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <circle cx="8.5" cy="12" r="2.2" />
          <path d="M13 10h6M13 14h4" />
        </Svg>
      );
    case 'search':
      return (
        <Svg {...props}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </Svg>
      );
    case 'rocket':
      return (
        <Svg {...props}>
          <path d="M12 3c3 2 5 5.5 5 9.5 0 2-.5 3.5-1.2 4.5L12 21l-3.8-4C7.5 16 7 14.5 7 12.5 7 8.5 9 5 12 3Z" />
          <circle cx="12" cy="11" r="1.6" />
          <path d="M8 15.5 5 18M16 15.5l3 2.5" />
        </Svg>
      );
    case 'trash':
      return (
        <Svg {...props}>
          <path d="M4 7h16M9 7V5h6v2M8 7l1 13h6l1-13" />
        </Svg>
      );
    case 'menu':
      return (
        <Svg {...props}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </Svg>
      );
    case 'chevronLeft':
      return (
        <Svg {...props}>
          <path d="m14 6-6 6 6 6" />
        </Svg>
      );
    case 'chevronRight':
      return (
        <Svg {...props}>
          <path d="m10 6 6 6-6 6" />
        </Svg>
      );
    case 'arrowUpRight':
      return (
        <Svg {...props}>
          <path d="M7 17 17 7M9 7h8v8" />
        </Svg>
      );
    case 'file':
      return (
        <Svg {...props}>
          <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
          <path d="M14 3v5h5" />
        </Svg>
      );
    case 'lightbulb':
      return (
        <Svg {...props}>
          <path d="M9 18h6M10 21h4" />
          <path d="M12 3a6 6 0 0 0-3.5 10.8c.6.5 1 1.2 1.1 2.2h4.8c.1-1 .5-1.7 1.1-2.2A6 6 0 0 0 12 3Z" />
        </Svg>
      );
    case 'medal':
      return (
        <Svg {...props}>
          <circle cx="12" cy="9" r="5" />
          <path d="m9 13-2 8 5-3 5 3-2-8" />
        </Svg>
      );
    case 'warning':
      return (
        <Svg {...props}>
          <path d="M12 3 2.5 20h19L12 3Z" />
          <path d="M12 10v5M12 17.5h.01" />
        </Svg>
      );
    case 'save':
      return (
        <Svg {...props}>
          <path d="M5 3h11l3 3v15H5V3Z" />
          <path d="M8 3v6h8V3M8 21v-7h8v7" />
        </Svg>
      );
    case 'play':
      return (
        <Svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="m10 8 7 4-7 4V8Z" fill="currentColor" stroke="none" />
        </Svg>
      );
    case 'arrowLeft':
      return (
        <Svg {...props}>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </Svg>
      );
    case 'bell':
      return (
        <Svg {...props}>
          <path d="M6 9a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </Svg>
      );
    default:
      return null;
  }
}
