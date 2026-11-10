"""
Parser registry and factory.
"""
from typing import List, Optional
from core.parsers.base import BaseBankParser
from core.parsers.techcombank import TechcombankParser

REGISTERED_PARSERS: List[BaseBankParser] = [
    TechcombankParser(),
]

def get_parser(pdf_path: str) -> Optional[BaseBankParser]:
    for parser in REGISTERED_PARSERS:
        if parser.can_parse(pdf_path):
            return parser
    # Fallback to Techcombank parser as default
    return TechcombankParser()
