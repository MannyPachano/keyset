import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/* Vitest runs here without global test APIs, so Testing Library's own auto
   cleanup never registers itself: it looks for a global afterEach and does not
   find one. Without this line every test leaves its render in the document and
   the next one queries a page holding several copies of the app, which reads
   as dozens of unrelated failures. */
afterEach(cleanup);
