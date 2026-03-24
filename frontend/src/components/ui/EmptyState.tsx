import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
}

export function EmptyState({ icon, title, description, actions }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center">
          <div className="text-muted-foreground/40">{icon}</div>
        </div>
        <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" />
      </div>
      <h3 className="font-display text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-6 leading-relaxed">{description}</p>
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actions.map((action, i) => (
            <Button
              key={i}
              variant={action.variant || (i === 0 ? "default" : "outline")}
              onClick={action.onClick}
              className={`rounded-xl btn-press ${i === 0 ? "gradient-bg text-primary-foreground border-0" : ""}`}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
