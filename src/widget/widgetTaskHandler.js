import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlayerWidget from './PlayerWidget';

/**
 * Обработчик виджета (react-native-android-widget). Работает и когда
 * приложение открыто, и когда Android будит его ради виджета.
 *
 * Пока приложение в памяти, PlayerProvider кладёт в global.__stefuWidget
 * команды плеера и текущее состояние — кнопки виджета управляют музыкой
 * сразу. Без него рисуем последнюю песню (из sm_widget), а «играть»
 * открывает приложение ссылкой.
 */
export const K_WIDGET = 'sm_widget';

export async function lastWidgetState() {
  try { return JSON.parse(await AsyncStorage.getItem(K_WIDGET)) || {}; } catch (e) { return {}; }
}

export async function widgetTaskHandler(props) {
  if (props.widgetAction === 'WIDGET_DELETED') return;
  const g = global.__stefuWidget;
  if (props.widgetAction === 'WIDGET_CLICK' && g) {
    try { g.cmd(props.clickAction); } catch (e) { /* плеер занят */ }
  }
  const s = g ? g.state() : await lastWidgetState();
  props.renderWidget(<PlayerWidget {...s} playing={!!(g && s.playing)} live={!!g} />);
}
