'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Key, Eye, EyeOff, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { passwordApi } from '@/lib/api';
import { PasswordBreachResponse } from '@/lib/types';
import { toast } from 'sonner';

export default function PasswordsPage() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PasswordBreachResponse | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const calculateStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 8) strength += 25;
    if (pwd.length >= 12) strength += 25;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength += 25;
    if (/[0-9]/.test(pwd)) strength += 12.5;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength += 12.5;
    return Math.min(strength, 100);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordStrength(calculateStrength(value));
  };

  const handleCheckPassword = async () => {
    if (!password) {
      toast.error('Please enter a password');
      return;
    }

    setIsLoading(true);
    try {
      const response = await passwordApi.checkPassword(password);
      setResult(response);
      
      if (response.status === 'PWNED') {
        toast.error(`Password found in ${response.count} breaches!`);
      } else if (response.status === 'SAFE') {
        toast.success('Password is safe - not found in any breaches');
      }
    } catch (error) {
      toast.error('Failed to check password');
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength < 30) return 'bg-red-500';
    if (passwordStrength < 60) return 'bg-yellow-500';
    if (passwordStrength < 80) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    if (passwordStrength < 30) return 'Weak';
    if (passwordStrength < 60) return 'Fair';
    if (passwordStrength < 80) return 'Good';
    return 'Strong';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Password Security</h1>
        <p className="text-muted-foreground">
          Check if your password has been compromised and assess its strength
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Password Checker</CardTitle>
          <CardDescription>
            Test your password against known breach databases
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password to check"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {password && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Password Strength</span>
                <span className="font-medium">{getStrengthText()}</span>
              </div>
              <Progress value={passwordStrength} className="h-2" />
            </div>
          )}

          <Button onClick={handleCheckPassword} disabled={isLoading || !password}>
            {isLoading ? 'Checking...' : 'Check Password'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              {result.status === 'SAFE' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : result.status === 'PWNED' ? (
                <XCircle className="h-5 w-5 text-red-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              <CardTitle>
                {result.status === 'SAFE' ? 'Password is Safe' : 
                 result.status === 'PWNED' ? 'Password Compromised' : 
                 'Error Checking'}
              </CardTitle>
            </div>
            <CardDescription>
              {result.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result.status === 'PWNED' && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Password Found in Breaches!</AlertTitle>
                  <AlertDescription>
                    This password has been exposed {result.count} times in data breaches.
                    You should immediately change this password on all accounts where it's used.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Use a unique password for each account</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Enable two-factor authentication</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Consider using a password manager</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button variant="destructive" className="w-full">
                        Generate New Password
                      </Button>
                      <Button variant="outline" className="w-full">
                        Update All Accounts
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {result.status === 'SAFE' && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Password is Secure!</AlertTitle>
                <AlertDescription>
                  Your password was not found in any known data breaches. Remember to keep it secure and never share it.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Password Security Tips</CardTitle>
          <CardDescription>
            Best practices for creating strong passwords
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="font-semibold">Do's</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Use at least 12 characters</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Include uppercase, lowercase, numbers, and symbols</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Use passphrases for easier memorization</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Use a password manager</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold">Don'ts</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Don't reuse passwords across sites</span>
                </div>
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Don't use personal information</span>
                </div>
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Don't use common words or patterns</span>
                </div>
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Don't share your passwords</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}