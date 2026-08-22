// Path: goviet247/apps/rider-mobile/components/AppBrandHeader.tsx
import { Image, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { getRiderPublicSystemConfig } from "../services/tripApi";

type Props = {
  title: string;
  subtitle?: string;
};

export default function AppBrandHeader({ title, subtitle }: Props) {
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [brandName, setBrandName] = useState("GoViet247");

  useEffect(() => {
    async function loadConfig() {
      try {
        const data = await getRiderPublicSystemConfig();

        setLogoUrl(String(data?.brandLogoUrl || "").trim());
        setBrandName(String(data?.brandName || "").trim() || "GoViet247");
      } catch (err) {
        console.warn("load brand config error:", err);
      }
    }

    void loadConfig();
  }, []);

  return (
    <View style={styles.wrapper}>
      <View style={styles.brandRow}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.logoImage} />
        ) : (
          <View style={styles.logoBox} />
        )}

        <Text style={styles.brandText}>{brandName}</Text>
      </View>

      <Text style={styles.title}>{title}</Text>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  logoBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: "#F97316",
    marginRight: 10,
  },
  logoImage: {
    width: 34,
    height: 34,
    borderRadius: 9,
    marginRight: 10,
    backgroundColor: "#FFFFFF",
  },
  brandText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1F2937",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 22,
  },
});