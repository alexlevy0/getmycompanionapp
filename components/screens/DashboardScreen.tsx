import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SettingsModal } from "@/components/SettingsModal";
import { StatusCard } from "@/components/dashboard/StatusCard";
import { NextCallCard } from "@/components/dashboard/NextCallCard";
import { StatsRow } from "@/components/dashboard/StatsRow";

interface UserData {
  status: any; // Using any for now to avoid re-importing complex types or just use simple typing
  firstName?: string;
  phone: string;
  nextCallScheduled?: string;
  totalCalls: number;
  trialCallsRemaining: number;
  preferredTime: string;
  preferredDays: string;
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

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.dashboardContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Bonjour{userStatus.firstName ? `, ${userStatus.firstName}` : ""} 👋
          </Text>
          <View style={styles.headerActions}>
            <Pressable 
              onPress={() => setIsSettingsModalVisible(true)} 
              style={styles.settingsButton}
            >
              <Text style={styles.settingsButtonText}>⚙️ Réglages</Text>
            </Pressable>
            <Pressable onPress={onLogout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Déconnexion</Text>
            </Pressable>
          </View>
        </View>

        {/* Status Card */}
        <StatusCard 
          status={userStatus.status} 
          trialCallsRemaining={userStatus.trialCallsRemaining} 
          paymentLink={userStatus.paymentLink}
          onOpenPaymentLink={(url) => {
            if (typeof window !== "undefined") window.open(url, "_blank");
          }}
        />

        {/* Next Call Card */}
        <NextCallCard scheduledDate={userStatus.nextCallScheduled || ""} />

        {/* Stats */}
        <StatsRow 
          totalCalls={userStatus.totalCalls} 
          preferredTime={userStatus.preferredTime} 
        />

      </ScrollView>

      {/* Settings Modal */}
      <SettingsModal
        visible={isSettingsModalVisible}
        onClose={() => setIsSettingsModalVisible(false)}
        currentSettings={{
          preferredTime: userStatus.preferredTime,
        }}
        onUpdate={onUpdatePreferences}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  dashboardContainer: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
    backgroundColor: "#f5f5f5",
  },
  header: {
    marginBottom: 24,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  settingsButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  settingsButtonText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 14,
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: "#6b7280",
    fontSize: 14,
  },
});
