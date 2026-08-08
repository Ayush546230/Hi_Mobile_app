import React, { useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Share, Clipboard
} from 'react-native';
import { useMeetings } from '../context/MeetingContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Trash2, Calendar, Clock, Video, Search, Copy } from 'lucide-react-native';

export default function HistoryScreen({ navigate }) {
  const { colors } = useTheme();
  const { meetingHistory, loading, clearHistory, deleteMeeting } = useMeetings();
  const { logout } = useAuth();

  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear your entire meeting history? This action cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Clear All', style: 'destructive', onPress: async () => {
            try {
              await clearHistory();
              showToast('Meeting history cleared.');
            } catch (err) {
              Alert.alert('Error', 'Failed to clear: ' + err.message);
            }
          }
        }
      ]
    );
  };

  const handleDeleteItem = (id) => {
    Alert.alert(
      'Delete Meeting',
      'Remove this meeting from your history?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Delete', style: 'destructive', onPress: () => deleteMeeting(id) }
      ]
    );
  };

  const handleCopyLink = async (meeting) => {
    const link = meeting.link || `https://hi-video.conferencing/meeting/${meeting.roomName}`;
    Clipboard.setString(link);
    showToast('Link copied!');
  };

  const filteredMeetings = meetingHistory.filter(m => {
    const s = search.toLowerCase();
    const titleVal = m.title || '';
    const descVal = m.description || '';
    const roomVal = m.roomName || '';
    return (
      titleVal.toLowerCase().includes(s) ||
      descVal.toLowerCase().includes(s) ||
      roomVal.toLowerCase().includes(s)
    );
  });

  const getRelativeText = (dateString) => {
    if (!dateString) return 'unknown';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'unknown';
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const c = colors;

  return (
    <View style={[styles.mainContainer, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        {/* ─── Page Heading ─── */}
        <View style={styles.pageHeadRow}>
          <Text style={[styles.pageTitle, { color: c.text }]}>Meeting History</Text>
          {meetingHistory.length > 0 && (
            <TouchableOpacity onPress={handleClearHistory}>
              <Text style={[styles.clearAllText, { color: c.accentRed }]}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.pageSubtitle, { color: c.textSecondary }]}>
          View and manage your past and upcoming meetings
        </Text>

        {/* ─── Search Bar ─── */}
        <View style={[styles.searchBar, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Search size={18} color={c.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: c.text }]}
            placeholder="Search meetings..."
            placeholderTextColor={c.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>

        {/* ─── List / Empty ─── */}
        {loading ? (
          <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 40 }} />
        ) : filteredMeetings.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <Calendar size={52} color={c.textMuted} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>No meetings found</Text>
            <Text style={[styles.emptyText, { color: c.textSecondary }]}>
              {search ? 'Try a different search term' : 'Your meeting history will appear here'}
            </Text>
          </View>
        ) : (
          filteredMeetings.map((meeting) => (
            <View key={meeting.id} style={[styles.historyCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              {/* Main row */}
              <View style={styles.cardMainRow}>
                <View style={[styles.historyIcon, { backgroundColor: c.primaryLight }]}>
                  <Video size={20} color={c.primary} />
                </View>

                <View style={styles.detailsWrap}>
                  <Text style={[styles.meetingTitle, { color: c.text }]} numberOfLines={2}>
                    {meeting.title}
                  </Text>
                  <Text style={[styles.meetingMeta, { color: c.textSecondary }]}>
                    {new Date(meeting.startTime).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                    {'  '}👥 {meeting.participants?.length || 0}
                    {typeof meeting.duration === 'number' ? `  ⏱️ ${meeting.duration}m` : ''}
                  </Text>
                  <Text style={[styles.relativeTime, { color: c.textMuted }]}>
                    {getRelativeText(meeting.createdAt || meeting.startTime)}
                  </Text>
                </View>

                {/* Icon buttons */}
                <View style={styles.actionCol}>
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: c.accentGreen + '22' }]}
                    onPress={() => navigate('MeetingRoom', { roomName: meeting.roomName, isHost: false })}
                    title="Join"
                  >
                    <Video size={14} color={c.accentGreen} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: c.bgHover }]}
                    onPress={() => handleCopyLink(meeting)}
                    title="Copy link"
                  >
                    <Copy size={14} color={c.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: c.accentRed + '15' }]}
                    onPress={() => handleDeleteItem(meeting.id)}
                    title="Delete"
                  >
                    <Trash2 size={14} color={c.accentRed} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Description collapsible */}
              {meeting.description ? (
                <View style={[styles.descBlock, { backgroundColor: c.bg }]}>
                  {meeting.description.length <= 85 ? (
                    <Text style={[styles.descText, { color: c.textSecondary }]}>{meeting.description}</Text>
                  ) : expandedId === meeting.id ? (
                    <>
                      <Text style={[styles.descText, { color: c.textSecondary }]}>{meeting.description}</Text>
                      <TouchableOpacity onPress={() => setExpandedId(null)}>
                        <Text style={[styles.seeMoreText, { color: c.primary }]}>show less</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.descText, { color: c.textSecondary }]}>{meeting.description.slice(0, 85)}...</Text>
                      <TouchableOpacity onPress={() => setExpandedId(meeting.id)}>
                        <Text style={[styles.seeMoreText, { color: c.primary }]}>see more</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      {/* Toast */}
      {toast !== '' && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  scrollContainer: { padding: 20, paddingBottom: 40 },

  // Page heading
  pageHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pageTitle: { fontSize: 26, fontWeight: '700' },
  clearAllText: { fontSize: 13, fontWeight: '600' },
  pageSubtitle: { fontSize: 14, lineHeight: 20, marginBottom: 20 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderRadius: 14, height: 48, paddingHorizontal: 14, gap: 10, marginBottom: 24,
  },
  searchInput: { flex: 1, fontSize: 14 },

  // Empty state
  emptyState: {
    borderWidth: 1, borderRadius: 20, padding: 48,
    alignItems: 'center', gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // History card
  historyCard: {
    borderWidth: 1, borderRadius: 16, padding: 16,
    marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardMainRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  detailsWrap: { flex: 1 },
  meetingTitle: { fontSize: 14, fontWeight: '700', marginBottom: 3, lineHeight: 20 },
  meetingMeta: { fontSize: 12, marginBottom: 2 },
  relativeTime: { fontSize: 11 },
  actionCol: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  iconBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  // Description
  descBlock: { marginTop: 12, padding: 10, borderRadius: 10 },
  descText: { fontSize: 12, lineHeight: 18 },
  seeMoreText: { fontSize: 12, fontWeight: '600', marginTop: 4 },

  // Toast
  toast: {
    position: 'absolute', bottom: 30, alignSelf: 'center',
    backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  toastText: { fontSize: 13, fontWeight: '600', color: '#202124' },
});
