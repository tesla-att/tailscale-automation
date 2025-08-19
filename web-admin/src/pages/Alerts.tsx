import React, { useState } from "react";

const NotificationCard = ({ 
  title, 
  description, 
  icon, 
  enabled, 
  onToggle 
}: { 
  title: string; 
  description: string; 
  icon: React.ReactNode; 
  enabled: boolean; 
  onToggle: () => void; 
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6">
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg text-white">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-gray-600 text-sm">{description}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  </div>
);

const Icons = {
  Telegram: () => (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.91 3.79L20.3 20.84c-.25 1.21-.98 1.5-2 .94l-5.5-4.07-2.66 2.57c-.3.3-.55.55-1.1.55-.72 0-.6-.27-.84-.95L6.3 13.7l-5.45-1.7c-1.18-.35-1.19-1.16.26-1.75l21.26-8.2c.97-.43 1.9.24 1.53 1.73z"/>
    </svg>
  ),
  Discord: () => (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  ),
  Email: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Webhook: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

export default function Alerts() {
  const [notifications, setNotifications] = useState({
    telegram: true,
    discord: false,
    email: true,
    webhook: false,
  });

  const handleToggle = (type: string) => {
    setNotifications(prev => ({
      ...prev,
      [type]: !prev[type as keyof typeof prev]
    }));
  };

  const notificationTypes = [
    {
      id: 'telegram',
      title: 'Telegram Notifications',
      description: 'Get notified about key operations via Telegram bot',
      icon: <Icons.Telegram />,
      enabled: notifications.telegram,
    },
    {
      id: 'discord',
      title: 'Discord Notifications', 
      description: 'Send alerts to Discord channel via webhook',
      icon: <Icons.Discord />,
      enabled: notifications.discord,
    },
    {
      id: 'email',
      title: 'Email Notifications',
      description: 'Receive notifications via email for important events',
      icon: <Icons.Email />,
      enabled: notifications.email,
    },
    {
      id: 'webhook',
      title: 'Custom Webhook',
      description: 'Send data to your custom endpoint for processing',
      icon: <Icons.Webhook />,
      enabled: notifications.webhook,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts & Notifications</h1>
          <p className="text-gray-600">Configure how you want to be notified about system events</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700">
          <Icons.Settings />
          <span>Settings</span>
        </button>
      </div>

      {/* Alert Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {notificationTypes.map((type) => (
          <NotificationCard
            key={type.id}
            title={type.title}
            description={type.description}
            icon={type.icon}
            enabled={type.enabled}
            onToggle={() => handleToggle(type.id)}
          />
        ))}
      </div>

      {/* Event Types */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Events</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
            <div>
              <h3 className="font-medium text-gray-900">API Key Created</h3>
              <p className="text-sm text-gray-600">When a new API key is generated</p>
            </div>
            <span className="text-green-600 text-sm font-medium">Active</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
            <div>
              <h3 className="font-medium text-gray-900">API Key Rotated</h3>
              <p className="text-sm text-gray-600">When an API key is rotated or renewed</p>
            </div>
            <span className="text-green-600 text-sm font-medium">Active</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
            <div>
              <h3 className="font-medium text-gray-900">API Key Revoked</h3>
              <p className="text-sm text-gray-600">When an API key is revoked or deleted</p>
            </div>
            <span className="text-green-600 text-sm font-medium">Active</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
            <div>
              <h3 className="font-medium text-gray-900">Device Connected</h3>
              <p className="text-sm text-gray-600">When a new device joins the network</p>
            </div>
            <span className="text-gray-400 text-sm font-medium">Inactive</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <h3 className="font-medium text-gray-900">Security Alert</h3>
              <p className="text-sm text-gray-600">Suspicious activity or failed authentication attempts</p>
            </div>
            <span className="text-red-600 text-sm font-medium">Critical</span>
          </div>
        </div>
      </div>

      {/* Configuration Info */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Configuration</h3>
            <p className="text-blue-800 text-sm mb-3">
              Notification settings are configured through environment variables on the server. 
              Make sure to set up your notification channels in the <code className="bg-blue-100 px-1 py-0.5 rounded">.env</code> file.
            </p>
            <div className="text-sm text-blue-700">
              <p><strong>Required variables:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><code>TELEGRAM_BOT_TOKEN</code> - Your Telegram bot token</li>
                <li><code>TELEGRAM_CHAT_ID</code> - Target chat ID for messages</li>
                <li><code>DISCORD_WEBHOOK_URL</code> - Discord webhook URL</li>
                <li><code>SMTP_HOST</code> - Email server configuration</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
