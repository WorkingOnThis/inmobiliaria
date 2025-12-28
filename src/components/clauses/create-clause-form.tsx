"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  CLAUSE_CATEGORIES,
  MAX_TITLE_LENGTH,
  MAX_CONTENT_LENGTH,
  type ClauseCategory,
} from "@/lib/clauses/constants";
import { ClauseContentEditor } from "./structured-content-editor/clause-content-editor";
import { serializeStructuredContent } from "@/lib/clauses/structured-content/serializer";
import { validateStructuredContent } from "@/lib/clauses/structured-content/validator";
import type { StructuredContent } from "@/lib/clauses/structured-content/types";

/**
 * CreateClauseForm Component
 *
 * Formulario para crear nuevas plantillas de cláusulas de contratos.
 * Incluye validación de campos requeridos y límites de longitud.
 */
export function CreateClauseForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [contentMode, setContentMode] = useState<"plain" | "structured">(
    "structured"
  );
  const [structuredContent, setStructuredContent] = useState<StructuredContent>(
    {
      type: "structured",
      parts: [{ type: "text", content: "" }],
    }
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateTitle = (titleValue: string): boolean => {
    if (!titleValue.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        title: "El título es requerido",
      }));
      return false;
    }
    if (titleValue.length > MAX_TITLE_LENGTH) {
      setFieldErrors((prev) => ({
        ...prev,
        title: `El título no puede exceder ${MAX_TITLE_LENGTH} caracteres`,
      }));
      return false;
    }
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.title;
      return newErrors;
    });
    return true;
  };

  const validateCategory = (categoryValue: string): boolean => {
    if (!categoryValue) {
      setFieldErrors((prev) => ({
        ...prev,
        category: "La categoría es requerida",
      }));
      return false;
    }
    if (!CLAUSE_CATEGORIES.includes(categoryValue as ClauseCategory)) {
      setFieldErrors((prev) => ({
        ...prev,
        category: "La categoría seleccionada no es válida",
      }));
      return false;
    }
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.category;
      return newErrors;
    });
    return true;
  };

  const validateContent = (contentValue: string): boolean => {
    if (!contentValue.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        content: "El contenido es requerido",
      }));
      return false;
    }
    if (contentValue.length > MAX_CONTENT_LENGTH) {
      setFieldErrors((prev) => ({
        ...prev,
        content: `El contenido no puede exceder ${MAX_CONTENT_LENGTH} caracteres`,
      }));
      return false;
    }
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.content;
      return newErrors;
    });
    return true;
  };

  const validateStructured = (): boolean => {
    // Validar que haya al menos una parte con contenido
    const hasContent = structuredContent.parts.some((part) => {
      if (part.type === "text") {
        return part.content.trim().length > 0;
      }
      return true; // Variables e iteraciones siempre tienen contenido
    });

    if (!hasContent) {
      setFieldErrors((prev) => ({
        ...prev,
        content: "El contenido es requerido",
      }));
      return false;
    }

    // Validar estructura
    const validation = validateStructuredContent(structuredContent);
    if (!validation.valid) {
      setFieldErrors((prev) => ({
        ...prev,
        content: validation.errors.join(". "),
      }));
      return false;
    }

    // Validar longitud después de serializar
    try {
      const serialized = serializeStructuredContent(structuredContent);
      if (serialized.length > MAX_CONTENT_LENGTH) {
        setFieldErrors((prev) => ({
          ...prev,
          content: `El contenido serializado excede ${MAX_CONTENT_LENGTH} caracteres`,
        }));
        return false;
      }
    } catch (err) {
      setFieldErrors((prev) => ({
        ...prev,
        content: "Error al validar el contenido estructurado",
      }));
      return false;
    }

    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.content;
      return newErrors;
    });
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Validar todos los campos
    const isTitleValid = validateTitle(title);
    const isCategoryValid = validateCategory(category);
    
    let finalContent = "";
    let isContentValid = false;

    if (contentMode === "structured") {
      isContentValid = validateStructured();
      if (isContentValid) {
        try {
          finalContent = serializeStructuredContent(structuredContent);
        } catch (err) {
          setError("Error al serializar el contenido estructurado");
          return;
        }
      }
    } else {
      isContentValid = validateContent(content);
      if (isContentValid) {
        finalContent = content.trim();
      }
    }

    if (!isTitleValid || !isCategoryValid || !isContentValid) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/clauses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          category: category,
          content: finalContent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Error al crear la cláusula. Por favor intenta de nuevo."
        );
        return;
      }

      // Éxito - redirigir al tablero con mensaje de éxito
      router.push("/tablero?success=clause_created");
      router.refresh();
    } catch (err) {
      console.error("Clause creation error:", err);
      setError(
        "Ocurrió un error al crear la cláusula. Por favor intenta de nuevo."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-2xl">
      {/* Title Field */}
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Título <span className="text-destructive">*</span>
        </label>
        <Input
          id="title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (fieldErrors.title) {
              validateTitle(e.target.value);
            }
          }}
          onBlur={() => validateTitle(title)}
          disabled={isLoading}
          required
          maxLength={MAX_TITLE_LENGTH}
          placeholder="Ej: Cláusula de Pago Mensual"
          aria-invalid={fieldErrors.title ? "true" : "false"}
        />
        <div className="flex justify-between items-center mt-1">
          {fieldErrors.title && (
            <p className="text-sm text-destructive">{fieldErrors.title}</p>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {title.length}/{MAX_TITLE_LENGTH}
          </span>
        </div>
      </div>

      {/* Category Field */}
      <div>
        <label
          htmlFor="category"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Categoría <span className="text-destructive">*</span>
        </label>
        <Select
          value={category}
          onValueChange={(value) => {
            setCategory(value);
            if (fieldErrors.category) {
              validateCategory(value);
            }
          }}
          disabled={isLoading}
          required
        >
          <SelectTrigger
            id="category"
            className="w-full"
            aria-invalid={fieldErrors.category ? "true" : "false"}
          >
            <SelectValue placeholder="Selecciona una categoría" />
          </SelectTrigger>
          <SelectContent>
            {CLAUSE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.category && (
          <p className="mt-1 text-sm text-destructive">
            {fieldErrors.category}
          </p>
        )}
      </div>

      {/* Content Field */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label
            htmlFor="content"
            className="block text-sm font-medium text-foreground"
          >
            Contenido <span className="text-destructive">*</span>
          </label>
          <div className="flex items-center gap-2">
            <Label htmlFor="content-mode" className="text-xs text-muted-foreground">
              Modo:
            </Label>
            <Select
              value={contentMode}
              onValueChange={(value: "plain" | "structured") => {
                setContentMode(value);
                setFieldErrors((prev) => {
                  const newErrors = { ...prev };
                  delete newErrors.content;
                  return newErrors;
                });
              }}
              disabled={isLoading}
            >
              <SelectTrigger id="content-mode" className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="structured">Estructurado</SelectItem>
                <SelectItem value="plain">Texto Plano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {contentMode === "structured" ? (
          <div>
            <ClauseContentEditor
              value={structuredContent}
              onChange={setStructuredContent}
              disabled={isLoading}
            />
            {fieldErrors.content && (
              <p className="mt-2 text-sm text-destructive">
                {fieldErrors.content}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Usa el editor visual para agregar variables y listas de forma
              intuitiva.
            </p>
          </div>
        ) : (
          <div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (fieldErrors.content) {
                  validateContent(e.target.value);
                }
              }}
              onBlur={() => validateContent(content)}
              disabled={isLoading}
              required
              maxLength={MAX_CONTENT_LENGTH}
              placeholder="Ej: El inquilino se compromete a pagar el monto de {{monto_mensual}} el día {{dia_pago}} de cada mes."
              rows={10}
              className="resize-y"
              aria-invalid={fieldErrors.content ? "true" : "false"}
            />
            <div className="flex justify-between items-center mt-1">
              {fieldErrors.content && (
                <p className="text-sm text-destructive">{fieldErrors.content}</p>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {content.length}/{MAX_CONTENT_LENGTH}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Puedes usar variables en el formato{" "}
              <code className="px-1 py-0.5 bg-muted rounded text-xs">
                {"{{nombre_variable}}"}
              </code>
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? "Guardando..." : "Crear Cláusula"}
        </Button>
      </div>
    </form>
  );
}
