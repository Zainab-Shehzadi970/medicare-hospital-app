import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Keyboard, Platform } from 'react-native';
import HomeScreen from './HomeScreen';
import MyAppointmentsScreen from './MyAppointmentsScreen';
import MessagesScreen from './MessagesScreen';
import { colors, shadow } from '../theme';

const TABS = [
  { key: 'book', label: 'Book' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'messages', label: 'Messages' },
];

export default function MainTabs({ session }) {
  const [tab, setTab] = useState('book');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [openRequest, setOpenRequest] = useState(null);

  // Hide the bottom tab bar while the keyboard is open
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const b = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  // Triggered by the "Message Doctor" button on a completed appointment
  const messageDoctor = (doctorId) => {
    setOpenRequest({ doctorId, t: Date.now() });
    setTab('messages');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* All three screens stay mounted so the Book form is not lost when switching tabs */}
      <View style={[s.screen, tab !== 'book' && s.hidden]}>
        <HomeScreen session={session} />
      </View>
      <View style={[s.screen, tab !== 'appointments' && s.hidden]}>
        <MyAppointmentsScreen session={session} onMessageDoctor={messageDoctor} />
      </View>
      <View style={[s.screen, tab !== 'messages' && s.hidden]}>
        <MessagesScreen session={session} openRequest={openRequest} onUnreadChange={setUnread} />
      </View>

      {!keyboardOpen && (
        <View style={s.bar}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.key} style={s.tab} onPress={() => setTab(t.key)} activeOpacity={0.8}>
              <View style={[s.indicator, tab === t.key && s.indicatorActive]} />
              <View style={s.labelRow}>
                <Text style={[s.label, tab === t.key && s.labelActive]}>{t.label}</Text>
                {t.key === 'messages' && unread > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{unread}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  hidden: { display: 'none' },
  bar: {
    flexDirection: 'row', backgroundColor: colors.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    ...shadow, shadowOffset: { width: 0, height: -4 }, elevation: 10,
  },
  tab: { flex: 1, alignItems: 'center', paddingBottom: 14 },
  indicator: { height: 4, width: 40, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: 'transparent', marginBottom: 11 },
  indicatorActive: { backgroundColor: colors.primary },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted },
  labelActive: { color: colors.primary },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 5,
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
});