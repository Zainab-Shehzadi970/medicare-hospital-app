import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
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
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.brandRow}>
          <View style={s.logoBadge}>
            <Text style={s.logoLetter}>M</Text>
          </View>
          <View>
            <Text style={s.brand}>MEDICARE</Text>
            <Text style={s.brandSub}>H O S P I T A L</Text>
          </View>
        </View>

        <Text style={s.title}>{isSignup ? 'Create your account' : 'Welcome back'}</Text>
        <Text style={s.subtitle}>
          {isSignup
            ? 'Sign up to book your appointments online.'
            : 'Log in to book and manage your appointments.'}
        </Text>

        {isSignup && (
          <>
            <Text style={s.label}>Full name</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Ahmed Khan"
              placeholderTextColor="#9CA3AF"
              value={fullName}
              onChangeText={setFullName}
            />
            <Text style={s.label}>Phone number</Text>
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

        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          placeholder="name@example.com"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={s.label}>Password</Text>
        <View style={s.passwordRow}>
          <TextInput
            style={[s.input, { flex: 1, marginBottom: 0 }]}
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
    paddingTop: 60,
    paddingBottom: 40,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  logoBadge: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  logoLetter: { color: colors.white, fontSize: 24, fontWeight: '800' },
  brand: { fontSize: 20, fontWeight: '800', color: colors.black, letterSpacing: 1 },
  brandSub: { fontSize: 10, color: colors.primary, fontWeight: '600', marginTop: 2 },
  title: { fontSize: 26, fontWeight: '700', color: colors.black, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: colors.text, backgroundColor: colors.white, marginBottom: 16,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  showBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  showText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  error: {
    color: colors.primaryDark, backgroundColor: colors.redLight,
    padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13,
  },
  info: { color: colors.success, marginBottom: 12, fontSize: 13 },
  button: {
    backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 10,
    alignItems: 'center', marginTop: 4,
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  switchText: { textAlign: 'center', marginTop: 20, color: colors.muted, fontSize: 14 },
  switchLink: { color: colors.primary, fontWeight: '700' },
});