import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { translationApi } from "@/features/translations/services/translationApi";
import type { TranslationListParams } from "@/features/translations/types/translationTypes";
import { translationKeys } from "./queryKeys";

/** Paged workflow-translations list, cached per {page,size,search}. */
export const useTranslationsList = (params: TranslationListParams) =>
  useQuery({
    queryKey: translationKeys.list({ ...params }),
    queryFn: () => translationApi.list(params),
    placeholderData: keepPreviousData,
  });
