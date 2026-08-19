from abc import ABC, abstractmethod

from app.schemas import AIAnalysisContent, AIJournalContent, CommitMessageSuggestions, DevelopmentJournalContext, ErrorAnalysisContext, GitDiffContext


class AIProvider(ABC):
    name: str
    model: str

    @abstractmethod
    async def analyze_error(self, context: ErrorAnalysisContext) -> AIAnalysisContent:
        raise NotImplementedError

    async def generate_journal(self, context: DevelopmentJournalContext) -> AIJournalContent:
        raise NotImplementedError

    async def suggest_commit_messages(self, context: GitDiffContext, language: str) -> CommitMessageSuggestions:
        raise NotImplementedError
