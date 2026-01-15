'use client';

import { useEffect } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
import type { BlockEntity } from './types';

type EntityPopupProps = {
  entity: BlockEntity;
  anchorElement: HTMLElement;
  isOpen: boolean;
  onClose: () => void;
};

export function EntityPopup({ entity, anchorElement, isOpen, onClose }: EntityPopupProps) {
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
    placement: 'bottom',
    middleware: [
      offset(12),
      flip({
        fallbackAxisSideDirection: 'start',
        padding: 8,
      }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, elements }) {
          // Limit the popup height to available space minus some padding
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.max(200, availableHeight - 16)}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context, {
    outsidePress: true,
  });
  const role = useRole(context);

  const { getFloatingProps } = useInteractions([click, dismiss, role]);

  // Set the anchor element as reference
  useEffect(() => {
    if (anchorElement) {
      refs.setReference(anchorElement);
    }
  }, [anchorElement, refs]);

  if (!isOpen) return null;

  return (
    <FloatingPortal>
      {/* eslint-disable react-hooks/refs */}
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        {...getFloatingProps()}
        className="z-40 w-80 max-w-[calc(100vw-32px)] rounded-xl border border-amber-400/30 bg-slate-950/95 shadow-2xl shadow-amber-500/10 backdrop-blur"
      >
        {/* eslint-enable react-hooks/refs */}
        <div className="flex max-h-[inherit] flex-col overflow-hidden p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-amber-100">{entity.name}</div>
              <div className="text-xs uppercase tracking-wide text-amber-200/80">{entity.type}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
            >
              Close
            </button>
          </div>

          <div className="overflow-y-auto pr-2">
            {entity.description ? (
              <EntityDetails description={entity.description} />
            ) : (
              <p className="text-xs text-slate-400">No extra details available for this entity yet.</p>
            )}
          </div>
        </div>
      </div>
    </FloatingPortal>
  );
}

type EntityDetailsProps = {
  description: NonNullable<BlockEntity['description']>;
};

function EntityDetails({ description }: EntityDetailsProps) {
  return (
    <div className="space-y-2 text-sm">
      {description.descriptionCurrent && <p className="text-slate-100">{description.descriptionCurrent}</p>}
      {description.aliases && description.aliases.length > 0 && (
        <p className="text-slate-200">
          <span className="text-slate-400">Also known as: </span>
          {description.aliases.join(', ')}
        </p>
      )}
      {renderList('Key Facts', description.keyFacts)}
      {renderList('Uncertainties', description.uncertainties)}
    </div>
  );
}

function renderList(label: string, items?: string[]) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-amber-200/80">{label}</div>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-100">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
