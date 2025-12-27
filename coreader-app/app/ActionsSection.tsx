import type { IconType } from 'react-icons';

import { ActionCard } from '../ui/ActionCard';
import { SectionHeader } from '../ui/SectionHeader';
import { IoCloudUploadOutline, IoLibraryOutline, IoStorefrontOutline, IoPersonOutline } from 'react-icons/io5';

export type ActionItem = {
  icon: IconType;
  label: string;
  description: string;
  pathTo: string;
  badge?: string;
  disabled?: boolean;
};

const actions: ActionItem[] = [
  {
    icon: IoCloudUploadOutline,
    label: 'Uploads',
    description: 'Add new titles to your private library.',
    pathTo: '/uploads',
  },
  {
    icon: IoLibraryOutline,
    label: 'Library',
    description: 'Open books, track processing, manage your collection.',
    pathTo: '/library',
  },
  {
    icon: IoStorefrontOutline,
    label: 'Shop',
    description: 'Browse free + curated books ready to read.',
    pathTo: '/shop',
    badge: 'Soon',
    disabled: true,
  },
  {
    icon: IoPersonOutline,
    label: 'Account',
    description: 'Email, password, and notifications.',
    pathTo: '/account',
    badge: 'Soon',
    disabled: true,
  },
];

export function ActionsSection() {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="Actions" title="Jump To" titleSize="xl" spaceBetween={false} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((action) => (
          <ActionCard key={action.label} {...action} />
        ))}
      </div>
    </section>
  );
}
