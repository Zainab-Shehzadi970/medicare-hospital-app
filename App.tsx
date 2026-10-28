import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from './src/lib/supabase';
import { colors } from './src/theme';
import AuthScreen from './src/screens/AuthScreen';
import MainTabs from './src/screens/MainTabs';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        {session ? <MainTabs session={session} /> : <AuthScreen />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}