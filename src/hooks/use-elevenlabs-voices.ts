import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  preview_url: string | null;
  category: string;
  labels: Record<string, string>;
}

export function useElevenLabsVoices() {
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasUserKey, setHasUserKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVoices = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    try {
      const { data, error: fnError } = await supabase.functions.invoke("elevenlabs-voices");

      if (fnError) {
        setError("Erro ao buscar vozes da ElevenLabs");
        setLoading(false);
        return;
      }

      setHasUserKey(!!data?.hasUserKey);
      setVoices(data?.voices ?? []);
      if (data?.error) setError(data.error);
      else if (!data?.voices?.length) setError("Nenhuma voz encontrada");
    } catch {
      setError("Erro ao conectar com o serviço de vozes");
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchVoices(); }, [fetchVoices]);

  return { voices, loading, hasUserKey, error, refetch: fetchVoices };
}
