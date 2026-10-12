import { readFileSync } from 'node:fs';
import { validateSeed } from '../src/lib/places.ts';

const file = process.argv[2];
if (!file) { console.error('usage: npm run seed:check -- <places.json>'); process.exit(2); }
const seed = validateSeed(JSON.parse(readFileSync(file, 'utf8')));
const count = (nodes) => nodes.reduce((n, x) => n + 1 + count(x.children ?? []), 0);
console.log(`ok: ${count(seed)} places`);
