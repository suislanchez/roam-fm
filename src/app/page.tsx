'use client';
import { useState } from 'react';
import WorldMap from '../components/WorldMap';

export default function Home() {
  const [tag, setTag] = useState('jazz');

  return (
    <main className="flex flex-col h-full">
      <h1 className="text-center text-2xl font-bold my-4">🎧 roam-FM</h1>

      <select
        value={tag}
        onChange={e => setTag(e.target.value)}
        className="block mx-auto mb-4 p-2 rounded border border-gray-300"
      >
        <option value="jazz">Jazz</option>
        <option value="rock">Rock</option>
        <option value="classical">Classical</option>
        <option value="electronic">Electronic</option>
        <option value="lofi">Lofi</option>
      </select>

      <div className="flex-1">
        <WorldMap tag={tag} />
      </div>
    </main>
  );
}
