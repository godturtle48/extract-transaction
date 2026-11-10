"""
Abstract Base Parser for Bank Statements.
"""
from abc import ABC, abstractmethod
from core.models import StatementSummary

class BaseBankParser(ABC):
    @abstractmethod
    def can_parse(self, pdf_path: str) -> bool:
        """Checks if the given PDF belongs to this bank."""
        pass

    @abstractmethod
    def parse(self, pdf_path: str) -> StatementSummary:
        """Parses the PDF and returns a StatementSummary."""
        pass
