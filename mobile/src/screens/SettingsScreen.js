import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, Switch, Alert, ActivityIndicator, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useMeetings } from '../context/MeetingContext';
import { useTheme } from '../context/ThemeContext';

const poweredByLogo = require('../../assets/powered_by_aiRender.png');

export default function SettingsScreen({ navigate }) {
  const { colors, theme, changeTheme, themes } = useTheme();
  const { logout, enablePushAuth, disablePushAuth, user, updateBackendHost, apiUrl } = useAuth();
  const { userPreferences, updatePreferences, userProfile, updateProfile } = useMeetings();

  const [dispName, setDispName] = useState(userProfile?.displayName || '');
  
  // Developer/Test Settings (Hidden 5-tap Mode)
  const [devTapCount, setDevTapCount] = useState(0);
  const [showDevInput, setShowDevInput] = useState(false);
  const [tempUrl, setTempUrl] = useState(apiUrl || '');

  // Preference States
  const [micDefault, setMicDefault] = useState(userPreferences?.micDefault || false);
  const [speakerDefault, setSpeakerDefault] = useState(userPreferences?.speakerDefault || false);
  const [cameraDefault, setCameraDefault] = useState(userPreferences?.cameraDefault || false);
  const [soundEffects, setSoundEffects] = useState(userPreferences?.soundEffects || false);
  const [meetingReminders, setMeetingReminders] = useState(userPreferences?.notifications || true);
  const [pushEnabled, setPushEnabled] = useState(user?.authMethods?.push || false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedProfileText, setSavedProfileText] = useState('Save Profile');
  const [savedPrefsText, setSavedPrefsText] = useState('Save Preferences');

  useEffect(() => { setDispName(userProfile?.displayName || ''); }, [userProfile]);
  useEffect(() => {
    setMicDefault(userPreferences?.micDefault || false);
    setSpeakerDefault(userPreferences?.speakerDefault || false);
    setCameraDefault(userPreferences?.cameraDefault || false);
    setSoundEffects(userPreferences?.soundEffects || false);
    setMeetingReminders(userPreferences?.notifications ?? true);
  }, [userPreferences]);
  useEffect(() => { setPushEnabled(user?.authMethods?.push || false); }, [user]);

  const handleSaveProfile = async () => {
    if (!dispName.trim()) { Alert.alert('Error', 'Display name cannot be empty.'); return; }
    setSavingProfile(true);
    try {
      await updateProfile({ displayName: dispName });
      setSavedProfileText('✓ Saved Profile');
      setTimeout(() => setSavedProfileText('Save Profile'), 2000);
    } catch (err) {
      Alert.alert('Error', 'Failed to update profile: ' + err.message);
    } finally { setSavingProfile(false); }
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      await updatePreferences({
        micDefault, speakerDefault, cameraDefault,
        soundEffects, notifications: meetingReminders,
      });
      setSavedPrefsText('✓ Preferences Saved!');
      setTimeout(() => setSavedPrefsText('Save Preferences'), 2000);
    } catch (err) {
      Alert.alert('Error', 'Failed to update preferences: ' + err.message);
    } finally { setSavingPrefs(false); }
  };

  const handleChangeAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow access to your photo library to change your avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        if (selectedAsset.base64) {
          const mimeType = selectedAsset.mimeType || 'image/jpeg';
          const base64Data = `data:${mimeType};base64,${selectedAsset.base64}`;

          setSavingProfile(true);
          await updateProfile({ displayName: dispName, avatar: base64Data });
          Alert.alert('Success', 'Avatar updated successfully!');
        } else {
          Alert.alert('Error', 'Failed to retrieve image base64 data.');
        }
      }
    } catch (err) {
      console.error('Error changing avatar:', err);
      Alert.alert('Error', 'Failed to change avatar: ' + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ displayName: dispName, avatar: '' });
      Alert.alert('Success', 'Profile photo removed successfully.');
    } catch (err) {
      console.error('Error removing avatar:', err);
      Alert.alert('Error', 'Failed to remove photo: ' + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarOptions = () => {
    const options = [
      { text: 'Choose from Library', onPress: handleChangeAvatar },
    ];
    if (userProfile?.avatar) {
      options.push({ 
        text: 'Remove Photo', 
        style: 'destructive', 
        onPress: handleRemoveAvatar 
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(
      'Profile Photo',
      'Choose an option to update your profile photo:',
      options
    );
  };

  const handleTogglePushAuth = async (wantsPush) => {
    setPushEnabled(wantsPush);
    try {
      if (wantsPush) { await enablePushAuth(); }
      else { await disablePushAuth(); }
    } catch (err) {
      setPushEnabled(!wantsPush);
      Alert.alert('Error', 'Failed to adjust push auth: ' + err.message);
    }
  };


  const handleLogoTap = () => {
    setDevTapCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setShowDevInput(true);
        setTempUrl(apiUrl);
        return 0;
      }
      return next;
    });
  };

  const c = colors;

  const Section = ({ title, children }) => (
    <View style={{ marginBottom: 8 }}>
      <Text style={[styles.sectionTitle, { color: c.text, borderBottomColor: c.border }]}>{title}</Text>
      {children}
    </View>
  );

  const SwitchRow = ({ title, subtitle, value, onValueChange }) => (
    <View style={[styles.switchRow, { borderBottomColor: c.border }]}>
      <View style={styles.switchMeta}>
        <Text style={[styles.switchTitle, { color: c.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.switchSubtitle, { color: c.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? c.primary : '#ccc'}
        trackColor={{ false: c.bgHover, true: c.primary + '66' }}
        ios_backgroundColor={c.bgHover}
      />
    </View>
  );

  return (
    <View style={[styles.mainContainer, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        {/* ─── Page Heading ─── */}
        <Text style={[styles.pageTitle, { color: c.text }]}>Settings & Preferences</Text>
        <Text style={[styles.pageSubtitle, { color: c.textSecondary }]}>Manage your profile and preferences</Text>

        {/* ─── Profile ─── */}
        <Section title="Profile">
          {/* Avatar */}
          <View style={styles.avatarRow}>
            <View style={[styles.avatarCircle, { backgroundColor: c.primary }]}>
              {userProfile?.avatar ? (
                <Image source={{ uri: userProfile.avatar }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{userProfile?.initials || 'U'}</Text>
              )}
            </View>
            <View>
              <TouchableOpacity 
                style={[styles.changeAvatarBtn, { backgroundColor: c.bgHover, borderColor: c.border }]}
                onPress={handleAvatarOptions}
              >
                <Text style={[styles.changeAvatarText, { color: c.text }]}>Change Avatar</Text>
              </TouchableOpacity>
              <Text style={[styles.avatarHint, { color: c.textMuted }]}>JPG, GIF or PNG. Max size 2MB.</Text>
            </View>
          </View>

          {/* Display Name */}
          <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>Display Name</Text>
          <TextInput
            style={[styles.fieldInput, { color: c.text, borderColor: c.border, backgroundColor: c.bg }]}
            value={dispName}
            onChangeText={setDispName}
          />

          {/* Email — disabled */}
          <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>Email</Text>
          <TextInput
            style={[styles.fieldInput, { color: c.textSecondary, borderColor: c.border, backgroundColor: c.bg, opacity: 0.7 }]}
            value={userProfile?.email || user?.email || ''}
            editable={false}
          />
          <Text style={[styles.fieldHint, { color: c.textMuted }]}>Email is linked to your authentication and cannot be changed</Text>

          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: c.primary }]}
            onPress={handleSaveProfile}
          >
            {savingProfile
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.btnPrimaryText}>{savedProfileText}</Text>
            }
          </TouchableOpacity>
        </Section>

        {/* ─── Appearance ─── */}
        <Section title="Appearance">
          <Text style={[styles.fieldHint, { color: c.textSecondary, marginBottom: 14 }]}>
            Switch between light, dark, and grey themes
          </Text>
          <View style={styles.themeRow}>
            {['light', 'dark', 'grey'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.themeCard,
                  {
                    backgroundColor: themes[t].bg,
                    borderColor: theme === t ? c.primary : c.border,
                    borderWidth: theme === t ? 2 : 1,
                  }
                ]}
                onPress={() => changeTheme(t)}
              >
                <View style={[styles.themePreviewDot, { backgroundColor: themes[t].primary }]} />
                <Text style={[styles.themeCardText, { color: themes[t].text, textTransform: 'capitalize' }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* ─── Notifications ─── */}
        <Section title="Notifications">
          <SwitchRow
            title="Meeting Reminders"
            subtitle="Get notified before scheduled meetings"
            value={meetingReminders}
            onValueChange={setMeetingReminders}
          />
          <SwitchRow
            title="Sound Effects"
            subtitle="Play sounds for join/leave and notifications"
            value={soundEffects}
            onValueChange={setSoundEffects}
          />
          <SwitchRow
            title="Single Click Login"
            subtitle="Register this device as a verified login helper"
            value={pushEnabled}
            onValueChange={handleTogglePushAuth}
          />
        </Section>

        {/* ─── Audio & Video ─── */}
        <Section title="Audio & Video">
          <SwitchRow
            title="Microphone"
            subtitle="Enable microphone by default when joining"
            value={micDefault}
            onValueChange={setMicDefault}
          />
          <SwitchRow
            title="Speaker"
            subtitle="Enable speaker by default"
            value={speakerDefault}
            onValueChange={setSpeakerDefault}
          />
          <SwitchRow
            title="Camera"
            subtitle="Enable camera by default when joining"
            value={cameraDefault}
            onValueChange={setCameraDefault}
          />
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: c.primary, marginTop: 16 }]}
            onPress={handleSavePreferences}
          >
            {savingPrefs
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.btnPrimaryText}>{savedPrefsText}</Text>
            }
          </TouchableOpacity>
        </Section>



      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  scrollContainer: { padding: 20, paddingBottom: 50, gap: 16 },

  pageTitle: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { fontSize: 14, lineHeight: 20, marginBottom: 8 },

  section: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 18, fontWeight: '700', letterSpacing: 0.3,
    marginBottom: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },

  // Avatar
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  avatarCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '600' },
  changeAvatarBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 4 },
  changeAvatarText: { fontSize: 13, fontWeight: '600' },
  avatarHint: { fontSize: 11 },

  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  fieldInput: { borderWidth: 1, borderRadius: 12, height: 46, paddingHorizontal: 14, fontSize: 14, marginBottom: 14 },
  fieldHint: { fontSize: 11, lineHeight: 16, marginBottom: 14 },

  btnPrimary: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Theme selector
  themeRow: { flexDirection: 'row', gap: 10 },
  themeCard: { flex: 1, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 4 },
  themePreviewDot: { width: 10, height: 10, borderRadius: 5 },
  themeCardText: { fontSize: 12, fontWeight: '600' },

  // Switch rows
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  switchMeta: { flex: 1, paddingRight: 14 },
  switchTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  switchSubtitle: { fontSize: 12, lineHeight: 18 },

  // Sign out
  signOutBtn: { height: 50, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  signOutText: { fontSize: 15, fontWeight: '700' },

  footerBranding: { alignItems: 'center', paddingVertical: 16 },
  footerLogo: { height: 36, width: 140 },
});
