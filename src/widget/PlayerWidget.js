import React from 'react';
import { FlexWidget, TextWidget, SvgWidget } from 'react-native-android-widget';

/**
 * Виджет «Stefu Music» на рабочем столе (4×1): знак приложения, песня,
 * кнопки «предыдущая», «играть/пауза», «следующая». Тап по песне открывает
 * приложение.
 *
 * live — приложение запущено и может выполнить кнопку прямо из виджета.
 * Если приложения в памяти нет, кнопка «играть» открывает его ссылкой
 * com.stefu.music://play — оно продолжит с того места, где остановились.
 */

const NOTES = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6.65 -4 108 108"><g fill="#ffffff">'
  + '<ellipse cx="25.36" cy="83.44" rx="11.79" ry="10.38" transform="rotate(-18 25.36 83.44)"/>'
  + '<ellipse cx="69.36" cy="72.44" rx="11.79" ry="10.38" transform="rotate(-18 69.36 72.44)"/>'
  + '<path d="M31.8 22.7H36.9V83.4H31.8ZM75.8 6.9L81 6V72.4H75.8ZM31.8 22.5L81 6V28L31.8 44.5Z"/></g></svg>';
const icon = d => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#ffffff" d="${d}"/></svg>`;
const PLAY = icon('M8 5v14l11-7z');
const PAUSE = icon('M6 19h4V5H6v14zm8-14v14h4V5h-4z');
const NEXT = icon('M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z');
const PREV = icon('M6 6h2v12H6zm3.5 6l8.5 6V6z');

export default function PlayerWidget({ title, artist, playing, live, scheme = 'com.stefu.music', emptyText = 'Stefu Music' }) {
  const btn = (svg, action, size = 30) => (
    <FlexWidget clickAction={action.uri ? 'OPEN_URI' : action.name} clickActionData={action.uri ? { uri: action.uri } : undefined}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 }}>
      <SvgWidget svg={svg} style={{ width: size, height: size }} />
    </FlexWidget>
  );
  const ctl = name => (live ? { name } : { uri: `${scheme}://${name === 'TOGGLE' ? 'play' : name.toLowerCase()}` });
  return (
    <FlexWidget style={{
      height: 'match_parent', width: 'match_parent', flexDirection: 'row', alignItems: 'center',
      backgroundColor: '#18171a', borderRadius: 22, paddingHorizontal: 10,
    }}>
      <FlexWidget clickAction="OPEN_APP" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 'match_parent' }}>
        <FlexWidget style={{
          width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
          backgroundGradient: { from: '#4e4d52', to: '#0a0a0b', orientation: 'TL_BR' },
        }}>
          <SvgWidget svg={NOTES} style={{ width: 28, height: 28 }} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, marginLeft: 10, flexDirection: 'column' }}>
          <TextWidget text={title || emptyText} maxLines={1} truncate="END"
            style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }} />
          {artist ? <TextWidget text={artist} maxLines={1} truncate="END" style={{ fontSize: 12, color: '#ffffffa8', marginTop: 2 }} /> : null}
        </FlexWidget>
      </FlexWidget>
      {btn(PREV, ctl('PREV'), 26)}
      {btn(playing ? PAUSE : PLAY, ctl('TOGGLE'), 32)}
      {btn(NEXT, ctl('NEXT'), 26)}
    </FlexWidget>
  );
}
