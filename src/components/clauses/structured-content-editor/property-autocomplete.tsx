"use client";

import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  getEntityProperties,
} from "@/lib/clauses/entity-definitions";

interface PropertyAutocompleteProps {
  /** Entidad para la cual mostrar propiedades */
  entity: string;
  /** Valor actual del textarea */
  value: string;
  /** Callback cuando cambia el valor */
  onChange: (value: string) => void;
  /** Placeholder del textarea */
  placeholder?: string;
  /** Si está deshabilitado */
  disabled?: boolean;
}

/**
 * Componente de textarea con autocomplete para propiedades dentro del template de iteración
 * Detecta cuando usuario escribe `{{` y muestra sugerencias de propiedades
 */
export function PropertyAutocomplete({
  entity,
  value,
  onChange,
  placeholder = "Escribe el template...",
  disabled = false,
}: PropertyAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionPosition, setSuggestionPosition] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [filteredProperties, setFilteredProperties] = useState<
    Array<{ key: string; label: string }>
  >([]);

  const entityProperties = getEntityProperties(entity);

  useEffect(() => {
    if (!entityProperties) {
      setFilteredProperties([]);
      return;
    }

    const properties = Object.entries(entityProperties).map(([key, label]) => ({
      key,
      label,
    }));
    setFilteredProperties(properties);
  }, [entity, entityProperties]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart;

    onChange(newValue);

    // Detectar si el usuario escribió `{{`
    const textBeforeCursor = newValue.substring(0, newCursorPos);
    const lastOpen = textBeforeCursor.lastIndexOf("{{");

    if (
      lastOpen !== -1 &&
      !textBeforeCursor.substring(lastOpen + 2).includes("}}")
    ) {
      // Hay un `{{` abierto antes del cursor y no está cerrado
      setShowSuggestions(true);
      setSuggestionPosition(lastOpen);
      setCursorPosition(newCursorPos);
    } else {
      setShowSuggestions(false);
    }
  };

  const insertProperty = (property: string) => {
    const textBefore = value.substring(0, suggestionPosition);
    const textAfter = value.substring(cursorPosition);
    const newValue = `${textBefore}{{${property}}}${textAfter}`;
    onChange(newValue);
    setShowSuggestions(false);

    // Restaurar focus y posición del cursor
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos =
          suggestionPosition + 2 + property.length + 2; // {{ + property + }}
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Si hay sugerencias abiertas, permitir cerrarlas con Escape
    if (showSuggestions && e.key === "Escape") {
      setShowSuggestions(false);
      e.preventDefault();
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="font-mono text-sm"
        rows={4}
      />
      {showSuggestions && filteredProperties.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="p-1">
            <div className="text-xs font-semibold px-2 py-1.5 text-muted-foreground">
              Propiedades disponibles:
            </div>
            {filteredProperties.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                onClick={() => insertProperty(key)}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {`{{${key}}}`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Escribe <code className="px-1 py-0.5 bg-muted rounded">{"{{"}</code>{" "}
        para ver propiedades disponibles
      </p>
    </div>
  );
}

