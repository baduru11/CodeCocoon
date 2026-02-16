import { GitBranch, Zap, BookOpen } from "lucide-react";

const steps = [
  {
    number: "1",
    title: "Connect",
    description: "Link your GitHub repo or paste any public repository URL. You can also upload files directly.",
    icon: GitBranch,
    color: "bg-secondary/10 text-secondary",
  },
  {
    number: "2",
    title: "Analyze",
    description: "AI breaks down your entire codebase — tech stack, architecture, code quality, and key files.",
    icon: Zap,
    color: "bg-accent-yellow/10 text-accent-yellow",
  },
  {
    number: "3",
    title: "Learn",
    description: "Get personalized learning paths, tutorials, and hands-on exercises built from your own code.",
    icon: BookOpen,
    color: "bg-accent-green/10 text-accent-green",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 bg-surface border-y-2 border-foreground/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            How It Works
          </h2>
          <p className="text-muted font-medium text-lg max-w-xl mx-auto">
            Three simple steps to understand your AI-generated code
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-[2px] bg-foreground/10" />

          {steps.map((step) => (
            <div key={step.number} className="relative text-center">
              {/* Number badge */}
              <div className="mx-auto mb-6 w-14 h-14 bg-foreground text-surface flex items-center justify-center text-xl font-bold border-2 border-foreground rounded-xl shadow-[3px_3px_0px_0px_#1E293B] relative z-10">
                {step.number}
              </div>

              {/* Icon */}
              <div className={`mx-auto mb-4 w-14 h-14 ${step.color} flex items-center justify-center rounded-xl`}>
                <step.icon size={28} strokeWidth={2} />
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold mb-3">{step.title}</h3>

              {/* Description */}
              <p className="font-medium text-muted leading-relaxed max-w-xs mx-auto">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
