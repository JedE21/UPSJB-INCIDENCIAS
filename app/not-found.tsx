import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
        <SearchX className="size-7 text-primary" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold">Página no encontrada</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        La página que buscas no existe o fue movida.
      </p>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
