export function generateRoomName(): string {
  const adjectives = ['swift', 'bright', 'cool', 'keen', 'bold', 'calm', 'fair', 'glad', 'kind', 'warm'];
  const nouns = ['falcon', 'river', 'summit', 'cloud', 'spark', 'orbit', 'pulse', 'nexus', 'prism', 'forge'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${adj}-${noun}-${num}`;
}

export function generateMeetingId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const seg = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg(3)}-${seg(4)}-${seg(3)}`;
}

export function getMeetingLink(roomName: string): string {
  return `${window.location.origin}/meeting/${roomName}`;
}

export function extractRoomFromLink(input: string): string | null {
  const trimmed = input.trim();
  let room = trimmed;
  
  if (trimmed.includes('/meeting/')) {
    const parts = trimmed.split('/meeting/');
    room = parts[1]?.split('?')[0] || '';
  }
  
  // Valid patterns: word-word-1234 OR abc-defg-hij
  if (/^[a-zA-Z]+-[a-zA-Z]+-\d+$/.test(room) || /^[a-zA-Z]{3}-[a-zA-Z]{4}-[a-zA-Z]{3}$/.test(room)) {
    return room;
  }
  
  return null;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
