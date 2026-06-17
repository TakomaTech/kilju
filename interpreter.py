from __future__ import annotations

import importlib.util
import datetime
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from parser import (
    Program,
    Import,
    FormatStmt,
    VarDecl,
    Assign,
    FncDef,
    IfStmt,
    WhileStmt,
    LoopStmt,
    IntoStmt,
    Expr,
    Number,
    String,
    Identifier,
    BinaryOp,
    Call,
    NullLiteral,
)


@dataclass
class FunctionValue:
    params: list[str]
    body: list[Any]
    env: Any


class Environment:
    def __init__(self, parent: Optional[Environment] = None):
        self.store: dict[str, Any] = {}
        self.mutable: dict[str, bool] = {}
        self.parent = parent

    def declare(self, name: str, value: Any, mutable: bool = False) -> None:
        self.store[name] = value
        self.mutable[name] = mutable

    def lookup(self, name: str) -> Any:
        if name in self.store:
            return self.store[name]
        if self.parent:
            return self.parent.lookup(name)
        raise NameError(name)

    def assign(self, name: str, value: Any) -> None:
        if name in self.store:
            if not self.mutable.get(name, False):
                raise NameError(name)
            self.store[name] = value
            return
        if self.parent:
            self.parent.assign(name, value)
            return
        raise NameError(name)


class Interpreter:
    def __init__(self):
        self.global_env = Environment()
        self.current_env = self.global_env
        self.last_value: Any = None
        self.global_env.declare(
            "localtime",
            {
                "getComputerDate": lambda: datetime.datetime.now(),
            },
            mutable=False,
        )

    def execute(self, program: Program) -> None:
        for stmt in program.body:
            self.eval_statement(stmt)

    def eval_statement(self, node: Any) -> Any:
        if isinstance(node, Expr):
            self.last_value = self.eval_expr(node)
            return self.last_value
        if isinstance(node, Import):
            module = self.import_module(node.module)
            self.current_env.declare(node.module, module, mutable=False)
            return None
        if isinstance(node, FormatStmt):
            values = [self.eval_expr(arg) for arg in node.args]
            print(" ".join(str(v) for v in values))
            return None
        if isinstance(node, VarDecl):
            value = self.eval_expr(node.value) if node.value is not None else None
            self.current_env.declare(node.name, value, mutable=node.mutable)
            return None
        if isinstance(node, Assign):
            value = self.eval_expr(node.value)
            self.current_env.assign(node.target, value)
            return value
        if isinstance(node, FncDef):
            value = FunctionValue(node.params, node.body, self.current_env)
            self.current_env.declare(node.name, value, mutable=False)
            return None
        if isinstance(node, IfStmt):
            cond = self.eval_expr(node.cond)
            if self.is_truthy(cond):
                self.execute_block(node.then_block)
            elif node.else_block is not None:
                self.execute_block(node.else_block)
            return None
        if isinstance(node, WhileStmt):
            while self.is_truthy(self.eval_expr(node.cond)):
                self.execute_block(node.body)
            return None
        if isinstance(node, LoopStmt):
            while True:
                self.execute_block(node.body)
        if isinstance(node, IntoStmt):
            if isinstance(node.value, Identifier) and node.value.name == "__LAST__":
                value = self.last_value
            else:
                value = self.eval_expr(node.value)
            self.current_env.assign(node.target, value)
            return value
        return None

    def execute_block(self, body: list[Any]) -> None:
        parent = self.current_env
        self.current_env = Environment(parent=parent)
        for stmt in body:
            self.eval_statement(stmt)
        self.current_env = parent

    def eval_expr(self, node: Expr) -> Any:
        if isinstance(node, Number):
            if "." in node.value:
                return float(node.value)
            return int(node.value)
        if isinstance(node, String):
            return node.value
        if isinstance(node, NullLiteral):
            return None
        if isinstance(node, Identifier):
            return self.current_env.lookup(node.name)
        if isinstance(node, BinaryOp):
            left = self.eval_expr(node.left)
            if node.op == ">":
                return self.eval_pipeline(left, node.right)
            right = self.eval_expr(node.right)
            if node.op == "+":
                return left + right
            if node.op == "-":
                return left - right
            if node.op == "*":
                return left * right
            if node.op == "/":
                return left / right
            if node.op == "%":
                return left % right
            if node.op == "==":
                return left == right
            if node.op == "!=":
                return left != right
            if node.op == "<":
                return left < right
            if node.op == ">":
                return left > right
            if node.op == "<=":
                return left <= right
            if node.op == ">=":
                return left >= right
        if isinstance(node, Call):
            callee = self.resolve_callee(node.callee)
            args = [self.eval_expr(arg) for arg in node.args]
            if isinstance(callee, FunctionValue):
                return self.call_function(callee, args)
            return callee(*args)
        raise RuntimeError(type(node).__name__)

    def eval_pipeline(self, left: Any, right: Expr) -> Any:
        if isinstance(right, Call) and isinstance(right.callee, Identifier) and isinstance(left, dict):
            name = right.callee.name
            if name in left and callable(left[name]):
                args = [self.eval_expr(arg) for arg in right.args]
                return left[name](*args)
        if isinstance(right, Call):
            callee = self.resolve_callee(right.callee, module_context=left)
            args = [self.eval_expr(arg) for arg in right.args]
            if isinstance(callee, FunctionValue):
                return self.call_function(callee, [left] + args)
            return callee(left, *args)
        if isinstance(right, Identifier):
            name = right.name
            if isinstance(left, dict) and name in left and callable(left[name]):
                return left[name]()
            callee = self.resolve_callee(right)
            if isinstance(callee, FunctionValue):
                return self.call_function(callee, [left])
            return callee(left)
        return left > self.eval_expr(right)

    def resolve_callee(self, node: Expr, module_context: Any = None) -> Any:
        if isinstance(node, Identifier):
            try:
                return self.current_env.lookup(node.name)
            except NameError:
                if isinstance(module_context, dict) and node.name in module_context:
                    return module_context[node.name]
                raise
        return self.eval_expr(node)

    def call_function(self, function: FunctionValue, args: list[Any]) -> Any:
        env = Environment(parent=function.env)
        for name, value in zip(function.params, args):
            env.declare(name, value, mutable=True)
        old = self.current_env
        self.current_env = env
        self.last_value = None
        for stmt in function.body:
            self.eval_statement(stmt)
        self.current_env = old
        return self.last_value

    def import_module(self, name: str) -> Any:
        path = Path(f"{name}.py")
        if path.exists():
            spec = importlib.util.spec_from_file_location(name, path)
            module = importlib.util.module_from_spec(spec)
            loader = spec.loader
            if loader is None:
                raise RuntimeError(name)
            loader.exec_module(module)
            return {k: getattr(module, k) for k in dir(module) if not k.startswith("_")}
        raise RuntimeError(name)

    def is_truthy(self, value: Any) -> bool:
        return bool(value)
