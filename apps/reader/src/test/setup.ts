import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sans `globals: true`, Testing Library n'enregistre pas son nettoyage :
// on le fait ici, sinon les DOM de deux tests se superposent.
afterEach(cleanup);

/**
 * jsdom n'implemente pas `matchMedia`. On le remplace en demandant du
 * mouvement reduit : les tests lisent alors les scenes d'un bloc, sans avoir a
 * piloter des minuteries pour verifier une regle de recit.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom ne sait pas defiler : les appels de confort ne doivent pas casser.
Element.prototype.scrollTo = () => {};
