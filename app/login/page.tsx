"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { signInWithGoogle } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { LayoutTemplate, Chrome } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      router.push("/projects");
    }
  }, [user, loading, router]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      toast.success("Successfully signed in!");
      router.push("/projects");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 p-6">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-gray-100 dark:border-zinc-800 shadow-xl text-center">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600">
          <LayoutTemplate className="w-8 h-8" />
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
        <p className="text-gray-500 mb-8">Sign in to sync your Social Media Studio projects to the cloud.</p>
        
        <Button 
          size="lg" 
          className="w-full h-14 text-base" 
          onClick={handleGoogleSignIn}
          disabled={isSigningIn}
        >
          <Chrome className="w-5 h-5 mr-3" />
          {isSigningIn ? "Signing in..." : "Continue with Google"}
        </Button>
        
        <p className="mt-6 text-xs text-gray-400">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
