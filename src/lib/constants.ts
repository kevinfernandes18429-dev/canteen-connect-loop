export const BREAK_TIMES = [
  { value: "break_1", labelId: "Istirahat 1 (09:30)", labelEn: "Break 1 (09:30)" },
  { value: "break_2", labelId: "Istirahat 2 (12:00)", labelEn: "Break 2 (12:00)" },
  { value: "after_school", labelId: "Pulang sekolah (15:00)", labelEn: "After school (15:00)" },
];

export const ORDER_STATUSES = ["pending", "preparing", "in_kitchen", "ready", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  preparing: "bg-accent/15 text-accent",
  in_kitchen: "bg-warning/20 text-foreground",
  ready: "bg-success/15 text-success",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
};
