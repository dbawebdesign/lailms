"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Constants = void 0;
exports.Constants = {
    public: {
        Enums: {
            assessment_type: [
                "practice",
                "lesson_quiz",
                "path_exam",
                "final_exam",
                "diagnostic",
                "benchmark",
            ],
            assignment_type: [
                "quiz",
                "homework",
                "project",
                "exam",
                "discussion",
                "lab",
                "assignment",
            ],
            audit_action: ["INSERT", "UPDATE", "DELETE"],
            criterion_type: ["holistic", "analytic", "checklist", "rating_scale"],
            document_status: ["queued", "processing", "completed", "error"],
            grade_status: ["graded", "missing", "late", "excused", "pending"],
            grading_method: [
                "automatic",
                "manual",
                "hybrid",
                "peer_review",
                "ai_assisted",
            ],
            grading_scale_type: [
                "points",
                "percentage",
                "letter_grade",
                "pass_fail",
                "rubric_scale",
            ],
            mastery_level: ["below", "approaching", "proficient", "advanced"],
            question_type: [
                "multiple_choice",
                "true_false",
                "short_answer",
                "long_answer",
                "coding",
            ],
            role: ["super_admin", "admin", "teacher", "student", "parent"],
            user_role: ["student", "teacher", "admin", "super_admin", "parent"],
        },
    },
};
