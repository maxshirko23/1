"""
Text Analyzer for Instagram Story Generator.

Extracts key words and phrases from article text to highlight
with underline effects on the story image.

Uses a heuristic approach (no external NLP dependencies):
  1. TF-based scoring — frequent meaningful words rank higher
  2. Positional boost — words in first/last sentences score more
  3. Length filter — very short words (≤2 chars) are skipped
  4. Phrase detection — adjacent high-scoring words merge into phrases
"""

from __future__ import annotations

import re
import string
from collections import Counter
from dataclasses import dataclass


# Common stop words (Russian + English) to exclude from key word extraction
STOP_WORDS_RU = {
    "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а",
    "то", "все", "она", "так", "его", "но", "да", "ты", "к", "у", "же",
    "вы", "за", "бы", "по", "только", "её", "ее", "мне", "было", "вот",
    "от", "меня", "ещё", "еще", "нет", "о", "из", "ему", "теперь",
    "когда", "даже", "ну", "вдруг", "ли", "если", "уже", "или", "ни",
    "быть", "был", "него", "до", "вас", "нибудь", "опять", "уж", "вам",
    "ведь", "там", "потом", "себя", "ничего", "ей", "может", "они",
    "тут", "где", "есть", "надо", "ней", "для", "мы", "тебя", "их",
    "чем", "была", "сам", "чтоб", "без", "будто", "чего", "раз",
    "тоже", "себе", "под", "будет", "ж", "тогда", "кто", "этот",
    "того", "потому", "этого", "какой", "совсем", "ним", "здесь",
    "этом", "один", "почти", "мой", "тем", "чтобы", "нее", "сейчас",
    "были", "куда", "зачем", "всех", "никогда", "можно", "при",
    "наконец", "два", "об", "другой", "хоть", "после", "над", "больше",
    "тот", "через", "эти", "нас", "про", "них", "какая", "много",
    "разве", "три", "эту", "моя", "впрочем", "хорошо", "свою",
    "этой", "перед", "иногда", "лучше", "чуть", "том", "нельзя",
    "такой", "им", "более", "всего", "это", "также", "которые",
    "который", "которая", "которое", "которых", "которой", "которому",
    "при", "между", "очень", "все", "всё",
}

STOP_WORDS_EN = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "was", "are", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "must", "shall", "can", "need",
    "dare", "ought", "used", "it", "its", "he", "she", "they", "them",
    "his", "her", "their", "my", "your", "our", "this", "that", "these",
    "those", "i", "me", "we", "you", "him", "who", "whom", "which",
    "what", "where", "when", "how", "why", "if", "then", "than", "so",
    "no", "not", "only", "very", "just", "also", "about", "up", "out",
    "into", "over", "after", "before", "between", "under", "above",
    "such", "each", "every", "all", "both", "few", "more", "most",
    "other", "some", "any", "many", "much", "own", "same", "too",
    "as", "while", "because", "through", "during", "still",
}

STOP_WORDS = STOP_WORDS_RU | STOP_WORDS_EN


@dataclass
class KeyPhrase:
    """A key phrase extracted from text, with its importance score."""
    text: str
    score: float
    # Original words that form this phrase
    words: list[str]


class TextAnalyzer:
    """
    Analyzes text to extract key words/phrases for highlighting.

    Parameters
    ----------
    max_keywords : int
        Maximum number of key phrases to return.
    min_word_length : int
        Minimum character length for a word to be considered.
    custom_stop_words : set[str] | None
        Additional stop words to exclude.
    """

    def __init__(
        self,
        max_keywords: int = 5,
        min_word_length: int = 3,
        custom_stop_words: set[str] | None = None,
    ):
        self.max_keywords = max_keywords
        self.min_word_length = min_word_length
        self.stop_words = STOP_WORDS.copy()
        if custom_stop_words:
            self.stop_words |= {w.lower() for w in custom_stop_words}

    def analyze(self, text: str) -> list[KeyPhrase]:
        """
        Extract key phrases from the given text.

        Returns a list of KeyPhrase objects sorted by score (highest first),
        limited to `max_keywords` items.
        """
        if not text or not text.strip():
            return []

        sentences = self._split_sentences(text)
        words_by_sentence = [self._tokenize(s) for s in sentences]

        # Score individual words
        word_scores = self._score_words(words_by_sentence)

        if not word_scores:
            return []

        # Build phrases from adjacent high-scoring words
        phrases = self._build_phrases(words_by_sentence, word_scores)

        # Sort by score descending, take top N
        phrases.sort(key=lambda p: p.score, reverse=True)
        return phrases[: self.max_keywords]

    def extract_highlight_words(self, text: str) -> list[str]:
        """
        Convenience method: returns just the phrase strings to highlight.

        This is the primary method used by the renderer.
        """
        phrases = self.analyze(text)
        return [p.text for p in phrases]

    def _split_sentences(self, text: str) -> list[str]:
        """Split text into sentences."""
        parts = re.split(r"[.!?…]+\s*", text)
        return [s.strip() for s in parts if s.strip()]

    def _tokenize(self, sentence: str) -> list[str]:
        """Tokenize a sentence into words, preserving order."""
        # Remove punctuation but keep hyphens inside words
        cleaned = re.sub(r"[^\w\s-]", "", sentence)
        return cleaned.split()

    def _score_words(
        self, words_by_sentence: list[list[str]]
    ) -> dict[str, float]:
        """
        Score each unique word based on:
          - Term frequency across all sentences
          - Positional bonus (first/last sentence)
          - Word length bonus
        """
        all_words_lower = []
        for words in words_by_sentence:
            all_words_lower.extend(w.lower() for w in words)

        # Filter out stop words and short words
        meaningful = [
            w for w in all_words_lower
            if w not in self.stop_words and len(w) >= self.min_word_length
        ]

        if not meaningful:
            return {}

        freq = Counter(meaningful)
        max_freq = max(freq.values())

        scores: dict[str, float] = {}
        for word, count in freq.items():
            # Base TF score normalized to [0, 1]
            tf_score = count / max_freq
            # Length bonus: longer words tend to be more meaningful
            length_bonus = min(len(word) / 12, 0.3)
            scores[word] = tf_score + length_bonus

        # Positional boost: words in first sentence
        if words_by_sentence:
            for w in words_by_sentence[0]:
                wl = w.lower()
                if wl in scores:
                    scores[wl] *= 1.3

            # Words in last sentence
            if len(words_by_sentence) > 1:
                for w in words_by_sentence[-1]:
                    wl = w.lower()
                    if wl in scores:
                        scores[wl] *= 1.15

        return scores

    def _build_phrases(
        self,
        words_by_sentence: list[list[str]],
        word_scores: dict[str, float],
    ) -> list[KeyPhrase]:
        """
        Build phrases by merging adjacent high-scoring words.
        Also keeps standalone high-scoring words.
        """
        if not word_scores:
            return []

        # Threshold: words with score above median are "high-scoring"
        sorted_scores = sorted(word_scores.values(), reverse=True)
        threshold = sorted_scores[len(sorted_scores) // 3] if len(sorted_scores) > 2 else 0

        phrases: list[KeyPhrase] = []
        seen_words: set[str] = set()

        for words in words_by_sentence:
            i = 0
            while i < len(words):
                w_lower = words[i].lower()
                score = word_scores.get(w_lower, 0)

                if score >= threshold and w_lower not in seen_words:
                    # Start building a phrase
                    phrase_words = [words[i]]
                    phrase_score = score
                    seen_words.add(w_lower)
                    j = i + 1

                    # Extend phrase with adjacent high-scoring words
                    while j < len(words):
                        next_lower = words[j].lower()
                        next_score = word_scores.get(next_lower, 0)

                        if next_score >= threshold and next_lower not in seen_words:
                            phrase_words.append(words[j])
                            phrase_score += next_score
                            seen_words.add(next_lower)
                            j += 1
                        else:
                            break

                    # Average the score for multi-word phrases
                    avg_score = phrase_score / len(phrase_words)
                    # Bonus for multi-word phrases (they look better highlighted)
                    if len(phrase_words) > 1:
                        avg_score *= 1.2

                    phrases.append(KeyPhrase(
                        text=" ".join(phrase_words),
                        score=avg_score,
                        words=phrase_words,
                    ))
                    i = j
                else:
                    i += 1

        return phrases
