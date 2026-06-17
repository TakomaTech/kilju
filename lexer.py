from __future__ import annotations

from dataclasses import dataclass
from enum import Enum, auto
from typing import Iterable, List, Optional


class TokenKind(Enum):
    EOF = auto()
    NEWLINE = auto()
    INDENT = auto()
    DEDENT = auto()
    IDENTIFIER = auto()
    KEYWORD = auto()
    NUMBER = auto()
    STRING = auto()
    OPERATOR = auto()
    PUNCTUATION = auto()


KEYWORDS = {
    "format",
    "import",
    "fnc",
    "start",
    "loop",
    "end",
    "if",
    "else",
    "while",
    "into",
    "null",
    "mut",
}

MULTI_CHAR_OPERATORS = {"==", "!=", "<=", ">=", "->"}
SINGLE_CHAR_OPERATORS = {"+", "-", "*", "/", "%", "=", "<", ">"}
PUNCTUATION_CHARS = {"(", ")", ",", "~"}


@dataclass(frozen=True)
class Token:
    kind: TokenKind
    value: str
    line: int
    column: int

    def __str__(self) -> str:
        return f"{self.kind.name}({self.value!r})@{self.line}:{self.column}"


class LexerError(Exception):
    pass


class Lexer:
    def __init__(self, source: str) -> None:
        self.source = source.replace("\r\n", "\n")
        self.lines = self.source.split("\n")
        self.tokens: List[Token] = []
        self.indent_stack: List[int] = [0]

    def tokenize(self) -> List[Token]:
        for line_no, raw_line in enumerate(self.lines, start=1):
            line = raw_line.rstrip("\n")
            if self._is_blank_or_comment(line):
                continue

            indent = self._count_leading_spaces(line)
            self._emit_indent_tokens(indent, line_no)

            self._scan_line(line, line_no)
            self.tokens.append(Token(TokenKind.NEWLINE, "\n", line_no, len(line) + 1))

        while len(self.indent_stack) > 1:
            self.indent_stack.pop()
            self.tokens.append(Token(TokenKind.DEDENT, "", len(self.lines) + 1, 1))

        self.tokens.append(Token(TokenKind.EOF, "", len(self.lines) + 1, 1))
        return self.tokens

    def _is_blank_or_comment(self, line: str) -> bool:
        stripped = line.lstrip()
        return stripped == "" or stripped.startswith("#")

    def _count_leading_spaces(self, line: str) -> int:
        if line.startswith("\t"):
            raise LexerError("Tabs are not allowed for indentation")
        return len(line) - len(line.lstrip(" "))

    def _emit_indent_tokens(self, indent: int, line_no: int) -> None:
        current_indent = self.indent_stack[-1]
        if indent > current_indent:
            self.indent_stack.append(indent)
            self.tokens.append(Token(TokenKind.INDENT, "", line_no, 1))
        elif indent < current_indent:
            while indent < self.indent_stack[-1]:
                self.indent_stack.pop()
                self.tokens.append(Token(TokenKind.DEDENT, "", line_no, 1))
            if indent != self.indent_stack[-1]:
                raise LexerError(
                    f"Inconsistent indentation on line {line_no}: expected {self.indent_stack[-1]} spaces, got {indent}"
                )

    def _scan_line(self, line: str, line_no: int) -> None:
        index = 0
        length = len(line)

        while index < length:
            char = line[index]
            if char.isspace():
                index += 1
                continue

            if char == '"':
                token, index = self._read_string(line, line_no, index)
                self.tokens.append(token)
                continue

            if char.isdigit():
                token, index = self._read_number(line, line_no, index)
                self.tokens.append(token)
                continue

            if char.isalpha() or char == "_":
                token, index = self._read_identifier_or_keyword(line, line_no, index)
                self.tokens.append(token)
                continue

            if char in SINGLE_CHAR_OPERATORS or char in PUNCTUATION_CHARS:
                token, index = self._read_operator_or_punctuation(line, line_no, index)
                self.tokens.append(token)
                continue

            raise LexerError(f"Unexpected character {char!r} at line {line_no}, column {index + 1}")

    def _read_string(self, line: str, line_no: int, index: int) -> tuple[Token, int]:
        start_column = index + 1
        index += 1
        buffer: List[str] = []
        while index < len(line):
            char = line[index]
            if char == '"':
                index += 1
                return Token(TokenKind.STRING, "".join(buffer), line_no, start_column), index
            if char == "\\":
                index += 1
                if index >= len(line):
                    raise LexerError(f"Unterminated escape sequence on line {line_no}")
                escape = line[index]
                buffer.append(self._escape_char(escape))
            else:
                buffer.append(char)
            index += 1

        raise LexerError(f"Unterminated string literal on line {line_no}, column {start_column}")

    def _escape_char(self, char: str) -> str:
        return {
            '"': '"',
            "\\": "\\",
            "n": "\n",
            "r": "\r",
            "t": "\t",
        }.get(char, char)

    def _read_number(self, line: str, line_no: int, index: int) -> tuple[Token, int]:
        start_column = index + 1
        buffer: List[str] = []
        has_dot = False

        while index < len(line) and (line[index].isdigit() or (line[index] == "." and not has_dot)):
            if line[index] == ".":
                has_dot = True
            buffer.append(line[index])
            index += 1

        return Token(TokenKind.NUMBER, "".join(buffer), line_no, start_column), index

    def _read_identifier_or_keyword(self, line: str, line_no: int, index: int) -> tuple[Token, int]:
        start_column = index + 1
        buffer: List[str] = []

        while index < len(line) and (line[index].isalnum() or line[index] == "_"):
            buffer.append(line[index])
            index += 1

        text = "".join(buffer)
        kind = TokenKind.KEYWORD if text in KEYWORDS else TokenKind.IDENTIFIER
        return Token(kind, text, line_no, start_column), index

    def _read_operator_or_punctuation(self, line: str, line_no: int, index: int) -> tuple[Token, int]:
        start_column = index + 1
        first = line[index]
        second = line[index + 1] if index + 1 < len(line) else ""
        candidate = first + second

        if candidate in MULTI_CHAR_OPERATORS:
            return Token(TokenKind.OPERATOR, candidate, line_no, start_column), index + 2

        if first in SINGLE_CHAR_OPERATORS:
            return Token(TokenKind.OPERATOR, first, line_no, start_column), index + 1

        if first in PUNCTUATION_CHARS:
            return Token(TokenKind.PUNCTUATION, first, line_no, start_column), index + 1

        raise LexerError(f"Unexpected symbol {first!r} at line {line_no}, column {start_column}")


def lex(source: str) -> List[Token]:
    return Lexer(source).tokenize()


if __name__ == "__main__":
    example = '''import "localtime"

~(mut) date = null

localtime > getComputerDate()
	into (date)
format date
'''
    print("Kilju lexer output:\n")
    for token in lex(example):
        print(token)
