import React from 'react';
import { Mail, MessageSquare, Radio } from 'lucide-react';

// ── SMS counter helper ─────────────────────────────────────────
function SmsCounter({ text }) {
  const len   = text.length;
  const msgs  = len === 0 ? 1 : Math.ceil(len / 160);
  const isWarn = len >= 140;
  const isOver = len > 160;
  return (
    <div className={`flex justify-between text-xs mt-1.5 ${isOver ? 'text-orange-500' : isWarn ? 'text-yellow-500' : 'text-gray-400'}`}>
      <span>{isOver ? `${msgs} SMS messages` : isWarn ? `${160 - len} characters left` : `${len} characters`}</span>
      <span>{len} / {msgs * 160}</span>
    </div>
  );
}

// ── channel toggle ─────────────────────────────────────────────
const CHANNELS = [
  { id: 'email', label: 'Email only',   icon: Mail },
  { id: 'sms',   label: 'SMS only',     icon: MessageSquare },
  { id: 'both',  label: 'Both',         icon: Radio },
];

function ChannelToggle({ value, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
      {CHANNELS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
            value === id
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Icon size={15} />
          {label}
        </button>
      ))}
    </div>
  );
}

export default function ComposeMessage({ channel, setChannel, subject, setSubject, message, setMessage }) {
  const showSubject = channel === 'email' || channel === 'both';
  const showSmsHint = channel === 'sms'   || channel === 'both';

  return (
    <div className="space-y-6">
      {/* channel toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
        <ChannelToggle value={channel} onChange={setChannel} />
      </div>

      {/* subject — only for email / both */}
      {showSubject && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. New FlowFi Platform Update"
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-colors"
            required={showSubject}
          />
        </div>
      )}

      {/* message body */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Message{channel === 'both' ? ' (used for both email body and SMS text)' : ''}
        </label>
        <textarea
          rows={channel === 'sms' ? 4 : 6}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={channel === 'sms' ? 'Type your SMS message… (160 chars = 1 SMS)' : 'Type your message here…'}
          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-colors resize-y"
          required
        />
        {/* SMS counter */}
        {showSmsHint && <SmsCounter text={message} />}
        {channel === 'email' && (
          <p className="text-xs text-gray-400 mt-1.5">Email will be wrapped in the FlowFi branded template.</p>
        )}
      </div>
    </div>
  );
}
