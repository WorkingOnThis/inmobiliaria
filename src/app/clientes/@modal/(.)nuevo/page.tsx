"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ClientForm } from "@/components/clients/client-form";

export default function NewClientModal() {
  const router = useRouter();

  const handleClose = () => {
    router.back();
  };

  return (
    <Dialog open={true} onOpenChange={(open) => {
      if (!open) {
        // We handle closing via the cancel button in the form
      }
    }}>
      <DialogContent 
        className="sm:max-w-[600px] [&>button:last-child]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Nuevo Cliente</DialogTitle>
          <DialogDescription>
            Ingresa los datos del nuevo cliente para registrarlo en el sistema.
          </DialogDescription>
        </DialogHeader>
        <ClientForm 
          onSuccess={handleClose} 
          onCancel={handleClose} 
        />
      </DialogContent>
    </Dialog>
  );
}

