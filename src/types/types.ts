export type PipefyCard = {
  id: string;
  title: string;
  createdAt: string;
  updated_at: string;
  due_date: string | null;
  done: boolean;
  current_phase: { id: string; name: string } | null;
  assignees: { id: string; name: string }[];
  labels: { name: string }[];
  fields: { name: string; value: string | null }[];
};

export type Card = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  dueDate: number | null;
  done: boolean;
  phaseId: string | null;
  phase: string;
  assigneeIds: string[];
  assigneeNames: string[];
  labels: string[];
  fields: Record<string, string | null>;
};
