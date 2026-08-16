package ingestion

import (
	"crypto/ed25519"
	"crypto/rand"
	"fmt"
	"net"
	"strconv"
	"sync"
	"testing"
	"time"

	"golang.org/x/crypto/ssh"
)

// testSSHServer is a minimal in-process SSH server (golang.org/x/crypto/ssh
// server mode) that accepts one fixed username/password and, for every
// "exec" request on a session channel, hands the requested command string
// to onExec along with the channel to write "remote command output" to —
// enough to exercise SSHLoader's real dial/auth/exec/read path without a
// real sshd.
type testSSHServer struct {
	addr     string
	username string
	password string
}

func startTestSSHServer(t *testing.T, onExec func(ch ssh.Channel, cmd string)) testSSHServer {
	t.Helper()

	const username = "testuser"
	const password = "testpass"

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generating host key: %v", err)
	}
	_ = pub
	signer, err := ssh.NewSignerFromSigner(priv)
	if err != nil {
		t.Fatalf("building signer: %v", err)
	}

	config := &ssh.ServerConfig{
		PasswordCallback: func(conn ssh.ConnMetadata, pass []byte) (*ssh.Permissions, error) {
			if conn.User() == username && string(pass) == password {
				return nil, nil
			}
			return nil, fmt.Errorf("denied")
		},
	}
	config.AddHostKey(signer)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() { _ = ln.Close() })

	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go handleTestSSHConn(t, conn, config, onExec)
		}
	}()

	return testSSHServer{addr: ln.Addr().String(), username: username, password: password}
}

func handleTestSSHConn(t *testing.T, conn net.Conn, config *ssh.ServerConfig, onExec func(ssh.Channel, string)) {
	sshConn, chans, reqs, err := ssh.NewServerConn(conn, config)
	if err != nil {
		return
	}
	defer sshConn.Close()
	go ssh.DiscardRequests(reqs)

	for newCh := range chans {
		if newCh.ChannelType() != "session" {
			_ = newCh.Reject(ssh.UnknownChannelType, "unsupported channel type")
			continue
		}
		channel, requests, err := newCh.Accept()
		if err != nil {
			continue
		}
		go func() {
			defer channel.Close()
			for req := range requests {
				switch req.Type {
				case "exec":
					var payload struct{ Command string }
					if err := ssh.Unmarshal(req.Payload, &payload); err != nil {
						_ = req.Reply(false, nil)
						continue
					}
					_ = req.Reply(true, nil)
					onExec(channel, payload.Command)
				default:
					if req.WantReply {
						_ = req.Reply(false, nil)
					}
				}
			}
		}()
	}
}

// TestSSHLoader_TailsRemoteCommandOutput verifies SSHLoader dials, runs
// `tail -n 0 -f <quoted path>`, and pushes every line of the (fake) remote
// command's stdout into its SharedSource, where subscribers receive it —
// the same fan-out path a local FileTailer uses.
func TestSSHLoader_TailsRemoteCommandOutput(t *testing.T) {
	var gotCmd string
	var cmdMu sync.Mutex

	srv := startTestSSHServer(t, func(ch ssh.Channel, cmd string) {
		cmdMu.Lock()
		gotCmd = cmd
		cmdMu.Unlock()

		fmt.Fprint(ch, "remote line one\n")
		fmt.Fprint(ch, "remote line two\n")
		// Deliberately leave the channel open — SSHLoader's tail loop keeps
		// reading until Stop() force-closes the connection, same as a real
		// `tail -f` that never exits on its own.
	})

	host, portStr, err := net.SplitHostPort(srv.addr)
	if err != nil {
		t.Fatalf("SplitHostPort: %v", err)
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		t.Fatalf("Atoi(%q): %v", portStr, err)
	}

	store := newTestLogStore(t)
	mgr := NewSharedSourceManager(store)

	var mu sync.Mutex
	var received []string
	shared := mgr.GetSource("ssh-src-1", "") // pre-subscribe before Start so no lines are missed
	subID := shared.Subscribe(func(line string, lineID int64) {
		mu.Lock()
		received = append(received, line)
		mu.Unlock()
	})
	defer shared.Unsubscribe(subID)

	loader := NewSSHLoader(host, port, srv.username, srv.password, "/var/log/app.log", "ssh-src-1", mgr)
	loader.Start()
	defer loader.Stop()

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		done := len(received) >= 2
		mu.Unlock()
		if done {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}

	mu.Lock()
	got := append([]string(nil), received...)
	mu.Unlock()

	if len(got) != 2 || got[0] != "remote line one" || got[1] != "remote line two" {
		t.Fatalf("received = %v, want [remote line one, remote line two]", got)
	}

	cmdMu.Lock()
	cmd := gotCmd
	cmdMu.Unlock()
	wantCmd := "tail -n 0 -f /var/log/app.log"
	if cmd != wantCmd {
		t.Errorf("remote command = %q, want %q", cmd, wantCmd)
	}
}

// TestSSHLoader_StopUnblocksReadAndJoins verifies Stop() force-closes the
// connection to unblock the tail loop's read and returns promptly rather
// than hanging, even though the fake `tail -f` never closes its own
// channel.
func TestSSHLoader_StopUnblocksReadAndJoins(t *testing.T) {
	srv := startTestSSHServer(t, func(ch ssh.Channel, cmd string) {
		fmt.Fprint(ch, "one line\n")
		// never close/exit — simulates tail -f running forever
	})

	host, portStr, _ := net.SplitHostPort(srv.addr)
	port, _ := strconv.Atoi(portStr)

	mgr := NewSharedSourceManager(newTestLogStore(t))
	loader := NewSSHLoader(host, port, srv.username, srv.password, "/var/log/app.log", "ssh-src-2", mgr)
	loader.Start()

	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) && !loader.Running() {
		time.Sleep(10 * time.Millisecond)
	}
	if !loader.Running() {
		t.Fatal("loader never reported Running() after Start")
	}

	stopped := make(chan struct{})
	go func() {
		loader.Stop()
		close(stopped)
	}()

	select {
	case <-stopped:
	case <-time.After(3 * time.Second):
		t.Fatal("Stop() did not return within 3s")
	}

	if loader.Running() {
		t.Error("loader still reports Running() after Stop()")
	}
}

// TestShellQuote ports shlex.quote's contract for the paths this loader
// actually needs to embed in a shell command.
func TestShellQuote(t *testing.T) {
	cases := []struct{ in, want string }{
		{"", "''"},
		{"/var/log/app.log", "/var/log/app.log"},
		{"simple-name_1.log", "simple-name_1.log"},
		{"/var/log/my app.log", "'/var/log/my app.log'"},
		{"it's a path", `'it'"'"'s a path'`},
	}
	for _, tc := range cases {
		if got := shellQuote(tc.in); got != tc.want {
			t.Errorf("shellQuote(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
