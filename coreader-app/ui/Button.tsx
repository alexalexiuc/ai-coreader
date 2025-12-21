'use client';

import React from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Spinner } from './Spinner';

type ButtonProps = {
  children: React.ReactNode;
  href?: string;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  paddingClass?: string;
  textSizeClass?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const baseStyles =
  'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all select-none focus:outline-none disabled:opacity-50 cursor-pointer disabled:pointer-events-none';

const variantStyles: Record<string, string> = {
  primary:
    'rounded-xl border border-slate-800 bg-slate-950/70 text-slate-200 hover:border-slate-700',
  active:
    'rounded-xl border border-slate-800 bg-slate-950/70 text-slate-200 hover:border-slate-700',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  href,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className,
  paddingClass,
  textSizeClass,
  ...props
}) => {
  const classes = clsx(
    baseStyles,
    variantStyles[variant],
    fullWidth && 'w-full',
    paddingClass ?? 'px-4 py-2',
    className,
    textSizeClass ?? 'text-sm',
    (disabled || loading) && 'opacity-50 pointer-events-none',
  );

  const content = loading ? (
    <Spinner height={20} width={20} />
  ) : (
    <>
      {leftIcon && <span className="flex items-center">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="flex items-center">{rightIcon}</span>}
    </>
  );

  if (href) {
    // Render as a Link when href is provided
    return (
      <Link href={href} className={classes} {...(props as any)} aria-disabled={disabled || loading}>
        {content}
      </Link>
    );
  }

  return (
    <button {...props} disabled={disabled || loading} className={classes}>
      {content}
    </button>
  );
};
