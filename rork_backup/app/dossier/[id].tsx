import { DossierPane } from '@/components/DossierPane';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function DossierScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();

  if (!id) {
    return null;
  }

  return <DossierPane dossierId={id} initialEdit={edit === 'true'} />;
}
