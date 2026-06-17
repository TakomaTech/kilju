from kilju_parser import parse_source, IntoStmt, BinaryOp, Identifier


def test_into_postfix():
    src = 'count + 1 into count'
    program = parse_source(src)
    stmt = program.body[0]
    assert isinstance(stmt, IntoStmt)
    assert isinstance(stmt.value, BinaryOp)
    assert stmt.target == 'count'


def test_pipe_and_into():
    src = 'localtime > getComputerDate() into date'
    program = parse_source(src)
    stmt = program.body[0]
    assert isinstance(stmt, IntoStmt)
    assert isinstance(stmt.value, BinaryOp)
    assert stmt.target == 'date'
