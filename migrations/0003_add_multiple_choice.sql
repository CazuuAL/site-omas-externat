-- Ajouter le type de question et le support des réponses multiples
ALTER TABLE questions ADD COLUMN question_type TEXT DEFAULT 'single' CHECK(question_type IN ('single', 'multiple'));
ALTER TABLE questions ADD COLUMN reponses_correctes TEXT; -- Format JSON array: ["A", "B"] pour réponses multiples
