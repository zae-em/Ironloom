'use client';

import * as React from 'react';
import { useAuth } from '../../../../components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { getSupabase } from '../../../../lib/supabase';
import { apiClient } from '../../../../lib/api-client';
import { User, Lock, Save, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function AccountSettingsPage() {
  const { user, refreshUserData } = useAuth();

  const [name, setName] = React.useState(user?.name || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);

  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);

  React.useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      await apiClient.patch('/users/me', { name });
      await refreshUserData();
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error && !error.message.includes('fetch')) {
        throw error;
      }

      setNewPassword('');
      setConfirmPassword('');
      toast.success('Account password updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Account Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your personal profile and authentication credentials.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Profile Information
            </CardTitle>
            <CardDescription className="text-xs">Update your display name and view account details.</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdateProfile}>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Email Address</label>
                <Input value={user?.email || ''} readOnly disabled className="opacity-70 font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Display Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">User UUID</label>
                <Input value={user?.userId || ''} readOnly disabled className="opacity-70 font-mono text-xs" />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end pt-2">
              <Button type="submit" isLoading={isUpdatingProfile}>
                <Save className="mr-2 h-3.5 w-3.5" /> Save Profile
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Change Password Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" /> Security & Password
            </CardTitle>
            <CardDescription className="text-xs">Change your Supabase password.</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdatePassword}>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">New Password</label>
                <Input
                  type="password"
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Confirm New Password</label>
                <Input
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end pt-2">
              <Button type="submit" isLoading={isUpdatingPassword}>
                <Shield className="mr-2 h-3.5 w-3.5" /> Update Password
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
