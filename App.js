import React, { useEffect, useMemo, useState } from 'react';
import { View, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';

import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { LangProvider, useLang } from './src/i18n';
import { LibraryProvider } from './src/context/LibraryContext';
import { PlayerProvider } from './src/context/PlayerContext';
import { UIProvider } from './src/context/UIContext';
import { MiniPlayer, PlayerSheet } from './src/components/Player';
import SongEditor from './src/components/SongEditor';
import { MusicIcon, ChartIcon, GearIcon } from './src/components/icons';
import LibraryScreen from './src/screens/LibraryScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

function Tabs({ onOpenPlayer }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      // Мини-плеер живёт над нижним меню, на всех вкладках.
      tabBar={props => (
        <View>
          <MiniPlayer onOpen={onOpenPlayer} />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.tabBar, borderTopColor: colors.border,
          height: 62 + insets.bottom, paddingBottom: insets.bottom + 4, paddingTop: 6,
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInact,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}
    >
      <Tab.Screen name="Music" component={LibraryScreen}
        options={{ tabBarLabel: t('nav_music'), tabBarIcon: ({ color, size }) => <MusicIcon color={color} size={size} /> }} />
      <Tab.Screen name="Reports" component={ReportsScreen}
        options={{ tabBarLabel: t('nav_reports'), tabBarIcon: ({ color, size }) => <ChartIcon color={color} size={size} /> }} />
      <Tab.Screen name="Settings" component={SettingsScreen}
        options={{ tabBarLabel: t('nav_settings'), tabBarIcon: ({ color, size }) => <GearIcon color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { colors, isDark } = useTheme();
  const [playerOpen, setPlayerOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NavigationBar.setBackgroundColorAsync(colors.navBar).catch(() => {});
    NavigationBar.setButtonStyleAsync('light').catch(() => {});
  }, [colors.navBar]);

  const ui = useMemo(() => ({ openEditor: s => setEditing(s), openPlayer: () => setPlayerOpen(true) }), []);
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, background: colors.bg, card: colors.tabBar, text: colors.text, border: colors.border, primary: colors.accent } };

  return (
    <View style={{ flex: 1, backgroundColor: colors.navBar }}>
      <UIProvider value={ui}>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          <Tabs onOpenPlayer={() => setPlayerOpen(true)} />
        </NavigationContainer>
        <PlayerSheet visible={playerOpen} onClose={() => setPlayerOpen(false)} onEdit={s => setEditing(s)} />
        {editing && <SongEditor song={editing} onClose={() => setEditing(null)} />}
      </UIProvider>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LangProvider>
          <LibraryProvider>
            <PlayerProvider>
              <Root />
            </PlayerProvider>
          </LibraryProvider>
        </LangProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
