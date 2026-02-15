"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ExercisesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/results");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin" size={32} />
    </div>
  );
}
