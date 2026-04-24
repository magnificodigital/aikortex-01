import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, ArrowUp, RefreshCw, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

const allSuggestions = [
  ["Quantos clientes ativos tenho?", "Quais tarefas estão atrasadas?", "Resumo financeiro do mês"],
  ["Propostas abertas no CRM", "Faturamento da semana", "Contratos a vencer"],
  ["Leads novos hoje", "Tarefas concluídas esta semana", "Despesas do mês"],
  ["Top 3 clientes por receita", "Vendas fechadas no mês", "Próximas reuniões"],
];

export const WorkspaceHomeChat = () => {
  const { profile } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const displayName =
    activeWorkspace?.name?.split(" ")[0] ??
    profile?.full_name?.split(" ")[0] ??
    "Cliente";

  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const currentSuggestions = allSuggestions[suggestionIndex];
  const refreshSuggestions = () =>
    setSuggestionIndex((i) => (i + 1) % allSuggestions.length);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workspace-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ message: text }),
        }
      );
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.reply ?? "Não consegui processar sua solicitação." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Erro ao conectar com o assistente." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl lg:text-5xl font-light text-foreground mb-3">
          {getGreeting()}, <span className="italic">{displayName}</span>
        </h1>
        <p className="text-sm lg:text-base text-muted-foreground max-w-lg">
          Pergunte ao assistente sobre clientes, tarefas, financeiro, vendas ou contratos do seu sistema.
        </p>
      </div>

      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl shadow-black/5 overflow-hidden mb-8">
        <div className="px-4 py-4 space-y-4 max-h-[320px] overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2 shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-muted text-foreground rounded-bl-none"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2 shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-none px-4 py-2.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Pergunte sobre seus clientes, tarefas, financeiro, vendas ou contratos..."
          className="w-full bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/50 px-5 py-3 min-h-[72px]"
          disabled={loading}
        />

        <div className="flex items-center justify-end px-4 pb-3">
          <Button
            size="sm"
            className="h-9 px-5 rounded-full bg-primary hover:bg-primary/90 gap-1.5"
            disabled={!input.trim() || loading}
            onClick={send}
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        {currentSuggestions.map((s) => (
          <button
            key={s}
            onClick={() => setInput(s)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {s}
          </button>
        ))}
        <button
          onClick={refreshSuggestions}
          className="flex items-center justify-center w-10 h-10 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Atualizar sugestões"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};