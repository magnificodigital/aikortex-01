// Stub: Lovable Cloud auth is not enabled in this project.
// Habilite o Lovable Cloud para usar OAuth (Google/Apple) via Lovable.

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: "google" | "apple", _opts?: SignInOptions) => {
      return {
        error: new Error(
          "Lovable Cloud não está habilitado neste projeto. Habilite o Lovable Cloud para usar OAuth."
        ),
      };
    },
  },
};
