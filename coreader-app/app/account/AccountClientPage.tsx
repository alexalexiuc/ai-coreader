'use client';

import { useState } from 'react';
import { PageContainer } from '@/ui/PageContainer';
import { User } from '../contexts/AuthContext';
import { ChangePasswordForm } from './ChangePasswordForm';
import { ProfileForm } from './ProfileForm';

interface AccountClientPageProps {
  user: User;
}

export function AccountClientPage({ user }: AccountClientPageProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Personal Cabinet</h1>
        <p className="mt-2 text-sm text-gray-400">Manage your account settings and security</p>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
        {/* Account Info */}
        <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <div className="text-sm text-gray-400">Email</div>
          <div className="mt-1 text-white">{user.email}</div>
          <div className="mt-3 text-sm text-gray-400">Account Created</div>
          <div className="mt-1 text-white">{new Date(user.createdAt).toLocaleDateString()}</div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === 'profile' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === 'password' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Change Password
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'profile' && <ProfileForm user={user} />}
        {activeTab === 'password' && <ChangePasswordForm />}
      </div>
    </PageContainer>
  );
}
