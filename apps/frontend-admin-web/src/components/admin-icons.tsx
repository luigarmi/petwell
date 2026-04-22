'use client';

type IconName = 'analytics' | 'billing' | 'calendar' | 'dashboard' | 'ehr' | 'logout' | 'paw' | 'shield' | 'users' | 'video';

export function AdminIcon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
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
    case 'analytics':
      return (
        <svg {...commonProps}>
          <path d="M4 20V8" />
          <path d="M10 20V4" />
          <path d="M16 20v-7" />
          <path d="M22 20v-11" />
        </svg>
      );
    case 'billing':
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="M3 10h18" />
          <path d="M7 15h5" />
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
    case 'dashboard':
      return (
        <svg {...commonProps}>
          <path d="M4 13h7V4H4Z" />
          <path d="M13 20h7v-9h-7Z" />
          <path d="M13 11h7V4h-7Z" />
          <path d="M4 20h7v-5H4Z" />
        </svg>
      );
    case 'ehr':
      return (
        <svg {...commonProps}>
          <path d="M6 4h9l3 3v13H6Z" />
          <path d="M15 4v4h4" />
          <path d="M9 13h6" />
          <path d="M12 10v6" />
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
    case 'shield':
      return (
        <svg {...commonProps}>
          <path d="M12 3c2.6 2 5.5 3 8 3v5c0 5.1-3.4 8.7-8 10-4.6-1.3-8-4.9-8-10V6c2.5 0 5.4-1 8-3Z" />
          <path d="m9.5 12 1.8 1.8 3.2-3.6" />
        </svg>
      );
    case 'users':
      return (
        <svg {...commonProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="9.5" cy="7" r="3.5" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
          <path d="M16 4.1a3.5 3.5 0 0 1 0 6.8" />
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
