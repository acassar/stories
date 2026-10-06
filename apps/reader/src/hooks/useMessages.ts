import { createContext, useContext } from 'react';

import { DEFAULT_LOCALE, MESSAGES } from '../lib/i18n';
import type { Messages } from '../lib/i18n';

/**
 * The words of the reader in the language it is set to. Provided once by the
 * app shell: every screen reads them from here rather than having them passed
 * down through props that would only carry them along.
 */
export const MessagesContext = createContext<Messages>(MESSAGES[DEFAULT_LOCALE]);

export function useMessages(): Messages {
  return useContext(MessagesContext);
}
