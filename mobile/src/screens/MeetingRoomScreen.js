import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, Dimensions, TextInput } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import { useMeetings } from '../context/MeetingContext';
import { useTheme } from '../context/ThemeContext';
import { Mic, MicOff, Video as VideoIcon, VideoOff, LogOut, ShieldAlert, Clock, Plus, Users, UserCheck, Check, X, ArrowRight } from 'lucide-react-native';

const JAAS_APP_ID = 'vpaas-magic-cookie-3d02f5dbcd50462788e0b6bbfcb6bbd4'; // fallback placeholder
const hiLogo = require('../../assets/Hi_Logo.png');
const poweredByLogo = require('../../assets/powered_by_aiRender.png');

export default function MeetingRoomScreen({ navigate, params }) {
  const { roomName, isHost: initialIsHost } = params || {};
  const { colors } = useTheme();
  const { user, API, socket } = useAuth();
  const { userPreferences } = useMeetings();

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
        setRoomData(res.data.meeting);

        // Fetch JaaS token
        try {
          const tokRes = await API.get(`/meetings/room/${roomName}/token`);
          setJwtToken(tokRes.data.token);
        } catch (tokErr) {
          console.log('JaaS token error (falling back to guest):', tokErr.message);
          setJwtToken('');
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
        socket.off('guest-knocking');
        socket.off('guest-admitted');
        socket.off('guest-denied');
      }
    };
  }, [roomName, socket]);

  // Handle Host joining notification
  useEffect(() => {
    if (roomData && user?.id === roomData.userId && !roomData.hostJoined && roomData.status === 'scheduled') {
      API.put(`/meetings/${roomData.id}`, { hostJoined: true })
        .then(() => {
          if (socket) socket.emit('host-joined');
        })
        .catch(console.error);
    }
  }, [roomData, user]);

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
      if (user?.id === roomData.userId) {
        if (remainingSecs === 300) setWarningPopup(300);
        else if (remainingSecs === 120) setWarningPopup(120);
        else if (remainingSecs === 60) setWarningPopup(60);
        else if (remainingSecs === 10) setWarningPopup(10);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [roomData, ended, joined]);

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

  const handleJoin = () => {
    const isHost = roomData?.userId === user?.id;
    const isInvitee = roomData?.participants?.some(p => p.email === user?.email);
    const isInstantMeeting = roomData?.type === 'instant';

    let requiresPermission = false;
    if (!isHost) {
      if (isInstantMeeting) {
        requiresPermission = false;
      } else if (roomData?.isPrivate) {
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
          user: { name: displayName, email: user?.email, isInvitee }
        });
      }
    } else {
      setJoined(true);
    }
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

  const handleEndMeeting = async () => {
    setEnded(true);
    setTimeLeft(30);
    const durationMin = Math.round((Date.now() - joinTimeRef.current) / 60000);
    if (roomData && user?.id === roomData.userId) {
      try {
        await API.put(`/meetings/${roomData.id}`, { status: 'completed', duration: durationMin });
        if (socket) socket.emit('meeting-ended');
      } catch (err) {
        console.log('Error ending meeting:', err);
      }
    }
  };

  const handleLeave = () => {
    setHasLeft(true);
    setTimeLeft(30);
  };

  const handleRejoin = () => {
    setHasLeft(false);
    setJoined(true);
    setTimeLeft(30);
  };

  const handleLeaveClick = () => {
    const isHost = roomData?.userId === user?.id;
    if (isHost) {
      Alert.alert(
        'Leave Meeting',
        'Choose how you want to exit the meeting:',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Leave Meeting', onPress: handleLeave },
          { text: 'End Meeting for All', style: 'destructive', onPress: handleEndMeeting }
        ]
      );
    } else {
      handleLeave();
    }
  };

  // Build Jitsi WebView Link
  // If JaaS credentials are not complete, we can fallback to standard meet.jit.si
  const getJitsiSource = () => {
    const isHost = roomData?.userId === user?.id;
    const configString = `#config.startWithAudioMuted=${audioMuted}&config.startWithVideoMuted=${videoMuted}&config.disableDeepLinking=true&config.prejoinPageEnabled=false&userInfo.displayName="${encodeURIComponent(displayName)}"`;
    
    if (jwtToken && roomData) {
      return { uri: `https://8x8.vc/${JAAS_APP_ID}/${roomName}?jwt=${jwtToken}${configString}` };
    } else {
      // Free public fallback
      return { uri: `https://meet.jit.si/${roomName}${configString}` };
    }
  };

  if (loading) {
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

  // Pre-join Room
  if (!joined) {
    return (
      <View style={[styles.prejoinContainer, { backgroundColor: colors.bg }]}>
        <View style={[styles.prejoinCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.prejoinTitle, { color: colors.text }]}>Ready to join?</Text>
          <Text style={[styles.prejoinRoomName, { color: colors.primary, fontFamily: 'monospace' }]}>{roomName}</Text>
          
          {/* Mock camera view box */}
          <View style={[styles.cameraMock, { backgroundColor: '#1a1a2e', borderColor: colors.border }]}>
            {videoMuted ? (
              <View style={styles.noVideoPlaceholder}>
                <VideoOff size={40} color={colors.textMuted} style={{ marginBottom: 8 }} />
                <Text style={[styles.cameraMockText, { color: colors.textMuted }]}>Camera is off</Text>
              </View>
            ) : (
              <View style={styles.noVideoPlaceholder}>
                <VideoIcon size={40} color={colors.primary} style={{ marginBottom: 8 }} />
                <Text style={[styles.cameraMockText, { color: '#fff' }]}>Camera is on</Text>
              </View>
            )}
          </View>

          {/* Toggle buttons row matching web style */}
          <View style={styles.togglesRow}>
            <TouchableOpacity 
              style={[
                styles.toggleCircle, 
                { backgroundColor: audioMuted ? colors.bg : colors.primaryLight }
              ]}
              onPress={() => setAudioMuted(!audioMuted)}
            >
              {audioMuted ? <MicOff size={20} color={colors.textSecondary} /> : <Mic size={20} color={colors.primary} />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.toggleCircle, 
                { backgroundColor: videoMuted ? colors.bg : colors.primaryLight }
              ]}
              onPress={() => setVideoMuted(!videoMuted)}
            >
              {videoMuted ? <VideoOff size={20} color={colors.textSecondary} /> : <VideoIcon size={20} color={colors.primary} />}
            </TouchableOpacity>
          </View>

          {/* Display name input matching web */}
          <View style={styles.nameFormGroup}>
            <TextInput
              style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
            />
          </View>

          <TouchableOpacity style={[styles.joinRoomBtn, { backgroundColor: colors.success || '#2d6a4f' }]} onPress={handleJoin}>
            <View style={styles.joinBtnRow}>
              <Text style={styles.joinRoomBtnText}>Join now</Text>
              <ArrowRight size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Active meeting with full-screen Webview
  return (
    <View style={[styles.meetingContainer, { backgroundColor: colors.bg }]}>
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
        source={getJitsiSource()} 
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        startInLoadingState={true}
        renderLoading={() => <ActivityIndicator size="large" color={colors.primary} style={StyleSheet.absoluteFill} />}
      />

      {/* Host Control Actions */}
      <View style={[styles.controlsRow, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
        <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.accentRed }]} onPress={handleLeaveClick}>
          <LogOut size={20} color="#fff" />
          <Text style={styles.controlText}>Leave</Text>
        </TouchableOpacity>

        {user?.id === roomData?.userId && roomData?.isConsultation && (
          <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.primary }]} onPress={() => setShowExtendMenu(true)}>
            <Plus size={20} color="#fff" />
            <Text style={styles.controlText}>Extend</Text>
          </TouchableOpacity>
        )}

        {user?.id === roomData?.userId && knockingGuests.length > 0 && (
          <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.gold }]} onPress={() => Alert.alert('Guests Waiting', `${knockingGuests.length} users are knocking to enter.`)}>
            <Users size={20} color="#fff" />
            <Text style={styles.controlText}>Knock ({knockingGuests.length})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Host admit knocking guest overlay modal */}
      {user?.id === roomData?.userId && knockingGuests.length > 0 && (
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
        <View style={[styles.warningBox, { backgroundColor: colors.accentRed }]}>
          <ShieldAlert size={20} color="#fff" />
          <Text style={styles.warningText}>Consultation ends in {warningPopup / 60}m!</Text>
          <TouchableOpacity onPress={() => setWarningPopup(null)}>
            <X size={16} color="#fff" />
          </TouchableOpacity>
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

            <TouchableOpacity style={[styles.sheetCloseBtn, { borderColor: colors.border }]} onPress={() => setShowExtendMenu(false)}>
              <Text style={[styles.sheetCloseText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
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
    lineHeight: 1.8,
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
    lineHeight: 1.8,
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
    lineHeight: 1.8,
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
});
