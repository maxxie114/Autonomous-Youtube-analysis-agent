import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowStep {
  id: string;
  label: string;
  status: "pending" | "active" | "complete";
  description?: string;
}

interface AgentWorkflowProps {
  steps: WorkflowStep[];
}

export const AgentWorkflow = ({ steps }: AgentWorkflowProps) => {
  return (
    <div className="space-y-4 p-6 bg-secondary/30 rounded-xl border border-border/50 backdrop-blur-sm">
      <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        Agent Workflow
      </h3>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              "flex items-start gap-3 transition-all duration-300",
              step.status === "active" && "scale-[1.02]"
            )}
          >
            <div className="flex-shrink-0 mt-0.5">
              {step.status === "complete" && (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              )}
              {step.status === "active" && (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              )}
              {step.status === "pending" && (
                <Circle className="h-5 w-5 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-sm font-medium transition-colors",
                  step.status === "complete" && "text-foreground",
                  step.status === "active" && "text-primary font-semibold",
                  step.status === "pending" && "text-muted-foreground"
                )}
              >
                {step.label}
              </p>
              {step.description && step.status !== "pending" && (
                <p className="text-xs text-muted-foreground mt-1 animate-in fade-in slide-in-from-left-1 duration-300">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
