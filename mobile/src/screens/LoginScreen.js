import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Image, ActivityIndicator, Alert, ScrollView, TouchableOpacity, Dimensions, TextInput } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { KeyRound } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const GOOGLE_CLIENT_ID = '778684435806-paa3crjb147a24meuj19em8jir66b2tf.apps.googleusercontent.com';

const GoogleLogo = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </Svg>
);

// Asset imports
const sliderimg1 = require('../../assets/sliderimg1.jpg');
const sliderimg2 = require('../../assets/sliderimg2.jpg');
const sliderimg3 = require('../../assets/sliderimg3.jpg');
const hiLogo = require('../../assets/Hi_Logo.png');
const poweredByLogo = require('../../assets/powered_by_aiRender.png');

const CAROUSEL_IMAGES = [sliderimg1, sliderimg2, sliderimg3];

function ImageCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.carouselContainer}>
      <View style={styles.carouselImageWrapper}>
        <Image
          source={CAROUSEL_IMAGES[currentIndex]}
          style={styles.carouselImage}
          resizeMode="cover"
        />
      </View>

      {/* Pill-shaped Indicators underneath (matches Screenshot 1) */}
      <View style={styles.indicatorsWrap}>
        {CAROUSEL_IMAGES.map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.indicatorDot,
              {
                width: idx === currentIndex ? 28 : 10,
                backgroundColor: idx === currentIndex ? '#6C63FF' : '#555566',
                opacity: idx === currentIndex ? 1 : 0.4,
              }
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export default function LoginScreen({ navigate }) {
  const { colors } = useTheme();
  const { devEmailLogin, loginWithGoogle, loginWithPasskey, registerPasskey } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      GoogleSignin.configure({
        webClientId: GOOGLE_CLIENT_ID,
        offlineAccess: true,
      });
    } catch (e) {
      console.log('GoogleSignin init warning:', e.message);
    }
  }, [GOOGLE_CLIENT_ID]);

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();

      const idToken = tokens.idToken || response.idToken;
      if (!idToken) throw new Error('Failed to get Google ID token');

      const loggedUser = await loginWithGoogle(idToken);

      // Prompt for passkey creation if they don't have one
      if (!loggedUser.authMethods?.passkey) {
        Alert.alert(
          'Create a Passkey?',
          'Set up a passkey to sign in faster next time using your fingerprint, face recognition, or device PIN.',
          [
            { text: 'Skip for now', style: 'cancel', onPress: () => navigate('Dashboard') },
            {
              text: 'Yes, create passkey',
              style: 'default',
              onPress: async () => {
                try {
                  setLoading(true);
                  await registerPasskey(loggedUser.email, loggedUser.name);
                  Alert.alert('Success', 'Passkey created successfully!');
                } catch (err) {
                  Alert.alert('Error', err.message || 'Failed to create passkey');
                } finally {
                  setLoading(false);
                  navigate('Dashboard');
                }
              }
            },
          ]
        );
      } else {
        navigate('Dashboard');
      }
    } catch (err) {
      console.log('Google Sign-in error:', err);
      setError(err?.response?.data?.error || err?.message || 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setError('');
    setPasskeyLoading(true);
    try {
      await loginWithPasskey();
      navigate('Dashboard');
    } catch (err) {
      console.log('Passkey login error:', err);
      setError(err.message || 'Passkey login failed.');
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleSingleClickAlert = () => {
    Alert.alert(
      'Single Click Login',
      'Single Click (Push) login allows you to approve desktop web sign-ins directly from this device. Please log in first using Google or Passkey, then register this device in Settings.',
      [{ text: 'Got it' }]
    );
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: '#0d0c15' }]}>
      
      {/* Top Header Branding Row - enlarged for clear visibility (matches Screenshot 1) */}
      <View style={styles.topBrandingRow}>
        <Image source={hiLogo} style={styles.topLogoHi} resizeMode="contain" />
        <Image source={poweredByLogo} style={styles.topLogoPowered} resizeMode="contain" />
      </View>

      {/* Image Carousel (Autoplay pills, no manual arrow buttons) */}
      <ImageCarousel />

      {/* Main Login Card */}
      <View style={[styles.card, { backgroundColor: '#161524', borderColor: '#232235' }]}>
        <View style={styles.logoRow}>
          <Text style={[styles.cardTitle, { color: '#fff' }]}>Sign In</Text>
          <Text style={[styles.cardSubtitle, { color: '#8e8d9a' }]}>Welcome back to</Text>
          <Image source={hiLogo} style={styles.brandLogo} resizeMode="contain" />
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: 'rgba(234,67,53,0.15)', borderColor: '#ea4335' }]}>
            <Text style={[styles.errorText, { color: '#ea4335' }]}>{error}</Text>
          </View>
        ) : null}

        {/* Official Google Sign In Button */}
        {googleLoading ? (
          <ActivityIndicator style={{ marginVertical: 12 }} size="small" color="#6C63FF" />
        ) : (
          <TouchableOpacity 
            style={styles.googleBtn}
            onPress={handleGoogleSignIn}
          >
            <View style={styles.googleBtnContent}>
              <GoogleLogo />
              <Text style={styles.googleBtnText}>Sign in with Google</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Passkey Sign In Button */}
        {passkeyLoading ? (
          <ActivityIndicator style={{ marginVertical: 12 }} size="small" color="#6C63FF" />
        ) : (
          <TouchableOpacity 
            style={[styles.btn, { backgroundColor: '#252538', borderColor: '#383850', borderWidth: 1 }]}
            onPress={handlePasskeySignIn}
          >
            <KeyRound size={16} color="#6C63FF" />
            <Text style={[styles.btnText, { color: '#fff' }]}>Sign in with Passkey</Text>
          </TouchableOpacity>
        )}

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Single Click Login Button */}
        <TouchableOpacity 
          style={[styles.btn, { backgroundColor: '#6C63FF' }]}
          onPress={handleSingleClickAlert}
        >
          <Text style={[styles.btnText, { color: '#fff' }]}>Login with Single Click</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    paddingTop: 48,
    paddingBottom: 48,
  },
  topBrandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 440,
    gap: 12,
    marginBottom: 28,
  },
  topLogoHi: {
    height: 40,
    width: 80,
  },
  topLogoPowered: {
    height: 40,
    width: 180,
  },
  carouselContainer: {
    width: '100%',
    maxWidth: 440,
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#232235',
    backgroundColor: '#161524',
    position: 'relative',
    marginBottom: 24,
  },
  carouselImageWrapper: {
    width: '100%',
    height: '100%',
    padding: 16,
    paddingBottom: 32,
  },
  carouselImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  indicatorsWrap: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  indicatorDot: {
    height: 5,
    borderRadius: 3,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Georgia',
    textAlign: 'center',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 6,
  },
  brandLogo: {
    height: 28,
    width: 100,
    marginTop: 4,
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  googleBtn: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  btn: {
    flexDirection: 'row',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
    width: '100%',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#232235',
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555566',
    marginHorizontal: 12,
  },
  subtitleContainer: {
    marginTop: 8,
    paddingHorizontal: 10,
    width: '100%',
    alignItems: 'center',
  },
  singleClickSubtitle: {
    fontSize: 11,
    color: '#8e8d9a',
    textAlign: 'center',
    lineHeight: 1.6,
  },
});
