'use client';
import { useState } from 'react';
import WorldMap from '../components/WorldMap';

export default function Home() {
  const [tag, setTag] = useState('jazz');

  return (
    <main className="flex flex-col h-full">
      <div className="flex-1">
        <WorldMap tag={tag} onTagChange={setTag} />
      </div>
    </main>
  );
}
