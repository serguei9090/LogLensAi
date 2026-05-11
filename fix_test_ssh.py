import re

with open("sidecar/tests/test_ssh.py", encoding="utf-8") as f:
    content = f.read()

# Replace SSHLoader kwargs:
# Remove workspace_id, parser, db
# Add log_store
# Update signature in tests

content = re.sub(
    r'workspace_id="test_ws",\s*parser=mock_parser,\s*db=mock_db,\s*source_id="test_src",',
    r'log_store=mock_db,\n        source_id="test_src",',
    content,
)

content = re.sub(
    r'workspace_id="test_ws",\s*parser=mock_parser,\s*db=mock_db,',
    r'log_store=mock_db,\n        source_id="test_src",',
    content,
)

# test_ssh_loader_tail_success expects loader._process_line which was refactored out.
old_mock_process = """    # Mock _process_line to ensure it's called
    loader._process_line = MagicMock()

    loader.running = True
    loader._tail()

    mock_ssh_client.connect.assert_called_once_with("localhost", 22, "user", "password")
    import shlex

    expected_command = f"tail -n 0 -f {shlex.quote(str(loader.filepath))}"
    mock_channel.exec_command.assert_called_once_with(expected_command)
    assert loader._process_line.call_count == 2
    loader._process_line.assert_any_call("line1")
    loader._process_line.assert_any_call("line2")"""

new_mock_process = """    loader.running = True

    mock_manager = MagicMock()
    mock_shared_src = MagicMock()
    mock_manager.get_source.return_value = mock_shared_src
    loader._manager = mock_manager

    loader._tail_loop()

    mock_ssh_client.connect.assert_called_once_with("localhost", 22, "user", "password")
    import shlex

    expected_command = f"tail -n 0 -f {shlex.quote(str(loader.filepath))}"
    mock_channel.exec_command.assert_called_once_with(expected_command)
    assert mock_shared_src.push_line.call_count == 2
    mock_shared_src.push_line.assert_any_call("line1")
    mock_shared_src.push_line.assert_any_call("line2")"""

content = content.replace(old_mock_process, new_mock_process)

# Update test_ssh_loader_tail_exception which calls loader._tail()
content = content.replace("loader._tail()", "loader._tail_loop()")

# Also fix the assertions in test_ssh_loader_initialization
content = content.replace('assert loader.workspace_id == "test_ws"\n', "")

with open("sidecar/tests/test_ssh.py", "w", encoding="utf-8") as f:
    f.write(content)
