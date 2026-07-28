import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  key?: React.Key;
  className?: string;
  children?: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border';
  
  const variants = {
    default: 'bg-surface-active text-text-secondary border-border',
    primary: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
    info: 'bg-info/10 text-info border-info/20'
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}