import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, CheckSquare, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

export const WorkspaceTasks = () => {
  const [search, setSearch] = useState("");

  const stats = [
    { label: "Total", value: 0, icon: CheckSquare, color: "text-primary" },
    { label: "Em andamento", value: 0, icon: Clock, color: "text-blue-500" },
    { label: "Concluídas", value: 0, icon: CheckCircle2, color: "text-emerald-500" },
    { label: "Atrasadas", value: 0, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas atividades</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-1" /> Nova Tarefa
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tarefas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {["Tarefa", "Status", "Prioridade", "Vencimento"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                Nenhuma tarefa cadastrada ainda.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default WorkspaceTasks;