from unittest.mock import MagicMock, patch

import pytest
from ssh_loader import SSHLoader


@pytest.fixture
def mock_parser():
    return MagicMock()


@pytest.fixture
def mock_db():
    return MagicMock()


def test_ssh_loader_initialization(mock_parser, mock_db):
    loader = SSHLoader(
        host="localhost",
        port=22,
        username="user",
        password="password",
        filepath="/var/log/syslog",
        workspace_id="test_ws",
        parser=mock_parser,
        db=mock_db,
        source_id="test_src",
    )
    assert loader.host == "localhost"
    assert loader.port == 22
    assert loader.username == "user"
    assert loader.password == "password"
    # FileTailer normalizes the path, so just check it ends with syslog
    assert str(loader.filepath).endswith("syslog")
    assert loader.workspace_id == "test_ws"
    assert loader.source_id == "test_src"


@patch("paramiko.SSHClient")
def test_ssh_loader_tail_success(mock_ssh_client_cls, mock_parser, mock_db):
    mock_ssh_client = MagicMock()
    mock_ssh_client_cls.return_value = mock_ssh_client

    mock_transport = MagicMock()
    mock_ssh_client.get_transport.return_value = mock_transport

    mock_channel = MagicMock()
    mock_transport.open_session.return_value = mock_channel

    loader = SSHLoader(
        host="localhost",
        port=22,
        username="user",
        password="password",
        filepath="/var/log/syslog",
        workspace_id="test_ws",
        parser=mock_parser,
        db=mock_db,
    )

    # We want to mock recv_ready to be True once, then False, then terminate
    call_count = 0

    def side_effect_recv_ready():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return True
        elif call_count == 2:
            loader.running = False  # Terminate loop
            return False
        return False

    mock_channel.recv_ready.side_effect = side_effect_recv_ready
    mock_channel.recv.return_value = b"line1\nline2\n"

    # Mock _process_line to ensure it's called
    loader._process_line = MagicMock()

    loader.running = True
    loader._tail()

    mock_ssh_client.connect.assert_called_once_with("localhost", 22, "user", "password")
    import shlex

    expected_command = f"tail -n 0 -f {shlex.quote(str(loader.filepath))}"
    mock_channel.exec_command.assert_called_once_with(expected_command)
    assert loader._process_line.call_count == 2
    loader._process_line.assert_any_call("line1")
    loader._process_line.assert_any_call("line2")


@patch("paramiko.SSHClient")
def test_ssh_loader_tail_exception(mock_ssh_client_cls, mock_parser, mock_db):
    mock_ssh_client = MagicMock()
    mock_ssh_client_cls.return_value = mock_ssh_client

    # Trigger exception on connect
    mock_ssh_client.connect.side_effect = Exception("Connection failed")

    loader = SSHLoader(
        host="localhost",
        port=22,
        username="user",
        password="password",
        filepath="/var/log/syslog",
        workspace_id="test_ws",
        parser=mock_parser,
        db=mock_db,
    )

    loader.running = True
    loader._tail()

    # If exception occurs, running should be set to False
    assert loader.running is False


@patch("paramiko.SSHClient")
def test_ssh_loader_stop(mock_ssh_client_cls, mock_parser, mock_db):
    mock_ssh_client = MagicMock()
    mock_ssh_client_cls.return_value = mock_ssh_client

    loader = SSHLoader(
        host="localhost",
        port=22,
        username="user",
        password="password",
        filepath="/var/log/syslog",
        workspace_id="test_ws",
        parser=mock_parser,
        db=mock_db,
    )

    mock_thread = MagicMock()
    loader.thread = mock_thread

    loader.stop()

    assert loader.running is False
    mock_thread.join.assert_called_once_with(timeout=2)
    mock_ssh_client.close.assert_called_once()
