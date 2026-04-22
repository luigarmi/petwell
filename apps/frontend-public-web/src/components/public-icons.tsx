'use client';

type IconName =
  | 'arrow-right'
  | 'bell'
  | 'book'
  | 'calendar'
  | 'card'
  | 'clinic'
  | 'heart'
  | 'home'
  | 'logout'
  | 'paw'
  | 'profile'
  | 'shield'
  | 'spark'
  | 'video';

export function PublicIcon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  const commonProps = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24'
  };

  switch (name) {
    case 'arrow-right':
      return (
        <svg {...commonProps}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...commonProps}>
          <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'book':
      return (
        <svg {...commonProps}>
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v14H6.5A2.5 2.5 0 0 0 4 20.5v-14Z" />
          <path d="M8 8h8" />
          <path d="M8 12h8" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...commonProps}>
          <path d="M7 3v4" />
          <path d="M17 3v4" />
          <rect x="4" y="5" width="16" height="16" rx="3" />
          <path d="M4 10h16" />
        </svg>
      );
    case 'card':
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="M3 10h18" />
          <path d="M7 15h4" />
        </svg>
      );
    case 'clinic':
      return (
        <svg {...commonProps}>
          <path d="M8 21V7l4-4 4 4v14" />
          <path d="M4 21h16" />
          <path d="M12 10v6" />
          <path d="M9 13h6" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...commonProps}>
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.3A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
        </svg>
      );
    case 'home':
      return (
        <svg {...commonProps}>
          <path d="m3 11 9-7 9 7" />
          <path d="M5 10.5V20h14v-9.5" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...commonProps}>
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M20 4v16" />
        </svg>
      );
    case 'paw':
      return (
        <svg {...commonProps}>
          <path d="M8 14c-1.7 0-3 1.3-3 3 0 1.1.9 2 2 2 1.5 0 1.8-1 3-1s1.5 1 3 1c1.1 0 2-.9 2-2 0-1.7-1.3-3-3-3-1.2 0-1.8.8-2 1-.2-.2-.8-1-2-1Z" />
          <path d="M7 8a1.5 2.5 0 1 0 0-5 1.5 2.5 0 0 0 0 5Z" />
          <path d="M12 6a1.5 2.5 0 1 0 0-5 1.5 2.5 0 0 0 0 5Z" />
          <path d="M17 8a1.5 2.5 0 1 0 0-5 1.5 2.5 0 0 0 0 5Z" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20a8 8 0 0 1 16 0" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...commonProps}>
          <path d="M12 3c2.6 2 5.5 3 8 3v5c0 5.1-3.4 8.7-8 10-4.6-1.3-8-4.9-8-10V6c2.5 0 5.4-1 8-3Z" />
          <path d="m9.5 12 1.8 1.8 3.2-3.6" />
        </svg>
      );
    case 'spark':
      return (
        <svg {...commonProps}>
          <path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" />
          <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" />
        </svg>
      );
    case 'video':
      return (
        <svg {...commonProps}>
          <rect x="3" y="6" width="12" height="12" rx="3" />
          <path d="m15 10 6-3v10l-6-3" />
        </svg>
      );
    default:
      return null;
  }
}
