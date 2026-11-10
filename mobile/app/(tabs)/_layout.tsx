import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Map, Radio, Users, Bookmark } from 'lucide-react-native';
import { FieldColors, FieldTypography } from '../../constants/FieldTokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: FieldColors.rescueOrange,
        tabBarInactiveTintColor: '#65736C',
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'TOPO MAP',
          tabBarIcon: ({ color, size }) => <Map size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'RECORD',
          tabBarIcon: ({ color, size }) => <Radio size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="squads"
        options={{
          title: 'SQUADS',
          tabBarIcon: ({ color, size }) => <Users size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'SAVED',
          tabBarIcon: ({ color, size }) => <Bookmark size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#121714',
    borderTopColor: '#242F28',
    borderTopWidth: 1.5,
    height: 60,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabItem: {
    paddingVertical: 2,
  },
  tabLabel: {
    fontFamily: FieldTypography.mono,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
