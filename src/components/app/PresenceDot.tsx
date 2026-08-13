import { cn } from "@/lib/utils";

const map: Record<string, string> = {
  online: "bg-success",
  idle: "bg-warning",
  dnd: "bg-destructive",
  invisible: "bg-muted-foreground",
};

export function PresenceDot({ presence, className }: { presence?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full ring-2 ring-card",
        map[presence ?? "online"] ?? "bg-muted-foreground",
        className ?? "h-3 w-3",
      )}
    />
  );
}
