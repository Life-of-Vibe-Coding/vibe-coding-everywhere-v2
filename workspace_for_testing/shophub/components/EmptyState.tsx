import Link from 'next/link';
import type { ReactNode } from 'react';

interface EmptyStateAction {
  label: string;
  href: string;
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: EmptyStateAction;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-20">
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 text-primary">
        {icon}
      </div>
      <h2 className="font-heading font-bold text-2xl text-text mb-4">
        {title}
      </h2>
      <p className="font-body text-gray-600 mb-6">
        {description}
      </p>
      {action && (
        <Link
          href={action.href}
          className="inline-block px-8 py-3 bg-primary hover:bg-secondary text-white font-semibold rounded-lg transition-colors cursor-pointer"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
