// Add question type specific metrics
interface FactualMetrics {
  factualAccuracy: number;
  sourceAccuracy: number;
}

interface ConceptualMetrics {
  conceptCoverage: number;
  relevanceScore: number;
}

interface MultiContextMetrics {
  contextUtilization: number;
  synthesisScore: number;
}

// Update EvaluationResult
export interface EvaluationQuestion {
  id: string;
  question: string;
  expectedAnswer?: string;
  metadata?: {
    sourceFiles?: string[];
    concepts?: string[];
  };
}

export interface EvaluationResult {
  questionId: string;
  question: string;
  systemAnswer: string;
  expectedAnswer?: string;
  references: string[];
  metadata: {
    responseTime: number;
    relevanceScore?: number;
    sourceOverlap?: number;
    conceptCoverage?: number;
  };
}

export interface EvaluationMetrics {
  totalQuestions: number;
  averageResponseTime: number;
  averageRelevanceScore: number;
  coverage: number;
  sourceAccuracy: number;
  conceptAccuracy: number;
}
