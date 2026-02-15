import { GitBranch, Zap, BookOpen } from "lucide-react";

const steps = [
  {
    number: "1",
    title: "Connect",
    description: "Link your GitHub repo or paste any public repository URL. You can also upload files directly.",
    icon: GitBranch,
    color: "bg-secondary",
  },
  {
    number: "2",
    title: "Analyze",
    description: "AI breaks down your entire codebase — tech stack, architecture, code quality, and key files.",
    icon: Zap,
    color: "bg-accent-yellow",
  },
  {
    number: "3",
    title: "Learn",
    description: "Get personalized learning paths, tutorials, and hands-on exercises built from your own code.",
    icon: BookOpen,
    color: "bg-accent-green",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 bg-surface border-y-4 border-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-14">
          How It Works
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className={`relative ${step.color} border-3 border-foreground rounded-[4px] shadow-[5px_5px_0px_0px_#1A1A1A] p-6 pt-12 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all`}
            >
              {/* Number badge */}
              <div className="absolute -top-4 -left-2 w-10 h-10 bg-foreground text-surface flex items-center justify-center text-lg font-bold border-3 border-foreground rounded-[4px] shadow-[3px_3px_0px_0px_#1A1A1A]">
                {step.number}
              </div>

              {/* Icon */}
              <div className="mb-4">
                <step.icon size={32} strokeWidth={2.5} />
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold mb-2">{step.title}</h3>

              {/* Description */}
              <p className="font-medium text-foreground/80 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
