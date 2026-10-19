import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AuthScreen() {
  const [isSignup, setIsSignup] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const validate = () => {
    if (isSignup && fullName.trim().length < 3) return 'Please enter your full name.';
    if (isSignup && !/^\+?\d{10,15}$/.test(phone.trim())) return 'Please enter a valid phone number (10-15 digits).';
    if (!EMAIL_REGEX.test(email.trim())) return 'Please enter a valid email address.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    return '';
  };

  const handleSubmit = async () => {
    setError('');
    setInfo('');
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    if (isSignup) {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: fullName.trim(), phone: phone.trim() } },
      });
      if (err) {
        setError(err.message);
      } else if (!data.session) {
        setInfo('Account created. Please log in.');
        setIsSignup(false);
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (err) {
        setError(err.message === 'Invalid login credentials' ? 'Incorrect email or password.' : err.message);
      }
    }
    setLoading(false);
  };

  const switchMode = () => {
    setIsSignup(!isSignup);
    setError('');
    setInfo('');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.white }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.container, { paddingBottom: 200 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Brand */}
        <View style={s.brandRow}>
          <Image source={require('../assets/logo.png')} style={s.logo} resizeMode="contain" />
          <View>
            <Text style={s.brand}>MEDICARE</Text>
            <Text style={s.brandSub}>HOSPITAL</Text>
          </View>
        </View>

        {/* Badge */}
        <View style={s.badge}>
          <View style={s.badgeDot} />
          <Text style={s.badgeText}>PATIENT PORTAL</Text>
        </View>

        <Text style={s.title}>
          {isSignup ? 'Create your ' : 'Welcome '}
          <Text style={s.titleRed}>{isSignup ? 'account.' : 'back.'}</Text>
        </Text>
        <Text style={s.subtitle}>
          {isSignup
            ? 'Sign up to book your appointments online with our top specialists.'
            : 'Log in to book and manage your appointments.'}
        </Text>

        {isSignup && (
          <>
            <Text style={s.label}>FULL NAME</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Ahmed Khan"
              placeholderTextColor="#9CA3AF"
              value={fullName}
              onChangeText={setFullName}
            />
            <Text style={s.label}>PHONE NUMBER</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 03001234567"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </>
        )}

        <Text style={s.label}>EMAIL</Text>
        <TextInput
          style={s.input}
          placeholder="name@example.com"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={s.label}>PASSWORD</Text>
        <View style={s.passwordWrap}>
          <TextInput
            style={s.passwordInput}
            placeholder="At least 6 characters"
            placeholderTextColor="#9CA3AF"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.showBtn}>
            <Text style={s.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
        {info ? <Text style={s.info}>{info}</Text> : null}

        <TouchableOpacity
          style={s.button}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.buttonText}>{isSignup ? 'Create Account' : 'Log In'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={switchMode}>
          <Text style={s.switchText}>
            {isSignup ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={s.switchLink}>{isSignup ? 'Log in' : 'Sign up'}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingTop: 56,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  logo: { width: 52, height: 52, marginRight: 10 },
  brand: { fontSize: 26, fontWeight: '900', color: '#000000', letterSpacing: -0.5 },
  brandSub: { fontSize: 12, fontWeight: '700', color: '#4B5563', letterSpacing: 3, marginTop: 1 },
  badge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.redLight, borderWidth: 1, borderColor: '#F5B5B3',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 14,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary, marginRight: 8 },
  badgeText: { fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', lineHeight: 32, marginBottom: 8 },
  titleRed: { color: colors.primary },
  subtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 26 },
  label: { fontSize: 11, fontWeight: '800', color: '#4B5563', letterSpacing: 0.8, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15,
    color: colors.text, backgroundColor: '#F9FAFB', marginBottom: 16,
  },
  passwordWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    backgroundColor: '#F9FAFB', marginBottom: 16,
  },
  passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: colors.text },
  showBtn: { paddingHorizontal: 14, paddingVertical: 13 },
  showText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  error: {
    color: colors.primaryDark, backgroundColor: colors.redLight,
    padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 13,
  },
  info: { color: colors.success, marginBottom: 12, fontSize: 13 },
  button: {
    backgroundColor: colors.primary, paddingVertical: 15, borderRadius: 12,
    alignItems: 'center', marginTop: 4,
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  switchText: { textAlign: 'center', marginTop: 22, color: '#6B7280', fontSize: 14 },
  switchLink: { color: colors.primary, fontWeight: '800' },
});