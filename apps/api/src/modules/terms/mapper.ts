import { TermValue } from "@prisma/client";
import { TermSuggestionDTO } from "@proactif-field/shared";

export function toTermSuggestionDTO(term: TermValue): TermSuggestionDTO {
  return {
    value: term.value,
    useCount: term.useCount,
    lastUsedAt: term.lastUsedAt.toISOString(),
  };
}
