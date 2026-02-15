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
  },
  {
    title: "Architecture Overview",
    description: "Understand how your code is organized — from entry points to data flow.",
    icon: LayoutGrid,
    accent: "border-l-secondary",
  },
  {
    title: "Skill Assessment",
    description: "Take a quick quiz to find your level. Get content matched to where you are.",
    icon: GraduationCap,
    accent: "border-l-accent-yellow",
  },
  {
    title: "Learning Paths",
    description: "Step-by-step tutorials for each tech in your stack, with links to the best resources.",
    icon: Route,
    accent: "border-l-accent-green",
  },
  {
    title: "Interactive Exercises",
    description: "Recreate components and explain code snippets from your own project.",
    icon: PenTool,
    accent: "border-l-accent-purple",
  },
  {
    title: "Bug Hunting",
    description: "We inject realistic bugs into your code. Can you find and fix them?",
    icon: Bug,
    accent: "border-l-accent-orange",
  },
];

export function Features() {
  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Why CodeCocoon?
        </h2>
        <p className="text-center text-muted font-medium max-w-2xl mx-auto mb-14">
          Everything you need to go from &quot;AI wrote this&quot; to &quot;I understand every line.&quot;
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={`bg-surface border-3 border-foreground ${feature.accent} border-l-[6px] rounded-[4px] shadow-[5px_5px_0px_0px_#1A1A1A] p-6 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all`}
            >
              <div className="mb-3">
                <feature.icon size={28} strokeWidth={2.5} />
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
