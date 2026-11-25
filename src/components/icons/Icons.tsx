import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

function resolveSize(size: number | undefined): number {
  if (size !== undefined) {
    return size;
  }
  return 20;
}

/* ==========================================================================
   Icônes interface (trait vectoriel sobre style Lucide, 24x24)
   ========================================================================== */

export function TableCardsIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <rect x="3" y="4" width="12" height="16" rx="2" />
      <path d="M15 7h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-1" />
      <path d="M9 10v4" />
      <path d="M7 12h4" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

export function BookOpenIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function MegaphoneIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d="m3 11 18-5v12L3 14v-3Z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

export function BellAlertIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function FlagIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" x2="4" y1="22" y2="15" />
    </svg>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function EditIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function ProjectorScreenIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
      <polygon points="10 7.5 15 10 10 12.5 10 7.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ==========================================================================
   Enseignes de cartes à jouer SVG (Pique, Cœur, Carreau, Trèfle)
   ========================================================================== */

export function SpadeSuitIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M12 2C9 6 4 9.6 4 14a4.5 4.5 0 0 0 6.8 3.8L9.6 21h4.8l-1.2-3.2A4.5 4.5 0 0 0 20 14c0-4.4-5-8-8-12Z" />
    </svg>
  );
}

export function HeartSuitIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M12 21s-8-5.2-8-11a4.8 4.8 0 0 1 8-3.4A4.8 4.8 0 0 1 20 10c0 5.8-8 11-8 11Z" />
    </svg>
  );
}

export function DiamondSuitIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M12 2 4 12l8 10 8-10-8-10Z" />
    </svg>
  );
}

export function ClubSuitIcon(props: IconProps) {
  const { size, ...rest } = props;
  const px = resolveSize(size);
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <circle cx="12" cy="7.5" r="3.8" />
      <circle cx="7.6" cy="13.2" r="3.8" />
      <circle cx="16.4" cy="13.2" r="3.8" />
      <path d="M10.4 15.5 9.2 21h5.6l-1.2-5.5h-3.2Z" />
    </svg>
  );
}
