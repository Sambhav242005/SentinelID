'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { breachApi } from '@/lib/api';
import { BreachReport } from '@/lib/types';
import { toast } from 'sonner';

export default function BreachesPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BreachReport | null>(null);

  const handleCheckBreach = async () => {
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    setIsLoading(true);
    try {
      const breachReport = await breachApi.checkLeak(email);
      setResult(breachReport);
      
      if (breachReport.status === 'COMPROMISED') {
        toast.error(`Email found in ${breachReport.breach_count} breaches!`);
      } else if (breachReport.status === 'SAFE') {
        toast.success('Email is safe - no breaches found');
      }
    } catch (error) {
      toast.error('Failed to check email breach status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Breach Detection</h1>
        <p className="text-muted-foreground">
          Check if your email has been compromised in data breaches
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Check Email Breach Status</CardTitle>
          <CardDescription>
            Enter an email address to check if it has been involved in any known data breaches
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <div className="flex-1">
              <Label htmlFor="email" className="sr-only">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCheckBreach()}
              />
            </div>
            <Button onClick={handleCheckBreach} disabled={isLoading}>
              {isLoading ? 'Checking...' : 'Check Breach'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              {result.status === 'SAFE' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : result.status === 'COMPROMISED' ? (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              ) : (
                <Shield className="h-5 w-5 text-yellow-500" />
              )}
              <CardTitle>
                {result.status === 'SAFE' ? 'Email is Safe' : 
                 result.status === 'COMPROMISED' ? 'Email Compromised' : 
                 'Error Checking'}
              </CardTitle>
            </div>
            <CardDescription>
              {result.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result.status === 'COMPROMISED' && (
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Immediate Action Required</AlertTitle>
                  <AlertDescription>
                    This email has been found in {result.breach_count} data breaches.
                    {result.action === 'REPLACE_PASSWORD' && ' You should change your password immediately.'}
                  </AlertDescription>
                </Alert>

                {result.breaches && result.breaches.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Known Breaches:</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.breaches.map((breach, index) => (
                        <Badge key={index} variant="destructive">
                          {breach}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex space-x-2">
                  <Button variant="destructive">
                    Change Password
                  </Button>
                  <Button variant="outline">
                    View Details
                  </Button>
                </div>
              </div>
            )}

            {result.status === 'SAFE' && (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Good News!</AlertTitle>
                  <AlertDescription>
                    Your email was not found in any known data breaches. Continue practicing good security habits.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Breach Checks</CardTitle>
          <CardDescription>
            History of recent email breach checks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No recent checks. Check an email above to see results here.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}