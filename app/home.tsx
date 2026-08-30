import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Alert,
  Switch,
} from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  loginAndLoad,
  markPaid,
  getConfig,
  saveConfig,
  type Lead,
  type Stats,
} from "../lib/api";
import { setupNotifications } from "../lib/notifications";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Tab = "inicio" | "vendas" | "carrinhos" | "pix" | "config";

export default function HomeScreen() {
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("inicio");
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pushOk, setPushOk] = useState<boolean | null>(null);
  const [purchaseOnPix, setPurchaseOnPix] = useState(false);
  const [cardEnabled, setCardEnabled] = useState(false);

  const load = useCallback(async (pwd: string) => {
    const hoje = todayISO();
    const data = await loginAndLoad(pwd, hoje, hoje);
    setStats(data.stats);
    setLeads(data.recentes || []);
  }, []);

  useEffect(() => {
    (async () => {
      const pwd = await SecureStore.getItemAsync("dash_pwd");

      if (!pwd) {
        router.replace("/");
        return;
      }

      setPassword(pwd);

      // Somente erro real de login/dashboard pode deslogar.
      try {
        await load(pwd);
      } catch {
        await SecureStore.deleteItemAsync("dash_pwd");
        router.replace("/");
        return;
      }

      // Erro de push NÃO derruba o login.
      try {
        const token = await setupNotifications(pwd);
        setPushOk(!!token);
      } catch (error) {
        console.log("Erro ao configurar notificações:", error);
        setPushOk(false);
      }

      // Erro ao buscar configurações também NÃO derruba o login.
      try {
        const cfg = await getConfig();
        setPurchaseOnPix(Boolean(cfg?.config?.purchaseOnPixGenerate));
        setCardEnabled(Boolean(cfg?.config?.cardEnabled));
      } catch (error) {
        console.log("Erro ao carregar configurações:", error);
      }
    })();
  }, [load]);

  async function onRefresh() {
    if (!password) return;

    setRefreshing(true);

    try {
      await load(password);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Erro ao atualizar dashboard";
      Alert.alert("Erro", msg);
    } finally {
      setRefreshing(false);
    }
  }

  async function onMarkPaid(lead: Lead) {
    Alert.alert("Confirmar", "Marcar este pedido como PAGO?", [
      {
        text: "Cancelar",
        style: "cancel",
      },
      {
        text: "Sim",
        onPress: async () => {
          try {
            await markPaid(password, lead);
            await load(password);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Falha";
            Alert.alert("Erro", msg);
          }
        },
      },
    ]);
  }

  function wa(lead: Lead) {
    const n = String(lead.telefone || "").replace(/\D/g, "");

    if (!n) return;

    const full = n.startsWith("55") ? n : `55${n}`;

    Linking.openURL(`https://wa.me/${full}`);
  }

  async function logout() {
    await SecureStore.deleteItemAsync("dash_pwd");
    router.replace("/");
  }

  const vendas = leads.filter(
    (l) => String(l.status).toLowerCase() === "pago"
  );

  const carrinhos = leads.filter((l) =>
    String(l.status).toLowerCase().includes("abandonado")
  );

  const pixList = leads.filter((l) =>
    ["aguardando_pix", "pago"].includes(
      String(l.status).toLowerCase()
    )
  );

  function LeadCard({
    lead,
    showPaid,
  }: {
    lead: Lead;
    showPaid?: boolean;
  }) {
    if (!lead.nome && !lead.telefone) return null;

    const st = String(lead.status || "").toLowerCase();

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {lead.nome || "Sem nome"}
        </Text>

        <Text style={styles.cardSub}>
          {lead.telefone || "—"} · R$ {lead.valor || "0"}
          {lead.frete ? ` · ${lead.frete}` : ""}
        </Text>

        <Text style={styles.badge}>
          {lead.status || "—"}
        </Text>

        <View style={styles.row}>
          {!!lead.telefone && (
            <TouchableOpacity
              style={styles.chip}
              onPress={() => wa(lead)}
            >
              <Text style={styles.chipText}>
                WhatsApp
              </Text>
            </TouchableOpacity>
          )}

          {showPaid && st === "aguardando_pix" && (
            <TouchableOpacity
              style={[styles.chip, styles.chipPrimary]}
              onPress={() => onMarkPaid(lead)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: "#fff" },
                ]}
              >
                Marcar pago
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "inicio", label: "Início" },
    { id: "vendas", label: "Vendas" },
    { id: "carrinhos", label: "Carrinhos" },
    { id: "pix", label: "PIX" },
    { id: "config", label: "Config" },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            Mundo Atleta
          </Text>

          <Text style={styles.headerSub}>
            {pushOk === null
              ? "…"
              : pushOk
              ? "Notificações ativas"
              : "Push não autorizado"}
          </Text>
        </View>

        <TouchableOpacity onPress={onRefresh}>
          <Text style={styles.link}>
            Atualizar
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[
              styles.tab,
              tab === t.id && styles.tabActive,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                tab === t.id && styles.tabTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {tab === "inicio" && (
          <>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>
                Volume hoje
              </Text>

              <Text style={styles.kpiValue}>
                {formatBRL(stats?.volume || 0)}
              </Text>
            </View>

            <View style={styles.grid}>
              <View style={styles.mini}>
                <Text style={styles.miniLabel}>
                  PIX gerados
                </Text>

                <Text style={styles.miniValue}>
                  {stats?.pixGerados ?? 0}
                </Text>
              </View>

              <View style={styles.mini}>
                <Text style={styles.miniLabel}>
                  PIX pagos
                </Text>

                <Text style={styles.miniValue}>
                  {stats?.pixPagos ?? 0}
                </Text>
              </View>

              <View style={styles.mini}>
                <Text style={styles.miniLabel}>
                  Abandonos
                </Text>

                <Text style={styles.miniValue}>
                  {stats?.abandonados ?? 0}
                </Text>
              </View>

              <View style={styles.mini}>
                <Text style={styles.miniLabel}>
                  Conversão
                </Text>

                <Text style={styles.miniValue}>
                  {stats?.conversaoPix ?? 0}%
                </Text>
              </View>
            </View>

            <Text style={styles.section}>
              Atividade recente
            </Text>

            {leads.slice(0, 20).map((l) => (
              <LeadCard
                key={l.row}
                lead={l}
                showPaid
              />
            ))}
          </>
        )}

        {tab === "vendas" &&
          (vendas.length === 0 ? (
            <Text style={styles.empty}>
              Nenhuma venda hoje
            </Text>
          ) : (
            vendas.map((l) => (
              <LeadCard
                key={l.row}
                lead={l}
              />
            ))
          ))}

        {tab === "carrinhos" &&
          (carrinhos.length === 0 ? (
            <Text style={styles.empty}>
              Nenhum abandono hoje
            </Text>
          ) : (
            carrinhos.map((l) => (
              <LeadCard
                key={l.row}
                lead={l}
              />
            ))
          ))}

        {tab === "pix" &&
          (pixList.length === 0 ? (
            <Text style={styles.empty}>
              Nenhum PIX hoje
            </Text>
          ) : (
            pixList.map((l) => (
              <LeadCard
                key={l.row}
                lead={l}
                showPaid
              />
            ))
          ))}

        {tab === "config" && (
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  Purchase ao gerar PIX
                </Text>

                <Text style={styles.cardSub}>
                  Meta Ads
                </Text>
              </View>

              <Switch
                value={purchaseOnPix}
                onValueChange={async (v) => {
                  setPurchaseOnPix(v);

                  try {
                    await saveConfig(password, {
                      purchaseOnPixGenerate: v,
                    });
                  } catch (e: unknown) {
                    const msg =
                      e instanceof Error
                        ? e.message
                        : "Erro";

                    Alert.alert("Erro", msg);
                  }
                }}
              />
            </View>

            <View
              style={[
                styles.switchRow,
                { marginTop: 16 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  Cartão InfinitePay
                </Text>

                <Text style={styles.cardSub}>
                  Mostrar no checkout
                </Text>
              </View>

              <Switch
                value={cardEnabled}
                onValueChange={async (v) => {
                  setCardEnabled(v);

                  try {
                    await saveConfig(password, {
                      cardEnabled: v,
                    });
                  } catch (e: unknown) {
                    const msg =
                      e instanceof Error
                        ? e.message
                        : "Erro";

                    Alert.alert("Erro", msg);
                  }
                }}
              />
            </View>

            <TouchableOpacity
              style={styles.logout}
              onPress={logout}
            >
              <Text style={styles.logoutText}>
                Sair
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f4f6f8",
  },

  header: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
  },

  headerSub: {
    fontSize: 12,
    color: "#0d9488",
    marginTop: 2,
  },

  link: {
    color: "#0d9488",
    fontWeight: "600",
    fontSize: 13,
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 4,
  },

  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },

  tabActive: {
    backgroundColor: "#ccfbf1",
  },

  tabText: {
    fontSize: 11,
    color: "#666",
    fontWeight: "600",
  },

  tabTextActive: {
    color: "#0f766e",
  },

  kpi: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },

  kpiLabel: {
    fontSize: 12,
    color: "#888",
  },

  kpiValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f766e",
    marginTop: 4,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },

  mini: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
  },

  miniLabel: {
    fontSize: 11,
    color: "#888",
  },

  miniValue: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 6,
    color: "#111",
  },

  section: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    color: "#111",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },

  cardSub: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },

  badge: {
    alignSelf: "flex-start",
    marginTop: 8,
    fontSize: 11,
    fontWeight: "700",
    color: "#0f766e",
    backgroundColor: "#ccfbf1",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },

  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  chip: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },

  chipPrimary: {
    backgroundColor: "#0d9488",
  },

  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },

  empty: {
    textAlign: "center",
    color: "#999",
    marginTop: 40,
  },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  logout: {
    marginTop: 24,
    alignItems: "center",
  },

  logoutText: {
    color: "#dc2626",
    fontWeight: "700",
  },
});