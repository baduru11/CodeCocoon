import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { Philosophy } from "@/components/landing/philosophy";
import { Protocol } from "@/components/landing/protocol";

export default function HomePage() {
  return (
    <div className="bg-background min-h-screen">
      <Hero />
      <Features />
      <Philosophy />
      <Protocol />
    </div>
  );
}
