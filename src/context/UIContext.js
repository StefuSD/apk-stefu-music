import { createContext, useContext } from 'react';

// Окна, которые открываются с разных экранов: редактор песни и полный плеер.
const UICtx = createContext({ openEditor: () => {}, openPlayer: () => {} });
export const UIProvider = UICtx.Provider;
export const useUI = () => useContext(UICtx);
