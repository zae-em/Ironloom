'use client';

import * as React from 'react';
import { getSupabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../../components/ui/card';
import { toast } from 'sonner';
import { KeyRound, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [isSent, setIsSent] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error && !error.message.includes('fetch')) {
        throw error;
      }

      setIsSent(true);
      toast.success('Password reset instructions sent to your email.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl border-border bg-card/90 backdrop-blur-md">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2 shadow-sm">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Reset Password</CardTitle>
          <CardDescription>
            Enter your account email to receive recovery instructions
          </CardDescription>
        </CardHeader>

        {isSent ? (
          <CardContent className="space-y-4 text-center">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-400">
              Check your inbox for <strong>{email}</strong>. We&apos;ve sent a secure reset link.
            </div>
            <a href="/login" className="inline-flex items-center text-xs text-primary hover:underline pt-2">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Sign In
            </a>
          </CardContent>
        ) : (
          <form onSubmit={handleResetRequest}>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Account Email</label>
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-3 pt-2">
              <Button type="submit" className="w-full font-semibold" isLoading={isLoading}>
                Send Recovery Instructions
              </Button>
              <a href="/login" className="inline-flex items-center justify-center text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Sign In
              </a>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
