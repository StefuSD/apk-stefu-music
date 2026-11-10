import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../i18n';
import { normalizeUrl } from '../utils/languages';
import { b64ToBytes } from '../utils/base64';

/** id видео YouTube из ссылки (watch?v=, youtu.be/, /shorts/, /embed/) или null. */
function youtubeId(u) {
  const m = u.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** Картинка ли это: по первым байтам (JPEG, PNG, WebP, GIF). */
async function isImage(uri) {
  const b = b64ToBytes(await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64, position: 0, length: 12 }));
  const jpg = b[0] === 0xff && b[1] === 0xd8;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const gif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return jpg || png || gif || webp;
}

/**
 * Окно «Обложка по ссылке»: скачать картинку из интернета и отдать путь
 * к файлу (onDone(uri)). Ссылка на видео YouTube → его превью-кадр.
 */
export default function CoverFromUrl({ visible, onDone, onClose }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (visible) { setUrl(''); setErr(''); setBusy(false); } }, [visible]);

  const paste = async () => {
    try { const s = (await Clipboard.getStringAsync() || '').trim(); if (s) { setUrl(s); setErr(''); } } catch (e) { /* пустой буфер */ }
  };

  const download = async () => {
    let u = normalizeUrl(url);
    if (!u) return;
    const yt = youtubeId(u);
    if (yt) u = `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
    setBusy(true); setErr('');
    const dest = FileSystem.cacheDirectory + 'cover-dl-' + Date.now();
    try {
      const r = await FileSystem.downloadAsync(u, dest);
      if (r.status < 200 || r.status >= 300) throw new Error('http ' + r.status);
      if (!(await isImage(r.uri))) { FileSystem.deleteAsync(r.uri, { idempotent: true }).catch(() => {}); throw new Error('not image'); }
      onDone(r.uri);
      onClose();
    } catch (e) {
      setErr(t('cover_url_bad'));
    } finally { setBusy(false); }
  };

  const btn = [st.btn, { borderColor: colors.border, backgroundColor: colors.bgCard }];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={busy ? undefined : onClose} style={[st.back, { backgroundColor: colors.overlay }]}>
        <Pressable style={[st.card, { backgroundColor: colors.bgCard }]}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{t('cover_url')}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4, lineHeight: 18 }}>{t('cover_url_hint')}</Text>
          <TextInput value={url} onChangeText={v => { setUrl(v); setErr(''); }} placeholder="https://…"
            placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url"
            style={[st.input, { backgroundColor: colors.bgInput, color: colors.text, borderColor: err ? colors.danger : colors.border }]}
            onSubmitEditing={download} editable={!busy} />
          {err ? <Text style={{ color: colors.danger, fontSize: 13, marginTop: 6 }}>{err}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 }}>
            <Pressable onPress={paste} disabled={busy} style={btn}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{t('lyrics_paste')}</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} disabled={busy} style={[st.btn, { borderColor: 'transparent' }]}>
              <Text style={{ color: colors.textMuted, fontWeight: '600' }}>{t('cancel')}</Text>
            </Pressable>
            <Pressable onPress={download} disabled={busy || !url.trim()}
              style={[st.btn, { backgroundColor: colors.accent, borderColor: colors.accent, opacity: url.trim() ? 1 : 0.5, minWidth: 92, alignItems: 'center' }]}>
              {busy ? <ActivityIndicator color={colors.onAccent} size="small" />
                : <Text style={{ color: colors.onAccent, fontWeight: '700' }}>{t('cover_download')}</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  back: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { borderRadius: 18, padding: 18 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 12 },
  btn: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
});
