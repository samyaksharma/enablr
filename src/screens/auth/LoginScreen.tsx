import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthActions } from '@convex-dev/auth/react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useThemeStore } from '../../stores/themeStore';
import { spacing, typography } from '../../constants/theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export function LoginScreen({ navigation }: Props) {
  const colors = useThemeStore((s) => s.colors);
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signIn("password", { email: email.trim(), password, flow: "signIn" });
    } catch (e: any) {
      setError(e?.message ?? 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signIn("google");
    } catch (e: any) {
      setError(e?.message ?? 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Enablr</Text>
          <Text style={[styles.subtitle, { color: colors.primary }]}>
            Your quest begins here
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="adventurer@enablr.app"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          ) : null}

          <Button title="Sign In" onPress={handleLogin} loading={loading} size="lg" />

          <Button
            title="Sign In with Google"
            onPress={handleGoogleSignIn}
            variant="outline"
            loading={loading}
            style={{ marginTop: spacing.md }}
          />

          <Button
            title="Create Account"
            onPress={() => navigation.navigate('SignUp')}
            variant="ghost"
            style={{ marginTop: spacing.md }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  title: {
    ...typography.h1,
    fontSize: 40,
    letterSpacing: 2,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.sm,
  },
  form: {
    width: '100%',
  },
  errorText: {
    ...typography.caption,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
