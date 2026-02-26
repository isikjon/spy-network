import { createContext, useContext, useState, type ReactNode } from 'react';

type WebDossierContextType = {
  selectedDossierId: string | null;
  selectedEdit: boolean;
  openDossier: (id: string, edit?: boolean) => void;
  closeDossier: () => void;
};

const WebDossierContext = createContext<WebDossierContextType>({
  selectedDossierId: null,
  selectedEdit: false,
  openDossier: () => {},
  closeDossier: () => {},
});

export function WebDossierProvider({ children }: { children: ReactNode }) {
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const [selectedEdit, setSelectedEdit] = useState(false);

  const openDossier = (id: string, edit = false) => {
    setSelectedDossierId(id);
    setSelectedEdit(edit);
  };

  const closeDossier = () => {
    setSelectedDossierId(null);
    setSelectedEdit(false);
  };

  return (
    <WebDossierContext.Provider value={{ selectedDossierId, selectedEdit, openDossier, closeDossier }}>
      {children}
    </WebDossierContext.Provider>
  );
}

export const useWebDossier = () => useContext(WebDossierContext);
