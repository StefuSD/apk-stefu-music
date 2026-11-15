import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet, PanResponder, Animated } from 'react-native';
import HeaderBg from './HeaderBg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../i18n';
import { useLibrary } from '../context/LibraryContext';
import Cover from './Cover';
import { DragIcon, CloseIcon } from './icons';

const H = 60;   // высота строки: по ней считаем, куда перетащили

/** Одна строка с ручкой перетаскивания справа. */
function Row({ song, i, n, drag, shift, onStart, onMove, onEnd, onRemove, colors, t }) {
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => onStart(i),
    onPanResponderMove: (_, g) => onMove(g.dy),
    onPanResponderRelease: (_, g) => onEnd(g.dy),
    onPanResponderTerminate: (_, g) => onEnd(g.dy),
  }), [i, n]);
  const active = drag && drag.from === i;
  return (
    <Animated.View style={{
      height: H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
      backgroundColor: active ? colors.accentSoft : colors.bgCard,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
      transform: [{ translateY: active ? drag.dy : shift }], zIndex: active ? 10 : 0, elevation: active ? 6 : 0,
    }}>
      <Text style={{ color: colors.textMuted, width: 26, fontWeight: '700' }}>{i + 1}</Text>
      <Cover song={song} size={40} radius={8} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>{song.title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{song.artist || t('unknown_artist')}</Text>
      </View>
      <Pressable onPress={onRemove} hitSlop={8} style={{ padding: 8 }}><CloseIcon color={colors.textMuted} size={20} /></Pressable>
      <View {...pan.panHandlers} style={{ padding: 10, marginRight: -6 }}><DragIcon color={colors.text} size={24} /></View>
    </Animated.View>
  );
}

/** Порядок песен в плейлисте: тяните за ручку «=» справа; крестик убирает песню из плейлиста. */
export default function PlaylistOrder({ playlist, onClose }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const lib = useLibrary();
  const [drag, setDrag] = useState(null);   // { from, to, dy: Animated.Value }
  const dragRef = useRef(null);
  const pl = lib.playlists.find(p => p.id === (playlist && playlist.id));
  const songs = pl ? pl.ids.map(id => lib.byId[id]).filter(Boolean) : [];
  const n = songs.length;
  // Ручки перетаскивания создаются один раз — свежие данные берём из ссылки.
  const cur = useRef({});
  cur.current = { pl, songs };

  const onStart = (i) => {
    const d = { from: i, to: i, dy: new Animated.Value(0) };
    dragRef.current = d; setDrag(d);
  };
  const onMove = (dy) => {
    const d = dragRef.current;
    if (!d) return;
    d.dy.setValue(dy);
    const to = Math.max(0, Math.min(n - 1, Math.round(d.from + dy / H)));
    if (to !== d.to) { d.to = to; setDrag({ ...d }); }
  };
  const onEnd = () => {
    const d = dragRef.current;
    dragRef.current = null; setDrag(null);
    const { pl: p, songs: ss } = cur.current;
    if (d && p && d.to !== d.from && ss[d.from] && ss[d.to]) {
      // Индексы в p.ids (там могут быть удалённые песни) — по id.
      lib.movePlaylistItem(p.id, p.ids.indexOf(ss[d.from].id), p.ids.indexOf(ss[d.to].id));
    }
  };
  const shiftOf = (i) => {
    if (!drag || i === drag.from) return 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -H;
    if (drag.from > drag.to && i < drag.from && i >= drag.to) return H;
    return 0;
  };

  return (
    <Modal visible={!!playlist} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: insets.bottom }}>
        <View style={{ backgroundColor: colors.bgHeader, paddingTop: insets.top + 10, paddingBottom: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
          <HeaderBg />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.headerText, fontSize: 19, fontWeight: '700' }} numberOfLines={1}>{pl ? pl.name : ''}</Text>
            <Text style={{ color: colors.headerText + 'aa', fontSize: 12, marginTop: 2 }}>{t('pl_order_hint')}</Text>
          </View>
          <Pressable onPress={onClose} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.headerBtn }}>
            <Text style={{ color: colors.headerText, fontWeight: '700' }}>{t('done')}</Text>
          </Pressable>
        </View>
        <ScrollView scrollEnabled={!drag}>
          {songs.map((s, i) => (
            <Row key={s.id} song={s} i={i} n={n} drag={drag} shift={shiftOf(i)} colors={colors} t={t}
              onStart={onStart} onMove={onMove} onEnd={onEnd} onRemove={() => lib.removeFromPlaylist(pl.id, s.id)} />
          ))}
          {!n ? <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 30 }}>{t('pl_empty')}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
