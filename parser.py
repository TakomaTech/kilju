from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Any

from lexer import lex, TokenKind, Token


@dataclass
class Node:
    pass


@dataclass
class Program(Node):
    body: List[Node]


@dataclass
class Import(Node):
    module: str


@dataclass
class FormatStmt(Node):
    args: List[Node]


@dataclass
class VarDecl(Node):
    name: str
    mutable: bool
    value: Optional[Node]


@dataclass
class Assign(Node):
    target: str
    value: Node


@dataclass
class FncDef(Node):
    name: str
    params: List[str]
    body: List[Node]


@dataclass
class IfStmt(Node):
    cond: Node
    then_block: List[Node]
    else_block: Optional[List[Node]]


@dataclass
class WhileStmt(Node):
    cond: Node
    body: List[Node]


@dataclass
class LoopStmt(Node):
    body: List[Node]


@dataclass
class IntoStmt(Node):
    value: Expr
    target: str


@dataclass
class Expr(Node):
    pass


@dataclass
class Number(Expr):
    value: str


@dataclass
class String(Expr):
    value: str


@dataclass
class Identifier(Expr):
    name: str


@dataclass
class BinaryOp(Expr):
    left: Expr
    op: str
    right: Expr


@dataclass
class Call(Expr):
    callee: Expr
    args: List[Expr]


@dataclass
class NullLiteral(Expr):
    pass


class ParseError(Exception):
    pass


class Parser:
    def __init__(self, tokens: List[Token]):
        self.tokens = tokens
        self.pos = 0

    # --- token helpers
    def peek(self) -> Token:
        return self.tokens[self.pos]

    def advance(self) -> Token:
        tok = self.tokens[self.pos]
        self.pos += 1
        return tok

    def expect(self, kind: TokenKind, value: Optional[str] = None) -> Token:
        tok = self.peek()
        if tok.kind is not kind or (value is not None and tok.value != value):
            raise ParseError(f"Expected {kind} {value!r} but got {tok}")
        return self.advance()

    def skip_newlines(self) -> None:
        while self.peek().kind == TokenKind.NEWLINE:
            self.advance()

    # --- top-level ---
    def parse(self) -> Program:
        body: List[Node] = []
        self.skip_newlines()
        while self.peek().kind != TokenKind.EOF:
            stmt = self.parse_statement()
            # attach indented `into` block to previous expression if present
            if isinstance(stmt, Expr) and self._peek_block_is_simple_into():
                target = self._consume_indented_into_target()
                stmt = IntoStmt(stmt, target)
            body.append(stmt)
            self.skip_newlines()
        return Program(body)

    def parse_statement(self) -> Node:
        tok = self.peek()
        if tok.kind == TokenKind.KEYWORD:
            if tok.value == "into":
                return self.parse_into_statement()
            if tok.value == "import":
                return self.parse_import()
            if tok.value == "format":
                return self.parse_format()
            if tok.value == "fnc":
                return self.parse_fnc()
            if tok.value == "if":
                return self.parse_if()
            if tok.value == "while":
                return self.parse_while()
            if tok.value == "loop":
                return self.parse_loop()

        if tok.kind == TokenKind.PUNCTUATION and tok.value == "~":
            return self.parse_vardecl()

        if tok.kind == TokenKind.IDENTIFIER:
            # parse an expression first (could be a call or binary op)
            expr = self.parse_expression()
            # allow post-expression 'into' to assign result
            if self.peek().kind == TokenKind.KEYWORD and self.peek().value == "into":
                return self.parse_into_after_expr(expr)
            return expr

        raise ParseError(f"Unexpected token at statement: {tok}")

    def parse_import(self) -> Import:
        self.expect(TokenKind.KEYWORD, "import")
        tok = self.expect(TokenKind.STRING)
        return Import(tok.value)

    def parse_format(self) -> FormatStmt:
        self.expect(TokenKind.KEYWORD, "format")
        args: List[Node] = []
        # parse comma separated expressions until newline
        while True:
            args.append(self.parse_expression())
            if self.peek().kind == TokenKind.PUNCTUATION and self.peek().value == ",":
                self.advance()
                continue
            break
        return FormatStmt(args)

    def parse_vardecl(self) -> VarDecl:
        # ~(mut) name = value ~   or without trailing ~
        self.expect(TokenKind.PUNCTUATION, "~")
        self.expect(TokenKind.PUNCTUATION, "(")
        mut_tok = self.expect(TokenKind.KEYWORD)
        mutable = mut_tok.value == "mut"
        self.expect(TokenKind.PUNCTUATION, ")")
        name_tok = self.expect(TokenKind.IDENTIFIER)
        name = name_tok.value
        self.expect(TokenKind.OPERATOR, "=")
        value = self.parse_expression()
        # optional trailing ~
        if self.peek().kind == TokenKind.PUNCTUATION and self.peek().value == "~":
            self.advance()
        return VarDecl(name, mutable, value)

    def parse_into_statement(self) -> IntoStmt:
        # starts with 'into' keyword
        self.expect(TokenKind.KEYWORD, "into")
        # allow either '(name)' or name
        if self.peek().kind == TokenKind.PUNCTUATION and self.peek().value == "(":
            self.advance()
            name = self.expect(TokenKind.IDENTIFIER).value
            self.expect(TokenKind.PUNCTUATION, ")")
        else:
            name = self.expect(TokenKind.IDENTIFIER).value
        # Without a preceding expression we cannot bind value here; represent as IntoStmt with value=None handled later
        # But we'll set value to a placeholder Identifier('__LAST__') to indicate external binding
        return IntoStmt(Identifier("__LAST__"), name)

    def parse_into_after_expr(self, expr: Expr) -> IntoStmt:
        # we've already parsed the expression; now consume 'into' and parse target
        self.expect(TokenKind.KEYWORD, "into")
        if self.peek().kind == TokenKind.PUNCTUATION and self.peek().value == "(":
            self.advance()
            name = self.expect(TokenKind.IDENTIFIER).value
            self.expect(TokenKind.PUNCTUATION, ")")
        else:
            name = self.expect(TokenKind.IDENTIFIER).value
        return IntoStmt(expr, name)

    def parse_assign(self) -> Assign:
        name = self.expect(TokenKind.IDENTIFIER).value
        self.expect(TokenKind.OPERATOR, "=")
        value = self.parse_expression()
        return Assign(name, value)

    def parse_fnc(self) -> FncDef:
        self.expect(TokenKind.KEYWORD, "fnc")
        name = self.expect(TokenKind.IDENTIFIER).value
        # parse params parentheses (simple, allow empty)
        self.expect(TokenKind.PUNCTUATION, "(")
        params: List[str] = []
        if self.peek().kind == TokenKind.IDENTIFIER:
            params.append(self.expect(TokenKind.IDENTIFIER).value)
            while self.peek().kind == TokenKind.PUNCTUATION and self.peek().value == ",":
                self.advance()
                params.append(self.expect(TokenKind.IDENTIFIER).value)
        self.expect(TokenKind.PUNCTUATION, ")")
        # expect start keyword
        self.expect(TokenKind.KEYWORD, "start")
        # body: either indent-based or explicit end fnc
        body = self.parse_block(allow_end_keyword=True, end_keyword_pair=("end", "fnc"))
        return FncDef(name, params, body)

    def parse_if(self) -> IfStmt:
        self.expect(TokenKind.KEYWORD, "if")
        cond = self.parse_expression()
        then_block = self.parse_block()
        else_block = None
        if self.peek().kind == TokenKind.KEYWORD and self.peek().value == "else":
            self.advance()
            else_block = self.parse_block()
        return IfStmt(cond, then_block, else_block)

    def parse_while(self) -> WhileStmt:
        self.expect(TokenKind.KEYWORD, "while")
        cond = self.parse_expression()
        body = self.parse_block()
        return WhileStmt(cond, body)

    def parse_loop(self) -> LoopStmt:
        self.expect(TokenKind.KEYWORD, "loop")
        body = self.parse_block(allow_end_keyword=True, end_keyword_pair=("end", "loop"))
        return LoopStmt(body)

    def parse_block(self, allow_end_keyword: bool = False, end_keyword_pair: Optional[tuple[str, str]] = None) -> List[Node]:
        # either INDENT ... DEDENT or statements until an 'end X' appears or next DEDENT
        stmts: List[Node] = []
        self.skip_newlines()
        if self.peek().kind == TokenKind.INDENT:
            self.advance()
            while self.peek().kind not in (TokenKind.DEDENT, TokenKind.EOF):
                stmts.append(self.parse_statement())
                self.skip_newlines()
            if self.peek().kind == TokenKind.DEDENT:
                self.advance()
            return stmts

        # no indent: allow inline block terminated by explicit end keywords
        if allow_end_keyword and end_keyword_pair:
            end_kw1, end_kw2 = end_keyword_pair
            while not (self.peek().kind == TokenKind.KEYWORD and self.peek().value == end_kw1):
                if self.peek().kind == TokenKind.EOF:
                    raise ParseError("Unterminated block, expected end keyword")
                stmts.append(self.parse_statement())
                self.skip_newlines()
            # consume end X
            self.expect(TokenKind.KEYWORD, end_kw1)
            self.expect(TokenKind.KEYWORD, end_kw2)
            return stmts

        # fallback: parse single-line statements until newline/dedent
        while self.peek().kind not in (TokenKind.DEDENT, TokenKind.EOF, TokenKind.KEYWORD):
            stmts.append(self.parse_statement())
            self.skip_newlines()
            if self.peek().kind == TokenKind.NEWLINE:
                self.advance()
        return stmts

    # --- expressions (simple precedence climbing) ---
    def parse_expression(self, min_precedence: int = 0) -> Expr:
        left = self.parse_primary()

        while True:
            tok = self.peek()
            if tok.kind != TokenKind.OPERATOR:
                break
            prec = self._prec(tok.value)
            if prec < min_precedence:
                break
            op = tok.value
            self.advance()
            right = self.parse_expression(prec + 1)
            # pipeline operator '>' transforms into a call where left becomes first arg
            if op == ">":
                # if right is identifier, treat as call with no args
                if isinstance(right, Identifier):
                    call = Call(right, [])
                else:
                    call = right

                if isinstance(call, Call):
                    callee = call.callee
                    args = [left] + call.args
                else:
                    callee = call
                    args = [left]

                left = Call(callee, args)
            else:
                left = BinaryOp(left, op, right)

        return left

    def _prec(self, op: str) -> int:
        if op in ("*", "/", "%"):
            return 20
        if op in ("+", "-"):
            return 10
        if op in ("==", "!=", "<", ">", "<=", ">="):
            return 5
        if op == ">":
            return 5
        return 0

    def parse_primary(self) -> Expr:
        tok = self.peek()
        if tok.kind == TokenKind.NUMBER:
            self.advance()
            return Number(tok.value)
        if tok.kind == TokenKind.STRING:
            self.advance()
            return String(tok.value)
        if tok.kind == TokenKind.KEYWORD and tok.value == "null":
            self.advance()
            return NullLiteral()
        if tok.kind == TokenKind.IDENTIFIER:
            self.advance()
            node: Expr = Identifier(tok.value)
            # function call
            if self.peek().kind == TokenKind.PUNCTUATION and self.peek().value == "(":
                self.advance()
                args: List[Expr] = []
                if self.peek().kind != TokenKind.PUNCTUATION or self.peek().value != ")":
                    while True:
                        args.append(self.parse_expression())
                        if self.peek().kind == TokenKind.PUNCTUATION and self.peek().value == ",":
                            self.advance()
                            continue
                        break
                self.expect(TokenKind.PUNCTUATION, ")")
                node = Call(node, args)
            return node

        if tok.kind == TokenKind.PUNCTUATION and tok.value == "(":
            self.advance()
            expr = self.parse_expression()
            self.expect(TokenKind.PUNCTUATION, ")")
            return expr

        raise ParseError(f"Unexpected token in expression: {tok}")

    def _peek_block_is_simple_into(self) -> bool:
        # Look ahead to see if next tokens form INDENT -> into statement -> DEDENT
        pos = self.pos
        if pos >= len(self.tokens):
            return False
        if self.tokens[pos].kind != TokenKind.INDENT:
            return False
        p = pos + 1
        while p < len(self.tokens) and self.tokens[p].kind == TokenKind.NEWLINE:
            p += 1
        if p >= len(self.tokens):
            return False
        if self.tokens[p].kind != TokenKind.KEYWORD or self.tokens[p].value != "into":
            return False
        q = p + 1
        if q < len(self.tokens) and self.tokens[q].kind == TokenKind.PUNCTUATION and self.tokens[q].value == "(":
            q += 1
            if q < len(self.tokens) and self.tokens[q].kind == TokenKind.IDENTIFIER:
                q += 1
                if q < len(self.tokens) and self.tokens[q].kind == TokenKind.PUNCTUATION and self.tokens[q].value == ")":
                    return True
                return False
            return False
        if q < len(self.tokens) and self.tokens[q].kind == TokenKind.IDENTIFIER:
            return True
        return False

    def _consume_indented_into_target(self) -> str:
        # assumes the peek check passed; consumes INDENT and the into stmt and DEDENT
        self.expect(TokenKind.INDENT)
        self.skip_newlines()
        self.expect(TokenKind.KEYWORD, "into")
        name = None
        if self.peek().kind == TokenKind.PUNCTUATION and self.peek().value == "(":
            self.advance()
            name = self.expect(TokenKind.IDENTIFIER).value
            self.expect(TokenKind.PUNCTUATION, ")")
        else:
            name = self.expect(TokenKind.IDENTIFIER).value
        # consume until DEDENT
        while self.peek().kind != TokenKind.DEDENT:
            if self.peek().kind == TokenKind.NEWLINE:
                self.advance()
                continue
            break
        if self.peek().kind == TokenKind.DEDENT:
            self.advance()
        return name


def parse_source(source: str) -> Program:
    tokens = lex(source)
    p = Parser(tokens)
    return p.parse()


if __name__ == "__main__":
    import pathlib, sys

    base = pathlib.Path(__file__).parent
    sample = base / "examples" / "test.kj"
    if not sample.exists() and len(sys.argv) > 1:
        sample = pathlib.Path(sys.argv[1])
    src = sample.read_text()
    program = parse_source(src)
    print(program)
