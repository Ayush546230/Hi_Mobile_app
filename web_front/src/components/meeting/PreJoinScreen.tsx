import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, VideoIcon, VideoOff, ArrowRight } from 'lucide-react';
import { useMeetings } from '../../context/MeetingContext';

interface Props {
  roomName: string;
  displayName: string;
  onJoin: (audioOn: boolean, videoOn: boolean) => void;
  onDisplayNameChange: (name: string) => void;
}

export default function PreJoinScreen({ roomName, displayName, onJoin, onDisplayNameChange }: Props) {
  const { userPreferences } = useMeetings();
  const [audioOn, setAudioOn] = useState(userPreferences.micDefault);
  const [videoOn, setVideoOn] = useState(userPreferences.cameraDefault);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync when preferences load
  useEffect(() => {
    setAudioOn(userPreferences.micDefault);
    setVideoOn(userPreferences.cameraDefault);
  }, [userPreferences.micDefault, userPreferences.cameraDefault]);

  useEffect(() => {
    if (videoOn) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => setVideoOn(false));
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [videoOn]);

  return (
    <div className="pre-join">
      <div className="pre-join-card">
        <h2>Ready to join?</h2>
        <p style={{ fontFamily: 'monospace', color: 'var(--primary)', fontSize: '0.85rem' }}>{roomName}</p>
        <div className="preview-box">
          {videoOn ? (
            <video ref={videoRef} autoPlay muted playsInline style={{ transform: 'scaleX(-1)' }} />
          ) : (
            <div className="no-video">
              <VideoOff size={40} />
              <span>Camera is off</span>
            </div>
          )}
        </div>
        <div className="preview-controls">
          <button
            className={`preview-control-btn ${audioOn ? 'on' : 'off'}`}
            onClick={() => setAudioOn(!audioOn)}
            title={audioOn ? 'Mute mic' : 'Unmute mic'}
          >
            {audioOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button
            className={`preview-control-btn ${videoOn ? 'on' : 'off'}`}
            onClick={() => setVideoOn(!videoOn)}
            title={videoOn ? 'Turn off camera' : 'Turn on camera'}
          >
            {videoOn ? <VideoIcon size={20} /> : <VideoOff size={20} />}
          </button>
        </div>
        <div className="form-group">
          <input
            className="form-input"
            placeholder="Your name"
            value={displayName}
            onChange={e => onDisplayNameChange(e.target.value)}
            style={{ textAlign: 'center' }}
          />
        </div>
        <button className="btn btn-green" onClick={() => onJoin(audioOn, videoOn)} style={{ width: '100%', justifyContent: 'center' }}>
          Join now <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
