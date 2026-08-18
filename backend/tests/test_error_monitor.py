from app.services.error_monitor import parse_error_context


def test_parses_python_traceback_location_and_message() -> None:
    traceback = """Traceback (most recent call last):
  File "/code/app/user.py", line 43, in create_user
    import missing_package
ModuleNotFoundError: No module named 'missing_package'
"""

    message, file, line = parse_error_context(traceback)

    assert message == "ModuleNotFoundError: No module named 'missing_package'"
    assert file == "/code/app/user.py"
    assert line == 43


def test_parses_javascript_style_location() -> None:
    message, file, line = parse_error_context("TypeError: broken\n    at src/main.ts:27:4")

    assert message == "TypeError: broken"
    assert file == "src/main.ts"
    assert line == 27
