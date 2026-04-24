import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DollarSign, Plus, TrendingUp, Target } from "lucide-react";

export const WorkspaceSales = () => {
  const stats = [
    { label: "Pipeline Total", value: "R$ 0,00", icon: TrendingUp },
    { label: "Fechados", value: "R$ 0,00", icon: DollarSign },
    { label: "Ticket Médio", value: "R$ 0,00", icon: TrendingUp },
    { label: "Oportunidades", value: "0", icon: Target },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
          <p className="text-sm text-muted-foreground">Pipeline e oportunidades</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-1" /> Nova Oportunidade
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <s.icon className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {["Cliente", "Valor", "Etapa", "Probabilidade", "Data"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                Nenhuma oportunidade cadastrada ainda.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default WorkspaceSales;