import type { Metadata } from 'next';
import { Lab } from './lab';

export const metadata: Metadata = {
  title: 'Llameo · Laboratorio de grabación',
  robots: { index: false, follow: false },
};

export default function RecordingLabPage() {
  return (
    <main className="phone">
      <Lab />
    </main>
  );
}
