import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  key?: React.Key;
  className?: string;
  children?: React.ReactNode;
  variant?: 'default' | 'glass' | 'raised';
}

export function Card({ className = '', variant = 'default', children, ...props }: CardProps) {
  const baseStyles = 'rounded-xl overflow-hidden max-w-full';
  
  const variants = {
    default: 'bg-surface border border-border',
    glass: 'glass-panel',
    raised: 'glass-panel-raised'
  };

  return (
    <div className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-3.5 sm:p-5 md:p-6 border-b border-border ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-3.5 sm:p-5 md:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-3.5 sm:p-5 md:p-6 border-t border-border flex items-center ${className}`} {...props}>
      {children}
    </div>
  );
}