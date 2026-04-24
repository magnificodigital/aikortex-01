import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DollarSign, Plus, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export const WorkspaceFinancial = () => {
  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Controle de receitas e despesas</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-1" /> Nova Transação
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Receita Total</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-emerald-500">R$ 0,00</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Despesas</span>
            <TrendingDown className="w-4 h-4 text-destructive" />
          </div>
          <p className="text-xl font-bold text-destructive">R$ 0,00</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Saldo</span>
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xl font-bold text-foreground">R$ 0,00</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Transações</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              {["Data", "Descrição", "Valor", "Tipo"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                Nenhuma transação registrada ainda.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default WorkspaceFinancial;