import {
  Layers,
  LayoutGrid,
  GraduationCap,
  Route,
  PenTool,
  Bug,
} from "lucide-react";

const features = [
  {
    title: "Tech Stack Detection",
    description: "Identifies every language, framework, database, and tool in your project automatically.",
    icon: Layers,
    accent: "border-l-primary",
    iconBg: "bg-primary/10 text-primary",
  },
  {
    title: "Architecture Mapping",
    description: "Understand how your code is organized — from entry points to data flow patterns.",
    icon: LayoutGrid,
    accent: "border-l-secondary",
    iconBg: "bg-secondary/10 text-secondary",
  },
  {
    title: "Skill Assessment",
    description: "Take a quick quiz to find your level. Get content matched to where you are.",
    icon: GraduationCap,
    accent: "border-l-accent-yellow",
    iconBg: "bg-accent-yellow/10 text-accent-yellow",
  },
  {
    title: "Learning Paths",
    description: "Step-by-step tutorials for each tech in your stack, with curated resources.",
    icon: Route,
    accent: "border-l-accent-green",
    iconBg: "bg-accent-green/10 text-accent-green",
  },
  {
    title: "Interactive Exercises",
    description: "Recreate components, explain code snippets, and fill in blanks from your own project.",
    icon: PenTool,
    accent: "border-l-accent-purple",
    iconBg: "bg-accent-purple/10 text-accent-purple",
  },
  {
    title: "Bug Hunting",
    description: "We inject realistic bugs into your code. Can you find and fix them?",
    icon: Bug,
    accent: "border-l-accent-orange",
    iconBg: "bg-accent-orange/10 text-accent-orange",
  },
];

export function Features() {
  return (
    <section className="relative py-24">
      <div className="absolute inset-0 dot-grid opacity-20" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2
            className="text-3xl md:text-4xl font-bold mb-4 animate-fade-in"
            style={{ "--delay": "0ms" } as React.CSSProperties}
          >
            Everything you need to understand your code
          </h2>
          <p
            className="text-muted font-medium max-w-2xl mx-auto text-lg animate-fade-in"
            style={{ "--delay": "100ms" } as React.CSSProperties}
          >
            Go from &quot;AI wrote this&quot; to &quot;I understand every line.&quot;
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`bg-surface border-2 border-foreground/15 ${feature.accent} border-l-[5px] rounded-xl p-6 hover:border-foreground/30 hover:shadow-[4px_4px_0px_0px_#1E293B] transition-all duration-200 cursor-default animate-fade-in`}
              style={{ "--delay": `${200 + index * 80}ms` } as React.CSSProperties}
            >
              <div
                className={`inline-flex items-center justify-center w-12 h-12 ${feature.iconBg} rounded-xl mb-4`}
              >
                <feature.icon size={24} strokeWidth={2} />
              </div>
              <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
              <p className="text-sm font-medium text-muted leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
