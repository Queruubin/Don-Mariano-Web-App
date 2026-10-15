import type { LucideIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  icon: LucideIcon;
  /** Grid placement on wide screens. */
  className?: string;
  aside?: ReactNode;
  children: ReactNode;
}

export function SectionCard({ title, icon: Icon, className = '', aside, children }: SectionCardProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={`card min-w-0 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 bg-surface-alt px-4 py-3">
        <h2 id={headingId} className="flex items-center gap-2 text-xl">
          <Icon aria-hidden="true" className="size-6 text-text-muted" />
          {title}
        </h2>
        {aside}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
