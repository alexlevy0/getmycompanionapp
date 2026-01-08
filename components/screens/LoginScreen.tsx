import React, { useState } from "react";
import { View, StyleSheet, Alert, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { CallModal } from "@/components/CallModal";

// Design System
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { COLORS, SPACING } from "@/constants/theme";

interface LoginScreenProps {
  diplerConfig: any; // We'll keep this as optional since it's null when unauth
}

export const LoginScreen = ({ diplerConfig }: LoginScreenProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isCallModalVisible, setIsCallModalVisible] = useState(false);
  const [emailError, setEmailError] = useState("");

  const handleRequestMagicLink = async () => {
    if (!email) {
      setEmailError("Email requis");
      return;
    }
    
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Email invalide");
      return;
    }

    setEmailError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/request-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMagicLinkSent(true);
        Alert.alert("Succès", data.message);
      } else {
        setEmailError(data.error || "Une erreur est survenue.");
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartDemo = () => {
    if (!diplerConfig) {
      Alert.alert("Connexion requise", "Veuillez vous connecter pour essayer la démo.");
      return;
    }
    setIsCallModalVisible(true);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text variant="h1" align="center" style={styles.title}>
            MyCompanion
          </Text>
          <Text variant="body" align="center" color={COLORS.text.secondary}>
            Votre coach de vie personnel, accessible à tout moment par téléphone.
          </Text>
        </View>

        <Card variant="default" padding="xl" style={styles.authCard}>
          {!magicLinkSent ? (
            <>
              <Text variant="h3" style={styles.cardTitle}>Connexion</Text>
              
              <Input
                label="Email"
                placeholder="votre@email.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setEmailError("");
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                error={emailError}
              />

              <Button
                label="Recevoir mon lien de connexion"
                onPress={handleRequestMagicLink}
                loading={loading}
              />
            </>
          ) : (
            <View style={styles.sentContainer}>
              <Text variant="h3" align="center">📩 Lien envoyé !</Text>
              <Text align="center" style={styles.sentText}>
                Vérifiez votre boîte mail ({email}) et cliquez sur le lien pour vous connecter.
              </Text>
              <Button
                label="Renvoyer le lien"
                variant="outline"
                onPress={() => setMagicLinkSent(false)}
                size="sm"
              />
            </View>
          )}
        </Card>

        <View style={styles.demoSection}>
          <Text variant="caption" align="center" style={styles.demoText}>
            Déjà client ? Prenez un appel test.
          </Text>
          <Button
            label="📞 Me faire appeler maintenant"
            variant="secondary"
            onPress={handleStartDemo}
            disabled={!diplerConfig}
            style={!diplerConfig ? { opacity: 0.5 } : undefined}
          />
        </View>
      </View>
      {/* Call Modal */}
      {diplerConfig && (
        <CallModal
          visible={isCallModalVisible}
          onClose={() => setIsCallModalVisible(false)}
          apiToken={diplerConfig.apiToken}
          agentId={diplerConfig.agentId}
          userIdForMemory={diplerConfig.userIdForMemory}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: SPACING.xl,
    maxWidth: 500,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    marginBottom: SPACING.xxxl,
    gap: SPACING.md,
  },
  title: {},
  callNowButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  authCard: {
    marginBottom: SPACING.xxl,
  },
  cardTitle: {
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  sentContainer: {
    alignItems: "center",
    gap: SPACING.md,
  },
  sentText: {
    marginBottom: SPACING.md,
    textAlign: "center",
  },
  demoSection: {
    alignItems: "center",
    gap: SPACING.sm,
  },
  demoText: {
    marginBottom: SPACING.sm,
  },
});
