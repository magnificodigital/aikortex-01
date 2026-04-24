import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Users, DollarSign, CheckSquare, MessageSquare, Bot, ArrowUp,
} from "lucide-react";

const QUICK_LINKS = [
  { to: "/workspace/clientes", label: "Clientes", description: "Gerencie seus clientes", icon: Users },
  { to: "/workspace/vendas", label: "Vendas", description: "Pipeline e oportunidades", icon: DollarSign },
  { to: "/workspace/tarefas", label: "Tarefas", description: "Suas atividades", icon: CheckSquare },
  { to: "/workspace/mensagens", label: "Mensagens", description: "Conversas e atendimento", icon: MessageSquare },
];

type ChatMessage = { role: "user" | "assistant"; text: string };

export const WorkspaceHome = () => {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] ?? "Cliente";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

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
      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: { message: text },
      });
      if (error) throw error;
      const reply =
        (data as { reply?: string; message?: string })?.reply ??
        (data as { message?: string })?.message ??
        "Não consegui processar sua solicitação.";
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
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
    <div className="p-6 lg:p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl lg:text-4xl font-light text-foreground">
          Olá, <span className="italic font-normal">{firstName}</span> 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bem-vindo ao seu workspace.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_LINKS.map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="group bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
              <q.icon className="w-5 h-5 text-primary" />
            </div>
            <p className="font-semibold text-foreground">{q.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{q.description}</p>
          </Link>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col" style={{ height: 420 }}>
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Assistente</p>
            <p className="text-xs text-muted-foreground">Pergunte sobre seus dados</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center mt-8">
              Comece uma conversa digitando sua pergunta abaixo.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mr-2 shrink-0">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
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
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mr-2 shrink-0">
                <Bot className="w-3.5 h-3.5 text-primary" />
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

        <div className="border-t border-border p-3 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Digite sua pergunta..."
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/60 px-2 py-2 max-h-24"
            disabled={loading}
          />
          <Button
            size="sm"
            className="h-9 w-9 p-0 rounded-full"
            disabled={!input.trim() || loading}
            onClick={send}
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceHome;