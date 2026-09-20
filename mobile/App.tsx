// Hokie Concierge - Android app screen (Expo / React Native).
// Map on top, chat on the bottom. Map pins come from agent results that include lat/lng.
//
// Setup (see MOBILE-UPDATE.md):
//   npx create-expo-app@latest mobile --template blank-typescript
//   cd mobile && npx expo install react-native-maps
//   put your backend address in mobile/.env as EXPO_PUBLIC_API_URL, then replace App.tsx with this file.
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";

// "10.0.2.2" is how the Android EMULATOR reaches your laptop. On a real phone you must set
// EXPO_PUBLIC_API_URL (your laptop's Wi-Fi address, a tunnel URL, or your deployed server).
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000";

// Roughly the middle of the Virginia Tech campus. Check it on Google Maps and adjust if needed.
const CAMPUS = { latitude: 37.2284, longitude: -80.4234, latitudeDelta: 0.02, longitudeDelta: 0.02 };

type Msg = { id: string; role: "user" | "assistant"; text: string };
type Chip = { agentId: string; status: "verified" | "unverified" | "mock"; answered?: boolean };
type Pin = { id: string; title: string; detail: string; latitude: number; longitude: number };
type ConciergeEvent = { event: string; data: any };

// Never show green for a mock check - only real ANS verification earns "verified".
const STATUS_COLOR = { verified: "#1a9c4a", unverified: "#d33", mock: "#888" };
const HERO_QUESTION = "I have $10, I'm hungry, and class starts in 40 minutes. What can I eat, and which bus helps?";

const newId = () => Math.random().toString(36).slice(2);

export default function App() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: "hello", role: "assistant", text: "Hi! Ask me about cheap food and Blacksburg Transit buses around campus." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chips, setChips] = useState<Chip[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList<Msg>>(null);

  const addMessage = (role: Msg["role"], text: string) =>
    setMessages((m) => [...m, { id: newId(), role, text }]);

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setInput("");
    addMessage("user", question);
    setLoading(true);
    setChips([]);
    setPins([]);

    try {
      const res = await fetch(`${API_URL}/api/concierge-json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error(`Server said ${res.status}`);
      const { events } = (await res.json()) as { events: ConciergeEvent[] };

      const nextChips: Chip[] = [];
      const nextPins: Pin[] = [];
      let answer = "";

      for (const { event, data } of events) {
        if (event === "verify") {
          nextChips.push({ agentId: data.agentId, status: data.status });
        } else if (event === "agent_result") {
          const chip = nextChips.find((c) => c.agentId === data.agent);
          if (chip) chip.answered = !!data.ok;
          if (data.ok) {
            (data.data.results ?? []).forEach((r: any, i: number) => {
              if (typeof r.lat === "number" && typeof r.lng === "number") {
                nextPins.push({
                  id: `${data.agent}-${i}`,
                  title: r.title,
                  detail: [r.when, r.where].filter(Boolean).join(" · "),
                  latitude: r.lat,
                  longitude: r.lng,
                });
              }
            });
          }
        } else if (event === "final") {
          answer = data.answer;
        } else if (event === "error") {
          throw new Error(data.message);
        }
      }

      setChips(nextChips);
      setPins(nextPins);
      addMessage("assistant", answer || "Sorry, I couldn't put an answer together.");

      // Zoom the map to the results.
      setTimeout(() => {
        if (nextPins.length === 1) {
          mapRef.current?.animateToRegion(
            { latitude: nextPins[0].latitude, longitude: nextPins[0].longitude, latitudeDelta: 0.006, longitudeDelta: 0.006 },
            400
          );
        } else if (nextPins.length > 1) {
          mapRef.current?.fitToCoordinates(
            nextPins.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
            { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }
          );
        }
      }, 300);
    } catch (err) {
      addMessage("assistant", `Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <MapView ref={mapRef} style={styles.map} initialRegion={CAMPUS}>
        {pins.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            title={p.title}
            description={p.detail}
          />
        ))}
      </MapView>

      <KeyboardAvoidingView style={styles.panel} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {chips.length > 0 && (
          <View style={styles.chipRow}>
            {chips.map((c) => (
              <View key={c.agentId} style={[styles.chip, { borderColor: STATUS_COLOR[c.status] }]}>
                <Text style={styles.chipText}>
                  {c.agentId} · {c.status}
                  {c.answered === false ? " · no answer" : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.botBubble]}>
              <Text style={item.role === "user" ? styles.userText : styles.botText}>{item.text}</Text>
            </View>
          )}
        />

        {loading && <ActivityIndicator style={{ margin: 6 }} />}

        {messages.length === 1 && (
          <TouchableOpacity style={styles.example} onPress={() => send(HERO_QUESTION)}>
            <Text style={styles.exampleText}>Try: "{HERO_QUESTION}"</Text>
          </TouchableOpacity>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about food or buses…"
            onSubmitEditing={() => send()}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={() => send()} disabled={loading}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  map: { flex: 1 },
  panel: {
    height: "50%",
    padding: 10,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  chip: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontSize: 12, color: "#333" },
  bubble: { maxWidth: "85%", padding: 10, borderRadius: 14, marginVertical: 3 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#861F41" },
  botBubble: { alignSelf: "flex-start", backgroundColor: "#f0f0f0" },
  userText: { color: "#fff" },
  botText: { color: "#111" },
  example: { alignSelf: "flex-start", padding: 8, borderRadius: 12, backgroundColor: "#fdf0f4", marginBottom: 6 },
  exampleText: { color: "#861F41" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4 },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  sendBtn: { backgroundColor: "#861F41", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendText: { color: "#fff", fontWeight: "600" },
});
