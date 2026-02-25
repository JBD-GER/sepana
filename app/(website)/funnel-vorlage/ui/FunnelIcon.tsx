import type { IconName } from "./funnelData"

type Props = {
  name: IconName
  className?: string
}

export default function FunnelIcon({ name, className = "h-5 w-5" }: Props) {
  const base = { viewBox: "0 0 24 24", fill: "none", className, "aria-hidden": true as const }
  switch (name) {
    case "home":
      return (
        <svg {...base}>
          <path d="M3 11.5L12 4l9 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 10.5V20h13V10.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M10 20v-5h4v5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case "credit":
      return (
        <svg {...base}>
          <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3 10h18M7 15h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case "build":
      return (
        <svg {...base}>
          <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M6 19V9l6-4 6 4v10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 13h6M12 10v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case "refresh":
      return (
        <svg {...base}>
          <path d="M20 7v5h-5M4 17v-5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19 12a7 7 0 0 0-12-4M5 12a7 7 0 0 0 12 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case "cash":
      return (
        <svg {...base}>
          <rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case "car":
      return (
        <svg {...base}>
          <path d="M5 15l1.5-4h11L19 15" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M4 15h16v3H4z" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="7.5" cy="18" r="1.5" fill="currentColor" />
          <circle cx="16.5" cy="18" r="1.5" fill="currentColor" />
        </svg>
      )
    case "search":
      return (
        <svg {...base}>
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case "users":
      return (
        <svg {...base}>
          <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="16.5" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 19c.8-2.7 3-4 5-4s4.2 1.3 5 4M13.8 18c.4-1.8 1.7-2.8 2.8-2.8s2.4 1 2.8 2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case "user":
      return (
        <svg {...base}>
          <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 19c1-3.2 3.9-4.5 7-4.5s6 1.3 7 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case "apartment":
      return (
        <svg {...base}>
          <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case "house":
      return (
        <svg {...base}>
          <path d="M4 11.5L12 5l8 6.5V20H4v-8.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M10 20v-5h4v5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case "plot":
      return (
        <svg {...base}>
          <path d="M4 18l3-10 7 2 6-4-3 10-7-2-6 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )
    case "blocks":
      return (
        <svg {...base}>
          <rect x="4" y="9" width="7" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="13" y="4" width="7" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case "factory":
      return (
        <svg {...base}>
          <path d="M3 20V10l6 3V9l6 4V7l6 4v9H3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )
    case "heart":
      return (
        <svg {...base}>
          <path d="M12 20s-7-4.6-9-9a5.3 5.3 0 0 1 9-5 5.3 5.3 0 0 1 9 5c-2 4.4-9 9-9 9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )
    case "mail":
      return (
        <svg {...base}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4.5 7l7.5 6L19.5 7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )
    case "shield":
      return (
        <svg {...base}>
          <path d="M12 3l7 3v6c0 4.3-2.8 6.8-7 9-4.2-2.2-7-4.7-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case "check":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8.5 12.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case "route":
      return (
        <svg {...base}>
          <path d="M6 6h6a3 3 0 1 1 0 6H9a3 3 0 1 0 0 6h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    default:
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
  }
}

