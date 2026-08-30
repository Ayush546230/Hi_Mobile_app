import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, Dimensions, TextInput, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useMeetings } from '../context/MeetingContext';
import { useTheme } from '../context/ThemeContext';
import { Mic, MicOff, Video as VideoIcon, VideoOff, LogOut, ShieldAlert, Clock, Plus, Users, UserCheck, Check, X, ArrowRight } from 'lucide-react-native';

const JAAS_APP_ID = 'vpaas-magic-cookie-e3bf79ea2b56454ea371d31b07ac1806';

// Safe ID comparison: handles both user.id and user._id, and ObjectId vs string
const getUserId = (user) => user?.id?.toString() || user?._id?.toString();
const isSameId = (a, b) => !!a && !!b && a.toString() === b.toString();
const hiLogo = require('../../assets/Hi_Logo.png');
const poweredByLogo = require('../../assets/powered_by_aiRender.png');

export default function MeetingRoomScreen({ navigate, params }) {
  const { roomName, isHost: initialIsHost } = params || {};
  const { colors } = useTheme();
  const { user, API, socket } = useAuth();
  const { userPreferences, refreshMeetings } = useMeetings();

  const [roomData, setRoomData] = useState(null);
  const [jwtToken, setJwtToken] = useState(null);
  const [joined, setJoined] = useState(false);
  const [knocking, setKnocking] = useState(false);
  const [admitted, setAdmitted] = useState(false);
  const [knockingGuests, setKnockingGuests] = useState([]);
  
  const [audioMuted, setAudioMuted] = useState(userPreferences?.micDefault ?? true);
  const [videoMuted, setVideoMuted] = useState(userPreferences?.cameraDefault ?? false);
  const [displayName, setDisplayName] = useState(user?.name || 'Guest');
  const [loading, setLoading] = useState(true);

  // Timers
  const [timeLeft, setTimeLeft] = useState(30);
  const [consultationTime, setConsultationTime] = useState(null);
  const [warningPopup, setWarningPopup] = useState(null);
  const [showExtendMenu, setShowExtendMenu] = useState(false);
  const [extValue, setExtValue] = useState(15);
  const [ended, setEnded] = useState(false);
  const [hasLeft, setHasLeft] = useState(false);

  const [showLeaveOptionsModal, setShowLeaveOptionsModal] = useState(false);
  const [jitsiKey, setJitsiKey] = useState(0);
  const [jaasAppId, setJaasAppId] = useState(JAAS_APP_ID);

  const socketRef = useRef(socket);
  const joinTimeRef = useRef(Date.now());

  // Bootstrap Room Data & Sockets
  useEffect(() => {
    if (!roomName) {
      navigate('Dashboard');
      return;
    }

    const fetchRoomData = async () => {
      try {
        const res = await API.get(`/meetings/room/${roomName}`);
        const m = res.data.meeting;
        setRoomData(m);

        // Fetch JaaS token (with retry for cold-start / transient errors)
        let tokenFetched = false;
        let lastTokenErr = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            // Manually read auth token from AsyncStorage and attach header
            // (bypasses async interceptor which can silently drop headers on mobile)
            const authToken = await AsyncStorage.getItem('auth_token');
            const tokRes = await API.get(`/meetings/room/${roomName}/token`, {
              headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
            });
            if (tokRes.data.token) {
              setJwtToken(tokRes.data.token);
              if (tokRes.data.appId) {
                setJaasAppId(tokRes.data.appId);
              }
              tokenFetched = true;
              console.log(`[DEBUG] JaaS token fetched successfully on attempt ${attempt}`);
              break;
            } else {
              console.log(`[DEBUG] Token response missing 'token' field on attempt ${attempt}:`, JSON.stringify(tokRes.data));
            }
          } catch (tokErr) {
            const status = tokErr?.response?.status;
            const errBody = tokErr?.response?.data;
            lastTokenErr = { status, errBody, message: tokErr.message };
            console.log(`[DEBUG] JaaS token fetch attempt ${attempt} failed:`, {
              status,
              errBody: JSON.stringify(errBody),
              message: tokErr.message,
            });
            // If 401, auth token may have expired – no point retrying
            if (status === 401) break;
            // Wait before retry (covers Render cold-start)
            if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 3000));
          }
        }
        if (!tokenFetched) {
          const errInfo = lastTokenErr
            ? `HTTP ${lastTokenErr.status || 'ERR'}: ${lastTokenErr.message}`
            : 'No response';
          console.warn('[DEBUG] All JaaS token fetch attempts failed – falling back to public Jitsi');
          Alert.alert(
            'Debug: Token Failed',
            `Could not fetch JaaS token.\nError: ${errInfo}\n\nMeeting will load on public Jitsi (moderator login may appear).`,
          );
          setJwtToken('');
        }

        // Check permission immediately
        // user.id may be ObjectId or string; use toString() for safe comparison
        const userId = user?.id?.toString() || user?._id?.toString();
        const isHost = m.userId?.toString() === userId;
        const isInvitee = m.participants?.some(p => p.email === user?.email);
        const isInstantMeeting = m.type === 'instant';

        let requiresPermission = false;
        if (!isHost) {
          if (isInstantMeeting) {
            requiresPermission = false;
          } else if (m.isPrivate) {
            requiresPermission = true; // Everyone must knock
          } else {
            requiresPermission = !isInvitee; // Invitees join directly, guests knock
          }
        }

        if (requiresPermission && !admitted) {
          setKnocking(true);
          if (socket) {
            socket.emit('guest-knocking', {
              roomName,
              user: { name: user?.preferences?.displayName || user?.name || 'Guest', email: user?.email, isInvitee }
            });
          }
        } else {
          setJoined(true);
        }
      } catch (err) {
        Alert.alert('Error', 'Meeting not found');
        navigate('Dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchRoomData();

    // Socket listeners
    if (socket) {
      socket.emit('join-room', roomName);
      
      socket.on('meeting-ended', () => {
        setEnded(true);
        setTimeLeft(30);
      });

      socket.on('consultation-extended', (newEndTime) => {
        setRoomData(prev => prev ? { ...prev, endTime: newEndTime } : null);
        setWarningPopup(null);
      });

      socket.on('host-joined', async () => {
        try {
          const res = await API.get(`/meetings/room/${roomName}`);
          setRoomData(res.data.meeting);
        } catch (err) {
          console.log('Failed to refresh room data on host join:', err.message);
        }
      });

      socket.on('guest-knocking', (guest) => {
        setKnockingGuests(prev => {
          if (prev.some(g => g.socketId === guest.socketId)) return prev;
          return [...prev, guest];
        });
      });

      socket.on('guest-admitted', () => {
        setAdmitted(true);
        setKnocking(false);
        setJoined(true);
      });

      socket.on('guest-denied', () => {
        Alert.alert('Denied', 'Host denied your entry request.');
        navigate('Dashboard');
      });
    }

    return () => {
      if (socket) {
        socket.off('meeting-ended');
        socket.off('consultation-extended');
        socket.off('host-joined');
        socket.off('guest-knocking');
        socket.off('guest-admitted');
        socket.off('guest-denied');
      }
    };
  }, [roomName, socket, user, API, admitted]);

  // Countdown timer for Consultation
  useEffect(() => {
    if (!roomData?.isConsultation || !roomData?.endTime || ended || !joined) return;

    const interval = setInterval(() => {
      const remainingMs = new Date(roomData.endTime).getTime() - Date.now();
      const remainingSecs = Math.max(0, Math.floor(remainingMs / 1000));
      setConsultationTime(remainingSecs);

      if (remainingSecs <= 0) {
        clearInterval(interval);
        handleEndMeeting();
      }

      // Host Warnings
      if (isSameId(getUserId(user), roomData.userId)) {
        if (remainingSecs === 600) setWarningPopup(600); // 10 min
        else if (remainingSecs === 300) setWarningPopup(300); // 5 min
        else if (remainingSecs === 120) setWarningPopup(120); // 2 min
        else if (remainingSecs === 60) setWarningPopup(60); // 1 min
        else if (remainingSecs <= 20 && remainingSecs > 0) {
          setWarningPopup(remainingSecs); // Continuous countdown from 20s down to 1s
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [roomData, ended, joined, user]);

  // Post-meeting countdown screen
  useEffect(() => {
    if (!ended && !hasLeft) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate('Dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [ended, hasLeft]);

  const handleEndMeeting = async () => {
    setEnded(true);
    setTimeLeft(30);
    const durationMin = Math.round((Date.now() - joinTimeRef.current) / 60000);
    if (roomData && isSameId(getUserId(user), roomData.userId)) {
      try {
        await API.put(`/meetings/${roomData.id}`, { status: 'completed', duration: durationMin });
        if (socket) socket.emit('meeting-ended');
        refreshMeetings();
      } catch (err) {
        console.log('Error ending meeting:', err);
      }
    }
  };

  const handleEndMeetingForAll = async () => {
    setShowLeaveOptionsModal(false);
    const durationMin = Math.round((Date.now() - joinTimeRef.current) / 60000);
    if (roomData && isSameId(getUserId(user), roomData.userId)) {
      try {
        await API.put(`/meetings/${roomData.id}`, { status: 'completed', duration: durationMin });
        if (socket) socket.emit('meeting-ended');
        refreshMeetings();
      } catch (err) {
        console.log('Error ending meeting:', err);
      }
    }
    navigate('Dashboard');
  };

  const handleLeave = () => {
    setShowLeaveOptionsModal(false);
    setHasLeft(true);
    setTimeLeft(30);
  };

  const handleRejoin = () => {
    setHasLeft(false);
    setJoined(true);
    setTimeLeft(30);
  };

  const handleAdmit = (guestSocketId) => {
    if (socket) {
      socket.emit('admit-guest', guestSocketId);
    }
    setKnockingGuests(prev => prev.filter(g => g.socketId !== guestSocketId));
  };

  const handleDeny = (guestSocketId) => {
    if (socket) {
      socket.emit('deny-guest', guestSocketId);
    }
    setKnockingGuests(prev => prev.filter(g => g.socketId !== guestSocketId));
  };

  const handleExtend = async (mins) => {
    if (!roomData) return;
    const currentEnd = new Date(roomData.endTime).getTime();
    const newEnd = new Date(currentEnd + mins * 60000);
    
    try {
      await API.put(`/meetings/${roomData.id}`, { endTime: newEnd.toISOString() });
      setShowExtendMenu(false);
      Alert.alert('Extended', `Meeting duration extended by ${mins} minutes.`);
    } catch (err) {
      Alert.alert('Error', 'Failed to extend meeting: ' + err.message);
    }
  };

  const getJitsiSource = () => {
    const effectivePrefs = userPreferences || user?.preferences || {};
    const isMicEnabled = effectivePrefs.micDefault === true;
    const isCamEnabled = effectivePrefs.cameraDefault === true;
    const startAudioMuted = !isMicEnabled;
    const startVideoMuted = !isCamEnabled;

    const resolvedDisplayName = effectivePrefs.displayName || user?.preferences?.displayName || user?.name || displayName || 'Guest';
    const logoUrl = 'https://video-conferencing-website-one.vercel.app/Hi_Logo.png';
    const brandLink = 'https://video-conferencing-website-one.vercel.app';
    const configString = `#config.startWithAudioMuted=${startAudioMuted}&config.startWithVideoMuted=${startVideoMuted}` +
      `&config.disableDeepLinking=true&config.enableClosePage=false&config.prejoinPageEnabled=true` +
      `&config.prejoinConfig.enabled=true&userInfo.displayName=${encodeURIComponent(resolvedDisplayName)}` +
      `&interfaceConfig.SHOW_JITSI_WATERMARK=false&interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false` +
      `&interfaceConfig.SHOW_POWERED_BY=false&interfaceConfig.SHOW_PROMOTIONAL_CLOSE_PAGE=false` +
      `&interfaceConfig.SHOW_BRAND_WATERMARK=true&interfaceConfig.DEFAULT_LOGO_URL=${encodeURIComponent(logoUrl)}` +
      `&interfaceConfig.BRAND_WATERMARK_LINK=${encodeURIComponent(brandLink)}`;
    
    if (jwtToken && roomData) {
      return { uri: `https://8x8.vc/${jaasAppId}/${roomName}?jwt=${jwtToken}${configString}` };
    } else {
      // Free public fallback
      return { uri: `https://meet.jit.si/${roomName}${configString}` };
    }
  };

  if (loading || jwtToken === null) {
    return (
      <View style={styles.loaderContainer}>
        <Image source={hiLogo} style={styles.loaderLogo} resizeMode="contain" />
        <ActivityIndicator size="large" color="#6C63FF" style={{ marginVertical: 20 }} />
        <Text style={styles.loaderText}>Preparing your meeting space...</Text>
      </View>
    );
  }

  // Voluntary Leave Screen
  if (hasLeft) {
    return (
      <View style={[styles.center, { backgroundColor: '#0d0c15', padding: 24 }]}>
        <View style={styles.endedLogoRow}>
          <Image source={hiLogo} style={styles.endLogoHi} resizeMode="contain" />
          <View style={styles.dividerLineVertical} />
          <Image source={poweredByLogo} style={styles.endLogoPowered} resizeMode="contain" />
        </View>
        <Text style={[styles.postScreenTitle, { color: '#fff' }]}>You left the meeting</Text>
        <Text style={[styles.postScreenDesc, { color: '#8e8d9a' }]}>
          Returning to dashboard in <Text style={{ color: '#6C63FF', fontWeight: 'bold' }}>{timeLeft}</Text> seconds...
        </Text>
        <View style={styles.postScreenBtns}>
          <TouchableOpacity style={styles.btnSecOutline} onPress={() => navigate('Dashboard')}>
            <Text style={styles.btnSecOutlineText}>Go to Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnPrimaryFilled, { backgroundColor: '#6C63FF' }]} onPress={handleRejoin}>
            <Text style={styles.btnPrimaryFilledText}>Rejoin Meeting</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Meeting Ended Screen
  if (ended) {
    const isConsultation = roomData?.isConsultation;
    return (
      <View style={[styles.center, { backgroundColor: '#0d0c15', padding: 24 }]}>
        <View style={styles.endedLogoRow}>
          <Image source={hiLogo} style={styles.endLogoHi} resizeMode="contain" />
          <View style={styles.dividerLineVertical} />
          <Image source={poweredByLogo} style={styles.endLogoPowered} resizeMode="contain" />
        </View>
        <Text style={[styles.postScreenTitle, { color: '#ea4335' }]}>
          {isConsultation ? 'Consultation Time Ended' : 'Meeting Ended'}
        </Text>
        <Text style={[styles.postScreenDesc, { color: '#8e8d9a' }]}>
          {isConsultation ? 'The consultation time has ended.' : 'This meeting has been concluded by the host.'}
        </Text>
        <Text style={[styles.postScreenCountdown, { color: '#8e8d9a' }]}>
          Returning to dashboard in <Text style={{ color: '#6C63FF', fontWeight: 'bold' }}>{timeLeft}</Text> seconds...
        </Text>
        <TouchableOpacity style={[styles.btnPrimaryFilled, { backgroundColor: '#6C63FF', width: '100%', maxWidth: 220, marginTop: 16 }]} onPress={() => navigate('Dashboard')}>
          <Text style={styles.btnPrimaryFilledText}>Return to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Knocking / Waiting room
  if (knocking) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg, padding: 24 }]}>
        <ActivityIndicator size="large" color={colors.gold || '#b8963e'} />
        <Text style={[styles.knockTitle, { color: colors.text, marginTop: 24 }]}>Knocking...</Text>
        <Text style={[styles.knockDesc, { color: colors.textSecondary }]}>
          Waiting for the host to admit you to this private meeting space.
        </Text>
        <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => navigate('Dashboard')}>
          <Text style={[styles.cancelBtnText, { color: colors.text }]}>Leave</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const runBeforeFirstLimit = `
    (function() {
      // Inject CSS to hide Jitsi watermark, deep linking ads, promo banners
      var style = document.createElement('style');
      style.innerHTML = \`
        .watermark { display: none !important; }
        .deep-linking-mobile { display: none !important; }
        .redirect-page { display: none !important; }
        .thank-you { display: none !important; }
        .promo { display: none !important; }
      \`;
      document.head.appendChild(style);

      var checkInterval = setInterval(function() {
        if (window.APP && window.APP.conference && typeof window.APP.conference.isJoined === 'function') {
          if (window.APP.conference.isJoined()) {
            clearInterval(checkInterval);
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'joined-conference' }));
          }
        }
      }, 1000);

      // Listen for conference left or page unload
      window.addEventListener('pagehide', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'hangup' }));
      });
      window.addEventListener('beforeunload', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'hangup' }));
      });

      // Intercept hangup button clicks
      document.addEventListener('click', function(e) {
        var btn = e.target && e.target.closest && e.target.closest('[aria-label*="hangup" i], [aria-label*="Leave" i], [aria-label*="End meeting" i], [data-testid*="hangup" i], .hangup-button');
        if (btn) {
          setTimeout(function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'hangup' }));
          }, 300);
        }
      }, true);
    })();
    true;
  `;

  const onWebViewMessage = async (event) => {
    try {
      if (!event?.nativeEvent?.data) return;
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'joined-conference') {
        const isHost = isSameId(roomData?.userId, getUserId(user));
        if (isHost && !roomData?.hostJoined) {
          console.log('Host joined the conference! Activating duration timer.');
          await API.put(`/meetings/${roomData.id}`, { hostJoined: true });
          if (socket) socket.emit('host-joined');
          // Refetch roomData so we get the correct endTime
          const res = await API.get(`/meetings/room/${roomName}`);
          setRoomData(res.data.meeting);
        }
      } else if (data.type === 'hangup' || data.type === 'conference-left') {
        const isHost = isSameId(roomData?.userId, getUserId(user));
        if (isHost) {
          setShowLeaveOptionsModal(true);
        } else {
          handleLeave();
        }
      }
    } catch (err) {
      console.log('Error parsing WebView message:', err);
    }
  };

  const isExitOrPromoUrl = (url) => {
    if (!url) return false;
    return (
      url.includes('close.html') ||
      url.includes('/close') ||
      url.includes('static/close') ||
      url.includes('thank-you') ||
      url.includes('welcome') ||
      url.includes('promo') ||
      url.includes('jitsi.org') ||
      (!url.includes(roomName) && !url.startsWith('about:') && !url.startsWith('blob:'))
    );
  };

  // Active meeting with full-screen Webview
  return (
    <View style={[styles.meetingContainer, { backgroundColor: colors.bg }]}>
      {/* Top Left Floating Hi Logo */}
      <View style={styles.topBarOverlay} pointerEvents="none">
        <View style={styles.topLogoBadge}>
          <Image source={hiLogo} style={styles.topLogoImg} resizeMode="contain" />
        </View>
      </View>

      {/* Timer overlay if Consultation */}
      {roomData?.isConsultation && consultationTime !== null && (
        <View style={[styles.timerOverlay, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Clock size={16} color={consultationTime < 60 ? colors.accentRed : colors.text} />
          <Text style={[styles.timerText, { color: consultationTime < 60 ? colors.accentRed : colors.text }]}>
            {Math.floor(consultationTime / 60)}:{String(consultationTime % 60).padStart(2, '0')}
          </Text>
        </View>
      )}

      <WebView 
        key={jitsiKey}
        source={getJitsiSource()} 
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        startInLoadingState={true}
        renderLoading={() => <ActivityIndicator size="large" color={colors.primary} style={StyleSheet.absoluteFill} />}
        injectedJavaScript={runBeforeFirstLimit}
        onMessage={onWebViewMessage}
        onNavigationStateChange={(navState) => {
          if (isExitOrPromoUrl(navState.url)) {
            const isHost = isSameId(roomData?.userId, getUserId(user));
            if (isHost) {
              setShowLeaveOptionsModal(true);
            } else {
              handleLeave();
            }
          }
        }}
        onShouldStartLoadWithRequest={(request) => {
          if (isExitOrPromoUrl(request.url)) {
            const isHost = isSameId(roomData?.userId, getUserId(user));
            if (isHost) {
              setShowLeaveOptionsModal(true);
            } else {
              handleLeave();
            }
            return false;
          }
          return true;
        }}
      />

      {/* Host Control Actions (Knock button ONLY - Leave is handled inside Jitsi) */}
      {isSameId(getUserId(user), roomData?.userId) && knockingGuests.length > 0 && (
        <View style={[styles.controlsRow, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
          <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.gold }]} onPress={() => Alert.alert('Guests Waiting', `${knockingGuests.length} users are knocking to enter.`)}>
            <Users size={20} color="#fff" />
            <Text style={styles.controlText}>Knock ({knockingGuests.length})</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Host admit knocking guest overlay modal */}
      {isSameId(getUserId(user), roomData?.userId) && knockingGuests.length > 0 && (
        <View style={[styles.lobbyOverlay, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.lobbyTitle, { color: colors.text }]}>Knocking: {knockingGuests[0].name}</Text>
          <View style={styles.lobbyBtns}>
            <TouchableOpacity style={[styles.lobbyBtn, { backgroundColor: colors.accentRed }]} onPress={() => handleDeny(knockingGuests[0].socketId)}>
              <X size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.lobbyBtn, { backgroundColor: colors.accentGreen }]} onPress={() => handleAdmit(knockingGuests[0].socketId)}>
              <Check size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Warnings */}
      {warningPopup !== null && (
        <View style={[styles.warningBox, { backgroundColor: colors.accentRed, flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ShieldAlert size={20} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 }}>
              Consultation ends in {warningPopup >= 60 ? `${warningPopup / 60}m` : `${warningPopup}s`}!
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <TouchableOpacity 
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }} 
              onPress={() => setWarningPopup(null)}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Ignore</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }} 
              onPress={() => {
                setWarningPopup(null);
                setShowExtendMenu(true);
              }}
            >
              <Text style={{ color: colors.accentRed, fontSize: 12, fontWeight: '700' }}>Extend</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Extend duration modal sheet */}
      <Modal animationType="slide" transparent={true} visible={showExtendMenu} onRequestClose={() => setShowExtendMenu(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheetContent, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Extend Consultation Duration</Text>
            
            <TouchableOpacity style={[styles.sheetBtn, { backgroundColor: colors.primaryLight }]} onPress={() => handleExtend(5)}>
              <Text style={[styles.sheetBtnText, { color: colors.primary }]}>+ 5 Minutes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sheetBtn, { backgroundColor: colors.primaryLight }]} onPress={() => handleExtend(15)}>
              <Text style={[styles.sheetBtnText, { color: colors.primary }]}>+ 15 Minutes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sheetBtn, { backgroundColor: colors.primaryLight }]} onPress={() => handleExtend(30)}>
              <Text style={[styles.sheetBtnText, { color: colors.primary }]}>+ 30 Minutes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sheetBtn, { backgroundColor: colors.primaryLight }]} onPress={() => handleExtend(60)}>
              <Text style={[styles.sheetBtnText, { color: colors.primary }]}>+ 1 Hour (60 Min)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sheetCloseBtn, { borderColor: colors.border }]} onPress={() => setShowExtendMenu(false)}>
              <Text style={[styles.sheetCloseText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Leave meeting choices modal for Host (Image 3 layout) */}
      <Modal animationType="fade" transparent={true} visible={showLeaveOptionsModal} onRequestClose={() => { setShowLeaveOptionsModal(false); setJitsiKey(k => k + 1); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#181829', borderColor: '#27273e', borderWidth: 1, borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Leave Meeting</Text>
              <TouchableOpacity onPress={() => { setShowLeaveOptionsModal(false); setJitsiKey(k => k + 1); }}>
                <X size={20} color="#8e8d9a" />
              </TouchableOpacity>
            </View>
            
            {/* Subtitle */}
            <Text style={{ color: '#8e8d9a', fontSize: 14, lineHeight: 20, marginBottom: 24 }}>
              Do you want to just leave the meeting, or end it for everyone?
            </Text>
            
            {/* Actions */}
            <View style={{ gap: 12 }}>
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2a2a40', height: 50, borderRadius: 14 }}
                onPress={handleLeave}
              >
                <LogOut size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Just Leave</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#ea4335', height: 50, borderRadius: 14 }}
                onPress={handleEndMeetingForAll}
              >
                <Users size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>End for all</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    marginTop: 16,
  },
  prejoinContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  prejoinTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  prejoinRoomName: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: 32,
  },
  cameraMock: {
    width: '100%',
    maxWidth: 320,
    height: 180,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  cameraMockText: {
    fontSize: 14,
  },
  togglesRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 40,
  },
  toggleCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinRoomBtn: {
    width: '100%',
    maxWidth: 320,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinRoomBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  meetingContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    marginTop: 40,
  },
  timerOverlay: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  controlsRow: {
    height: 80,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    borderTopWidth: 1,
    paddingBottom: 10,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  controlText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  lobbyOverlay: {
    position: 'absolute',
    bottom: 95,
    left: 20,
    right: 20,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  lobbyTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  lobbyBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  lobbyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningBox: {
    position: 'absolute',
    top: 90,
    left: 20,
    right: 20,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 30,
  },
  warningText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 24,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  sheetBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetCloseBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  sheetCloseText: {
    fontSize: 14,
    fontWeight: '600',
  },
  endCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 16,
  },
  endTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  endDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 22,
  },
  endBtn: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  endBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  knockTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  knockDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    maxWidth: 260,
  },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 160,
    marginTop: 32,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  prejoinCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  noVideoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameFormGroup: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 20,
  },
  nameInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 13,
    textAlign: 'center',
  },
  joinBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  endedLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  endLogoHi: {
    height: 36,
    width: 72,
  },
  dividerLineVertical: {
    width: 1,
    height: 40,
    backgroundColor: '#232235',
  },
  endLogoPowered: {
    height: 60,
    width: 120,
  },
  postScreenTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  postScreenDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  postScreenCountdown: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  postScreenBtns: {
    flexDirection: 'row',
    gap: 16,
  },
  btnSecOutline: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#232235',
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecOutlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnPrimaryFilled: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryFilledText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  topBarOverlay: {
    position: 'absolute',
    top: 40,
    left: 14,
    zIndex: 9999,
  },
  topLogoBadge: {
    backgroundColor: 'rgba(13, 12, 21, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  topLogoImg: {
    height: 22,
    width: 44,
  },
});

