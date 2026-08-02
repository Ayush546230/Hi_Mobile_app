import React, { useState, useMemo } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, Alert, Linking, Clipboard, Image
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useMeetings } from '../context/MeetingContext';
import { useTheme } from '../context/ThemeContext';
import {
  Video, Calendar, Clock, Keyboard, X, Globe, Bell,
  ChevronDown, ChevronLeft, ChevronRight, Copy, ExternalLink
} from 'lucide-react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

const hiLogo = require('../../assets/Hi_Logo.png');
const poweredByLogo = require('../../assets/powered_by_aiRender.png');

// ─── Real Logos for Share Platform tiles ──────────────────
const WhatsAppIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 24 24">
    <Path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.739-1.456L0 24h.057zm12.012-3.136c1.8 0 3.565-.483 5.101-1.396l.366-.217 3.792.994-.972-3.7-.238-.378a9.88 9.88 0 001.558-5.328c.002-5.46-4.44-9.9-9.91-9.9-2.65 0-5.14 1.03-7.01 2.9a9.78 9.78 0 00-2.89 7.01c-.001 5.46 4.44 9.9 9.91 9.9h.007zm5.495-7.51c-.301-.15-1.78-.88-2.05-.98-.27-.1-.47-.15-.67.15-.2.3-.77.98-.95 1.18-.18.2-.36.22-.66.07a8.33 8.33 0 01-2.45-1.51 9.2 9.2 0 01-1.7-2.11c-.18-.3-.02-.47.13-.62.14-.13.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.67-1.62-.92-2.22-.25-.6-.52-.52-.72-.53-.18-.01-.4-.01-.62-.01-.22 0-.58.08-.88.4-.3.32-1.15 1.12-1.15 2.73s1.17 3.16 1.33 3.38c.17.22 2.3 3.52 5.58 4.94.78.34 1.39.54 1.86.69.78.25 1.49.21 2.05.13.62-.09 1.78-.73 2.03-1.43.25-.69.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" fill="#25D366" />
  </Svg>
);

const TelegramIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 24 24">
    <Path d="M11.944 0C5.358 0 0 5.357 0 11.94c0 5.3 3.456 9.79 8.243 11.385.114.022.25-.015.342-.089.091-.073.123-.19.088-.3l-.868-3.056c-.032-.113-.008-.236.066-.328 1.954-2.404 3.018-5.385 3.014-8.473-.002-3.415-.815-6.722-2.352-9.563-.032-.059-.092-.097-.16-.097h-.015zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.05-.21.03-.31-.05-.18-.08.13-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.37.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z" fill="#0088cc" />
  </Svg>
);

const CalendarIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 24 24">
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill="none" stroke="#4285F4" strokeWidth="2" />
    <Path d="M16 2v4M8 2v4M3 10h18" stroke="#34A853" strokeWidth="2" />
    <Circle cx="8" cy="14" r="1.5" fill="#FBBC05" />
    <Circle cx="12" cy="14" r="1.5" fill="#EA4335" />
    <Circle cx="16" cy="14" r="1.5" fill="#4285F4" />
    <Circle cx="8" cy="18" r="1.5" fill="#EA4335" />
    <Circle cx="12" cy="18" r="1.5" fill="#4285F4" />
    <Circle cx="16" cy="18" r="1.5" fill="#34A853" />
  </Svg>
);

const GmailIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 24 24">
    <Path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" fill="#E53935" />
    <Path d="M22 6l-10 7L2 6v12h20V6z" fill="#D54B3E" />
    <Path d="M22 6L12 13 2 6" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const QRIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="7" height="7" />
    <Rect x="14" y="3" width="7" height="7" />
    <Rect x="3" y="14" width="7" height="7" />
    <Path d="M14 14h2v2h-2zm2 2h2v2h-2zm2-2h3v2h-3zm0 4h2v2h-2zm-2 2h2v-2h-2zm-2-2h2v2h-2zm0-4h2v2h-2z" />
  </Svg>
);

// ─── Timezone Database ──────────────────────────────────────
const TIMEZONES = [
  { label: 'India Standard Time', zone: 'Asia/Kolkata' },
  { label: 'Greenwich Mean Time', zone: 'Africa/Abidjan' },
  { label: 'Greenwich Mean Time', zone: 'Africa/Accra' },
  { label: 'East Africa Time', zone: 'Africa/Addis_Ababa' },
  { label: 'Central European Standard Time', zone: 'Africa/Algiers' },
  { label: 'East Africa Time', zone: 'Africa/Asmera' },
  { label: 'Singapore Standard Time', zone: 'Asia/Singapore' },
  { label: 'Japan Standard Time', zone: 'Asia/Tokyo' },
  { label: 'Eastern Standard Time', zone: 'America/New_York' },
  { label: 'Central Standard Time', zone: 'America/Chicago' },
  { label: 'Mountain Standard Time', zone: 'America/Denver' },
  { label: 'Pacific Standard Time', zone: 'America/Los_Angeles' },
  { label: 'Gulf Standard Time', zone: 'Asia/Dubai' },
  { label: 'Australian Eastern Standard Time', zone: 'Australia/Sydney' },
  { label: 'British Summer Time', zone: 'Europe/London' },
  { label: 'Central European Summer Time', zone: 'Europe/Paris' },
  { label: 'Moscow Standard Time', zone: 'Europe/Moscow' },
  { label: 'New Zealand Standard Time', zone: 'Pacific/Auckland' },
  { label: 'Hawaii Standard Time', zone: 'Pacific/Honolulu' },
  { label: 'Argentina Time', zone: 'America/Argentina/Buenos_Aires' },
  { label: 'Brazil Time', zone: 'America/Sao_Paulo' },
  { label: 'China Standard Time', zone: 'Asia/Shanghai' },
  { label: 'Korea Standard Time', zone: 'Asia/Seoul' },
  { label: 'South Africa Standard Time', zone: 'Africa/Johannesburg' },
  { label: 'Turkey Time', zone: 'Europe/Istanbul' },
  { label: 'Hong Kong Time', zone: 'Asia/Hong_Kong' },
  { label: 'Israel Standard Time', zone: 'Asia/Jerusalem' },
  { label: 'Arabian Standard Time', zone: 'Asia/Riyadh' },
  { label: 'Pacific/Fiji Time', zone: 'Pacific/Fiji' }
];

// ─── Inline Calendar Picker Component ───────────────────────
function CalendarPicker({ date, onChange, onClose, colors, theme }) {
  const [viewYear, setViewYear] = useState(date.getFullYear());
  const [viewMonth, setViewMonth] = useState(date.getMonth());
  const [selDay, setSelDay] = useState(date.getDate());
  
  // Time selector states
  const [selHour, setSelHour] = useState(date.getHours() % 12 || 12);
  const [selMin, setSelMin] = useState(date.getMinutes());
  const [ampm, setAmpm] = useState(date.getHours() >= 12 ? 'PM' : 'AM');
  const [customTimeMode, setCustomTimeMode] = useState(false);

  // Dropdown list states for preset selectors
  const [showHourMenu, setShowHourMenu] = useState(false);
  const [showMinMenu, setShowMinMenu] = useState(false);
  const [showAmPmMenu, setShowAmPmMenu] = useState(false);

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const bg = theme === 'light' ? '#fff' : '#1e1e2e';
  const innerBg = theme === 'light' ? '#f3f4f6' : '#27273a';
  const border = colors.border;
  const primary = colors.primary;
  const text = colors.text;
  const muted = colors.textMuted;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const handleOK = () => {
    let h = (parseInt(selHour) || 12) % 12;
    if (ampm === 'PM') h += 12;
    const m = parseInt(selMin) || 0;
    const d = new Date(viewYear, viewMonth, selDay, h, m, 0);
    onChange(d);
    onClose();
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={{ backgroundColor: bg, borderRadius: 16, borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
      {/* Month nav */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border }}>
        <TouchableOpacity onPress={prevMonth} style={{ padding: 4 }}>
          <ChevronLeft size={20} color={text} />
        </TouchableOpacity>
        <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>{MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={nextMonth} style={{ padding: 4 }}>
          <ChevronRight size={20} color={text} />
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 10, paddingTop: 8 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', color: muted, fontSize: 12, fontWeight: '600' }}>{d}</Text>
        ))}
      </View>

      {/* Day grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingBottom: 8 }}>
        {cells.map((d, i) => {
          const isSelected = d === selDay && viewMonth === date.getMonth() && viewYear === date.getFullYear();
          const isToday = d === new Date().getDate() && viewMonth === new Date().getMonth() && viewYear === new Date().getFullYear();
          return (
            <TouchableOpacity
              key={i}
              style={{ width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 }}
              onPress={() => d && setSelDay(d)}
            >
              {d ? (
                <View style={[
                  { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
                  isSelected && { backgroundColor: primary },
                  !isSelected && isToday && { borderWidth: 1, borderColor: primary }
                ]}>
                  <Text style={{ fontSize: 13, color: isSelected ? '#fff' : text, fontWeight: isSelected ? '700' : '400' }}>{d}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Time row */}
      <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border, paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Clock size={16} color={muted} />
          <Text style={{ color: text, fontWeight: '600' }}>Time</Text>
        </View>

        {/* Input area */}
        {!customTimeMode ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Hour select */}
            <View style={{ zIndex: 10 }}>
              <TouchableOpacity
                style={{ borderWidth: 1, borderColor: border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: innerBg }}
                onPress={() => { setShowHourMenu(v => !v); setShowMinMenu(false); setShowAmPmMenu(false); }}
              >
                <Text style={{ color: text, fontSize: 14, fontWeight: '600' }}>{selHour}</Text>
                <ChevronDown size={14} color={muted} />
              </TouchableOpacity>
              {showHourMenu && (
                <View style={{ position: 'absolute', bottom: 42, left: 0, width: 80, maxHeight: 180, backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: 8, overflow: 'hidden' }}>
                  <ScrollView nestedScrollEnabled>
                    {Array.from({ length: 12 }, (_, idx) => idx + 1).map(h => (
                      <TouchableOpacity key={h} style={{ padding: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border }} onPress={() => { setSelHour(h); setShowHourMenu(false); }}>
                        <Text style={{ color: text, textAlign: 'center' }}>{h}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>:</Text>

            {/* Minute select */}
            <View style={{ zIndex: 10 }}>
              <TouchableOpacity
                style={{ borderWidth: 1, borderColor: border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: innerBg }}
                onPress={() => { setShowMinMenu(v => !v); setShowHourMenu(false); setShowAmPmMenu(false); }}
              >
                <Text style={{ color: text, fontSize: 14, fontWeight: '600' }}>{String(selMin).padStart(2, '0')}</Text>
                <ChevronDown size={14} color={muted} />
              </TouchableOpacity>
              {showMinMenu && (
                <View style={{ position: 'absolute', bottom: 42, left: 0, width: 80, backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: 8, overflow: 'hidden' }}>
                  {[0, 15, 30, 45].map(m => (
                    <TouchableOpacity key={m} style={{ padding: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border }} onPress={() => { setSelMin(m); setShowMinMenu(false); }}>
                      <Text style={{ color: text, textAlign: 'center' }}>{String(m).padStart(2, '0')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* AM/PM Select */}
            <View style={{ zIndex: 10 }}>
              <TouchableOpacity
                style={{ borderWidth: 1, borderColor: border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: innerBg }}
                onPress={() => { setShowAmPmMenu(v => !v); setShowHourMenu(false); setShowMinMenu(false); }}
              >
                <Text style={{ color: text, fontSize: 14, fontWeight: '600' }}>{ampm}</Text>
                <ChevronDown size={14} color={muted} />
              </TouchableOpacity>
              {showAmPmMenu && (
                <View style={{ position: 'absolute', bottom: 42, left: 0, width: 80, backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: 8, overflow: 'hidden' }}>
                  {['AM', 'PM'].map(a => (
                    <TouchableOpacity key={a} style={{ padding: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border }} onPress={() => { setAmpm(a); setShowAmPmMenu(false); }}>
                      <Text style={{ color: text, textAlign: 'center' }}>{a}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Custom Hour textinput */}
            <TextInput
              style={{ borderWidth: 1, borderColor: border, borderRadius: 8, width: 60, height: 40, textAlign: 'center', color: text, fontSize: 16, backgroundColor: innerBg }}
              value={String(selHour)}
              onChangeText={(val) => {
                const h = parseInt(val);
                if (!val) setSelHour('');
                else if (h >= 1 && h <= 12) setSelHour(h);
              }}
              keyboardType="numeric"
              maxLength={2}
            />
            <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>:</Text>
            {/* Custom Minute textinput */}
            <TextInput
              style={{ borderWidth: 1, borderColor: border, borderRadius: 8, width: 60, height: 40, textAlign: 'center', color: text, fontSize: 16, backgroundColor: innerBg }}
              value={String(selMin)}
              onChangeText={(val) => {
                const m = parseInt(val);
                if (!val) setSelMin('');
                else if (m >= 0 && m <= 59) setSelMin(m);
              }}
              keyboardType="numeric"
              maxLength={2}
            />
            {/* AM/PM toggle */}
            <TouchableOpacity
              style={{ borderWidth: 1, borderColor: border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: innerBg }}
              onPress={() => setAmpm(v => v === 'AM' ? 'PM' : 'AM')}
            >
              <Text style={{ color: text, fontSize: 14, fontWeight: '600' }}>{ampm}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Toggle Preset/Custom link */}
        <TouchableOpacity style={{ marginTop: 12 }} onPress={() => setCustomTimeMode(v => !v)}>
          <Text style={{ color: primary, fontSize: 13, fontWeight: '600' }}>
            {customTimeMode ? 'Use preset time' : 'Custom time...'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* OK button */}
      <View style={{ padding: 16, alignItems: 'flex-end', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border }}>
        <TouchableOpacity style={{ backgroundColor: primary, paddingHorizontal: 28, paddingVertical: 10, borderRadius: 10 }} onPress={handleOK}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>OK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Notification Picker Component (Screenshot 4 styled) ────
function NotifPicker({ amount, unit, type, onChange, onClose, colors, theme }) {
  const [localAmount, setLocalAmount] = useState(amount);
  const [localUnit, setLocalUnit] = useState(unit.replace(' before', ''));
  const [localType, setLocalType] = useState(type);

  const cardBg = theme === 'light' ? '#f3f4f6' : '#27273a';
  const border = colors.border;
  const primary = colors.primary;
  const text = colors.text;

  const UNIT_OPTIONS = ['minutes', 'hours', 'days', 'weeks'];
  const TYPE_OPTIONS = ['As Notification', 'As Email'];

  const handleDone = () => {
    onChange({ amount: parseInt(localAmount) || 10, unit: `${localUnit} before`, type: localType });
    onClose();
  };

  return (
    <View style={{ backgroundColor: cardBg, borderRadius: 16, borderWidth: 1, borderColor: border, padding: 16 }}>
      {/* Number input box */}
      <TextInput
        style={{ borderWidth: 1, borderColor: border, borderRadius: 10, height: 44, paddingHorizontal: 14, fontSize: 18, fontWeight: '600', color: text, backgroundColor: theme === 'light' ? '#fff' : '#1e1e2e', marginBottom: 14 }}
        value={String(localAmount)}
        onChangeText={(v) => setLocalAmount(v.replace(/[^0-9]/g, ''))}
        keyboardType="numeric"
      />

      {/* Unit Pills */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {UNIT_OPTIONS.map(u => (
          <TouchableOpacity
            key={u}
            style={[{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
              localUnit === u ? { backgroundColor: primary + '22', borderColor: primary } : { borderColor: border, backgroundColor: theme === 'light' ? '#fff' : '#1e1e2e' }]}
            onPress={() => setLocalUnit(u)}
          >
            <Text style={{ color: localUnit === u ? primary : text, fontSize: 13, fontWeight: localUnit === u ? '700' : '400' }}>{u}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Type Pills */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {TYPE_OPTIONS.map(t => (
          <TouchableOpacity
            key={t}
            style={[{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
              localType === t ? { backgroundColor: primary + '22', borderColor: primary } : { borderColor: border, backgroundColor: theme === 'light' ? '#fff' : '#1e1e2e' }]}
            onPress={() => setLocalType(t)}
          >
            <Text style={{ color: localType === t ? primary : text, fontSize: 13, fontWeight: localType === t ? '700' : '400' }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Separator */}
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: border, marginVertical: 10 }} />

      {/* Done button */}
      <View style={{ alignItems: 'flex-end' }}>
        <TouchableOpacity style={{ backgroundColor: primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 }} onPress={handleDone}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Duration Picker Component (15-min intervals up to 12 hours) ──
function DurationPicker({ startDate, durationMin, onChange, onClose, colors, theme }) {
  const bg = theme === 'light' ? '#fff' : '#1e1e2e';
  const border = colors.border;
  const primary = colors.primary;
  const text = colors.text;

  // Generate 15-min intervals up to 12 hours (720 mins)
  const options = [];
  for (let m = 0; m <= 720; m += 15) {
    const endTime = new Date(startDate.getTime() + m * 60000);
    const endStr = endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    let label;
    if (m === 0) label = '0 mins';
    else if (m < 60) label = `${m} mins`;
    else if (m === 60) label = '1 hr';
    else if (m % 60 === 0) label = `${m / 60} hrs`;
    else label = `${Math.floor(m / 60)}.${(m % 60) * 10 / 60} hrs`;
    options.push({ m, endStr, label });
  }

  return (
    <View style={{ backgroundColor: bg, borderRadius: 16, borderWidth: 1, borderColor: border, maxHeight: 300 }}>
      <ScrollView nestedScrollEnabled>
        {options.map(o => (
          <TouchableOpacity
            key={o.m}
            style={[{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border },
              durationMin === o.m && { backgroundColor: primary + '22' }]}
            onPress={() => { onChange(o.m); onClose(); }}
          >
            <Text style={{ color: text, fontWeight: durationMin === o.m ? '700' : '400', fontSize: 14 }}>
              {o.endStr}
            </Text>
            <Text style={{ color: durationMin === o.m ? primary : colors.textMuted, fontSize: 14 }}>({o.label})</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Main Dashboard Screen ───────────────────────────────────
export default function DashboardScreen({ navigate }) {
  const { colors, theme } = useTheme();
  const { user } = useAuth();
  const { upcomingMeetings, loading, createInstantMeeting, scheduleMeeting, cancelMeeting, sendInvites } = useMeetings();

  const [joinCode, setJoinCode] = useState('');
  const [schedModalVisible, setSchedModalVisible] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteMeeting, setInviteMeeting] = useState(null);
  const [creating, setCreating] = useState(false);
  const [linkBox, setLinkBox] = useState(null);
  const [toast, setToast] = useState('');

  // Schedule form
  const [schedTitle, setSchedTitle] = useState('');
  const [schedDesc, setSchedDesc] = useState('');
  const [schedConsultation, setSchedConsultation] = useState(false);
  
  // Set default start time to the nearest half-an-hour
  const [schedDate, setSchedDate] = useState(() => {
    const d = new Date();
    const mins = d.getMinutes();
    if (mins > 0 && mins <= 30) {
      d.setMinutes(30, 0, 0);
    } else if (mins > 30) {
      d.setHours(d.getHours() + 1, 0, 0, 0);
    }
    return d;
  });
  
  // Default duration = 1 hr (60 mins)
  const [schedDurationMin, setSchedDurationMin] = useState(60);
  const [schedPrivacy, setSchedPrivacy] = useState('public');
  const [schedParticipants, setSchedParticipants] = useState([]);
  const [participantInput, setParticipantInput] = useState('');
  const [repeat, setRepeat] = useState('Does not repeat');
  const [notifAmount, setNotifAmount] = useState(30);
  const [notifUnit, setNotifUnit] = useState('minutes before');
  const [notifType, setNotifType] = useState('As Notification');

  // Timezone search & paginate states
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [tzSearch, setTzSearch] = useState('');
  const [tzPage, setTzPage] = useState(1);

  // Description / Participants toggle states
  const [showDescId, setShowDescId] = useState(null);
  const [showParticipantsId, setShowParticipantsId] = useState(null);
  const [showQR, setShowQR] = useState(false);

  // UI toggles for pickers
  const [showCalendar, setShowCalendar] = useState(false);
  const [showDuration, setShowDuration] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  const REPEAT_OPTIONS = ['Does not repeat', 'Daily', 'Weekly', 'Monthly'];

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const formatDate = (d) => {
    if (!d) return 'Select date';
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return 'Select date';
    return parsed.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  const formatMeetingDate = (s) => {
    if (!s) return 'No date';
    const d = new Date(s);
    if (isNaN(d.getTime())) return 'Invalid date';
    const isToday = new Date().toDateString() === d.toDateString();
    if (isToday) return `Today, ${d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getDurationLabel = (m) => {
    if (!m) return '—';
    if (m < 60) return `${m} min`;
    if (m === 60) return '1 hr';
    if (m % 60 === 0) return `${m / 60} hr`;
    return `${Math.floor(m / 60)}.${(m % 60) * 10 / 60} hr`;
  };

  const getEndTimeLabel = () => {
    const end = new Date(schedDate.getTime() + schedDurationMin * 60000);
    const endStr = end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${endStr} (${getDurationLabel(schedDurationMin)})`;
  };

  // Timezone display name resolver
  const getTimezoneLabel = (zoneStr) => {
    const found = TIMEZONES.find(t => t.zone === zoneStr);
    return found ? found.label : zoneStr;
  };

  // Timezone search & paginate logic
  const filteredTzs = useMemo(() => {
    return TIMEZONES.filter(t =>
      t.label.toLowerCase().includes(tzSearch.toLowerCase()) ||
      t.zone.toLowerCase().includes(tzSearch.toLowerCase())
    );
  }, [tzSearch]);

  const tzTotalPages = Math.ceil(filteredTzs.length / 5) || 1;
  const paginatedTzs = useMemo(() => {
    const start = (tzPage - 1) * 5;
    return filteredTzs.slice(start, start + 5);
  }, [filteredTzs, tzPage]);

  // ── Actions ──
  const handleInstantMeeting = async () => {
    setCreating(true);
    try {
      const meeting = await createInstantMeeting();
      setLinkBox(meeting);
    } catch (err) {
      Alert.alert('Error', 'Failed to start meeting: ' + err.message);
    } finally { setCreating(false); }
  };

  const openScheduleModal = (isConsultation = false) => {
    setSchedConsultation(isConsultation);
    setSchedTitle(isConsultation ? 'Consultation' : '');
    setSchedDesc(''); setSchedParticipants([]); setParticipantInput('');
    setSchedPrivacy('public'); setSchedDurationMin(60); setRepeat('Does not repeat');
    setNotifAmount(30); setNotifUnit('minutes before'); setNotifType('As Notification');
    setShowCalendar(false); setShowDuration(false); setShowNotif(false); setShowRepeat(false);
    setTimezone('Asia/Kolkata'); setTzSearch(''); setTzPage(1);
    
    // Set default start time to the nearest half-an-hour
    const d = new Date();
    const mins = d.getMinutes();
    if (mins > 0 && mins <= 30) {
      d.setMinutes(30, 0, 0);
    } else if (mins > 30) {
      d.setHours(d.getHours() + 1, 0, 0, 0);
    }
    setSchedDate(d);
    setSchedModalVisible(true);
  };

  const addParticipant = () => {
    const email = participantInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { Alert.alert('Invalid Email', 'Enter a valid email.'); return; }
    if (schedParticipants.includes(email)) { Alert.alert('Duplicate', 'Already added.'); return; }
    setSchedParticipants(prev => [...prev, email]);
    setParticipantInput('');
  };

  const handleScheduleSubmit = async () => {
    if (!schedTitle.trim()) { Alert.alert('Error', 'Please enter a meeting title.'); return; }
    setCreating(true);
    try {
      const endTime = new Date(schedDate.getTime() + schedDurationMin * 60000);
      const meeting = await scheduleMeeting({
        title: schedTitle.trim(),
        description: schedDesc.trim(),
        startTime: schedDate.toISOString(),
        endTime: endTime.toISOString(),
        participants: schedParticipants.map(email => ({ name: email.split('@')[0], email })),
        timezone: timezone,
        isPrivate: schedPrivacy === 'private',
        isConsultation: schedConsultation,
        notification: { amount: notifAmount, unit: notifUnit, type: notifType },
        recurrence: repeat === 'Daily' ? 'daily' : repeat === 'Weekly' ? 'weekly' : undefined,
        recurrenceCount: (repeat === 'Daily' || repeat === 'Weekly') ? 4 : undefined,
      });
      if (schedParticipants.length > 0 && meeting?.id) {
        try { await sendInvites(meeting.id, schedParticipants); } catch (e) { console.log('Invite non-fatal:', e.message); }
      }
      setSchedModalVisible(false);
      setInviteMeeting(meeting);
      setInviteModalVisible(true);
      showToast('Meeting scheduled successfully!');
    } catch (err) {
      Alert.alert('Error', 'Scheduling failed: ' + err.message);
    } finally { setCreating(false); }
  };

  const handleJoinMeeting = () => {
    if (!joinCode.trim()) { Alert.alert('Error', 'Enter a meeting code or link.'); return; }
    let room = joinCode.trim();
    if (room.includes('/meeting/')) room = room.split('/meeting/')[1].split('?')[0];
    navigate('MeetingRoom', { roomName: room, isHost: false });
  };

  const handleCancel = (meetingId) => {
    Alert.alert('Cancel Meeting', 'Cancel this scheduled meeting?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: async () => { await cancelMeeting(meetingId); showToast('Meeting cancelled.'); } }
    ]);
  };

  const openInviteModal = (meeting) => { 
    setInviteMeeting(meeting); 
    setShowQR(false);
    setInviteModalVisible(true); 
  };

  const copyLink = (link) => { Clipboard.setString(link); showToast('Link copied!'); };

  const shareViaEmail = async (meeting) => {
    try {
      const subject = encodeURIComponent(`Meeting Invitation: ${meeting?.title || ''}`);
      const body = encodeURIComponent(`Hi there,\n\nYou are invited to a video meeting on hi.\n\nJoin the meeting here:\n${meeting?.link || ''}\n\nBest regards`);
      await Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
    } catch (e) {
      console.log('Email composer launch failed:', e.message);
      await shareViaGeneral(meeting);
    }
  };

  const shareViaCalendar = async (meeting) => {
    try {
      const start = new Date(meeting.startTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const end = meeting.endTime
        ? new Date(meeting.endTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
        : new Date(new Date(meeting.startTime).getTime() + 60 * 60000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(meeting.title)}&dates=${start}/${end}&details=${encodeURIComponent('Join the hi video conference: ' + meeting.link)}&location=${encodeURIComponent(meeting.link)}`;
      await Linking.openURL(googleUrl);
    } catch (e) {
      console.log('Calendar integration failed:', e.message);
      await shareViaGeneral(meeting);
    }
  };

  const shareViaWhatsApp = async (meeting) => {
    try {
      const textVal = `Join my meeting "${meeting?.title}":\n${meeting?.link || ''}`;
      const url = `whatsapp://send?text=${encodeURIComponent(textVal)}`;
      await Linking.openURL(url);
    } catch (err) {
      try {
        const webUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Join "${meeting?.title}":\n${meeting?.link || ''}`)}`;
        await Linking.openURL(webUrl);
      } catch (e) {
        await shareViaGeneral(meeting);
      }
    }
  };

  const shareViaTelegram = async (meeting) => {
    try {
      const textVal = `Join my meeting "${meeting?.title}":\n${meeting?.link || ''}`;
      const url = `tg://msg?text=${encodeURIComponent(textVal)}`;
      await Linking.openURL(url);
    } catch (err) {
      try {
        const webUrl = `https://telegram.me/share/url?url=${encodeURIComponent(meeting?.link || '')}&text=${encodeURIComponent(`Join "${meeting?.title}"`)}`;
        await Linking.openURL(webUrl);
      } catch (e) {
        await shareViaGeneral(meeting);
      }
    }
  };

  const shareViaGeneral = async (meeting) => {
    const { Share } = require('react-native');
    await Share.share({ message: `Join "${meeting?.title}":\n${meeting?.link || ''}` });
  };

  const c = colors;
  const bg = c.bg; const card = c.bgCard; const border = c.border;
  const text = c.text; const textSec = c.textSecondary; const textMut = c.textMuted;
  const primary = c.primary; const green = c.accentGreen; const red = c.accentRed;

  return (
    <View style={[styles.mainContainer, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        {/* ── Hero Branding Section (No waving emoji, uses real hi logo image) ── */}
        <View style={styles.dashboardHero}>
          <View style={styles.welcomeRow}>
            <Text style={[styles.heroWelcome, { color: text }]}>Welcome to</Text>
            <Image source={hiLogo} style={styles.topLogoBrand} resizeMode="contain" />
          </View>
          <Text style={[styles.heroSubtitle, { color: textSec }]}>
            Premium video conferencing — secure,{'\n'}simple, and stunning.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: text }]}>Quick Actions</Text>

        {/* ── Join Input ── */}
        <View style={styles.joinInputRow}>
          <View style={[styles.joinSearchWrap, { backgroundColor: card, borderColor: border }]}>
            <Keyboard size={18} color={textMut} />
            <TextInput
              style={[styles.joinTextInput, { color: text }]}
              placeholder="Enter a code or link"
              placeholderTextColor={textMut}
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={handleJoinMeeting}
            />
          </View>
          <TouchableOpacity style={[styles.joinButton, { backgroundColor: card, borderColor: border }]} onPress={handleJoinMeeting}>
            <Text style={[styles.joinButtonText, { color: textSec }]}>Join</Text>
          </TouchableOpacity>
        </View>

        {/* ── Action Cards ── */}
        <View style={styles.actionsPanel}>
          <TouchableOpacity style={[styles.actionCard, { backgroundColor: primary }]} onPress={handleInstantMeeting} disabled={creating}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              {creating ? <ActivityIndicator size="small" color="#fff" /> : <Video size={22} color="#fff" />}
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={[styles.actionTitle, { color: '#fff' }]}>New Meeting</Text>
              <Text style={[styles.actionDesc, { color: 'rgba(255,255,255,0.8)' }]}>Start instantly</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard, { backgroundColor: card, borderColor: border, borderWidth: 1 }]} onPress={() => openScheduleModal(false)}>
            <View style={[styles.iconWrap, { backgroundColor: green + '22' }]}><Calendar size={22} color={green} /></View>
            <View style={styles.actionTextWrap}>
              <Text style={[styles.actionTitle, { color: text }]}>Schedule</Text>
              <Text style={[styles.actionDesc, { color: textSec }]}>Plan ahead</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard, { backgroundColor: card, borderColor: border, borderWidth: 1 }]} onPress={() => openScheduleModal(true)}>
            <View style={[styles.iconWrap, { backgroundColor: red + '22' }]}><Clock size={22} color={red} /></View>
            <View style={styles.actionTextWrap}>
              <Text style={[styles.actionTitle, { color: text }]}>Consultation</Text>
              <Text style={[styles.actionDesc, { color: textSec }]}>Timed session</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Instant Meeting Link Box ── */}
        {linkBox && (
          <View style={[styles.linkBoxCard, { backgroundColor: card, borderColor: border }]}>
            <Text style={[styles.linkBoxTitle, { color: textSec }]}>Share this link to invite others</Text>
            <View style={[styles.linkBoxRow, { backgroundColor: bg }]}>
              <Text numberOfLines={1} style={[styles.linkBoxCode, { color: primary }]}>{linkBox.link}</Text>
              <TouchableOpacity onPress={() => copyLink(linkBox.link)}><Copy size={16} color={primary} /></TouchableOpacity>
            </View>
            <View style={styles.linkBoxActions}>
              <TouchableOpacity style={[styles.linkBoxBtnSec, { borderColor: border }]} onPress={() => setLinkBox(null)}>
                <Text style={[styles.linkBoxBtnSecText, { color: text }]}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.linkBoxBtnPri, { backgroundColor: primary }]}
                onPress={() => { const room = linkBox.roomName; setLinkBox(null); navigate('MeetingRoom', { roomName: room, isHost: true }); }}>
                <Text style={styles.linkBoxBtnPriText}>Join Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Upcoming Meetings ── */}
        <Text style={[styles.sectionTitle, { color: text, marginTop: linkBox ? 8 : 0 }]}>
          Upcoming Meetings{upcomingMeetings.length > 0 ? ` (${upcomingMeetings.length})` : ''}
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={primary} style={{ marginTop: 20 }} />
        ) : upcomingMeetings.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: card, borderColor: border }]}>
            <Calendar size={48} color={textMut} />
            <Text style={[styles.emptyTitle, { color: text }]}>No upcoming meetings</Text>
            <Text style={[styles.emptyText, { color: textSec }]}>Schedule or start a meeting instantly</Text>
          </View>
        ) : (
          upcomingMeetings.map((meeting) => {
            const isHost = meeting.userId === user?.id || meeting.userId === user?._id;
            return (
              <View key={meeting.id} style={[styles.meetingCard, { backgroundColor: card, borderColor: border }]}>
                <View style={styles.meetingCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                    <Text style={[styles.meetingTitle, { color: text }]} numberOfLines={1}>{meeting.title}</Text>
                    
                    {/* (i) Info icon to toggle description */}
                    <TouchableOpacity onPress={() => {
                      setShowDescId(prev => prev === meeting.id ? null : meeting.id);
                      setShowParticipantsId(null);
                    }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: primary, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: primary, fontSize: 10, fontWeight: '900' }}>i</Text>
                      </View>
                    </TouchableOpacity>

                    {/* (?) Help icon to toggle participant list */}
                    <TouchableOpacity onPress={() => {
                      setShowParticipantsId(prev => prev === meeting.id ? null : meeting.id);
                      setShowDescId(null);
                    }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: textMut, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: textMut, fontSize: 10, fontWeight: '900' }}>?</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.badge, { backgroundColor: meeting.isConsultation ? red + '22' : primary + '22' }]}>
                    <Text style={[styles.badgeText, { color: meeting.isConsultation ? red : primary }]}>
                      {meeting.status === 'scheduled' ? 'Upcoming' : meeting.status}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.meetingDetailsBlock}>
                  <View style={styles.detailRow}>
                    <Calendar size={14} color={textMut} />
                    <Text style={[styles.detailText, { color: textSec }]}>{formatMeetingDate(meeting.startTime)}</Text>
                  </View>
                  {meeting.duration != null && (
                    <View style={styles.detailRow}>
                      <Clock size={14} color={textMut} />
                      <Text style={[styles.detailText, { color: textSec }]}>{getDurationLabel(meeting.duration)}</Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailText, { color: textSec }]}>👥 {meeting.participants?.length > 0 ? `${meeting.participants.length} participants` : 'No participants'}</Text>
                  </View>
                </View>

                {/* Description Box (Toggled by Info Icon) */}
                {showDescId === meeting.id && (
                  <View style={{ backgroundColor: theme === 'light' ? '#f3f4f6' : '#1e1e2e', padding: 12, borderRadius: 10, marginBottom: 12 }}>
                    <Text style={{ color: textSec, fontSize: 13 }}>{meeting.description || 'No description provided.'}</Text>
                  </View>
                )}

                {/* Participants Box (Toggled by Help Icon) */}
                {showParticipantsId === meeting.id && (
                  <View style={{ backgroundColor: theme === 'light' ? '#f3f4f6' : '#1e1e2e', padding: 12, borderRadius: 10, marginBottom: 12 }}>
                    <Text style={{ color: text, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>Invited Participants:</Text>
                    {meeting.participants && meeting.participants.length > 0 ? (
                      meeting.participants.map((p, idx) => (
                        <Text key={idx} style={{ color: textSec, fontSize: 12, marginVertical: 2 }}>
                          • {p.email} {p.name ? `(${p.name})` : ''}
                        </Text>
                      ))
                    ) : (
                      <Text style={{ color: textMut, fontSize: 12 }}>No participants added</Text>
                    )}
                  </View>
                )}

                <View style={styles.cardActions}>
                  <TouchableOpacity style={[styles.cardBtnJoin, { backgroundColor: green }]}
                    onPress={() => navigate('MeetingRoom', { roomName: meeting.roomName, isHost })}>
                    <Video size={14} color="#fff" />
                    <Text style={styles.cardBtnJoinText}>Join</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cardBtnIcon, { borderColor: border, backgroundColor: card }]}
                    onPress={() => copyLink(meeting.link || `https://hi-video.conferencing/meeting/${meeting.roomName}`)}>
                    <Copy size={13} color={text} />
                    <Text style={[styles.cardBtnIconText, { color: textSec }]}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cardBtnIcon, { borderColor: border, backgroundColor: card }]}
                    onPress={() => openInviteModal(meeting)}>
                    <ExternalLink size={13} color={text} />
                    <Text style={[styles.cardBtnIconText, { color: textSec }]}>Invite</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cardBtnIcon, { borderColor: 'transparent', backgroundColor: 'transparent' }]}
                    onPress={() => handleCancel(meeting.id)}>
                    <Text style={[styles.cardBtnIconText, { color: red, fontSize: 12, fontWeight: '700' }]}>✕ Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Toast */}
      {toast !== '' && (
        <View style={[styles.toast, { backgroundColor: theme === 'light' ? '#fff' : '#27272a' }]}>
          <Text style={[styles.toastText, { color: text }]}>{toast}</Text>
        </View>
      )}

      {/* ══════════ SCHEDULE MODAL ══════════ */}
      <Modal animationType="slide" transparent visible={schedModalVisible} onRequestClose={() => setSchedModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: theme === 'light' ? '#f1f3f8' : '#1a1a2e', borderColor: border, maxHeight: '94%' }]}>
            <View style={[styles.modalHeaderRow, { borderBottomColor: border }]}>
              <Text style={[styles.modalHeading, { color: text }]}>{schedConsultation ? 'Schedule Consultation' : 'Schedule Meeting'}</Text>
              <TouchableOpacity onPress={() => setSchedModalVisible(false)}><X size={22} color={textMut} /></TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Meeting Title */}
              <Text style={[styles.fieldLabel, { color: textSec }]}>Meeting Title</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: bg, borderColor: border, color: text }]}
                placeholder="Add title"
                placeholderTextColor={textMut}
                value={schedTitle}
                onChangeText={setSchedTitle}
              />

              {/* Start Time */}
              <Text style={[styles.fieldLabel, { color: textSec }]}>Start Time</Text>
              <TouchableOpacity
                style={[styles.fieldInputRow, { backgroundColor: bg, borderColor: showCalendar ? primary : border }]}
                onPress={() => { setShowCalendar(v => !v); setShowDuration(false); setShowNotif(false); setShowRepeat(false); }}
              >
                <Calendar size={16} color={textMut} />
                <Text style={[styles.fieldInputRowText, { color: text }]}>{formatDate(schedDate)}</Text>
              </TouchableOpacity>
              {showCalendar && (
                <View style={{ marginBottom: 12 }}>
                  <CalendarPicker
                    date={schedDate}
                    onChange={(d) => setSchedDate(d)}
                    onClose={() => setShowCalendar(false)}
                    colors={c}
                    theme={theme}
                  />
                </View>
              )}

              {/* Duration */}
              <Text style={[styles.fieldLabel, { color: textSec }]}>Duration</Text>
              <TouchableOpacity
                style={[styles.fieldInputRow, { backgroundColor: bg, borderColor: showDuration ? primary : border }]}
                onPress={() => { setShowDuration(v => !v); setShowCalendar(false); setShowNotif(false); setShowRepeat(false); }}
              >
                <Text style={[styles.fieldInputRowText, { color: text }]}>{getEndTimeLabel()}</Text>
                <ChevronDown size={16} color={textMut} />
              </TouchableOpacity>
              {showDuration && (
                <View style={{ marginBottom: 4 }}>
                  <DurationPicker
                    startDate={schedDate}
                    durationMin={schedDurationMin}
                    onChange={(m) => setSchedDurationMin(m)}
                    onClose={() => setShowDuration(false)}
                    colors={c}
                    theme={theme}
                  />
                </View>
              )}
              <TouchableOpacity style={{ alignSelf: 'flex-end', marginBottom: 14 }} onPress={() => { setShowDuration(true); }}>
                <Text style={{ color: primary, fontSize: 12, fontWeight: '600' }}>Custom duration...</Text>
              </TouchableOpacity>

              {/* India Standard Time (Search & Select Timezone) */}
              <TouchableOpacity
                style={[styles.infoRow, { marginBottom: 12 }]}
                onPress={() => setShowTimezoneModal(true)}
              >
                <Globe size={16} color={primary} />
                <Text style={[styles.infoRowText, { color: primary }]}>{getTimezoneLabel(timezone)}</Text>
              </TouchableOpacity>

              {/* Custom Reminder alert container block */}
              <View style={[styles.infoRow, { marginBottom: 8 }]}>
                <Bell size={16} color={textMut} />
                <Text style={[styles.infoRowText, { color: textSec }]}>{notifLabel}</Text>
                <TouchableOpacity style={{ marginLeft: 'auto' }}
                  onPress={() => { setShowNotif(v => !v); setShowCalendar(false); setShowDuration(false); setShowRepeat(false); }}>
                  <Text style={{ color: primary, fontSize: 13, fontWeight: '700' }}>
                    {showNotif ? 'Done' : 'Add Notification'}
                  </Text>
                </TouchableOpacity>
              </View>
              {showNotif && (
                <View style={{ marginBottom: 16 }}>
                  <NotifPicker
                    amount={notifAmount}
                    unit={notifUnit}
                    type={notifType}
                    onChange={(v) => { setNotifAmount(v.amount); setNotifUnit(v.unit); setNotifType(v.type); }}
                    onClose={() => setShowNotif(false)}
                    colors={c}
                    theme={theme}
                  />
                </View>
              )}

              {/* Repeat */}
              <Text style={[styles.fieldLabel, { color: textSec, marginTop: 4 }]}>Repeat</Text>
              <TouchableOpacity
                style={[styles.fieldInputRow, { backgroundColor: bg, borderColor: showRepeat ? primary : border, marginBottom: 16 }]}
                onPress={() => { setShowRepeat(v => !v); setShowCalendar(false); setShowDuration(false); setShowNotif(false); }}
              >
                <Text style={[styles.fieldInputRowText, { color: text }]}>{repeat}</Text>
                <ChevronDown size={16} color={textMut} />
              </TouchableOpacity>
              {showRepeat && (
                <View style={[styles.dropdownMenu, { backgroundColor: bg, borderColor: border, marginBottom: 14 }]}>
                  {REPEAT_OPTIONS.map(o => (
                    <TouchableOpacity key={o} style={[styles.dropdownItem, { borderBottomColor: border }]}
                      onPress={() => { setRepeat(o); setShowRepeat(false); }}>
                      <Text style={[styles.dropdownItemText, { color: text, fontWeight: repeat === o ? '700' : '400' }]}>{o}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Description */}
              <Text style={[styles.fieldLabel, { color: textSec }]}>Description</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: bg, borderColor: border, color: text, height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                placeholder="Add description..."
                placeholderTextColor={textMut}
                value={schedDesc}
                onChangeText={setSchedDesc}
                multiline
              />

              {/* Meeting Privacy */}
              <View style={[styles.privacyBox, { borderColor: border, backgroundColor: bg }]}>
                <Text style={[styles.privacyTitle, { color: text }]}>Meeting Privacy</Text>
                <TouchableOpacity style={styles.radioRow} onPress={() => setSchedPrivacy('public')}>
                  <View style={[styles.radioOuter, { borderColor: schedPrivacy === 'public' ? primary : border }]}>
                    {schedPrivacy === 'public' && <View style={[styles.radioInner, { backgroundColor: primary }]} />}
                  </View>
                  <Text style={[styles.radioLabel, { color: text }]}>Public</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.radioRow} onPress={() => setSchedPrivacy('private')}>
                  <View style={[styles.radioOuter, { borderColor: schedPrivacy === 'private' ? primary : border }]}>
                    {schedPrivacy === 'private' && <View style={[styles.radioInner, { backgroundColor: primary }]} />}
                  </View>
                  <Text style={[styles.radioLabel, { color: text }]}>Private</Text>
                </TouchableOpacity>
              </View>

              {/* Add Participants */}
              <Text style={[styles.fieldLabel, { color: textSec }]}>Add Participants</Text>
              <View style={[styles.chipInputWrap, { backgroundColor: bg, borderColor: border }]}>
                {schedParticipants.map(email => (
                  <TouchableOpacity key={email} style={[styles.chip, { backgroundColor: primary + '22' }]} onPress={() => setSchedParticipants(p => p.filter(e => e !== email))}>
                    <Text style={[styles.chipText, { color: primary }]}>{email}</Text>
                    <Text style={[styles.chipX, { color: primary }]}>×</Text>
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={[styles.chipInput, { color: text, flex: 1, minWidth: 150 }]}
                  placeholder="Enter email and press Enter"
                  placeholderTextColor={textMut}
                  value={participantInput}
                  onChangeText={setParticipantInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={addParticipant}
                  blurOnSubmit={false}
                />
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={[styles.modalFooter, { borderTopColor: border }]}>
              <TouchableOpacity style={[styles.modalBtnCancel, { borderColor: border }]} onPress={() => setSchedModalVisible(false)}>
                <Text style={[styles.modalBtnCancelText, { color: text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnSubmit, { backgroundColor: primary }]} onPress={handleScheduleSubmit} disabled={creating}>
                {creating ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalBtnSubmitText}>{schedConsultation ? 'Schedule Consultation' : 'Schedule Meeting'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════ TIMEZONE PICKER MODAL (Search & Paginated) ══════════ */}
      {showTimezoneModal && (
        <Modal animationType="fade" transparent visible={showTimezoneModal} onRequestClose={() => setShowTimezoneModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalSheet, { backgroundColor: theme === 'light' ? '#f1f3f8' : '#1a1a2e', borderColor: border, height: '70%' }]}>
              <View style={[styles.modalHeaderRow, { borderBottomColor: border }]}>
                <Text style={[styles.modalHeading, { color: text }]}>Select Timezone</Text>
                <TouchableOpacity onPress={() => setShowTimezoneModal(false)}><X size={22} color={textMut} /></TouchableOpacity>
              </View>
              <View style={{ padding: 20 }}>
                {/* Search input box */}
                <View style={[styles.joinSearchWrap, { backgroundColor: bg, borderColor: border, marginBottom: 16 }]}>
                  <Keyboard size={18} color={textMut} />
                  <TextInput
                    style={[styles.joinTextInput, { color: text }]}
                    placeholder="Search timezone..."
                    placeholderTextColor={textMut}
                    value={tzSearch}
                    onChangeText={(val) => { setTzSearch(val); setTzPage(1); }}
                  />
                </View>

                {/* Paginated List */}
                <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                  {paginatedTzs.map((tz) => (
                    <TouchableOpacity
                      key={tz.zone}
                      style={{ paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                      onPress={() => { setTimezone(tz.zone); setShowTimezoneModal(false); }}
                    >
                      <View>
                        <Text style={{ color: text, fontSize: 14, fontWeight: '600' }}>{tz.label}</Text>
                        <Text style={{ color: textMut, fontSize: 12 }}>{tz.zone}</Text>
                      </View>
                      {timezone === tz.zone && <Text style={{ color: primary, fontWeight: '700', fontSize: 16 }}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Pagination Controls */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 18 }}>
                  <TouchableOpacity onPress={() => setTzPage(p => Math.max(1, p - 1))} disabled={tzPage === 1}>
                    <ChevronLeft size={20} color={tzPage === 1 ? textMut : text} />
                  </TouchableOpacity>
                  <Text style={{ color: text, fontSize: 14, fontWeight: '600' }}>{tzPage} of {tzTotalPages}</Text>
                  <TouchableOpacity onPress={() => setTzPage(p => Math.min(tzTotalPages, p + 1))} disabled={tzPage === tzTotalPages}>
                    <ChevronRight size={20} color={tzPage === tzTotalPages ? textMut : text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ══════════ INVITE MODAL (Platform Real Logos) ══════════ */}
      <Modal animationType="slide" transparent visible={inviteModalVisible} onRequestClose={() => setInviteModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.inviteSheet, { backgroundColor: theme === 'light' ? '#f1f3f8' : '#1a1a2e', borderColor: border }]}>
            <View style={[styles.modalHeaderRow, { borderBottomColor: border }]}>
              <Text style={[styles.modalHeading, { color: text }]}>Invite People</Text>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)}><X size={22} color={textMut} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
              <View style={[styles.inviteLinkBox, { backgroundColor: bg, borderColor: border }]}>
                <Text style={[styles.inviteLinkText, { color: primary }]} numberOfLines={3}>{inviteMeeting?.link || ''}</Text>
                <TouchableOpacity style={[styles.inviteCopyBtn, { backgroundColor: primary }]} onPress={() => copyLink(inviteMeeting?.link || '')}>
                  <Copy size={16} color="#fff" />
                  <Text style={styles.inviteCopyBtnText}>Copy</Text>
                </TouchableOpacity>
              </View>

              {/* Share Options Grid with Real Logos */}
              <View style={styles.shareGrid}>
                <TouchableOpacity style={[styles.shareOption, { backgroundColor: bg, borderColor: border }]} onPress={() => shareViaEmail(inviteMeeting)}>
                  <GmailIcon />
                  <Text style={[styles.shareOptionText, { color: text }]}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.shareOption, { backgroundColor: bg, borderColor: border }]} onPress={() => shareViaCalendar(inviteMeeting)}>
                  <CalendarIcon />
                  <Text style={[styles.shareOptionText, { color: text }]}>Calendar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.shareOption, { backgroundColor: bg, borderColor: border }]} onPress={() => shareViaWhatsApp(inviteMeeting)}>
                  <WhatsAppIcon />
                  <Text style={[styles.shareOptionText, { color: text }]}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.shareOption, { backgroundColor: bg, borderColor: border }]} onPress={() => shareViaTelegram(inviteMeeting)}>
                  <TelegramIcon />
                  <Text style={[styles.shareOptionText, { color: text }]}>Telegram</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity style={[styles.qrTile, { backgroundColor: bg, borderColor: border }]} onPress={() => setShowQR(v => !v)}>
                <QRIcon />
                <Text style={[styles.shareOptionText, { color: text }]}>{showQR ? 'Hide QR Code' : 'Show QR Code'}</Text>
              </TouchableOpacity>
              
              {showQR && (
                <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 20, padding: 16, backgroundColor: theme === 'light' ? '#fff' : '#1e1e2e', borderRadius: 14, borderWidth: 1, borderColor: border }}>
                  <Image
                    source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteMeeting?.link || '')}` }}
                    style={{ width: 180, height: 180 }}
                    resizeMode="contain"
                  />
                  <Text style={{ color: textMut, fontSize: 11, marginTop: 8 }}>Scan this QR code to join instantly</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  scrollContainer: { padding: 20, paddingBottom: 40 },
  dashboardHero: { paddingVertical: 20, marginBottom: 8 },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  heroWelcome: { fontSize: 28, fontWeight: '700' },
  topLogoBrand: { width: 48, height: 32, marginLeft: 8 },
  heroSubtitle: { fontSize: 15, lineHeight: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 14 },
  joinInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  joinSearchWrap: { flex: 1, flexDirection: 'row', height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  joinTextInput: { flex: 1, fontSize: 14 },
  joinButton: { width: 72, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  joinButtonText: { fontSize: 14, fontWeight: '600' },
  actionsPanel: { gap: 12, marginBottom: 24 },
  actionCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 16, gap: 16 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionTextWrap: { flex: 1 },
  actionTitle: { fontSize: 16, fontWeight: '700' },
  actionDesc: { fontSize: 12, marginTop: 2 },
  linkBoxCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 24 },
  linkBoxTitle: { fontSize: 12, marginBottom: 10 },
  linkBoxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 12, height: 40, marginBottom: 14 },
  linkBoxCode: { fontSize: 12, flex: 1, marginRight: 8 },
  linkBoxActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  linkBoxBtnSec: { height: 36, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  linkBoxBtnSecText: { fontSize: 13, fontWeight: '600' },
  linkBoxBtnPri: { height: 36, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  linkBoxBtnPriText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  emptyState: { borderWidth: 1, borderRadius: 20, padding: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  meetingCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  meetingCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  meetingTitle: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  meetingDetailsBlock: { gap: 6, marginBottom: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardBtnJoin: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 10 },
  cardBtnJoinText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cardBtnIcon: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 36, borderRadius: 10, borderWidth: 1 },
  cardBtnIconText: { fontSize: 12, fontWeight: '600' },
  toast: { position: 'absolute', bottom: 30, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  toastText: { fontSize: 13, fontWeight: '600' },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, maxHeight: '94%' },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  modalHeading: { fontSize: 18, fontWeight: '700' },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 2 },
  fieldInput: { borderWidth: 1, borderRadius: 12, height: 48, paddingHorizontal: 14, fontSize: 14, marginBottom: 14 },
  fieldInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, height: 48, paddingHorizontal: 14, gap: 8, marginBottom: 4 },
  fieldInputRowText: { flex: 1, fontSize: 14 },
  dropdownMenu: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  dropdownItemText: { fontSize: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoRowText: { fontSize: 13, fontWeight: '600' },
  privacyBox: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16 },
  privacyTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  radioLabel: { fontSize: 15, fontWeight: '500' },
  chipInputWrap: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: 12, padding: 8, gap: 6, minHeight: 48, marginBottom: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, gap: 4 },
  chipText: { fontSize: 12, fontWeight: '600' },
  chipX: { fontSize: 16, lineHeight: 20 },
  chipInput: { fontSize: 13, paddingVertical: 4 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 28, borderTopWidth: StyleSheet.hairlineWidth },
  modalBtnCancel: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancelText: { fontSize: 15, fontWeight: '600' },
  modalBtnSubmit: { flex: 2, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalBtnSubmitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // Invite modal
  inviteSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, maxHeight: '85%' },
  inviteLinkBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 14, gap: 10, marginBottom: 20 },
  inviteLinkText: { flex: 1, fontSize: 12, lineHeight: 18 },
  inviteCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  inviteCopyBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  shareGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12, justifyContent: 'space-between' },
  shareOption: { width: '47%', paddingVertical: 20, borderWidth: 1, borderRadius: 14, alignItems: 'center', gap: 8, marginBottom: 12 },
  shareOptionText: { fontSize: 13, fontWeight: '600' },
  qrTile: { paddingVertical: 20, borderWidth: 1, borderRadius: 14, alignItems: 'center', gap: 8 },
});
