"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowRight, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { AnalysisResult } from "@/types/analysis";
import type { QuizQuestion, AssessmentResult } from "@/types/assessment";
import { SKILL_LEVELS } from "@/lib/constants";

export default function AssessPage() {
  const router = useRouter();
  const { value: analysisData, isLoaded } = useLocalStorage<AnalysisResult | null>("analysisData", null);
  const { setValue: setAssessmentData } = useLocalStorage<AssessmentResult | null>("assessmentData", null);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: string; selectedAnswer: number }[]>([]);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  useEffect(() => {
    if (isLoaded && !analysisData) {
      router.push("/connect");
      return;
    }

    if (isLoaded && analysisData) {
      loadQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, analysisData]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const techStack = [
        ...(analysisData?.techStack.languages || []),
        ...(analysisData?.techStack.frameworks || []),
      ];

      const res = await fetch("/api/assess/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ techStack }),
      });

      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions);
      }
    } catch (err) {
      console.error("Failed to load questions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = () => {
    if (selectedAnswer === null) return;

    const newAnswers = [
      ...answers,
      { questionId: questions[currentQ].id, selectedAnswer },
    ];
    setAnswers(newAnswers);
    setSelectedAnswer(null);

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      submitAssessment(newAnswers);
    }
  };

  const submitAssessment = async (finalAnswers: typeof answers) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/assess/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions, answers: finalAnswers }),
      });

      if (res.ok) {
        const data: AssessmentResult = await res.json();
        setResult(data);
        setAssessmentData(data);
      }
    } catch (err) {
      console.error("Failed to submit:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={32} className="animate-spin" />
        <p className="font-bold">Generating your skill assessment...</p>
      </div>
    );
  }

  // Results view
  if (result) {
    const level = SKILL_LEVELS[result.skillLevel];
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Assessment Complete!</h1>
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-surface border-3 border-foreground rounded-[4px] shadow-[5px_5px_0px_0px_#1A1A1A]">
            <span className="text-2xl">{level.emoji}</span>
            <span className="text-2xl font-bold">{level.label}</span>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <p className="text-5xl font-bold mb-1">{result.score}%</p>
              <p className="text-muted font-medium">
                {result.answers.filter((a) => a.isCorrect).length} of {result.questions.length} correct
              </p>
            </div>
            <Progress value={result.score} color={result.score >= 70 ? "bg-accent-green" : result.score >= 40 ? "bg-accent-yellow" : "bg-primary"} />
          </CardContent>
        </Card>

        {/* Topic Breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Topic Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.topicBreakdown.map((topic) => (
                <div key={topic.topic} className="flex items-center justify-between">
                  <span className="font-bold text-sm">{topic.topic}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{topic.correct}/{topic.total}</span>
                    {topic.correct === topic.total ? (
                      <CheckCircle2 size={16} className="text-accent-green" />
                    ) : (
                      <XCircle size={16} className="text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Review Answers */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Review Answers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {result.questions.map((q, i) => {
                const answer = result.answers[i];
                return (
                  <div key={q.id} className={`p-3 rounded-[4px] border-2 ${answer?.isCorrect ? "border-accent-green/50 bg-accent-green/5" : "border-primary/50 bg-primary/5"}`}>
                    <p className="font-bold text-sm mb-1">{i + 1}. {q.question}</p>
                    <p className="text-xs text-muted mb-1">
                      Your answer: <span className="font-bold">{q.options[answer?.selectedAnswer]}</span>
                      {!answer?.isCorrect && <> — Correct: <span className="font-bold text-accent-green">{q.options[q.correctAnswer]}</span></>}
                    </p>
                    <p className="text-xs font-medium text-muted">{q.explanation}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/learn">
            <Button size="lg" className="gap-2">
              Start Learning <ArrowRight size={18} />
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={() => { setResult(null); setAnswers([]); setCurrentQ(0); loadQuestions(); }}
          >
            <RotateCcw size={16} /> Retake Quiz
          </Button>
        </div>
      </div>
    );
  }

  // Quiz view
  const question = questions[currentQ];
  if (!question) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">Skill Assessment</h1>
          <Badge variant="default">
            {currentQ + 1} / {questions.length}
          </Badge>
        </div>
        <Progress value={((currentQ) / questions.length) * 100} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={question.difficulty === "beginner" ? "success" : question.difficulty === "intermediate" ? "warning" : "danger"}>
              {question.difficulty}
            </Badge>
            <Badge variant="default">{question.topic}</Badge>
          </div>
          <CardTitle className="text-lg leading-snug">{question.question}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 mb-6">
            {question.options.map((option, i) => (
              <button
                key={i}
                onClick={() => setSelectedAnswer(i)}
                className={`w-full text-left p-4 border-3 rounded-[4px] font-medium transition-all ${
                  selectedAnswer === i
                    ? "border-primary bg-primary/10 shadow-[3px_3px_0px_0px_#FF6B6B]"
                    : "border-foreground/30 hover:border-foreground hover:shadow-[3px_3px_0px_0px_#1A1A1A]"
                }`}
              >
                <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                {option}
              </button>
            ))}
          </div>

          <Button
            onClick={handleAnswer}
            disabled={selectedAnswer === null || submitting}
            className="w-full gap-2"
            size="lg"
          >
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : currentQ < questions.length - 1 ? (
              <>Next Question <ArrowRight size={18} /></>
            ) : (
              <>Submit Assessment <CheckCircle2 size={18} /></>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
