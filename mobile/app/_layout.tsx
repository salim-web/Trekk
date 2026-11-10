import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FieldColors } from '../constants/FieldTokens';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={FieldColors.obsidianBasalt} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: FieldColors.obsidianBasalt },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
