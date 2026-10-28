import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, shadow } from '../theme';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_AHEAD = 14;

// day_of_week: 0 = Sunday ... 6 = Saturday (Mon = 1, Fri = 5)
const dowOf = (d) => d.getDay();

const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const toMinutes = (t) => {
  const [h, m] = String(t).split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
};
const toHHMM = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const fmt12 = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
};

function Chip({ label, selected, onPress, sub, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[s.chip, selected && s.chipSelected, disabled && s.chipDisabled]}
    >
      <Text style={[s.chipText, selected && s.chipTextSelected, disabled && s.chipTextDisabled]}>
        {label}
      </Text>
      {sub ? <Text style={[s.chipSub, selected && s.chipTextSelected]}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

export default function HomeScreen({ session }) {
  const scrollRef = useRef(null);
  const user = session?.user;
  const userName = user?.user_metadata?.full_name;

  const [departments, setDepartments] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [deptId, setDeptId] = useState(null);
  const [doctorId, setDoctorId] = useState(null);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [booked, setBooked] = useState([]);
  const [reason, setReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    setDataLoading(true);
    setLoadError('');
    const [deptRes, docRes, schRes] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase
        .from('doctors')
        .select('id, department_id, name, specialization, consultation_fee, slot_duration_minutes')
        .order('name'),
      supabase.from('doctor_schedules').select('doctor_id, day_of_week, start_time, end_time'),
    ]);
    const err = deptRes.error || docRes.error || schRes.error;
    if (err) {
      setLoadError(err.message);
    } else {
      setDepartments(deptRes.data);
      setAllDoctors(docRes.data);
      setSchedules(schRes.data);
    }
    setDataLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const doctors = allDoctors.filter((d) => d.department_id === deptId);
  const doctor = allDoctors.find((d) => d.id === doctorId);

  const days = useMemo(() => {
    if (!doctorId) return [];
    const workDays = new Set(
      schedules.filter((x) => x.doctor_id === doctorId).map((x) => Number(x.day_of_week))
    );
    const arr = [];
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      if (workDays.has(dowOf(d))) {
        arr.push({
          iso: toISO(d),
          dow: dowOf(d),
          day: DAY_NAMES[d.getDay()],
          label: `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`,
        });
      }
    }
    return arr;
  }, [doctorId, schedules]);

  const slots = useMemo(() => {
    if (!doctor || !date) return [];
    const day = days.find((d) => d.iso === date);
    if (!day) return [];
    const dur = doctor.slot_duration_minutes || 30;
    const now = new Date();
    const isToday = date === toISO(now);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const out = [];
    schedules
      .filter((x) => x.doctor_id === doctor.id && Number(x.day_of_week) === day.dow)
      .forEach((sch) => {
        const end = toMinutes(sch.end_time);
        for (let t = toMinutes(sch.start_time); t + dur <= end; t += dur) {
          if (isToday && t <= nowMins) continue;
          out.push(toHHMM(t));
        }
      });
    return [...new Set(out)].sort();
  }, [doctor, date, days, schedules]);

  const loadBooked = async (docId, dateISO) => {
    const { data, error: err } = await supabase.rpc('get_booked_slots', {
      p_doctor: docId,
      p_date: dateISO,
    });
    if (err || !data) {
      setBooked([]);
      return;
    }
    setBooked(
      data.map((r) => String(typeof r === 'string' ? r : r.time_slot).slice(0, 5))
    );
  };

  useEffect(() => {
    if (doctorId && date) loadBooked(doctorId, date);
    else setBooked([]);
  }, [doctorId, date]);

  const resetMessages = () => {
    setSuccess('');
    setError('');
  };
  const pickDept = (id) => {
    setDeptId(id);
    setDoctorId(null);
    setDate(null);
    setTime(null);
    resetMessages();
  };
  const pickDoctor = (id) => {
    setDoctorId(id);
    setDate(null);
    setTime(null);
    resetMessages();
  };
  const pickDate = (iso) => {
    setDate(iso);
    setTime(null);
    resetMessages();
  };

  const handleBook = async () => {
    resetMessages();
    if (!deptId) return setError('Please select a department.');
    if (!doctorId) return setError('Please select a doctor.');
    if (!date) return setError('Please select a date.');
    if (!time) return setError('Please select a time slot.');

    setLoading(true);
    const { error: err } = await supabase.from('appointments').insert({
      patient_id: user.id,
      doctor_id: doctorId,
      appointment_date: date,
      time_slot: time,
      patient_name: userName || user.email,
      patient_phone: user?.user_metadata?.phone || null,
      reason: reason.trim() || null,
      status: 'pending',
    });
    setLoading(false);

    if (err) {
      if (err.code === '23505') {
        setError('This slot was just booked. Please choose another time.');
        loadBooked(doctorId, date);
      } else {
        setError(err.message);
      }
      return;
    }
    setSuccess(`Request sent to ${doctor.name} for ${date} at ${fmt12(time)}. The doctor will confirm your appointment shortly.`);
    setDeptId(null);
    setDoctorId(null);
    setDate(null);
    setTime(null);
    setReason('');
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.container}>
        <View style={s.header}>
          <View style={s.userRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {String(userName || user?.email || 'P').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={s.hello}>Hello, {userName || 'there'}</Text>
              <Text style={s.headerSub}>Medicare Hospital</Text>
            </View>
          </View>
          <TouchableOpacity style={s.logoutBtn} onPress={() => supabase.auth.signOut()}>
            <Text style={s.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>

        {dataLoading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : loadError ? (
          <View style={s.center}>
            <Text style={s.error}>{loadError}</Text>
            <TouchableOpacity style={[s.button, { paddingHorizontal: 30 }]} onPress={loadData}>
              <Text style={s.buttonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[s.body, { paddingBottom: 250 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Text style={s.title}>Book an Appointment</Text>
            {success ? <Text style={s.success}>{success}</Text> : null}

            <Text style={s.label}>1. Department</Text>
            <View style={s.wrap}>
              {departments.map((d) => (
                <Chip key={d.id} label={d.name} selected={deptId === d.id} onPress={() => pickDept(d.id)} />
              ))}
            </View>

            <Text style={s.label}>2. Doctor</Text>
            {!deptId ? (
              <Text style={s.hint}>Select a department first.</Text>
            ) : doctors.length === 0 ? (
              <Text style={s.hint}>No doctors available in this department yet.</Text>
            ) : (
              <View style={s.wrap}>
                {doctors.map((d) => (
                  <Chip
                    key={d.id}
                    label={d.name}
                    sub={[d.specialization, d.consultation_fee ? `Rs. ${d.consultation_fee}` : null]
                      .filter(Boolean)
                      .join(' • ')}
                    selected={doctorId === d.id}
                    onPress={() => pickDoctor(d.id)}
                  />
                ))}
              </View>
            )}

            <Text style={s.label}>3. Date</Text>
            {!doctorId ? (
              <Text style={s.hint}>Select a doctor first.</Text>
            ) : days.length === 0 ? (
              <Text style={s.hint}>This doctor has no schedule in the next {DAYS_AHEAD} days.</Text>
            ) : (
              <View style={s.wrap}>
                {days.map((d) => (
                  <Chip key={d.iso} label={d.label} sub={d.day} selected={date === d.iso} onPress={() => pickDate(d.iso)} />
                ))}
              </View>
            )}

            <Text style={s.label}>4. Time</Text>
            {!date ? (
              <Text style={s.hint}>Select a date first.</Text>
            ) : slots.length === 0 ? (
              <Text style={s.hint}>No slots available on this day.</Text>
            ) : (
              <View style={s.wrap}>
                {slots.map((t) => (
                  <Chip
                    key={t}
                    label={fmt12(t)}
                    selected={time === t}
                    disabled={booked.includes(t)}
                    onPress={() => setTime(t)}
                  />
                ))}
              </View>
            )}

            <Text style={s.label}>5. Reason for visit</Text>
            <TextInput
              style={[s.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Reason for visit (optional)"
              placeholderTextColor="#9CA3AF"
              multiline
              value={reason}
              onChangeText={setReason}
              onFocus={() =>
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)
              }
            />

            {error ? <Text style={s.error}>{error}</Text> : null}

            <TouchableOpacity style={s.button} onPress={handleBook} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color={colors.white} />
                : <Text style={s.buttonText}>Book Appointment</Text>}
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14,
    backgroundColor: colors.white, ...shadow, zIndex: 2,
  },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: '800' },
  hello: { fontSize: 20, fontWeight: '700', color: colors.black },
  headerSub: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2 },
  logoutBtn: {
    backgroundColor: colors.redLight, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  logoutText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  body: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 4, letterSpacing: -0.5 },
  success: {
    color: '#166534', backgroundColor: '#E8F7EE', padding: 14,
    borderRadius: 12, marginTop: 8, marginBottom: 8, fontSize: 14, lineHeight: 20,
    borderLeftWidth: 4, borderLeftColor: colors.success,
  },
  label: {
    fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 24, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 10,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { fontSize: 13, color: colors.muted },
  chip: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    marginRight: 8, marginBottom: 8, ...shadow, shadowOpacity: 0.04, elevation: 1,
  },
  chipSelected: {
    backgroundColor: colors.primary, borderColor: colors.primary,
    shadowColor: colors.primary, shadowOpacity: 0.3, elevation: 4,
  },
  chipDisabled: { backgroundColor: '#F3F4F6', opacity: 0.6 },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  chipTextSelected: { color: colors.white },
  chipTextDisabled: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  chipSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: colors.text, backgroundColor: colors.white, marginBottom: 12,
  },
  error: {
    color: colors.primaryDark, backgroundColor: colors.redLight,
    padding: 10, borderRadius: 8, marginTop: 4, marginBottom: 4, fontSize: 13,
  },
  button: {
    backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 12,
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});