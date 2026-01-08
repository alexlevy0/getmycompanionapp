import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Linking,
  Alert,
} from "react-native";
import { SettingsModal } from "@/components/SettingsModal";
import { StatusCard } from "@/components/dashboard/StatusCard";
import { NextCallCard } from "@/components/dashboard/NextCallCard";
import { StatsRow } from "@/components/dashboard/StatsRow";

// Design System
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { COLORS, SPACING } from "@/constants/theme";

interface UserData {
  status: string;
  firstName?: string;
  phone: string;
  nextCallScheduled?: string;
  totalCalls?: string;
  trialCallsRemaining?: string;
  preferredTime?: string;
  preferredDays?: string;
  paymentLink?: string;
}

interface DashboardScreenProps {
  userStatus: UserData;
  onLogout: () => void;
  onRefresh: () => Promise<void>;
  onUpdatePreferences: (updates: { preferredTime: string }) => Promise<void>;
}

export const DashboardScreen = ({
  userStatus,
  onLogout,
  onRefresh,
  onUpdatePreferences,
}: DashboardScreenProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const handleOpenLink = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      if (typeof globalThis.window !== "undefined") {
        globalThis.window.open(url, "_blank");
      } else {
        Alert.alert("Erreur", "Impossible d'ouvrir le lien : " + url);
      }
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="h1">
            Bonjour{userStatus.firstName ? `, ${userStatus.firstName}` : ""} 👋
          </Text>
          
          <View style={styles.headerActions}>
            <Button 
              label="⚙️ Réglages" 
              variant="outline" 
              size="sm" 
              onPress={() => setIsSettingsModalVisible(true)}
              style={styles.actionButton}
            />
            <Button 
              label="Déconnexion" 
              variant="secondary" 
              size="sm" 
              onPress={onLogout}
            />
          </View>
        </View>

        {/* Status Card */}
        <StatusCard 
          status={userStatus.status} 
          trialCallsRemaining={Number.parseInt(userStatus.trialCallsRemaining || "0", 10)} 
          paymentLink={userStatus.paymentLink}
          onOpenPaymentLink={handleOpenLink}
        />

        {/* Next Call Card */}
        <NextCallCard scheduledDate={userStatus.nextCallScheduled || ""} />

        {/* Stats */}
        <StatsRow 
          totalCalls={Number.parseInt(userStatus.totalCalls || "0", 10)} 
          preferredTime={userStatus.preferredTime || "10:00"} 
        />

      </ScrollView>

      {/* Settings Modal */}
      <SettingsModal
        visible={isSettingsModalVisible}
        onClose={() => setIsSettingsModalVisible(false)}
        currentSettings={{
          preferredTime: userStatus.preferredTime || "10:00",
        }}
        onUpdate={onUpdatePreferences}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.xl,
    paddingTop: 60,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: SPACING.md,
    gap: SPACING.sm, // Note: gap might not work in older RN versions, use margin if needed
  },
  actionButton: {
    marginRight: SPACING.sm,
  },
});
