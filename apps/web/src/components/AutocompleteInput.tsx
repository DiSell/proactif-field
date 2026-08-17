import { useEffect, useState } from "react";
import { useRecordTerm, useTermSuggestions } from "../api/hooks";

interface Props {
  field: string;
  value: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  autoFocus?: boolean;
  required?: boolean;
}

// Generic, business-agnostic autocomplete: suggests values previously typed
// for this same `field` across the whole team (ranked by frequency and
// recency), while always allowing free typing. Whatever is committed
// (blur, or picking a suggestion) is recorded back into the shared library
// for next time — no hardcoded vocabulary for any trade.
export default function AutocompleteInput({
  field,
  value,
  onChange,
  onCommit,
  placeholder,
  multiline,
  rows,
  autoFocus,
  required,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const recordTerm = useRecordTerm();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), 150);
    return () => clearTimeout(t);
  }, [value]);

  const { data: suggestions } = useTermSuggestions(field, debouncedValue, focused);
  const visibleSuggestions = (suggestions ?? []).filter((s) => s.value !== value);

  function commit(finalValue: string) {
    const trimmed = finalValue.trim();
    if (trimmed) {
      recordTerm.mutate({ field, value: trimmed });
    }
    onCommit?.(finalValue);
  }

  function selectSuggestion(v: string) {
    onChange(v);
    commit(v);
    setFocused(false);
  }

  const sharedProps = {
    value,
    placeholder,
    autoFocus,
    required,
    onFocus: () => setFocused(true),
    onBlur: () => {
      commit(value);
      setFocused(false);
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  };

  return (
    <div className="autocomplete">
      {multiline ? <textarea rows={rows ?? 3} {...sharedProps} /> : <input {...sharedProps} />}
      {focused && visibleSuggestions.length > 0 && (
        <div className="autocomplete-list">
          {visibleSuggestions.map((s) => (
            <button
              key={s.value}
              type="button"
              className="autocomplete-item"
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(s.value);
              }}
            >
              {s.value}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
