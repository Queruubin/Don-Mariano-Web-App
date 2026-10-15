"""Ranked product search (PRD FR-12, FR-16).

Matching runs on `normalized_name` (lowercase, accent-free), so it is case- and
accent-insensitive. Results are ranked:

0. the name starts with the query ("papa" -> "Papa criolla");
1. a word of the name starts with the query ("pollo" -> "Pechuga de pollo");
2. every query word appears somewhere in the name ("criolla papa");
3. a close trigram match, so typos still find something ("papya" -> "Papaya").

Within a rank, closer trigram matches come first, then alphabetical order.
"""

from django.contrib.postgres.search import TrigramSimilarity, TrigramWordSimilarity
from django.db.models import Case, IntegerField, Q, QuerySet, Value, When

from apps.common.text import normalize_text

# Minimum pg_trgm word_similarity for a typo match. "papya" vs "papaya" is 0.5;
# unrelated names like "pan tajado" score about 0.33.
TYPO_THRESHOLD = 0.45
# Trigram matching on one or two letters is mostly noise.
TYPO_MIN_LENGTH = 3


def search_products(queryset: QuerySet, query: str) -> QuerySet:
    term = normalize_text(query)
    if not term:
        return queryset

    words = term.split()
    contains_all = Q()
    for word in words:
        contains_all &= Q(normalized_name__contains=word)

    queryset = queryset.annotate(
        match_rank=Case(
            When(normalized_name__startswith=term, then=Value(0)),
            When(normalized_name__contains=f" {term}", then=Value(1)),
            When(contains_all, then=Value(2)),
            default=Value(3),
            output_field=IntegerField(),
        ),
        word_similarity=TrigramWordSimilarity(term, "normalized_name"),
        similarity=TrigramSimilarity("normalized_name", term),
    )

    matches = contains_all
    if len(term) >= TYPO_MIN_LENGTH:
        matches |= Q(word_similarity__gte=TYPO_THRESHOLD)
    return queryset.filter(matches).order_by("match_rank", "-word_similarity", "-similarity", "name")
