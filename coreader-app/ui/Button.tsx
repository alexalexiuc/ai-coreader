'use client';

import React from 'react';
import Link, { type LinkProps } from 'next/link';
import clsx from 'clsx';
import { Spinner } from './Spinner';

const isLink = (props: ButtonProps): props is ButtonAsLinkProps => {
  return 'href' in props;
};

type CommonProps = {
  children: React.ReactNode;
  variant?: 'primary' | 'danger';
  isLoading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  paddingClass?: string;
  textSizeClass?: string;
};

type ButtonAsButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: undefined;
  };

type ButtonAsLinkProps = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps | 'href'> &
  Pick<LinkProps, 'prefetch' | 'replace' | 'scroll' | 'shallow' | 'locale'> & {
    href: LinkProps['href'];
  };

type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

const baseStyles =
  'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all select-none focus:outline-none disabled:opacity-50 cursor-pointer disabled:pointer-events-none';

const variantStyles: Record<string, string> = {
  primary: 'rounded-xl border border-slate-800 bg-slate-950/70 text-slate-200 hover:border-slate-700',
  danger: 'rounded-xl border border-rose-800 bg-rose-950/70 text-rose-200 hover:border-rose-700 hover:bg-rose-950/90',
};

export const Button: React.FC<ButtonProps> = (props) => {
  const {
    children,
    variant = 'primary',
    isLoading: loading = false,
    disabled = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    className,
    paddingClass,
    textSizeClass,
  } = props;

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

  if (isLink(props)) {
    // Link branch: only link-safe props are allowed here by type
    const { href, prefetch, replace, scroll, shallow, locale, ...anchorProps } = props;

    return (
      <Link
        href={href}
        prefetch={prefetch}
        replace={replace}
        scroll={scroll}
        shallow={shallow}
        locale={locale}
        className={classes}
        aria-disabled={disabled || loading}
        tabIndex={disabled || loading ? -1 : anchorProps.tabIndex}
        onClick={(e) => {
          if (disabled || loading) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          anchorProps.onClick?.(e);
        }}
        {...anchorProps}
      >
        {content}
      </Link>
    );
  }

  // Button branch
  const { ...buttonProps } = props;

  return (
    <button {...buttonProps} disabled={disabled || loading} className={classes}>
      {content}
    </button>
  );
};
