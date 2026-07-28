import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e?: any) => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Button({ 
  className = '', 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false,
  children, 
  ...props 
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-mono font-bold uppercase transition-all rounded-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 leading-tight text-center max-w-full';
  
  const variants = {
    primary: 'bg-primary text-black hover:bg-primary-focus shadow-md shadow-primary/10',
    secondary: 'bg-secondary text-black hover:bg-secondary/90 shadow-md shadow-secondary/10',
    outline: 'bg-transparent border border-border hover:border-primary/50 text-text-primary hover:text-primary',
    ghost: 'bg-transparent hover:bg-surface-active text-text-secondary hover:text-text-primary',
    danger: 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const width = fullWidth ? 'w-full' : '';

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${width} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}