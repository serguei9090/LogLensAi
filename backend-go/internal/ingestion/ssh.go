package ingestion

import (
	"bufio"
	"log"
	"net"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
)

// sshConnectTimeout bounds the initial TCP+handshake dial, since this loop
// otherwise has no equivalent to paramiko's implicit socket timeout.
const sshConnectTimeout = 10 * time.Second

// SSHLoader tails a remote file over SSH (`tail -n 0 -f <path>`) and pushes
// observed lines into a SharedSource, so they fan out through the same
// subscriber/broadcast path as a local FileTailer. Ports ssh_loader.py's
// SSHLoader.
type SSHLoader struct {
	Host     string
	Port     int
	Username string
	Password string
	Filepath string
	SourceID string

	manager *SharedSourceManager

	mu      sync.Mutex
	running bool
	stopCh  chan struct{}
	doneCh  chan struct{}
	client  *ssh.Client
}

// NewSSHLoader builds a loader for host:port/filepath, publishing observed
// lines under sourceID via manager.
func NewSSHLoader(host string, port int, username, password, filepath, sourceID string, manager *SharedSourceManager) *SSHLoader {
	return &SSHLoader{
		Host:     host,
		Port:     port,
		Username: username,
		Password: password,
		Filepath: filepath,
		SourceID: sourceID,
		manager:  manager,
	}
}

// Running reports whether the tail loop is currently active.
func (l *SSHLoader) Running() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.running
}

// Start connects and begins tailing in the background. Ports
// SSHLoader.start.
func (l *SSHLoader) Start() {
	l.mu.Lock()
	if l.running {
		l.mu.Unlock()
		return
	}
	l.running = true
	l.stopCh = make(chan struct{})
	l.doneCh = make(chan struct{})
	l.mu.Unlock()

	go l.tailLoop()
}

// Stop signals the tail loop to end, force-closes the SSH connection to
// unblock any in-flight read, and waits (bounded) for the loop to exit.
// Ports SSHLoader.stop.
func (l *SSHLoader) Stop() {
	l.mu.Lock()
	if !l.running {
		l.mu.Unlock()
		return
	}
	l.running = false
	close(l.stopCh)
	client := l.client
	doneCh := l.doneCh
	l.mu.Unlock()

	if client != nil {
		_ = client.Close()
	}

	if doneCh != nil {
		select {
		case <-doneCh:
		case <-time.After(2 * time.Second):
		}
	}
}

// tailLoop connects over SSH, runs `tail -n 0 -f <quoted path>`, and pushes
// every line of stdout into this source's SharedSource until Stop() is
// called or the connection/command ends. Ports SSHLoader._tail_loop.
func (l *SSHLoader) tailLoop() {
	defer func() {
		l.mu.Lock()
		l.running = false
		l.mu.Unlock()
		close(l.doneCh)
	}()

	// SECURITY: this mirrors ssh_loader.py's
	// `paramiko.AutoAddPolicy()` — it accepts ANY remote host key without
	// verification, i.e. no protection against SSH MITM. That is a known,
	// pre-existing security gap inherited from the Python original; it is
	// intentionally not "fixed" here (e.g. via a known_hosts callback),
	// since tightening host-key verification is a behavior change outside
	// this port's scope.
	config := &ssh.ClientConfig{
		User:            l.Username,
		Auth:            []ssh.AuthMethod{ssh.Password(l.Password)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), //nolint:gosec // intentional parity with paramiko.AutoAddPolicy(), see comment above
		Timeout:         sshConnectTimeout,
	}

	addr := net.JoinHostPort(l.Host, strconv.Itoa(l.Port))
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		log.Printf("[SSH] Failed to connect to %s: %v", l.Host, err)
		return
	}
	l.mu.Lock()
	l.client = client
	l.mu.Unlock()
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		log.Printf("[SSH] Failed to open session for %s: %v", l.Host, err)
		return
	}
	defer session.Close()

	stdout, err := session.StdoutPipe()
	if err != nil {
		log.Printf("[SSH] Failed to get stdout pipe for %s: %v", l.Host, err)
		return
	}

	cmd := "tail -n 0 -f " + shellQuote(l.Filepath)
	if err := session.Start(cmd); err != nil {
		log.Printf("[SSH] Failed to start tail command on %s: %v", l.Host, err)
		return
	}

	// SSH loaders have no local file for SharedSource to fsnotify-watch —
	// lines arrive exclusively via PushLine below, matching
	// `self._manager.get_source(self.source_id)` (no filepath) in
	// ssh_loader.py.
	shared := l.manager.GetSource(l.SourceID, "")

	reader := bufio.NewReader(stdout)
	for {
		line, err := reader.ReadString('\n')
		if len(line) > 0 {
			shared.PushLine(strings.TrimSpace(line))
		}
		if err != nil {
			select {
			case <-l.stopCh:
			default:
				log.Printf("[SSH] Tail loop ended for %s: %v", l.Host, err)
			}
			return
		}

		select {
		case <-l.stopCh:
			return
		default:
		}
	}
}

// shellUnsafeChars mirrors Python shlex.quote's `_find_unsafe` pattern:
// anything outside this set forces quoting.
var shellUnsafeChars = regexp.MustCompile(`[^\w@%+=:,./-]`)

// shellQuote POSIX-shell-quotes s, porting Python's shlex.quote (used by
// ssh_loader.py to safely embed the remote path in `tail -n 0 -f <path>`).
func shellQuote(s string) string {
	if s == "" {
		return "''"
	}
	if !shellUnsafeChars.MatchString(s) {
		return s
	}
	return "'" + strings.ReplaceAll(s, "'", `'"'"'`) + "'"
}
