import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, shadow } from '../theme';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS = {
  pending: { label: 'Pending', bg: '#FEF3C7', fg: '#B45309', note: "Waiting for the doctor's confirmation." },
  confirmed: { label: 'Confirmed', bg: '#DCFCE7', fg: '#15803D', note: 'Confirmed. Please arrive 10 minutes early.' },
  completed: { label: 'Completed', bg: '#E5E7EB', fg: '#374151', note: 'Consultation completed.' },
  cancelled: { label: 'Cancelled', bg: '#FEE2E2', fg: '#B91C1C', note: 'This appointment was cancelled.' },
};

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const fmtDate = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_NAMES[dt.getDay()]}, ${d} ${MONTH_NAMES[m - 1]} ${y}`;
};
const fmt12 = (t) => {
  const [h, m] = String(t).slice(0, 5).split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export default function MyAppointmentsScreen({ session, onMessageDoctor }) {
  const user = session?.user;
  const [rows, setRows] = useState([]);
  const [doctors, setDoctors] = useState({});
  const [tab, setTab] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [apRes, docRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, doctor_id, appointment_date, time_slot, reason, status')
        .eq('patient_id', user.id),
      supabase.from('doctors').select('id, name, specialization'),
    ]);
    const err = apRes.error || docRes.error;
    if (err) {
      setError(err.message);
    } else {
      setError('');
      setRows(apRes.data);
      setDoctors(Object.fromEntries(docRes.data.map((d) => [d.id, d])));
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return undefined;
    // Update instantly when the doctor confirms, cancels or completes an appointment
    const channel = supabase
      .channel(`my-appointments-${user.id}`)
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

  const groups = useMemo(() => {
    const key = (r) => `${r.appointment_date} ${String(r.time_slot).slice(0, 5)}`;
    const asc = (a, b) => key(a).localeCompare(key(b));
    const desc = (a, b) => key(b).localeCompare(key(a));
    return {
      upcoming: rows.filter((r) => r.status === 'pending' || r.status === 'confirmed').sort(asc),
      completed: rows.filter((r) => r.status === 'completed').sort(desc),
      cancelled: rows.filter((r) => r.status === 'cancelled').sort(desc),
    };
  }, [rows]);

  const cancelRequest = (r) => {
    Alert.alert('Cancel request?', `${fmtDate(r.appointment_date)} at ${fmt12(r.time_slot)}`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          setBusyId(r.id);
          setError('');
          const { data, error: err } = await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('id', r.id)
            .eq('status', 'pending')
            .select();
          setBusyId(null);
          if (err) setError(err.message);
          else if (!data || data.length === 0) {
            setError('Could not cancel. The doctor may have just confirmed it.');
          }
          load();
        },
      },
    ]);
  };

  const renderItem = ({ item: r }) => {
    const st = STATUS[r.status] || STATUS.pending;
    const doc = doctors[r.doctor_id];
    return (
      <View style={[s.card, { borderLeftColor: st.fg }]}>
        <View style={s.cardTop}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={s.docName}>{doc?.name || 'Doctor'}</Text>
            {doc?.specialization ? <Text style={s.docSpec}>{doc.specialization}</Text> : null}
          </View>
          <View style={[s.badge, { backgroundColor: st.bg }]}>
            <Text style={[s.badgeText, { color: st.fg }]}>{st.label}</Text>
          </View>
        </View>

        <View style={s.dateRow}>
          <Text style={s.date}>{fmtDate(r.appointment_date)}</Text>
          <Text style={s.time}>{fmt12(r.time_slot)}</Text>
        </View>

        {r.reason ? <Text style={s.reason}>Reason: {r.reason}</Text> : null}
        <Text style={[s.note, { color: st.fg }]}>{st.note}</Text>

        {r.status === 'completed' && onMessageDoctor && (
          <TouchableOpacity
            style={s.messageBtn}
            onPress={() => onMessageDoctor(r.doctor_id)}
            activeOpacity={0.85}
          >
            <Text style={s.messageText}>Message Doctor</Text>
          </TouchableOpacity>
        )}

        {r.status === 'pending' && (
          <TouchableOpacity
            style={s.cancelBtn}
            onPress={() => cancelRequest(r)}
            disabled={busyId === r.id}
            activeOpacity={0.8}
          >
            {busyId === r.id ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={s.cancelText}>Cancel request</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>My Appointments</Text>
        <Text style={s.sub}>Updates automatically when your doctor confirms or cancels.</Text>
      </View>

      <View style={s.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, tab === t.key && s.tabActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.8}
          >
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>
              {t.label} ({groups[t.key].length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={groups[tab]}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <Text style={s.empty}>
              {tab === 'upcoming'
                ? 'No upcoming appointments. Book one from the Book tab.'
                : tab === 'completed'
                ? 'No completed appointments yet.'
                : 'No cancelled appointments.'}
            </Text>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: colors.white, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    ...shadow, zIndex: 2,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.black },
  sub: { fontSize: 12, color: colors.muted, marginTop: 4 },
  tabs: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', marginHorizontal: 3,
    backgroundColor: colors.white, borderWidth: 1, borderColor: '#EEF2F6',
  },
  tabActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.text },
  tabTextActive: { color: colors.white },
  list: { padding: 16, paddingBottom: 40 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 50, fontSize: 14, paddingHorizontal: 30 },
  error: {
    color: colors.primaryDark, backgroundColor: colors.redLight, margin: 16, marginBottom: 0,
    padding: 10, borderRadius: 8, fontSize: 13,
  },
  card: {
    backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#EEF2F6', borderLeftWidth: 4, ...shadow,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  docName: { fontSize: 16, fontWeight: '800', color: colors.black },
  docSpec: { fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  dateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.slate, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginTop: 12,
  },
  date: { fontSize: 14, fontWeight: '700', color: colors.text },
  time: { fontSize: 14, fontWeight: '800', color: colors.primary },
  reason: { fontSize: 13, color: colors.text, marginTop: 10 },
  note: { fontSize: 12, fontWeight: '600', marginTop: 10 },
  cancelBtn: {
    marginTop: 12, backgroundColor: colors.redLight, borderRadius: 12,
    paddingVertical: 11, alignItems: 'center',
  },
  cancelText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  messageBtn: {
    marginTop: 12, backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  messageText: { color: colors.white, fontWeight: '800', fontSize: 14 },
});