cat > lib/api.ts <<'EOF'
import Constants from "expo-constants";

export const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string })?.apiUrl ||
  "https://mundo-atleta-checkout.vercel.app";

export type Stats = {
  volume: number;
  pixGerados: number;
  pixPagos: number;
  abandonados: number;
  ticketMedio: number;
  conversaoPix: number;
  funil: {
    dados: number;
    entrega: number;
    pagamento: number;
    pix: number;
  };
  totalLeads: number;
};

export type Lead = {
  row: number;
  data: string;
  nome: string;
  telefone: string;
  email: string;
  valor: string;
  status: string;
  etapa: string;
  frete: string;
  source?: "LP-GROK" | "LP-GPT" | "SHOPIFY" | "DIRETO" | string;
};

export async function loginAndLoad(
  password: string,
  dateFrom?: string,
  dateTo?: string
) {
  const params = new URLSearchParams();
  params.set("password", password);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  const res = await fetch(`${API_URL}/api/dashboard?${params}`, {
    cache: "no-store",
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || "Senha incorreta");
  }

  return json as {
    stats: Stats;
    recentes: Lead[];
  };
}

export async function markPaid(password: string, lead: Lead) {
  const res = await fetch(`${API_URL}/api/dashboard`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      password,
      row: lead.row,
      nome: lead.nome,
      valor: lead.valor,
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || "Erro ao marcar pago");
  }

  return json;
}

export async function registerPushToken(
  password: string,
  token: string
) {
  const res = await fetch(`${API_URL}/api/notifications/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      password,
      token,
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || "Erro ao registrar push");
  }

  return json;
}

export async function getConfig() {
  const res = await fetch(`${API_URL}/api/config`, {
    cache: "no-store",
  });

  return res.json();
}

export async function saveConfig(
  password: string,
  data: {
    purchaseOnPixGenerate?: boolean;
    cardEnabled?: boolean;
  }
) {
  const res = await fetch(`${API_URL}/api/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      password,
      ...data,
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || "Erro ao salvar");
  }

  return json;
}