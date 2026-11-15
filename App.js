import React, { useEffect, useMemo, useState } from 'react';
import { View, Platform, Image, Appearance } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { navRef } from './src/navigation/navRef';
import { ProProvider } from './src/pro/ProContext';
import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';

import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { LangProvider, useLang } from './src/i18n';
import { LibraryProvider, useLibrary } from './src/context/LibraryContext';
import { PlayerProvider } from './src/context/PlayerContext';
import { UIProvider } from './src/context/UIContext';
import { MiniPlayer, PlayerSheet } from './src/components/Player';
import SongEditor from './src/components/SongEditor';
import FavToast from './src/components/FavToast';
import { AppGlyphIcon, TrophyIcon, ChartIcon, GearIcon } from './src/components/icons';
import LibraryScreen from './src/screens/LibraryScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LinkHandler from './src/links/LinkHandler';

const Tab = createBottomTabNavigator();
// Ссылки com.stefu.music://… переключают вкладки (src/links/LinkHandler.js); navRef — src/navigation/navRef.js.

/** Pro (src/pro/, общий модуль Stefu): язык и цвета приложения для окна Pro и замков. */
function ProBridge({ children }) {
  const { colors } = useTheme();
  const { lang } = useLang();
  const c = useMemo(() => ({
    card: colors.bgCard, text: colors.text, muted: colors.textMuted, accent: colors.accent,
    border: colors.border, onAccent: colors.onAccent, btn: colors.ink, onBtn: colors.onInk, btnBorder: colors.ink,
  }), [colors]);
  return <ProProvider appName="Stefu Music" lang={lang} colors={c}>{children}</ProProvider>;
}

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
        // Невидимые вкладки не перерисовываются от каждого прослушивания и смены песни —
        // переключение вкладок не тяжелеет (особенно Отчёты с длинными списками).
        freezeOnBlur: true,
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
        options={{ tabBarLabel: t('nav_music'), tabBarIcon: ({ color, size }) => <AppGlyphIcon color={color} size={size} /> }} />
      <Tab.Screen name="Top"
        options={{ tabBarLabel: t('nav_top'), tabBarIcon: ({ color, size }) => <TrophyIcon color={color} size={size} /> }}>
        {props => <ReportsScreen {...props} top />}
      </Tab.Screen>
      <Tab.Screen name="Reports" component={ReportsScreen}
        options={{ tabBarLabel: t('nav_reports'), tabBarIcon: ({ color, size }) => <ChartIcon color={color} size={size} /> }} />
      <Tab.Screen name="Settings" component={SettingsScreen}
        options={{ tabBarLabel: t('nav_settings'), tabBarIcon: ({ color, size }) => <GearIcon color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}

// Заставка при запуске — как в Stefu Football: та же картинка, что в нативной заставке (знак и под ним
// название; рисует assets/mk_icon.py), тот же размер 288 dp и тот же фон по теме телефона —
// при переходе от системной заставки ничего не прыгает. Видна, пока грузится библиотека,
// но не меньше SPLASH_MIN_MS, чтобы название успели прочитать.
const SPLASH_LIGHT = require('./assets/splash-icon.png');
const SPLASH_DARK = require('./assets/splash-icon-dark.png');
const SPLASH_MIN_MS = 1000;
function AppSplash() {
  const dark = Appearance.getColorScheme() === 'dark';
  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#0A0A0A' : '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Image source={dark ? SPLASH_DARK : SPLASH_LIGHT} style={{ width: 288, height: 288 }} />
    </View>
  );
}

function Root() {
  const { loaded } = useLibrary();
  const [minDone, setMinDone] = useState(false);
  useEffect(() => { const h = setTimeout(() => setMinDone(true), SPLASH_MIN_MS); return () => clearTimeout(h); }, []);
  if (!loaded || !minDone) return <AppSplash />;
  return <Main />;
}

function Main() {
  const { colors, isDark } = useTheme();
  const [playerOpen, setPlayerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [navReady, setNavReady] = useState(false);

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
        <NavigationContainer ref={navRef} theme={navTheme} onReady={() => setNavReady(true)}>
          <StatusBar style="light" />
          <Tabs onOpenPlayer={() => setPlayerOpen(true)} />
        </NavigationContainer>
        <PlayerSheet visible={playerOpen} onClose={() => setPlayerOpen(false)} onEdit={s => setEditing(s)} />
        {editing && <SongEditor song={editing} onClose={() => setEditing(null)} />}
        <LinkHandler navRef={navRef} navReady={navReady} openPlayer={() => setPlayerOpen(true)} />
        {!playerOpen ? <FavToast bottom={170} /> : null}
      </UIProvider>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LangProvider>
          <ProBridge>
            <LibraryProvider>
              <PlayerProvider>
                <Root />
              </PlayerProvider>
            </LibraryProvider>
          </ProBridge>
        </LangProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
