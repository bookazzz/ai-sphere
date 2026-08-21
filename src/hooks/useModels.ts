'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  categories as staticCategories,
  allModels as staticModels,
  loadModelsFromApi,
  subscribeToModelsUpdates,
  type ModelCategory,
  type ModelItem,
} from '@/lib/models-data';

interface ModelsState {
  categories: ModelCategory[];
  allModels: ModelItem[];
  loading: boolean;
}

export function useModels(): ModelsState {
  const [state, setState] = useState<ModelsState>({
    categories: staticCategories,
    allModels: staticModels,
    loading: true,
  });

  const refresh = useCallback(() => {
    setState({
      categories: [...staticCategories],
      allModels: [...staticModels],
      loading: false,
    });
  }, []);

  useEffect(() => {
    // Первая загрузка
    loadModelsFromApi().then(refresh);

    // Подписка на обновления (автоматически при каждом loadModelsFromApi)
    const unsub = subscribeToModelsUpdates(refresh);

    // Polling каждые 60 секунд
    const interval = setInterval(() => {
      loadModelsFromApi();
    }, 30000);

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [refresh]);

  return state;
}
