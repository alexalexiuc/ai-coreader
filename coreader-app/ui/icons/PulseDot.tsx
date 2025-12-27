import type React from 'react';
import type { IconType } from 'react-icons';

export const PulseDot: IconType = ({ size, color, title, className, style, ...props }) => {
  const dimension = size ? (typeof size === 'number' ? `${size}px` : size) : '0.5rem';
  const outerClassName = ['relative inline-flex', className].filter(Boolean).join(' ');

  return (
    <span
      className={outerClassName}
      style={{ width: dimension, height: dimension, ...style }}
      title={title}
      {...(props as React.HTMLAttributes<HTMLSpanElement>)}
    >
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-400/60 opacity-75"
        style={color ? { backgroundColor: color } : undefined}
      />
      <span
        className="relative inline-flex h-full w-full rounded-full bg-slate-300/70"
        style={color ? { backgroundColor: color } : undefined}
      />
    </span>
  );
};
