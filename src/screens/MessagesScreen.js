import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput,
  Keyboard, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { colors, shadow } from '../theme';

// If the input box is still cut off by the keyboard, increase this number (e.g. 20).
// If there is a gap between the keyboard and the box, decrease it (e.g. -20).
const EXTRA_LIFT = 0;

const initial = (n) =>
  String(n || '').replace(/^dr\.?\s*/i, '').trim().charAt(0).toUpperCase() || 'D';

const fmtTime = (iso) => {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()}/${d.getMonth() + 1}  ${h % 12 === 0 ? 12 : h % 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
};

export default function MessagesScreen({ session, openRequest, onUnreadChange }) {
  const user = session?.user;
  const [doctors, setDoctors] = useState([]); // doctors with a COMPLETED appointment
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [kbHeight, setKbHeight] = useState(0);
  const [windowResized, setWindowResized] = useState(false);
  const baseHeight = useRef(0);
  const kbOpen = useRef(false);

  // Measure the real keyboard height and lift the chat box above it
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, (e) => {
      kbOpen.current = true;
      setKbHeight(e.endCoordinates.height);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    });
    const b = Keyboard.addListener(hideEvt, () => {
      kbOpen.current = false;
      setKbHeight(0);
      setWindowResized(false);
    });
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  // On some phones Android resizes the screen itself when the keyboard opens.
  // In that case no extra lift is needed, otherwise the box would sit too high.
  const onContainerLayout = (e) => {
    const h = e.nativeEvent.layout.height;
    if (!kbOpen.current) baseHeight.current = h;
    else if (baseHeight.current && h < baseHeight.current - 40) setWindowResized(true);
  };

  // On Android the reported keyboard height already excludes the navigation bar; on iOS it does not
  const lift =
    kbHeight > 0 && !windowResized
      ? Math.max(0, kbHeight - (Platform.OS === 'ios' ? insets.bottom : 0) + EXTRA_LIFT)
      : 0;

  const load = useCallback(async () => {
    if (!user) return;
    const [apRes, docRes, msgRes] = await Promise.all([
      supabase.from('appointments').select('doctor_id').eq('patient_id', user.id).eq('status', 'completed'),
      supabase.from('doctors').select('id, name, specialization'),
      supabase
        .from('messages')
        .select('id, doctor_id, sender, body, created_at, read_at')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: true }),
    ]);
    const err = apRes.error || docRes.error || msgRes.error;
    if (err) {
      setError(err.message);
    } else {
      setError('');
      const ids = new Set(apRes.data.map((a) => a.doctor_id));
      setDoctors(docRes.data.filter((d) => ids.has(d.id)));
      setMessages(msgRes.data);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return undefined;
    const channel = supabase
      .channel(`my-messages-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `patient_id=eq.${user.id}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `patient_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, user]);

  // The "Message Doctor" button opens that doctor's chat directly
  useEffect(() => {
    if (openRequest?.doctorId) setSelected(openRequest.doctorId);
  }, [openRequest]);

  const threads = useMemo(
    () =>
      doctors
        .map((d) => {
          const msgs = messages.filter((m) => m.doctor_id === d.id);
          return {
            ...d,
            last: msgs[msgs.length - 1],
            unread: msgs.filter((m) => m.sender === 'doctor' && !m.read_at).length,
          };
        })
        .sort((a, b) => (b.last?.created_at || '').localeCompare(a.last?.created_at || '')),
    [doctors, messages]
  );

  const totalUnread = threads.reduce((n, t) => n + t.unread, 0);
  useEffect(() => {
    onUnreadChange?.(totalUnread);
  }, [totalUnread, onUnreadChange]);

  const current = threads.find((t) => t.id === selected);
  const thread = messages.filter((m) => m.doctor_id === selected);
  const hasUnread = thread.some((m) => m.sender === 'doctor' && !m.read_at);

  // While the chat is open, mark the doctor's messages as read
  useEffect(() => {
    if (!selected || !hasUnread || !user) return;
    supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('patient_id', user.id)
      .eq('doctor_id', selected)
      .eq('sender', 'doctor')
      .is('read_at', null)
      .then(() => load());
  }, [selected, hasUnread, user, load]);

  const send = async () => {
    const body = text.trim();
    if (!body || !selected || sending) return;
    setSending(true);
    setError('');
    const { error: err } = await supabase
      .from('messages')
      .insert({ patient_id: user.id, doctor_id: selected, sender: 'patient', body });
    setSending(false);
    if (err) {
      setError(err.message);
      return;
    }
    setText('');
    load();
  };

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ---------- Chat screen ----------
  if (selected) {
    return (
      <View style={[s.container, { paddingBottom: lift }]} onLayout={onContainerLayout}>
        <View style={s.chatHeader}>
          <TouchableOpacity onPress={() => setSelected(null)} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backText}>‹</Text>
          </TouchableOpacity>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initial(current?.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.chatName}>{current?.name || 'Doctor'}</Text>
            {current?.specialization ? <Text style={s.chatSpec}>{current.specialization}</Text> : null}
          </View>
        </View>

        <Text style={s.notice}>
          Not for emergencies. In an emergency call the hospital or go to the nearest emergency room.
        </Text>

        <FlatList
          ref={listRef}
          data={thread}
          keyExtractor={(m) => m.id}
          contentContainerStyle={s.chatList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text style={s.empty}>No messages yet. Ask your doctor about your medicine or follow-up.</Text>
          }
          renderItem={({ item: m }) => {
            const mine = m.sender === 'patient';
            return (
              <View style={[s.bubbleRow, mine ? s.rowMine : s.rowTheirs]}>
                <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
                  <Text style={[s.bubbleText, mine && { color: colors.white }]}>{m.body}</Text>
                  <Text style={[s.bubbleTime, mine && { color: 'rgba(255,255,255,0.75)' }]}>
                    {fmtTime(m.created_at)}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
            onPress={send}
            disabled={!text.trim() || sending}
            activeOpacity={0.85}
          >
            {sending ? <ActivityIndicator color={colors.white} /> : <Text style={s.sendText}>Send</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------- Doctors list ----------
  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Messages</Text>
        <Text style={s.sub}>Chat with doctors you have completed an appointment with.</Text>
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <FlatList
        data={threads}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <Text style={s.empty}>
            Chat unlocks once a doctor marks your appointment as completed.
          </Text>
        }
        renderItem={({ item: t }) => (
          <TouchableOpacity style={s.threadCard} onPress={() => setSelected(t.id)} activeOpacity={0.8}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initial(t.name)}</Text>
            </View>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={s.threadName}>{t.name}</Text>
              <Text style={s.threadLast} numberOfLines={1}>
                {t.last ? (t.last.sender === 'patient' ? 'You: ' : '') + t.last.body : 'Tap to start chatting'}
              </Text>
            </View>
            {t.unread > 0 && (
              <View style={s.unread}>
                <Text style={s.unreadText}>{t.unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  avatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: '800' },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: colors.white, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    ...shadow, zIndex: 2,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.black },
  sub: { fontSize: 12, color: colors.muted, marginTop: 4 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 50, fontSize: 14, paddingHorizontal: 30 },
  error: {
    color: colors.primaryDark, backgroundColor: colors.redLight, marginHorizontal: 16, marginVertical: 6,
    padding: 10, borderRadius: 8, fontSize: 13,
  },
  threadCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 16,
    padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#EEF2F6', ...shadow,
  },
  threadName: { fontSize: 16, fontWeight: '800', color: colors.black },
  threadLast: { fontSize: 13, color: colors.muted, marginTop: 3 },
  unread: {
    minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  unreadText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12,
    ...shadow, zIndex: 2,
  },
  backBtn: { paddingHorizontal: 12, paddingVertical: 2 },
  backText: { fontSize: 34, color: colors.primary, lineHeight: 36 },
  chatName: { fontSize: 17, fontWeight: '800', color: colors.black },
  chatSpec: { fontSize: 12, color: colors.muted, marginTop: 1 },
  notice: {
    fontSize: 11, color: '#92400E', backgroundColor: '#FEF3C7',
    paddingHorizontal: 14, paddingVertical: 7, textAlign: 'center',
  },
  chatList: { padding: 14, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', marginBottom: 8 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16 },
  bubbleMine: {
    backgroundColor: colors.primary, borderBottomRightRadius: 4,
    shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  bubbleTheirs: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: '#EEF2F6', borderBottomLeftRadius: 4,
    ...shadow, shadowOpacity: 0.04, elevation: 1,
  },
  bubbleText: { fontSize: 15, color: colors.text },
  bubbleTime: { fontSize: 10, color: colors.muted, marginTop: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 10, backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: '#EEF2F6',
  },
  input: {
    flex: 1, maxHeight: 110, borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: colors.text, backgroundColor: colors.bg,
  },
  sendBtn: {
    marginLeft: 8, backgroundColor: colors.primary, borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 11, minWidth: 64, alignItems: 'center',
  },
  sendText: { color: colors.white, fontWeight: '800', fontSize: 14 },
});