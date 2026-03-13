import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { forwardGeocode } from "@/services/locationService";

interface PlaceSuggestion {
  lat: number;
  lng: number;
  display: string;
}

interface PlaceAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: PlaceSuggestion) => void;
  placeholder?: string;
  className?: string;
  minChars?: number;
}

export default function PlaceAutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder = "Search location",
  className,
  minChars = 3,
}: PlaceAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const query = value.trim();
    if (query.length < minChars) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await forwardGeocode(query);
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, minChars]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <Input
        placeholder={placeholder}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }

          if (e.key === "Enter" && suggestions.length > 0) {
            e.preventDefault();
            onSelect(suggestions[0]);
            setOpen(false);
          }
        }}
      />

      {loading && value.trim().length >= minChars && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-card border rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
          {suggestions.map((suggestion, index) => {
            const parts = suggestion.display.split(",");
            const primary = parts[0]?.trim() || suggestion.display;
            const secondary = parts.slice(1, 3).map((p) => p.trim()).join(", ");

            return (
              <button
                key={`${suggestion.lat}-${suggestion.lng}-${index}`}
                type="button"
                onClick={() => {
                  onSelect(suggestion);
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-muted/60 flex items-start gap-3 border-b last:border-0 transition-colors"
              >
                <MapPin className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{primary}</p>
                  {secondary && <p className="text-xs text-muted-foreground truncate">{secondary}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
