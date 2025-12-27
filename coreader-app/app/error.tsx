'use client';

import { useEffect } from 'react';
import { PageContainer } from '@/ui/PageContainer';
import { Section } from '@/ui/Section';
import { SectionHeader } from '@/ui/SectionHeader';
import { ErrorBanner } from '@/ui/ErrorBanner';
import { Button } from '@/ui/Button';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('Root layout error:', error);
  }, [error]);

  return (
    <PageContainer>
      <SectionHeader label="Error" title="Something went wrong" />
      <Section className="mt-4">
        <ErrorBanner message="We hit an unexpected error while loading this page." title="Page error" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => reset()}>Try again</Button>
          <Button href="/">Back to home</Button>
        </div>
      </Section>
    </PageContainer>
  );
}
