import React, { useState, useRef } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View, Text, ActivityIndicator, Image, TouchableOpacity, Dimensions, Animated, Modal, ScrollView, Linking } from 'react-native';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { MeetingProvider } from './src/context/MeetingContext';
import { Menu, HelpCircle, Home, Clock, Settings as SettingsIcon, LogOut, X } from 'lucide-react-native';

// Import Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import MeetingRoomScreen from './src/screens/MeetingRoomScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PushApproveScreen from './src/screens/PushApproveScreen';
import notifee, { EventType } from '@notifee/react-native';

const hiLogo = require('./assets/Hi_Logo.png');
const poweredByLogo = require('./assets/powered_by_aiRender.png');

function FullPageLoader({ text = "Loading…" }) {
  return (
    <View style={styles.loaderContainer}>
      <Image source={hiLogo} style={styles.loaderLogo} resizeMode="contain" />
      <ActivityIndicator size="large" color="#6C63FF" style={{ marginVertical: 20 }} />
      <Text style={styles.loaderText}>{text}</Text>
    </View>
  );
}

function MainApp() {
  const { colors, theme, changeTheme } = useTheme();
  const { user, loading, logout } = useAuth();
  
  // Custom State Navigation Router
  const [currentScreen, setCurrentScreen] = useState('Login');
  const [screenParams, setScreenParams] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingMeetingRoom, setPendingMeetingRoom] = useState(null);

  const navigate = (screenName, params = {}) => {
    setCurrentScreen(screenName);
    setScreenParams(params);
    setDrawerOpen(false);
    setShowHelp(false);
  };

  // Redirect to PushApprove when user taps on push notifications
  React.useEffect(() => {
    let unsubscribe;
    try {
      if (notifee && typeof notifee.onForegroundEvent === 'function') {
        unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
          if (type === EventType.PRESS && detail.notification?.data) {
            const { requestId, token } = detail.notification.data;
            if (requestId && token) {
              navigate('PushApprove', { requestId, token });
            }
          }
        });
      }
    } catch (err) {
      console.log('Notifee foreground event subscription skipped:', err.message);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Handle Deep Linking / Universal Links (Google Meet link behavior)
  React.useEffect(() => {
    const handleDeepLink = (event) => {
      if (event.url) {
        parseAndNavigateUrl(event.url);
      }
    };

    const parseAndNavigateUrl = (url) => {
      try {
        const route = url.replace(/.*?:\/\//g, '');
        const parts = route.split('/');
        const meetingIndex = parts.indexOf('meeting');
        if (meetingIndex !== -1 && parts[meetingIndex + 1]) {
          const room = parts[meetingIndex + 1];
          if (room) {
            if (user) {
              navigate('MeetingRoom', { roomName: room });
            } else {
              setPendingMeetingRoom(room);
            }
          }
        }
      } catch (err) {
        console.log('Error parsing deep link:', err);
      }
    };

    // Check if app was opened from a link
    Linking.getInitialURL()
      .then((url) => {
        if (url) parseAndNavigateUrl(url);
      })
      .catch((err) => console.log('Linking.getInitialURL error:', err));

    // Listen for incoming links while running
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  }, [user]);

  // Automatically route user based on Auth state changes
  React.useEffect(() => {
    if (!loading) {
      if (user) {
        if (pendingMeetingRoom) {
          navigate('MeetingRoom', { roomName: pendingMeetingRoom });
          setPendingMeetingRoom(null);
        } else if (currentScreen === 'Login') {
          setCurrentScreen('Dashboard');
        }
      } else {
        setCurrentScreen('Login');
      }
    }
  }, [user, loading, pendingMeetingRoom]);

  if (loading) {
    return <FullPageLoader text="Loading…" />;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Login':
        return <LoginScreen navigate={navigate} params={screenParams} />;
      case 'Dashboard':
        return <DashboardScreen navigate={navigate} params={screenParams} />;
      case 'MeetingRoom':
        return <MeetingRoomScreen navigate={navigate} params={screenParams} />;
      case 'History':
        return <HistoryScreen navigate={navigate} params={screenParams} />;
      case 'Settings':
        return <SettingsScreen navigate={navigate} params={screenParams} />;
      case 'PushApprove':
        return <PushApproveScreen navigate={navigate} params={screenParams} />;
      default:
        return <LoginScreen navigate={navigate} params={screenParams} />;
    }
  };

  const isDrawerScreen = ['Dashboard', 'History', 'Settings'].includes(currentScreen);
  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  // Toggle sun: light ↔ dark
  const toggleSunTheme = () => {
    changeTheme(theme === 'light' ? 'dark' : 'light');
  };

  // Toggle cloud: grey ↔ previous (dark)
  const toggleCloudTheme = () => {
    changeTheme(theme === 'grey' ? 'dark' : 'grey');
  };

  // Dynamic header background based on theme
  const headerBg = theme === 'light' ? '#ffffff' : theme === 'grey' ? '#18181b' : '#0d0c15';
  const headerBorder = theme === 'light' ? '#dadce0' : theme === 'grey' ? '#3f3f46' : '#232235';
  const textColor = theme === 'light' ? '#202124' : '#fff';

  // Sun emoji changes based on theme
  const sunEmoji = theme === 'light' ? '☀️' : '🌙';
  const cloudEmoji = '☁️';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: headerBg }]}>
      <StatusBar
        barStyle={theme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={headerBg}
      />
      
      {/* Global Header Bar */}
      {isDrawerScreen && (
        <View style={[styles.globalHeader, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setDrawerOpen(true)}>
            <Menu size={22} color={theme === 'light' ? '#5f6368' : '#fff'} />
          </TouchableOpacity>
          
          <View style={styles.headerCenterIcons}>
            {/* Sun/Moon icon — emoji to match web exactly */}
            <TouchableOpacity
              style={[
                styles.headerIconBtn,
                theme === 'light' && { backgroundColor: 'rgba(255,170,0,0.12)', borderRadius: 20 }
              ]}
              onPress={toggleSunTheme}
            >
              <Text style={styles.headerEmoji}>{sunEmoji}</Text>
            </TouchableOpacity>

            {/* Cloud icon — emoji to match web exactly */}
            <TouchableOpacity
              style={[
                styles.headerIconBtn,
                theme === 'grey' && { backgroundColor: 'rgba(56,189,248,0.15)', borderRadius: 20 }
              ]}
              onPress={toggleCloudTheme}
            >
              <Text style={styles.headerEmoji}>{cloudEmoji}</Text>
            </TouchableOpacity>

            {/* Help button */}
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowHelp(v => !v)}>
              <HelpCircle size={20} color={showHelp ? colors.primary : (theme === 'light' ? '#5f6368' : '#8e8d9a')} />
            </TouchableOpacity>
          </View>

          {/* Avatar — show user photo if available */}
          <TouchableOpacity style={styles.headerRight} onPress={() => navigate('Settings')}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.headerAvatarImg} />
            ) : (
              <View style={styles.headerAvatar}>
                <Text style={styles.headerAvatarText}>{userInitials}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Help Tooltip — dropdown */}
      {isDrawerScreen && showHelp && (
        <TouchableOpacity
          activeOpacity={1}
          style={styles.helpOverlay}
          onPress={() => setShowHelp(false)}
        >
          <View style={[styles.helpTooltip, { backgroundColor: theme === 'light' ? '#fff' : '#1e1e2e', borderColor: theme === 'light' ? '#dadce0' : '#2d2d4a' }]}>
            <Text style={[styles.helpTitle, { color: colors.primary }]}>Need Help?</Text>
            <Text style={[styles.helpBody, { color: theme === 'light' ? '#5f6368' : '#9aa0a6' }]}>
              Welcome to <Text style={{ fontWeight: '700', color: theme === 'light' ? '#202124' : '#e8eaed' }}>hi</Text>! You can start or schedule a new meeting from your Dashboard, or manage your profile and preferences in Settings.
            </Text>
            <Text style={[styles.helpBody, { color: theme === 'light' ? '#5f6368' : '#9aa0a6', marginTop: 8 }]}>
              For technical support, please contact our team at{' '}
              <Text style={{ fontStyle: 'italic' }}>support@airender.com</Text>.
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Drawer Overlay Menu */}
      {isDrawerScreen && drawerOpen && (
        <View style={styles.drawerOverlay}>
          {/* Backdrop */}
          <TouchableOpacity style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)} />
          
          {/* Drawer Content */}
          <View style={[styles.drawerCard, { backgroundColor: headerBg, borderRightColor: headerBorder }]}>
            <View style={styles.drawerHeader}>
              <Image source={hiLogo} style={styles.drawerLogoHi} resizeMode="contain" />
              <TouchableOpacity onPress={() => setDrawerOpen(false)}>
                <X size={20} color={theme === 'light' ? '#5f6368' : '#fff'} />
              </TouchableOpacity>
            </View>

            <View style={styles.drawerNavList}>
              <TouchableOpacity
                style={[styles.drawerItem, currentScreen === 'Dashboard' && styles.drawerItemActive]}
                onPress={() => navigate('Dashboard')}
              >
                <Home size={20} color={currentScreen === 'Dashboard' ? colors.primary : (theme === 'light' ? '#5f6368' : '#8e8d9a')} />
                <Text style={[styles.drawerItemText, { color: currentScreen === 'Dashboard' ? colors.primary : (theme === 'light' ? '#5f6368' : '#8e8d9a') }, currentScreen === 'Dashboard' && styles.drawerItemTextActive]}>Home</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.drawerItem, currentScreen === 'History' && styles.drawerItemActive]}
                onPress={() => navigate('History')}
              >
                <Clock size={20} color={currentScreen === 'History' ? colors.primary : (theme === 'light' ? '#5f6368' : '#8e8d9a')} />
                <Text style={[styles.drawerItemText, { color: currentScreen === 'History' ? colors.primary : (theme === 'light' ? '#5f6368' : '#8e8d9a') }, currentScreen === 'History' && styles.drawerItemTextActive]}>Meeting History</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.drawerItem, currentScreen === 'Settings' && styles.drawerItemActive]}
                onPress={() => navigate('Settings')}
              >
                <SettingsIcon size={20} color={currentScreen === 'Settings' ? colors.primary : (theme === 'light' ? '#5f6368' : '#8e8d9a')} />
                <Text style={[styles.drawerItemText, { color: currentScreen === 'Settings' ? colors.primary : (theme === 'light' ? '#5f6368' : '#8e8d9a') }, currentScreen === 'Settings' && styles.drawerItemTextActive]}>Settings & Preferences</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.drawerFooter, { borderTopColor: headerBorder }]}>
              <Image source={poweredByLogo} style={styles.drawerLogoPowered} resizeMode="contain" />
              <TouchableOpacity
                style={styles.drawerSignoutRow}
                onPress={async () => {
                  setDrawerOpen(false);
                  await logout();
                  navigate('Login');
                }}
              >
                <LogOut size={18} color="#ea4335" />
                <Text style={styles.drawerSignoutText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={[styles.content, { backgroundColor: colors.bg }]}>
        {renderScreen()}
      </View>
    </SafeAreaView>
  );
}

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null, showDetails: false };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0d0c15', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {/* Logo Brand Header */}
          <Image source={hiLogo} style={{ height: 40, width: 110, marginBottom: 40 }} resizeMode="contain" />
          
          {/* User Friendly Icon and Title */}
          <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
            Oops! Something went wrong
          </Text>
          <Text style={{ color: '#a0aec0', fontSize: 14, textAlign: 'center', marginBottom: 30, paddingHorizontal: 10, lineHeight: 22 }}>
            An unexpected error occurred in the application. Please try reloading or restarting the app.
          </Text>

          {/* Action Button */}
          <TouchableOpacity 
            style={{ backgroundColor: '#6C63FF', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, width: '100%', maxWidth: 240, alignItems: 'center', shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}
            onPress={() => this.setState({ hasError: false, error: null, showDetails: false })}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Reload Application</Text>
          </TouchableOpacity>

          {/* Hidden Technical Details for Developers */}
          <TouchableOpacity 
            style={{ marginTop: 40, padding: 8 }} 
            onPress={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
          >
            <Text style={{ color: '#718096', fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' }}>
              {this.state.showDetails ? 'Hide technical details' : 'Show technical details'}
            </Text>
          </TouchableOpacity>

          {this.state.showDetails && (
            <View style={{ marginTop: 12, backgroundColor: '#171622', borderWidth: 1, borderColor: '#272635', borderRadius: 12, padding: 12, width: '100%', maxHeight: 150 }}>
              <ScrollView>
                <Text style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: 11, lineHeight: 16 }}>
                  {this.state.error ? this.state.error.toString() : 'No stack trace available.'}
                </Text>
              </ScrollView>
            </View>
          )}
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MeetingProvider>
          <ErrorBoundary>
            <MainApp />
          </ErrorBoundary>
        </MeetingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: '#0d0c15',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loaderLogo: {
    height: 48,
    width: 140,
  },
  loaderText: {
    fontSize: 14,
    color: '#8e8d9a',
    fontWeight: '500',
  },
  globalHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerEmoji: {
    fontSize: 20,
  },
  headerCenterIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerRight: {},
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#8f55ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarImg: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  // Help tooltip
  helpOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 900,
  },
  helpTooltip: {
    position: 'absolute',
    top: 8,
    right: 16,
    width: 260,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 910,
  },
  helpTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  helpBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  // Drawer
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  drawerCard: {
    width: 280,
    height: '100%',
    borderRightWidth: 1,
    padding: 20,
    paddingTop: 50,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  drawerLogoHi: {
    height: 32,
    width: 80,
  },
  drawerNavList: {
    flex: 1,
    gap: 4,
  },
  drawerItem: {
    flexDirection: 'row',
    height: 50,
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  drawerItemActive: {
    backgroundColor: 'rgba(108,99,255,0.12)',
  },
  drawerItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  drawerItemTextActive: {
    fontWeight: '600',
  },
  drawerFooter: {
    paddingBottom: 24,
    gap: 20,
    borderTopWidth: 1,
    paddingTop: 20,
  },
  drawerLogoPowered: {
    height: 36,
    width: 140,
    alignSelf: 'center',
  },
  drawerSignoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  drawerSignoutText: {
    color: '#ea4335',
    fontSize: 14,
    fontWeight: '600',
  },
});
